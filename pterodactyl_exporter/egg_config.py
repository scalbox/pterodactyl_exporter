"""Convert Pterodactyl Egg UUID filters into the YAML lists required by the exporter.

The Pterodactyl configuration parser supports scalar replacements but cannot
reliably generate YAML arrays from editable Egg environment variables.
A separate runtime config leaves the user's config.yml untouched.
"""

import argparse
import os
import re
from pathlib import Path
from uuid import UUID
from typing import List

import yaml


def parse_uuid_list(raw: str, variable: str) -> List[str]:
    uuids: List[str] = []
    for item in re.split(r"[,;\s]+", raw.strip()):
        if not item:
            continue
        try:
            uuids.append(str(UUID(item)))
        except ValueError as exc:
            raise ValueError(
                f"{variable}: invalid full server UUID {item!r}"
            ) from exc
    return uuids


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Prepare the runtime configuration for the Pterodactyl Egg"
    )
    parser.add_argument("--source", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()

    with Path(args.source).open(encoding="utf-8") as handle:
        config = yaml.safe_load(handle)
    if not isinstance(config, dict):
        parser.error("The source YAML must contain a configuration mapping")

    for env_name, field_name in (
        ("INCLUDE_SERVERS", "include_servers"),
        ("EXCLUDE_SERVERS", "exclude_servers"),
    ):
        try:
            config[field_name] = parse_uuid_list(
                os.environ.get(env_name, ""), env_name
            )
        except ValueError as exc:
            parser.error(str(exc))

    # The generated file contains the API key: keep it private in the container.
    os.umask(0o077)
    destination = Path(args.output)
    destination.write_text(
        yaml.safe_dump(config, sort_keys=False, allow_unicode=True),
        encoding="utf-8",
    )
    destination.chmod(0o600)


if __name__ == "__main__":
    main()
