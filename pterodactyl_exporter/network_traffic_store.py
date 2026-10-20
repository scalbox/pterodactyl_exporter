"""Persist per-server network totals across game-server and exporter restarts.

Pterodactyl reports per-boot RX/TX byte counters. On a decrease, the
new reading is treated as traffic since the reset. Values observed
between the last successful poll and a reset cannot be reconstructed.

Version 1 state only stored a combined total. When upgrading to version 2,
preserve that amount as unattributed legacy traffic and track RX/TX separately
from the first poll after migration. Do not invent a historical split.
"""

import json
import math
import os
import tempfile
from pathlib import Path


class NetworkTrafficStore:
    STATE_VERSION = 2

    def __init__(self, path=None):
        self.path = Path(path) if path is not None else None
        self.servers = {}
        if self.path is not None and self.path.exists():
            with self.path.open("r", encoding="utf-8") as handle:
                data = json.load(handle)
            if not isinstance(data, dict) or data.get("version") not in (1, self.STATE_VERSION):
                raise ValueError(f"Unrecognized network traffic state file: {self.path}")
            servers = data.get("servers")
            if not isinstance(servers, dict):
                raise ValueError(f"Invalid network traffic state file: {self.path}")
            version = data["version"]
            for uuid, values in servers.items():
                if not isinstance(uuid, str) or not isinstance(values, dict):
                    raise ValueError(f"Invalid network traffic state file: {self.path}")
                required = ("last_rx", "last_tx", "total")
                if version == self.STATE_VERSION:
                    required += ("total_rx", "total_tx", "legacy_total")
                for field_name in required:
                    value = values.get(field_name)
                    if not isinstance(value, (int, float)) or not math.isfinite(value) or value < 0:
                        raise ValueError(f"Invalid network traffic state file: {self.path}")
                if version == 1:
                    # An old combined total cannot be split into historical RX/TX.
                    self.servers[uuid] = {
                        "last_rx": values["last_rx"],
                        "last_tx": values["last_tx"],
                        "total": values["total"],
                        "total_rx": 0.0,
                        "total_tx": 0.0,
                        "legacy_total": values["total"],
                    }
                else:
                    expected = values["legacy_total"] + values["total_rx"] + values["total_tx"]
                    if not math.isclose(values["total"], expected, rel_tol=1e-10, abs_tol=1e-6):
                        raise ValueError(f"Inconsistent network traffic state file: {self.path}")
                    self.servers[uuid] = {key: values[key] for key in required}

    def update(self, server_uuid, rx_mebibyte, tx_mebibyte):
        key = str(server_uuid).strip().lower()
        if not key:
            raise ValueError("A server UUID is required for persistent network totals")
        rx, tx = float(rx_mebibyte), float(tx_mebibyte)
        if not all(math.isfinite(value) and value >= 0 for value in (rx, tx)):
            raise ValueError(f"Invalid network counter for server {key}")

        previous = self.servers.get(key)
        if previous is None:
            # First observation includes traffic already used during this boot.
            total_rx, total_tx, legacy_total = rx, tx, 0.0
        else:
            # Detect counter resets independently in each direction.
            rx_delta = rx - previous["last_rx"]
            tx_delta = tx - previous["last_tx"]
            total_rx = previous["total_rx"] + (rx_delta if rx_delta >= 0 else rx)
            total_tx = previous["total_tx"] + (tx_delta if tx_delta >= 0 else tx)
            legacy_total = previous["legacy_total"]

        total = legacy_total + total_rx + total_tx
        self.servers[key] = {
            "last_rx": rx,
            "last_tx": tx,
            "total": total,
            "total_rx": total_rx,
            "total_tx": total_tx,
            "legacy_total": legacy_total,
        }
        return total

    def get_direction_totals(self, server_uuid):
        """Return RX/TX accounted since tracking started for this server."""
        key = str(server_uuid).strip().lower()
        values = self.servers[key]
        return values["total_rx"], values["total_tx"]

    def save(self):
        if self.path is None:
            return
        self.path.parent.mkdir(parents=True, exist_ok=True)
        temporary_path = None
        try:
            with tempfile.NamedTemporaryFile(
                mode="w", encoding="utf-8", dir=self.path.parent,
                prefix=f".{self.path.name}.", suffix=".tmp", delete=False
            ) as handle:
                temporary_path = handle.name
                json.dump({"version": self.STATE_VERSION, "servers": self.servers}, handle, sort_keys=True)
                handle.write("\n")
                handle.flush()
                os.fsync(handle.fileno())
            os.replace(temporary_path, self.path)
        finally:
            if temporary_path is not None and os.path.exists(temporary_path):
                os.unlink(temporary_path)
