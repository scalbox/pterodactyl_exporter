from ..enum.server_list_type import ServerListType
from dataclasses import dataclass, field
from ipaddress import ip_address
from typing import List
from .validation import Validation

@dataclass
class Config(Validation):
    host: str
    port: int
    api_key: str
    https: bool
    ignore_ssl: bool
    server_list_type: ServerListType
    host_port: int = field(default=None)  # Make host_port optional
    listen_address: str = field(default="0.0.0.0")
    query_interval: int = field(default=10)
    include_servers: List[str] = field(default_factory=list)
    exclude_servers: List[str] = field(default_factory=list)
    traffic_state_file: str | None = field(default=None)

    @staticmethod
    def _validate_uuid_list(value, field_name):
        if value is None:
            return []
        if not isinstance(value, list) or any(
            not isinstance(uuid, str) or not uuid.strip() for uuid in value
        ):
            raise ValueError(f"{field_name}: Expected a list of non-empty server UUIDs")
        return [uuid.strip().lower() for uuid in value]

    @staticmethod
    def validate_include_servers(value, **_):
        return Config._validate_uuid_list(value, "include_servers")

    @staticmethod
    def validate_exclude_servers(value, **_):
        return Config._validate_uuid_list(value, "exclude_servers")

    @staticmethod
    def validate_server_list_type(value, **_) -> str:
        if value not in list(ServerListType):
            raise ValueError(f"server_list_type: Please use one of the following types: "
                             f"{', '.join(str(serverListType.value) for serverListType in ServerListType)}")
        return value
    
    # host_port is optional, so handle None case
    @staticmethod
    def validate_host_port(value, **_) -> int | None:
        if value is None:
            return None
        if not isinstance(value, int) or not (1 <= value <= 65535):
            raise ValueError("host_port: Please use a port between 1 and 65535")
        return value

    @staticmethod
    def validate_listen_address(value, **_) -> str:
        if not isinstance(value, str) or not value.strip():
            raise ValueError("listen_address: Please use a valid IPv4 or IPv6 address")
        value = value.strip()
        try:
            ip_address(value)
        except ValueError as exc:
            raise ValueError("listen_address: Please use a valid IPv4 or IPv6 address") from exc
        return value

    @staticmethod
    def validate_port(value, **_) -> int:
        if False is isinstance(value, int) or False is (1 <= value <= 65535):
            raise ValueError("port: Please use a port between 1 and 65535")
        return value

    @staticmethod
    def validate_https(value, **_) -> bool:
        if True is isinstance(value, int):
            return bool(value)
        if False is isinstance(value, bool):
            raise ValueError("https: Please use a boolean value")
        return value

    @staticmethod
    def validate_ignore_ssl(value, **_) -> bool:
        if True is isinstance(value, int):
            return bool(value)
        if False is isinstance(value, bool):
            raise ValueError("ignore_ssl: Please use a boolean value")
        return value

    @staticmethod
    def validate_traffic_state_file(value, **_) -> str | None:
        if value is None:
            return None
        if not isinstance(value, str) or not value.strip():
            raise ValueError("traffic_state_file: Please use a non-empty path")
        return value.strip()

    @staticmethod
    def validate_query_interval(value, **_) -> int:
        if value is None:
            return 10
        if not isinstance(value, int) or value < 1:
            raise ValueError("query_interval: Please use a positive integer (seconds)")
        return value
