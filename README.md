# Pterodactyl Exporter

### Please use the Discussion for Support rather than the Issues.

A python script that exports performance metrics from Pterodactyl Panel 1.x via the Client API, converts the data to the correct format and provides a prometheus target.

This can be used for time series monitoring of Pterodactyl game servers and visualization with Grafana.

Feel free to try this script and submit an issue if needed.

## Features added in this fork

This fork is based on [LOENS2/pterodactyl_exporter](https://github.com/LOENS2/pterodactyl_exporter).
Scalbox added full-UUID server inclusion/exclusion filters and **new Prometheus
metrics** ([see the complete list](#metrics-added-by-scalbox-in-this-fork)).
This fork also includes customized English/Italian Grafana dashboards with a
built-in uptime table and an automated Docker/GHCR release workflow.
The existing upstream metric names and labels are preserved.

The exporter uses the Pterodactyl Client API. It does **not** require an exporter or
other monitoring software to be installed on Pterodactyl nodes.

## Table of contents

- [How to install](#how-to-install)
  - [What you need](#what-you-need)
  - [Run as Pterodactyl Server](#run-as-pterodactyl-server)
  - [Run as service](#run-as-service)
- [How to update](#how-to-update)
  - [Virtual environment and systemd](#virtual-environment-and-systemd)
  - [pipx installation](#pipx-installation)
  - [Pterodactyl Egg installation](#pterodactyl-egg-installation)
  - [Docker Compose installation](#docker-compose-installation)
  - [Manual source checkout](#manual-source-checkout)
- [Server inclusion and exclusion](#server-inclusion-and-exclusion)
- [Metrics](#metrics)
  - [Original metrics](#original-metrics-loens2-upstream)
  - [Metrics added by Scalbox](#metrics-added-by-scalbox-in-this-fork)
- [Grafana dashboards](#grafana-dashboards)
  - [Dashboard screenshots](#dashboard-screenshots)
  - [Dashboard features and import](#dashboard-features-and-import)
  - [Grafana uptime and restart panel plugin](#grafana-uptime-and-restart-panel-plugin)
- [Run with Docker](#run-with-docker-starting-with-109)
  - [Automated releases](#automated-docker-and-python-releases)
- [Run manually](#run-manually)
- [Troubleshooting](#troubleshooting)

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

 - Download the [Egg JSON](egg/egg-pterodactyl-exporter.json) or the releases
 - Import the Egg into the Nest of your choice
 - Create the server from the egg and fill in the required config values
 - Run the server

The egg installs the **Scalbox fork** directly from GitHub (not the original
PyPI package). It exposes the exporter bind address through
`LISTEN_ADDRESS` (default: `0.0.0.0`, required for container port access)
and server filters through `INCLUDE_SERVERS` and `EXCLUDE_SERVERS`.
Enter **full server UUIDs** separated by commas, spaces or newlines.
Leave both filters empty to monitor all accessible servers. Exclusions take
precedence over inclusions. The egg converts the filter values into YAML
lists automatically at each startup without changing your `config.yml`.
The exporter port is set by the server's Pterodactyl allocation.

## Run as service

#### Installed as user "prometheus":

 - To install with pipx:
```
pipx install "git+https://github.com/scalbox/pterodactyl_exporter.git@1.0.13"
```

 - To install with pip _(not recommended, could break system dependencies)_:
```
pip install "git+https://github.com/scalbox/pterodactyl_exporter.git@1.0.13"
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

## How to update

Use a **published Git tag** for production (see [Releases](https://github.com/scalbox/pterodactyl_exporter/releases)); use `main` only when you intentionally want the latest, potentially unreleased changes. In the commands below, change `RELEASE_REF` to the **new release tag** you want to install. The value `1.0.12` is only an example, not an automatically updated version selector.

Updating the Python package does **not** overwrite your existing `config.yml` files or systemd units. Check the new release notes for configuration changes before restarting.

### Virtual environment and systemd

This applies to installations such as `/opt/pterodactyl-exporter/venv`, including setups with several `pterodactyl-exporter@INSTANCE.service` instances using different YAML files.

**1. Check the installed version and discover the service names:**

```bash
/opt/pterodactyl-exporter/venv/bin/python -m pip show pterodactyl_exporter
systemctl list-units --all --type=service 'pterodactyl-exporter@*.service'
```

**2. Upgrade the package inside the existing virtual environment:**

```bash
RELEASE_REF="1.0.12"  # Replace with the desired newer tag (or "main" for unreleased changes)
sudo /opt/pterodactyl-exporter/venv/bin/python -m pip install --upgrade --no-cache-dir \
  "git+https://github.com/scalbox/pterodactyl_exporter.git@${RELEASE_REF}"
```

Do not create another virtual environment or reinstall the systemd services. This command upgrades the Python code shared by all instances using that virtual environment.

**3. Only after the installation succeeds, restart each existing instance:**

```bash
sudo systemctl restart pterodactyl-exporter@INSTANCE.service
```

Replace `INSTANCE` with each instance name shown in step 1. Repeat the command for every instance sharing the virtual environment. The existing `/etc/pterodactyl-exporter/INSTANCE.yml` configuration files are retained.

**4. Verify the installed version and service logs:**

```bash
/opt/pterodactyl-exporter/venv/bin/python -m pip show pterodactyl_exporter
sudo systemctl status pterodactyl-exporter@INSTANCE.service --no-pager
sudo journalctl -u pterodactyl-exporter@INSTANCE.service -n 50 --no-pager
```

If you installed into a different virtual environment, use its `bin/python` path instead. If your unit has a different name, substitute the exact name returned by `systemctl`.

### pipx installation

For installations originally managed by `pipx` (not the virtual environment above), use the **same Linux user** that owns the pipx installation:

```bash
RELEASE_REF="1.0.12"  # Replace with the desired newer tag
pipx list
pipx install --upgrade "git+https://github.com/scalbox/pterodactyl_exporter.git@${RELEASE_REF}"
pipx list
```

If the exporter is managed by systemd, restart its service after the upgrade. Do not use `pipx` to update installations located in `/opt/pterodactyl-exporter/venv`.

### Pterodactyl Egg installation

1. Download the latest [Egg JSON](egg/egg-pterodactyl-exporter.json) and update/import the egg in your Pterodactyl Panel.
2. Review the existing server's startup command and egg variables; updating an egg does not necessarily propagate every change to servers already created from it.
3. Back up the server's `config.yml` and any other data before using **Reinstall** in the Panel. Reinstalling reruns the egg's installer, which installs the Scalbox fork from GitHub `main`.
4. Confirm the values for `LISTEN_ADDRESS`, `INCLUDE_SERVERS` and `EXCLUDE_SERVERS`, then start the server and inspect its console.

The egg installer preserves an existing `config.yml`, but a Pterodactyl reinstall can affect other files depending on your Panel setup. This is why a backup is recommended.

### Docker Compose installation

The supplied [Docker Compose file](docker/docker-compose.yml) uses a versioned GHCR image. To upgrade:

1. Edit its `image: ghcr.io/scalbox/pterodactyl_exporter:VERSION` to the **new published release tag** (or `:latest` if you intentionally track the latest release).
2. Pull and recreate the container:

```bash
docker compose -f docker/docker-compose.yml pull
docker compose -f docker/docker-compose.yml up -d
docker compose -f docker/docker-compose.yml ps
```

The bind-mounted `config.yml` remains on the host. These commands use the same Compose file and do not require reinstalling Docker.

### Manual source checkout

For a source checkout installed in editable mode (development/testing), update the repository and its Python package:

```bash
cd pterodactyl_exporter
git pull --ff-only
python -m pip install --upgrade -e .
```

Restart the exporter process afterwards. Use a tagged release and a virtual environment for production rather than relying on an unpinned development checkout.

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

The exporter exposes **18 Pterodactyl-specific Prometheus metrics**, all of type
`Gauge`. The 12 upstream metrics are listed first, followed by the six metrics
added by Scalbox in this fork. Metrics generally use the `server_name` and `id`
labels (`id` is the short server identifier); the identity metric additionally
includes the complete `uuid` label.

### Original metrics (LOENS2 upstream)

| Metric | Type | Description |
| --- | --- | --- |
| `pterodactyl_server_cpu_absolute` | Gauge | Current CPU usage in percent; values may exceed 100% on multicore servers. |
| `pterodactyl_server_max_cpu_absolute` | Gauge | Configured CPU limit in percent (0 = unlimited). |
| `pterodactyl_server_memory_mebibyte` | Gauge | Currently used RAM in MiB. |
| `pterodactyl_server_max_memory_mebibyte` | Gauge | Configured RAM limit in MiB (0 = unlimited). |
| `pterodactyl_server_disk_mebibyte` | Gauge | Currently used disk space in MiB. |
| `pterodactyl_server_max_disk_mebibyte` | Gauge | Configured disk limit in MiB (0 = unlimited). |
| `pterodactyl_server_max_swap_mebibyte` | Gauge | Configured swap allocation in MiB. |
| `pterodactyl_server_io` | Gauge | Configured disk I/O weight. |
| `pterodactyl_server_network_rx_mebibyte` | Gauge | Total traffic received in MiB since the latest game-server counter reset. |
| `pterodactyl_server_network_tx_mebibyte` | Gauge | Total traffic transmitted in MiB since the latest game-server counter reset. |
| `pterodactyl_server_uptime_milliseconds` | Gauge | Current server uptime in milliseconds. |
| `pterodactyl_server_most_recent_backup_time` | Gauge | Unix timestamp (seconds) of the most recent successful backup; 0 if unavailable. |

### Metrics added by Scalbox in this fork

| Metric | Type | Description |
| --- | --- | --- |
| `pterodactyl_server_backup_count` | Gauge | Number of currently stored server backups. |
| `pterodactyl_server_backup_limit` | Gauge | Maximum number of backup slots configured for the server; `NaN` when unavailable. |
| `pterodactyl_server_identity_info` | Gauge | Constant value `1`, with the full server UUID in the `uuid` label. |

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

**Added by Scalbox in this fork.** These customized English and Italian
Grafana dashboards are developed and maintained by Scalbox.

This fork includes two language versions of the **Pterodacty l Server & Network**
Grafana dashboard in the [`dashboards/`](dashboards/) directory:

- [English dashboard](dashboards/Pterodactyl-Server-Network-en.json)
- [Italian dashboard](dashboards/Pterodactyl-Server-Network-it.json)

### Dashboard screenshots

The screenshots below use anonymized server labels (`Server 1`, `Server 2`, etc.),
generic panel labels (`Panel A`, `Panel B`), and no real server UUIDs or panel
hostnames. Click an image to view it at full resolution.

**CPU, Uptime, and Memory**

[![CPU, Uptime, and Memory dashboard panels](dashboards/screenshots/01-cpu-uptime-memory-disk.png)](dashboards/screenshots/01-cpu-uptime-memory-disk.png)

**Network RX/TX — Current and Cumulative**

[![Current and cumulative network RX and TX dashboard panels](dashboards/screenshots/02-network-rx-tx.png)](dashboards/screenshots/02-network-rx-tx.png)

**Total Network Traffic and Backups**

[![Total network traffic and backup dashboard panels](dashboards/screenshots/03-network-traffic-backups.png)](dashboards/screenshots/03-network-traffic-backups.png)

Both exports contain the same panels, Prometheus queries, server selector, and
layout. Only the user-facing labels, descriptions, legends, and backup-table
messages differ by language.

The bundled dashboards use standard Grafana panels. Beside the uptime history
chart, the built-in **Table** panel shows one row per server with **Server,
Uptime, Last reboot, Restarts and Notes**. Full names can be inspected in
Grafana, and the table scrolls when more servers are present.

**Data accuracy:** `Restarts` is an estimate of decreases in the uptime metric
over the currently selected dashboard interval, not an authoritative restart
log. An offline server has no reliable current reboot timestamp and shows
`Unavailable` / `Non disponibile`. `Notes` indicates online/offline status
and whether a reset was detected. Date/time uses Grafana's date/time display
settings. The first screenshot shows the built-in Uptime Summary table,
including the server state, last reboot, and detected restarts.

### Dashboard features and import

The dashboards include:

- CPU and memory usage, disk usage, current uptime, and historical uptime.
- Per-server network RX and TX charts for cumulative traffic and current
  throughput in automatically scaled bits/s (kbps/Mbps/Gbps).
- Two total-network charts (Current and Cumulative) with three colored series
  each: Total (RX + TX), RX and TX. Data volumes use automatically scaled IEC
  bytes (MiB/GiB/TiB/PiB); the current-speed chart uses SI bits/s.
- A per-server backup table with the latest backup, stored backup count, backup
  limit, usage indicator, panel name, and complete server UUID.

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

### Grafana uptime and restart panel plugin

**Scalbox - Pterodactyl Uptime & Restart Monitor (Grafana panel)** is an
experimental visualization for server uptime and restart events. It is currently
**beta and disabled** in both bundled dashboards.

For details about what it does, its current limitations, source compilation,
installation, and testing, see the **[plugin README](grafana-plugin/README.md)**.

## Run with Docker (starting with 1.0.9)

**Added by Scalbox in this fork.** The fork's prebuilt multi-platform Docker
images are distributed through GitHub Container Registry (GHCR).

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

**Added by Scalbox in this fork.** The automated release pipeline publishes
Docker images and Python packages for each tagged version.

The [release workflow](.github/workflows/publish-docker.yml) runs whenever a
stable version Git tag such as `1.0.11` is pushed. It:

1. Runs the Python regression tests, builds the wheel (`.whl`) and Python source
   distribution (`.tar.gz`) from the exact tagged commit, and validates both.
2. Builds Docker images for Linux `amd64` and `arm64` and publishes the versioned
   image (`:1.0.11`) and `:latest` to GHCR.
3. **Only after both jobs succeed**, creates a GitHub Release for the tag, with
   the Python distributions attached as downloadable release assets.
4. Uses the **annotated Git tag message** as the GitHub Release description.
5. Updates the version in both `pipx` and `pip` installation commands, the
   Docker Compose image tag, and the Grafana plugin download/`preinstall`
   examples in [the plugin README](grafana-plugin/README.md), only after the
   plugin ZIP has been attached to the successful GitHub Release. It never
   replaces a newer documented version with an older one.

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
