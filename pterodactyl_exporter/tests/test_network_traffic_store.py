import json
import tempfile
import unittest
from pathlib import Path

from pterodactyl_exporter.network_traffic_store import NetworkTrafficStore


class TestNetworkTrafficStore(unittest.TestCase):
    def test_cumulative_traffic_survives_counter_and_exporter_restarts(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "data" / "network_traffic.json"
            store = NetworkTrafficStore(path)
            uuid = "11111111-1111-4111-8111-111111111111"

            # First observation includes the traffic already used in this boot.
            self.assertEqual(store.update(uuid.upper(), 100, 200), 300)
            self.assertEqual(store.update(uuid, 120, 230), 350)
            store.save()
            self.assertTrue(path.exists())

            # Exporter restarts, then the game server restarts (both counters reset).
            store = NetworkTrafficStore(path)
            self.assertEqual(store.update(uuid, 3, 5), 358)
            self.assertEqual(store.update(uuid, 7, 8), 365)
            store.save()

            # An independent server has its own total; both survive reloads.
            other_uuid = "22222222-2222-4222-8222-222222222222"
            self.assertEqual(store.update(other_uuid, 10, 20), 30)
            store.save()
            store = NetworkTrafficStore(path)
            self.assertEqual(store.update(uuid, 7, 8), 365)
            self.assertEqual(store.update(other_uuid, 11, 20), 31)
            self.assertEqual(store.servers[uuid]["total"], 365)

            with path.open(encoding="utf-8") as handle:
                data = json.load(handle)
            self.assertEqual(data["version"], 1)
            self.assertIn(uuid, data["servers"])

    def test_each_direction_detects_reset_independently(self):
        store = NetworkTrafficStore()
        uuid = "33333333-3333-4333-8333-333333333333"
        self.assertEqual(store.update(uuid, 10, 100), 110)
        # RX restarts, but TX does not.
        self.assertEqual(store.update(uuid, 2, 115), 127)
        # TX restarts, but RX does not.
        self.assertEqual(store.update(uuid, 4, 1), 130)
        self.assertEqual(store.update(uuid, 4, 1), 132)

    def test_corrupt_or_unknown_state_is_not_silently_replaced(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "network_traffic.json"
            path.write_text('{"version":2,"servers":{}}', encoding="utf-8")
            with self.assertRaises(ValueError):
                NetworkTrafficStore(path)

    def test_invalid_counter_rejected(self):
        store = NetworkTrafficStore()
        for values in ((-1, 4), (float("nan"), 2), (1, float("inf"))):
            with self.subTest(values=values), self.assertRaises(ValueError):
                store.update("44444444-4444-4444-8444-444444444444", *values)


if __name__ == "__main__":
    unittest.main()
