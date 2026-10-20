# Scalbox Uptime & Restart Monitor (Grafana panel)

Frontend-only panel plugin for the English and Italian dashboards included in
[scalbox/pterodactyl_exporter](https://github.com/scalbox/pterodactyl_exporter).

- **Sources:** `src/`
- **Ready-built Grafana plugin:** `dist/`
- **Compile:** Node.js 22 LTS, from this `grafana-plugin/` directory:
  `npm ci` followed by `npm run check` (or `npm run build` to compile only).
  The build automatically runs `scripts/copy-plugin-json.mjs`, which copies
  metadata and the logo to `dist/` and sets the release version when
  `PLUGIN_VERSION` is specified. **Do not run the copy script manually.**
  On Windows, if npm reports `EBUSY` in a Dropbox/OneDrive checkout,
  follow the PowerShell instructions in the [root README](../README.md#compile-manually-from-source).
- **Automatic Linux install (Grafana 11.5+):** configure Grafana's
  `[plugins] preinstall` setting with the versioned ZIP URL from
  [GitHub Releases](https://github.com/scalbox/pterodactyl_exporter/releases).
  Also allow the specific unsigned plugin ID `scalbox-uptime-panel`.
  See the [exact Linux configuration and upgrade steps](../README.md#automatic-installation-from-a-github-release-linux-grafana-115).
- **Manual install:** copy `dist/` contents to
  `/var/lib/grafana/plugins/scalbox-uptime-panel/`, allow this unsigned plugin
  ID, and restart Grafana.

The full [plugin explanation and installation instructions](../README.md#grafana-uptime-and-restart-panel-plugin)
include Docker, releases, timezone support and limitations of uptime-based
restart counting.
