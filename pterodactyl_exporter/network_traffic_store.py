"""Persist per-server network totals across game-server and exporter restarts.

Pterodactyl reports per-boot RX/TX byte counters. On a decrease, the
new reading is treated as traffic since the reset. Values observed
between the last successful poll and a reset cannot be reconstructed.
"""

import json
import math
import os
import tempfile
from pathlib import Path


class NetworkTrafficStore:
    def __init__(self, path=None):
        self.path = Path(path) if path is not None else None
        self.servers = {}
        if self.path is not None and self.path.exists():
            with self.path.open("r", encoding="utf-8") as handle:
                data = json.load(handle)
            if not isinstance(data, dict) or data.get("version") != 1:
                raise ValueError(f"Unrecognized network traffic state file: {self.path}")
            servers = data.get("servers")
            if not isinstance(servers, dict):
                raise ValueError(f"Invalid network traffic state file: {self.path}")
            for uuid, values in servers.items():
                if not isinstance(uuid, str) or not isinstance(values, dict):
                    raise ValueError(f"Invalid network traffic state file: {self.path}")
                for key in ("last_rx", "last_tx", "total"):
                    value = values.get(key)
                    if not isinstance(value, (int, float)) or not math.isfinite(value) or value < 0:
                        raise ValueError(f"Invalid network traffic state file: {self.path}")
            self.servers = servers

    def update(self, server_uuid, rx_mebibyte, tx_mebibyte):
        key = str(server_uuid).strip().lower()
        if not key:
            raise ValueError("A server UUID is required for persistent network totals")
        rx, tx = float(rx_mebibyte), float(tx_mebibyte)
        if not all(math.isfinite(value) and value >= 0 for value in (rx, tx)):
            raise ValueError(f"Invalid network counter for server {key}")

        previous = self.servers.get(key)
        if previous is None:
            # Begin accounting with the counters already accumulated this boot.
            total = rx + tx
        else:
            # Detect restarts per direction, before adding the two directions.
            rx_delta = rx - previous["last_rx"]
            tx_delta = tx - previous["last_tx"]
            total = previous["total"] + (rx_delta if rx_delta >= 0 else rx) + (
                tx_delta if tx_delta >= 0 else tx
            )

        self.servers[key] = {"last_rx": rx, "last_tx": tx, "total": total}
        return total

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
                json.dump({"version": 1, "servers": self.servers}, handle, sort_keys=True)
                handle.write("\n")
                handle.flush()
                os.fsync(handle.fileno())
            os.replace(temporary_path, self.path)
        finally:
            if temporary_path is not None and os.path.exists(temporary_path):
                os.unlink(temporary_path)
