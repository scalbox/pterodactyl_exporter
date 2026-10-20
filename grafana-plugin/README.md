# Scalbox Uptime & Restart Monitor (Grafana panel)

Frontend-only panel plugin for the English and Italian dashboards included in
[scalbox/pterodactyl_exporter](https://github.com/scalbox/pterodactyl_exporter).

- **Sources:** `src/`
- **Ready-built Grafana plugin:** `dist/`
- **Compile:** Node.js 22 LTS, `npm ci`, then `npm run check`
- **Install:** copy `dist/` contents to
  `/var/lib/grafana/plugins/scalbox-uptime-panel/`, permit unsigned plugin
  `scalbox-uptime-panel` and restart Grafana.

The full [plugin explanation and installation instructions](../README.md#grafana-uptime-and-restart-panel-plugin)
include Docker, releases, timezone support and limitations of uptime-based
restart counting.
