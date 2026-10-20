import unittest
from unittest.mock import patch, MagicMock
from pterodactyl_exporter.http_client import HTTPClient
from pterodactyl_exporter.dto.config import Config
from pterodactyl_exporter.enum.server_list_type import ServerListType

class TestHTTPClient(unittest.TestCase):
    @patch('pterodactyl_exporter.http_client.requests.get')
    def test_get_metrics(self, mock_get):
        config = Config(
            port=9531,
            host="example.com",
            api_key="test123",
            https=True,
            ignore_ssl=False,
            server_list_type=ServerListType.OWNER
        )

        # Page 1
        response_servers_page1 = MagicMock()
        response_servers_page1.status_code = 200
        response_servers_page1.json.return_value = {
            'meta': {'pagination': {'total_pages': 2}},
            'data': [
                {
                    'attributes': {
                        'is_suspended': False,
                        'is_installing': False,
                        'is_transferring': False,
                        'is_node_under_maintenance': False,
                        'name': 'server1',
                        'identifier': 'id1',
                        'uuid': '11111111-1111-4111-8111-111111111111',
                        'feature_limits': {'backups': 6},
                        'limits': {
                            'memory': 1024,
                            'swap': 0,
                            'disk': 2048,
                            'io': 500,
                            'cpu': 2
                        }
                    }
                },
                {
                    'attributes': {
                        'is_suspended': True,
                        'is_installing': False,
                        'is_transferring': False,
                        'is_node_under_maintenance': False,
                        'name': 'server2',
                        'identifier': 'id2',
                        'limits': {
                            'memory': 4543,
                            'swap': 321,
                            'disk': 4353,
                            'io': 23,
                            'cpu': 3
                        }
                    }
                },
                {
                    'attributes': {
                        'is_suspended': False,
                        'is_installing': True,
                        'is_transferring': False,
                        'is_node_under_maintenance': False,
                        'name': 'server3',
                        'identifier': 'id3',
                        'limits': {
                            'memory': 6544,
                            'swap': 43,
                            'disk': 7544,
                            'io': 325,
                            'cpu': 2
                        }
                    }
                },
                {
                    'attributes': {
                        'is_suspended': False,
                        'is_installing': False,
                        'is_transferring': True,
                        'is_node_under_maintenance': False,
                        'name': 'server4',
                        'identifier': 'id4',
                        'limits': {
                            'memory': 1024,
                            'swap': 0,
                            'disk': 2048,
                            'io': 500,
                            'cpu': 2
                        }
                    }
                },
                {
                    'attributes': {
                        'is_suspended': False,
                        'is_installing': False,
                        'is_transferring': False,
                        'is_node_under_maintenance': True,
                        'name': 'server5',
                        'identifier': 'id5',
                        'limits': {
                            'memory': 1024,
                            'swap': 0,
                            'disk': 2048,
                            'io': 500,
                            'cpu': 2
                        }
                    }
                }
            ]
        }

        # Page 2
        response_servers_page2 = MagicMock()
        response_servers_page2.status_code = 200
        response_servers_page2.json.return_value = {
            'meta': {'pagination': {'total_pages': 2}},
            'data': [
                {
                    'attributes': {
                        'is_suspended': False,
                        'is_installing': False,
                        'is_transferring': False,
                        'is_node_under_maintenance': False,
                        'name': 'server6',
                        'identifier': 'id6',
                        'uuid': '66666666-6666-4666-8666-666666666666',
                        'feature_limits': {'backups': 10},
                        'limits': {
                            'memory': 2048,
                            'swap': 0,
                            'disk': 4096,
                            'io': 1000,
                            'cpu': 4
                        }
                    }
                }
            ]
        }

        response_resources_s1 = MagicMock()
        response_resources_s1.status_code = 200
        response_resources_s1.json.return_value = {
            'attributes': {
                'resources': {
                    'memory_bytes': 1048576,
                    'cpu_absolute': 20,
                    'disk_bytes': 2097152,
                    'network_rx_bytes': 524288,
                    'network_tx_bytes': 524288,
                    'uptime': 12345
                }
            }
        }

        response_backup_s1 = MagicMock()
        response_backup_s1.status_code = 200
        response_backup_s1.json.return_value = {
            'meta': {'pagination': {'total': 5}},
            'data': [
                {
                    'attributes': {
                        'completed_at': '2025-05-29T12:00:00Z',
                        'is_successful': True
                    }
                }
            ]
        }

        response_resources_s2 = MagicMock()
        response_resources_s2.status_code = 200
        response_resources_s2.json.return_value = {
            'attributes': {
                'resources': {
                    'memory_bytes': 2097152,
                    'cpu_absolute': 40,
                    'disk_bytes': 4194304,
                    'network_rx_bytes': 1048576,
                    'network_tx_bytes': 1048576,
                    'uptime': 67890
                }
            }
        }

        response_backup_s2 = MagicMock()
        response_backup_s2.status_code = 200
        response_backup_s2.json.return_value = {
            'meta': {'pagination': {'total': 7}},
            'data': [
                {
                    'attributes': {
                        'completed_at': '2025-05-28T12:00:00Z',
                        'is_successful': True
                    }
                }
            ]
        }

        mock_get.side_effect = [
            response_servers_page1,
            response_servers_page1,
            response_servers_page2,
            response_resources_s1,
            response_backup_s1,
            response_resources_s2,
            response_backup_s2
        ]

        client = HTTPClient(config)
        metrics = client.get_metrics()

        self.assertEqual(metrics.name, ['server1', 'server6'])
        self.assertEqual(metrics.id, ['id1', 'id6'])
        self.assertEqual(metrics.uuid, [
            '11111111-1111-4111-8111-111111111111',
            '66666666-6666-4666-8666-666666666666'
        ])
        self.assertEqual(metrics.max_memory, [1024, 2048])
        self.assertEqual(metrics.memory, [1, 2])  # bytes to MiB
        self.assertEqual(metrics.cpu, [20, 40])
        self.assertEqual(metrics.disk, [2, 4])
        self.assertEqual(metrics.uptime, [12345, 67890])
        self.assertEqual(len(metrics.last_backup_time), 2)
        self.assertEqual(metrics.backup_count, [5.0, 7.0])
        self.assertEqual(metrics.backup_limit, [6.0, 10.0])
        self.assertGreater(metrics.last_backup_time[0], 0)
        self.assertGreater(metrics.last_backup_time[1], 0)

        # The backup endpoint must always request page 1, including for a
        # server found on a later page of the server list.
        requested_urls = [call.args[0] for call in mock_get.call_args_list]
        self.assertEqual(len(requested_urls), 7)
        self.assertTrue(requested_urls[4].endswith('/backups?per_page=50&page=1'))
        self.assertTrue(requested_urls[6].endswith('/backups?per_page=50&page=1'))

    def test_include_and_exclude_filter_before_server_statistics(self):
        server_uuid_1 = '11111111-1111-4111-8111-111111111111'
        server_uuid_2 = '22222222-2222-4222-8222-222222222222'
        server_uuid_3 = '33333333-3333-4333-8333-333333333333'
        config = Config(
            host='example.com', port=9531, api_key='test', https=True,
            ignore_ssl=False, server_list_type=ServerListType.OWNER,
            include_servers=[server_uuid_1.upper(), server_uuid_2],
            exclude_servers=[server_uuid_2]
        )
        servers = {
            'meta': {'pagination': {'total_pages': 1}},
            'data': [
                {'attributes': {
                    'uuid': uuid, 'identifier': f'id{index}', 'name': f'Server {index}',
                    'is_suspended': False, 'is_installing': False,
                    'is_transferring': False, 'is_node_under_maintenance': False,
                    'limits': {'memory': 1024, 'swap': 0, 'disk': 2048, 'io': 500, 'cpu': 200},
                    'feature_limits': {'backups': 5}
                }}
                for index, uuid in enumerate((server_uuid_1, server_uuid_2, server_uuid_3), 1)
            ]
        }
        resources = {
            'memory_bytes': 1048576, 'cpu_absolute': 10,
            'disk_bytes': 2097152, 'network_rx_bytes': 1024,
            'network_tx_bytes': 2048, 'uptime': 1000
        }
        client = HTTPClient(config)
        with patch.object(client, 'fetch_server', return_value=servers), \
             patch.object(client, 'fetch_resources', return_value=resources) as fetch_resources, \
             patch.object(client, 'fetch_last_backup_time') as fetch_backups:
            metrics = client.get_metrics()

        self.assertEqual(metrics.id, ['id1'])
        self.assertEqual(metrics.uuid, [server_uuid_1])
        self.assertEqual(fetch_resources.call_count, 1)
        self.assertEqual(fetch_resources.call_args.args, ('id1', 0, 1))
        self.assertEqual(fetch_backups.call_count, 1)
        self.assertEqual(fetch_backups.call_args.args, ('id1', 0, 1))


    if __name__ == '__main__':
        unittest.main()
