# Pterodactyl Exporter

### Please use the Discussion for Support rather than the Issues.

A python script that exports performance metrics from Pterodactyl Panel 1.x via the Client API, converts the data to the correct format and provides a prometheus target.

This can be used for time series monitoring of Pterodactyl game servers and visualization with Grafana.

Feel free to try this script and submit an issue if needed.

## Features added in this fork

This fork is based on [LOENS2/pterodactyl_exporter](https://github.com/LOENS2/pterodactyl_exporter).
Scalbox added full-UUID server inclusion/exclusion filters, backup counts and
quotas, complete server UUID metadata, and a persistent network traffic total
that survives game-server and exporter restarts. The existing upstream metric
names and labels are preserved.

The exporter uses the Pterodactyl Client API. It does **not** require an exporter or
other monitoring software to be installed on Pterodactyl nodes.

# How to install

**Latest stable release:** [View on GitHub](https://github.com/scalbox/pterodactyl_exporter/releases/latest).

## What you need:

 * Linux server (should run on Windows as well, but is only tested in a linux environment)
 * Prometheus
 * Python (3.10)
 * Pterodactyl client API key 
   * Service account with read only is recommended
   * You only need to set `Backup->Read` as permission for the account to the server you want to monitor.

## Run as Pterodactyl Server

 - Download the Egg JSON from `egg/egg-pterodactyl-exporter.json` or the releases
 - Import the Egg into the Nest of your choice
 - Create the server from the egg and fill in the required config values
 - Run the server

## Run as service

#### Installed as user "prometheus":

 - To install with pipx:
```
pipx install "git+https://github.com/scalbox/pterodactyl_exporter.git@1.0.12"
```

 - To install with pip _(not recommended, could break system dependencies)_:
```
pip install "git+https://github.com/scalbox/pterodactyl_exporter.git@1.0.12"
```
 - Create directory `pterodactyl_exporter`.
 
 - Create the config file `config.yml` in that directory (set the values as needed, it's recommended to use https):
 
 ```yml
host: panel.example.com
host_port: # This is the port of the panel (optional)
port: 9531 # Standard exporter listening port
listen_address: 127.0.0.1 # Bind locally when Prometheus runs on this host
api_key: APIKEY_APIKEYAPIKEYAPIKEY
https: true
ignore_ssl: false
server_list_type: owner
query_interval: 10 # Interval in seconds between each query to the Pterodactyl panel (default: 10)
include_servers: [] # Optional full-UUID allowlist (empty = all accessible servers)
exclude_servers: [] # Optional full-UUID blocklist
# traffic_state_file: data/network_traffic.json # Persistent RX+TX state (relative to config.yml)
 ```

 The `listen_address` setting controls which interface serves `/metrics` (`127.0.0.1` for local-only access, `0.0.0.0` for all interfaces). If omitted, it defaults to `0.0.0.0`. It is separate from `host` and `host_port`, which refer to the Pterodactyl panel. Restart the exporter after changing the setting.

 - Create systemd service `/etc/systemd/system/pterodactyl_exporter.service`:
```
[Unit]
Description=Prometheus Server
After=network-online.target

[Service]
User=prometheus
Restart=on-failure
ExecStart=pterodactyl_exporter \
--config-file=/home/prometheus/pterodactyl_exporter/config.yml

[Install]
WantedBy=multi-user.target
```

 - Enable and start the service.
 
 - Add a job configuration:
 
 ```yml
 - job_name: 'pterodactyl_exporter'
    static_configs:
      - targets: ['localhost:9531']

 ```

 - To use the dashboards bundled with this fork, see [Grafana dashboards](#grafana-dashboards). The original upstream Grafana dashboard is also available under ID `16575`.
 
 #### Servers can be selected by changing API permissions or with the UUID filters documented below.

## Server inclusion and exclusion

**Added by Scalbox in this fork.** The `include_servers` and `exclude_servers`
configuration options are not available in the original LOENS2 exporter.

Set `include_servers` and/or `exclude_servers` in `config.yml` to control which
servers are monitored. These lists contain **full server UUIDs**, not the short
8-character identifiers displayed in some Pterodactyl views.

```yaml
include_servers:
  - "11111111-1111-4111-8111-111111111111" # Production server
  - "22222222-2222-4222-8222-222222222222" # Testing server

exclude_servers:
  - "22222222-2222-4222-8222-222222222222" # Do not monitor testing
```

- When `include_servers` is empty or omitted, all servers accessible to the API key
  are eligible for monitoring.
- When `include_servers` contains UUIDs, only matching servers are eligible.
- UUIDs in `exclude_servers` are always skipped, even if also included.
- Matching is case-insensitive, and surrounding whitespace is ignored.
- Filtering happens **before** individual server resource and backup API requests.
  Excluded servers therefore do not incur those per-server requests.
- Restart the exporter after changing its configuration. Previously collected
  Prometheus samples remain until the configured retention period expires or
  the data is deliberately removed from Prometheus.

For no filtering, use `include_servers: []` and `exclude_servers: []`.
The API key must still have the appropriate Client API permissions.

## Metrics

The exporter exposes **16 Pterodactyl-specific Prometheus metrics**, all of type
`Gauge`. The 12 upstream metrics are listed first, followed by the four metrics
added by Scalbox in this fork. Metrics generally use the `server_name` and `id`
labels (`id` is the short server identifier); the identity metric additionally
includes the complete `uuid` label.

### Original metrics (LOENS2 upstream)

| Metric | Description |
| --- | --- |
| `pterodactyl_server_cpu_absolute` | Current CPU usage in percent; values may exceed 100% on multicore servers. |
| `pterodactyl_server_max_cpu_absolute` | Configured CPU limit in percent (0 = unlimited). |
| `pterodactyl_server_memory_mebibyte` | Currently used RAM in MiB. |
| `pterodactyl_server_max_memory_mebibyte` | Configured RAM limit in MiB (0 = unlimited). |
| `pterodactyl_server_disk_mebibyte` | Currently used disk space in MiB. |
| `pterodactyl_server_max_disk_mebibyte` | Configured disk limit in MiB (0 = unlimited). |
| `pterodactyl_server_max_swap_mebibyte` | Configured swap allocation in MiB. |
| `pterodactyl_server_io` | Configured disk I/O weight. |
| `pterodactyl_server_network_rx_mebibyte` | Total traffic received in MiB since the latest game-server counter reset. |
| `pterodactyl_server_network_tx_mebibyte` | Total traffic transmitted in MiB since the latest game-server counter reset. |
| `pterodactyl_server_uptime_milliseconds` | Current server uptime in milliseconds. |
| `pterodactyl_server_most_recent_backup_time` | Unix timestamp (seconds) of the most recent successful backup; 0 if unavailable. |

### Metrics added by Scalbox in this fork

| Metric | Description |
| --- | --- |
| `pterodactyl_server_backup_count` | Number of currently stored server backups. |
| `pterodactyl_server_backup_limit` | Maximum number of backup slots configured for the server; `NaN` when unavailable. |
| `pterodactyl_server_identity_info` | Constant value `1`, with the full server UUID in the `uuid` label. |
| `pterodactyl_server_network_historical_total_mebibyte` | Persistent historical RX + TX total in MiB, maintained across game-server and exporter restarts when the state file is preserved. |

These are the complete **Pterodactyl application metrics** defined by the
exporter. The Prometheus Python client may also expose standard Python runtime
and process metrics, depending on the installed version and platform.

The backup metrics use data returned by the existing server-list and backup-list
requests. Backup counts use the API's pagination total when available; backup
limits come from each server's `feature_limits.backups`. A missing limit is
represented as `NaN`. The existing backup-list request always targets page 1,
independent of the server-list page number.

For example, Prometheus exposes data in this form:

```prometheus
pterodactyl_server_backup_count{server_name="Production",id="11111111"} 5
pterodactyl_server_backup_limit{server_name="Production",id="11111111"} 6
pterodactyl_server_identity_info{server_name="Production",id="11111111",uuid="11111111-1111-4111-8111-111111111111"} 1
```

The UUID is intentionally provided in a separate information metric, so the
labels of existing metrics (including `server_name` and `id`) do not change.

These changes are built into this fork. Do not run the legacy third-party
patching script against this version; it was only intended for the unmodified
upstream package.

## Grafana dashboards

This fork includes two language versions of the **Pterodacty l Server & Network**
Grafana dashboard in the [`dashboards/`](dashboards/) directory:

- [English dashboard](dashboards/Pterodactyl-Server-Network-en.json)
- [Italian dashboard](dashboards/Pterodactyl-Server-Network-it.json)

### Dashboard screenshots

The screenshots below show the dashboard with anonymized server names and UUIDs.
Click an image to view it at full resolution.

**CPU, Uptime, Memory, and Disk**

[![CPU, Uptime, Memory, and Disk dashboard panels](dashboards/screenshots/01-cpu-uptime-memory-disk.png)](dashboards/screenshots/01-cpu-uptime-memory-disk.png)

**Network RX/TX — Current and Cumulative**

[![Current and cumulative network RX and TX dashboard panels](dashboards/screenshots/02-network-rx-tx.png)](dashboards/screenshots/02-network-rx-tx.png)

**Total Network Traffic and Backups**

[![Total network traffic and backup dashboard panels](dashboards/screenshots/03-network-traffic-backups.png)](dashboards/screenshots/03-network-traffic-backups.png)

Both exports contain the same panels, Prometheus queries, server selector, and
layout. Only the user-facing labels, descriptions, legends, and backup-table
messages differ by language.

The dashboards include:

- CPU and memory usage, disk usage, current uptime, and historical uptime.
- Per-server network RX and TX charts for both cumulative traffic and current
  throughput in Mbps, including combined RX/TX views and overall totals.
- A persistent, all-time RX + TX total directly below the current cumulative
  network total, independent of Pterodactyl server restart resets.
- A per-server backup table with the latest backup, stored backup count, backup
  limit, usage indicator, panel name, and complete server UUID.

### Persistent network traffic totals

The new historical network panel uses
`pterodactyl_server_network_historical_total_mebibyte`, introduced in the
exporter alongside the updated dashboards. **Update/restart the exporter as
well as importing the JSON**; older exporter versions will leave this panel empty.

Pterodactyl's RX/TX values restart at zero with a game server. The exporter
now tracks positive increments for each server's UUID, detects resets in each
direction and writes the cumulative total to a JSON state file after each
successful collection cycle. The default path is `data/network_traffic.json`
**relative to the directory containing `config.yml`**. You may set the
optional `traffic_state_file` configuration key to an absolute path or a
different relative path. The exporter must have write access to the directory.

**Keep and back up this file.** If it is deleted or stored only in an
ephemeral container layer, the historical total will restart from the currently
reported server counters. The provided Docker Compose file mounts
`../data:/opt/pterodactyl_exporter/config/data`; retain this volume when
updating or recreating the container. Pterodactyl Egg installations should
also retain the `data/` directory alongside their `config.yml`.

The lifetime total begins when the updated exporter first observes a server.
On first observation, it includes the RX/TX amounts reported for that server's
*current boot*; older restarts cannot be backfilled from a live counter.
Traffic transmitted between the last successful exporter poll and an
unobserved reset may also be missed. With the state file preserved, the
reported total does not decrease as observed counters reset. The time range
available in Grafana still depends on Prometheus data retention.

To import either version, open **Grafana > Dashboards > New > Import**, upload
the desired JSON file, select your **Prometheus** data source, and import it.
The exporter must be reachable by Prometheus and provide the additional backup
and identity metrics described above for those columns to contain data.

The **Server** selector filters the displayed metrics in Grafana. To prevent
servers from being queried and exported at all, configure `include_servers`
and/or `exclude_servers` in the exporter instead.

Both JSON files use the same dashboard title and are intended as alternative
language versions. To keep both in one Grafana installation, import them into
different folders or choose distinct dashboard names during import.
 
## Run with Docker (starting with 1.0.9)

Starting with **1.0.9**, release images are published from this fork to GitHub
Container Registry (GHCR). The Compose file uses the pinned image
`ghcr.io/scalbox/pterodactyl_exporter:1.0.11` and does not use the upstream
`loens2/pterodactyl_exporter` image. The Docker image is published by GitHub Actions after the version tag is pushed
and its multi-platform build completes successfully.

Create the files and edit `config.yml` with your Pterodactyl Client API details:

```bash
mkdir -p pterodactyl_exporter/docker
cd pterodactyl_exporter
curl -fsSL -o config.yml https://raw.githubusercontent.com/scalbox/pterodactyl_exporter/main/config.example.yml
curl -fsSL -o docker/docker-compose.yml https://raw.githubusercontent.com/scalbox/pterodactyl_exporter/main/docker/docker-compose.yml
# Edit config.yml before starting the exporter.
# Compose mounts ../data into the container to keep network traffic totals.
docker compose -f docker/docker-compose.yml pull
docker compose -f docker/docker-compose.yml up -d
```

The Compose file mounts `config.yml` read-only and restarts the exporter unless
it is explicitly stopped. By default, it maps port 9531 on all host interfaces.
**In Docker, keep `listen_address: 0.0.0.0` in `config.yml`**, because the
exporter must accept connections from outside the container's own loopback.
If Prometheus runs on the Docker host, restrict access using the Compose
port mapping `127.0.0.1:9531:9531` instead. This limits the host's published
port; `listen_address: 127.0.0.1` inside the container would prevent the
published Docker port from reaching the exporter.

### Automated Docker and Python releases

The [release workflow](.github/workflows/publish-docker.yml) runs whenever a
stable version Git tag such as `1.0.11` is pushed. It:

1. Runs the Python regression tests, builds the wheel (`.whl`) and Python source
   distribution (`.tar.gz`) from the exact tagged commit, and validates both.
2. Builds Docker images for Linux `amd64` and `arm64` and publishes the versioned
   image (`:1.0.11`) and `:latest` to GHCR.
3. **Only after both jobs succeed**, creates a GitHub Release for the tag, with
   the Python distributions attached as downloadable release assets.
4. Uses the **annotated Git tag message** as the GitHub Release description.
5. Updates the version in both `pipx` and `pip` installation commands and the
   Docker Compose image tag on `main` after successful release publication.
   It never replaces a newer installed version with an older one.

GitHub automatically adds two source snapshots (ZIP and TAR.GZ) to every release.
The workflow adds two different Python installation packages:
`pterodactyl_exporter-X.Y.Z-py3-none-any.whl` (wheel) and
`pterodactyl_exporter-X.Y.Z.tar.gz` (source distribution). The Docker image is
published separately under GitHub Packages (GHCR), not as a release asset.

Before creating a tag, use **Actions > Publish Docker and Python release > Run
workflow** on `main` to validate Docker and Python builds. Manual runs do **not**
publish Docker images or create GitHub Releases.

To release a new version, first push the desired commits to `main`, then create
an annotated tag pointing to that commit. For example, in PowerShell:

```powershell
git tag -a 1.0.11
git push origin refs/tags/1.0.11
```

The `git tag -a` command opens your configured editor; write the complete
English release notes in the tag message. A short one-line message also works,
but the automated GitHub Release will then contain only that short message.
Do not move an already published release tag to add workflow changes; publish
the updated workflow on `main` **before** creating the next version tag.

No Docker Hub credentials or personal access tokens are needed: the workflow
uses GitHub's `GITHUB_TOKEN` with `packages: write` for GHCR and
`contents: write` only for the release-publishing job. If a GitHub Release
already exists for the same tag, a rerun leaves it unchanged. The README update
is committed by GitHub Actions only when the installed version actually changes.

New GHCR packages may initially be private. After the first publish, open the
package settings on GitHub and change its visibility to **Public** if users
should be able to run `docker pull` without authentication.

## Run manually

#### Only meant for testing purposes, not recommended for production use!

 - Clone the project:
```
git clone https://github.com/scalbox/pterodactyl_exporter.git
```
 - Change to the cloned directory
```
cd pterodactyl_exporter
```
 - Install dependencies:
```
python -m pip install -e .
```
 - Run with python:
```
python -m pterodactyl_exporter.pterodactyl_exporter --config-file=config.example.yml
```

# Troubleshooting

You can view the output with (Time is UTC):

```
sudo journalctl -u pterodacyl_exporter.service -b --since "2024-12-14 13:45:27"
```

Post any stacktraces as an Issue.

##

With special thanks to @grimsi for helping me with docker.

&copy; LOENS2 2023
