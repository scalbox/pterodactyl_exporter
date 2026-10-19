# Pterodactyl Exporter

### Please use the Discussion for Support rather than the Issues.

A python script that exports performance metrics from Pterodactyl Panel 1.x via the Client API, converts the data to the correct format and provides a prometheus target.

This can be used for time series monitoring of Pterodactyl game servers and visualization with Grafana.

Feel free to try this script and submit an issue if needed.

## Features added in this fork (1.0.8)

This fork is based on [LOENS2/pterodactyl_exporter](https://github.com/LOENS2/pterodactyl_exporter)
and adds optional full-UUID server filtering, backup counts and quotas, and a metric
containing each server's complete UUID. Existing metric names and labels are preserved.

The exporter uses the Pterodactyl Client API. It does **not** require an exporter or
other monitoring software to be installed on Pterodactyl nodes.

# How to install

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
pipx install "git+https://github.com/scalbox/pterodactyl_exporter.git@1.0.8"
```

 - To install with pip _(not recommended, could break system dependencies)_:
```
pip install "git+https://github.com/scalbox/pterodactyl_exporter.git@1.0.8"
```
 - Create directory `pterodactyl_exporter`.
 
 - Create the config file `config.yml` in that directory (set the values as needed, it's recommended to use https):
 
 ```yml
host: panel.example.com
host_port: # This is the port of the panel (optional)
port: 9531 #Standard port for the exporter
api_key: APIKEY_APIKEYAPIKEYAPIKEY
https: true
ignore_ssl: false
server_list_type: owner
query_interval: 10 # Interval in seconds between each query to the Pterodactyl panel (default: 10)
include_servers: [] # Optional full-UUID allowlist (empty = all accessible servers)
exclude_servers: [] # Optional full-UUID blocklist
 ```

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

 - To get the Grafana dashboard, import id `16575`. Alternatively download the JSON file from the releases.
 
 #### Servers can be selected by changing API permissions or with the UUID filters documented below.

## Server inclusion and exclusion

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

## Additional Prometheus metrics

This fork adds the following metrics alongside the existing CPU, memory, disk,
network, uptime, and most-recent-backup metrics:

| Metric | Type | Description |
| --- | --- | --- |
| `pterodactyl_server_backup_count` | Gauge | Number of stored backups for the server. |
| `pterodactyl_server_backup_limit` | Gauge | Maximum backup slots configured for the server. |
| `pterodactyl_server_identity_info` | Gauge | Constant `1`, with the complete UUID in the `uuid` label. |

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
 
## Run with Docker

 - Create a folder named `pterodactyl_exporter`
 
 - Download the config file from GitHub:
 ```
 curl -fsSL -o config.yml https://raw.githubusercontent.com/scalbox/pterodactyl_exporter/main/config.example.yml
 ```
 - Create a folder named `docker`
 
 - Download the `docker-compose.yml` into that folder:
 ```
 curl -fsSL -o docker-compose.yml https://raw.githubusercontent.com/scalbox/pterodactyl_exporter/main/docker/docker-compose.yml
 ```
 - Run the container:
 ```
 docker-compose up -d
 ```
 
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
