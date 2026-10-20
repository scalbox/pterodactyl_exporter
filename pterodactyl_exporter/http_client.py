import requests
import time
import dateutil.parser
from .dto.config import Config
from .dto.metrics import Metrics
from .network_traffic_store import NetworkTrafficStore


class HTTPClient:
    def __init__(self, config: Config):
        self.config = config
        self.metrics: Metrics = Metrics()
        self.network_traffic_store = NetworkTrafficStore(config.traffic_state_file)
        self.headers = {
            "Authorization": f"Bearer {config.api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json"
        }

    def get_metrics(self):
        self.metrics = Metrics()
        t1 = time.time()
        servers = self.fetch_server()
        server_pages = {}
        include_uuids = set(self.config.include_servers)
        exclude_uuids = set(self.config.exclude_servers)
        pages = servers['meta']['pagination']['total_pages']

        for page in range(1, pages + 1):
            servers = self.fetch_server(page)
            for server_data in servers.get('data', []):
                # Filter before requesting resource or backup statistics.
                server_uuid = str(
                    server_data.get('attributes', {}).get('uuid') or ''
                ).strip().lower()
                if include_uuids and server_uuid not in include_uuids:
                    continue
                if server_uuid in exclude_uuids:
                    continue
                if not (bool(server_data['attributes']['is_suspended']) or
                        bool(server_data['attributes']['is_installing']) or
                        bool(server_data['attributes']['is_transferring']) or
                        bool(server_data['attributes']['is_node_under_maintenance'])):
                    self.process_servers(server_data)
                    server_id = server_data['attributes']['identifier']
                    server_pages[server_id] = page

        for index, server_id in enumerate(self.metrics.id):
            page = server_pages[server_id]
            resources = self.fetch_resources(server_id, index, page)
            self.process_resources(resources)
            self.metrics.network_total_historical.append(
                self.network_traffic_store.update(
                    self.metrics.uuid[index], self.metrics.rx[index], self.metrics.tx[index]
                )
            )
            self.fetch_last_backup_time(server_id, index, page)

        # Only publish values after the durable state has been saved.
        self.network_traffic_store.save()
        t2 = time.time()
        print(f"total= {t2 - t1}")
        return self.metrics

    def fetch_server(self, page=1):
        url = f"{self.get_url()}/api/client/?type={self.config.server_list_type}&page={page}"
        response = requests.get(url, headers=self.headers, verify=not self.config.ignore_ssl)
        if response.status_code != 200:
            raise Exception(f"Error fetching servers: {response.text}")
        response.close()
        return response.json()

    def process_servers(self, server_data):
        attributes = server_data.get('attributes', {})
        self.metrics.name.append(attributes.get('name', ''))
        self.metrics.id.append(attributes.get('identifier', ''))
        self.metrics.uuid.append(str(attributes.get('uuid') or ''))
        self.metrics.max_memory.append(attributes['limits']['memory'])
        self.metrics.max_swap.append(attributes['limits']['swap'])
        self.metrics.max_disk.append(attributes['limits']['disk'])
        self.metrics.io.append(attributes['limits']['io'])
        self.metrics.max_cpu.append(attributes['limits']['cpu'])
        backup_limit = attributes.get('feature_limits', {}).get('backups')
        self.metrics.backup_limit.append(
            float('nan') if backup_limit is None else float(backup_limit)
        )

    def fetch_resources(self, server_id, index, page):
        url = f"{self.get_url()}/api/client/servers/{server_id}/resources?page={page}"
        response = requests.get(url, headers=self.headers, verify=not self.config.ignore_ssl)
        if response.status_code != 200:
            raise Exception(f"Fetch metrics for {self.metrics.name[index]}")
        response_data = response.json()
        response.close()
        return response_data["attributes"]["resources"]

    def process_resources(self, resources):
        self.metrics.memory.append(self.convert_byte_to_mebibyte(resources["memory_bytes"]))
        self.metrics.cpu.append(resources["cpu_absolute"])
        self.metrics.disk.append(self.convert_byte_to_mebibyte(resources["disk_bytes"]))
        self.metrics.rx.append(self.convert_byte_to_mebibyte(resources["network_rx_bytes"]))
        self.metrics.tx.append(self.convert_byte_to_mebibyte(resources["network_tx_bytes"]))
        self.metrics.uptime.append(resources["uptime"])

    def fetch_last_backup_time(self, server_id, index, page):
        # Always fetch the first backup page, regardless of server-list pagination.
        url = f"{self.get_url()}/api/client/servers/{server_id}/backups?per_page=50&page=1"
        response = requests.get(url, headers=self.headers, verify=not self.config.ignore_ssl)
        if response.status_code != 200:
            raise Exception(f"Fetch last backup for {self.metrics.name[index]}")
        response_data = response.json()
        response.close()
        backups = response_data["data"]
        backup_meta = response_data.get('meta', {})
        backup_count = backup_meta.get('backup_count')
        if backup_count is None:
            backup_count = backup_meta.get('pagination', {}).get('total', len(backups))
        self.metrics.backup_count.append(float(backup_count))
        last_successful_backup = max(
            (dateutil.parser.isoparse(backup["attributes"]["completed_at"]).timestamp()
             for backup in backups
             if backup["attributes"]["is_successful"]), default=0
        ) if backups else 0
        self.metrics.last_backup_time.append(last_successful_backup)

    def get_url(self):
        if self.config.https:
            return f"https://{self.config.host}:{self.config.host_port if self.config.host_port else 443}"
        return f"http://{self.config.host}:{self.config.host_port if self.config.host_port else 80}"

    @staticmethod
    def convert_byte_to_mebibyte(byte):
        return byte / 1048576
