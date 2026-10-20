import unittest
from unittest.mock import MagicMock, call, patch
from pterodactyl_exporter.http_server import HTTPServer
from pterodactyl_exporter.dto.config import Config
from pterodactyl_exporter.dto.metrics import Metrics
from pterodactyl_exporter.enum.server_list_type import ServerListType


class TestHTTPServer(unittest.TestCase):
    @patch('pterodactyl_exporter.http_server.Gauge')
    @patch('pterodactyl_exporter.http_server.start_http_server')
    def test_listen_address(self, mock_start_server, _mock_gauge):
        config = Config(
            host="example.com", port=9531, api_key="test", https=True,
            ignore_ssl=False, server_list_type=ServerListType.OWNER,
            listen_address="127.0.0.1"
        )
        HTTPServer(config)
        mock_start_server.assert_called_once_with(9531, addr="127.0.0.1")

    @patch('pterodactyl_exporter.http_server.start_http_server')
    def test_serve_metrics(self, _mock_start_server):
        config = Config(
            port=9531,
            host="example.com",
            api_key="test123",
            https=True,
            ignore_ssl=False,
            server_list_type=ServerListType.OWNER
        )

        http_server = HTTPServer(config)
        _mock_start_server.assert_called_once_with(9531, addr="0.0.0.0")
        http_server.identity_info = MagicMock()
        http_server.metric_gauges = {
            "memory": MagicMock(),
            "cpu": MagicMock(),
            "disk": MagicMock(),
            "rx": MagicMock(),
            "tx": MagicMock(),
            "network_total_historical": MagicMock(),
            "network_rx_historical": MagicMock(),
            "network_tx_historical": MagicMock(),
            "uptime": MagicMock(),
            "max_memory": MagicMock(),
            "max_swap": MagicMock(),
            "max_disk": MagicMock(),
            "io": MagicMock(),
            "max_cpu": MagicMock(),
            "last_backup_time": MagicMock(),
            "backup_count": MagicMock(),
            "backup_limit": MagicMock()
        }

        metrics = Metrics(
            name=["Server1", "Server2"],
            id=["id1", "id2"],
            uuid=["11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222"],
            memory=[1024, 2048],
            cpu=[50, 75],
            disk=[512, 1024],
            rx=[100, 200],
            tx=[150, 250],
            network_total_historical=[250, 450],
            network_rx_historical=[100, 200],
            network_tx_historical=[150, 250],
            uptime=[3600000, 7200000],
            max_memory=[4096, 8192],
            max_swap=[2048, 4096],
            max_disk=[2048, 4096],
            io=[1, 2],
            max_cpu=[90, 95],
            last_backup_time=[1234567890, 1234567900],
            backup_count=[5, 4],
            backup_limit=[6, 10]
        )

        http_server.serve_metrics(metrics)

        self.assertEqual(http_server.identity_info.labels.call_args_list, [
            call("Server1", "id1", "11111111-1111-4111-8111-111111111111"),
            call("Server2", "id2", "22222222-2222-4222-8222-222222222222")
        ])
        for name, first, second in (
            ("network_total_historical", 250, 450),
            ("network_rx_historical", 100, 200),
            ("network_tx_historical", 150, 250),
        ):
            gauge = http_server.metric_gauges[name]
            gauge.labels.assert_any_call("Server1", "id1")
            gauge.labels.assert_any_call("Server2", "id2")
            gauge.labels.return_value.set.assert_any_call(first)
            gauge.labels.return_value.set.assert_any_call(second)
        http_server.metric_gauges['backup_count'].labels.assert_any_call('Server1', 'id1')
        http_server.metric_gauges['backup_limit'].labels.assert_any_call('Server2', 'id2')

        expected_calls = [
            ((1024,), ("Server1", "id1")),
            ((50,), ("Server1", "id1")),
            ((512,), ("Server1", "id1")),
            ((100,), ("Server1", "id1")),
            ((150,), ("Server1", "id1")),
            ((3600000,), ("Server1", "id1")),
            ((4096,), ("Server1", "id1")),
            ((2048,), ("Server1", "id1")),
            ((2048,), ("Server1", "id1")),
            ((1,), ("Server1", "id1")),
            ((90,), ("Server1", "id1")),
            ((1234567890,), ("Server1", "id1")),

            ((2048,), ("Server2", "id2")),
            ((75,), ("Server2", "id2")),
            ((1024,), ("Server2", "id2")),
            ((200,), ("Server2", "id2")),
            ((250,), ("Server2", "id2")),
            ((7200000,), ("Server2", "id2")),
            ((8192,), ("Server2", "id2")),
            ((4096,), ("Server2", "id2")),
            ((4096,), ("Server2", "id2")),
            ((2,), ("Server2", "id2")),
            ((95,), ("Server2", "id2")),
            ((1234567900,), ("Server2", "id2")),
        ]
        for metric_name, mock_obj in http_server.metric_gauges.items():
            for call_args, call_kwargs in expected_calls:
                if metric_name in call_kwargs:
                    mock_obj.labels.assert_called_with(*call_kwargs)

    if __name__ == '__main__':
        unittest.main()
