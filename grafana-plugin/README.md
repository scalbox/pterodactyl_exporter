# Scalbox - Pterodactyl Uptime & Restart Monitor (Grafana panel)

Experimental frontend-only Grafana panel plugin developed by Scalbox for
[scalbox/pterodactyl_exporter](https://github.com/scalbox/pterodactyl_exporter).
The plugin source is in `src/`, and the ready-built files are in `dist/`.

> **Status: BETA — DISABLED.** This plugin is **not included or referenced** in
> either bundled English or Italian Grafana dashboard. Both dashboards use the
> native **Uptime - History** and **Uptime - Summary** panels (with translated
> titles in Italian). The plugin source and compiled build are retained for
> development and testing only; it is not currently recommended for normal use.
>
> Installing the plugin does **not** activate it in the supplied dashboards.
> To evaluate the beta, manually add the `scalbox-pterodactyl-uptime` panel
> visualization in Grafana and configure an uptime query.

## Compile manually

Requires **Node.js 22 LTS** and npm. From the `grafana-plugin/` directory,
run each command in order:

1. Install dependencies:

   ```bash
   npm ci
   ```

2. Run tests and compile:

   ```bash
   npm run check
   ```

   Alternatively, use `npm run build` to compile without tests.

3. Verify the result:

   ```bash
   ls -l dist/module.js dist/plugin.json dist/img/logo.svg
   ```

`scripts/copy-plugin-json.mjs` runs automatically during the build. It copies
the plugin metadata and logo into `dist/` and sets the version when
`PLUGIN_VERSION` is supplied. **Do not run it manually.**

## Install a local build on Linux (beta testing only)

**Not required for the bundled dashboards.** Install only if you intend to
create a separate experimental Grafana panel manually.

These commands assume the default Grafana plugin directory and service account.

1. Create the installation directory:

   ```bash
   sudo install -d -m 755 /var/lib/grafana/plugins/scalbox-pterodactyl-uptime
   ```

2. Copy the **contents** of `dist/`:

   ```bash
   sudo cp -a dist/. /var/lib/grafana/plugins/scalbox-pterodactyl-uptime/
   ```

3. Assign the files to the Grafana user and group:

   ```bash
   sudo chown -R grafana:grafana /var/lib/grafana/plugins/scalbox-pterodactyl-uptime
   ```

4. Set permissions on directories (`755`):

   ```bash
   sudo find /var/lib/grafana/plugins/scalbox-pterodactyl-uptime -type d -exec chmod 755 {} +
   ```

5. Set permissions on files (`644`):

   ```bash
   sudo find /var/lib/grafana/plugins/scalbox-pterodactyl-uptime -type f -exec chmod 644 {} +
   ```

6. Open Grafana's configuration:

   ```bash
   sudo nano /etc/grafana/grafana.ini
   ```

   In the existing `[plugins]` section, enable only this trusted unsigned plugin:

   ```ini
   [plugins]
   allow_loading_unsigned_plugins = scalbox-pterodactyl-uptime
   ```

7. Restart Grafana:

   ```bash
   sudo systemctl restart grafana-server
   ```

For a ZIP downloaded from GitHub Releases, follow the
[manual ZIP installation guide](../README.md#manual-installation-from-a-zip).
For **Grafana 11.5+**, you can also
[install a release automatically on Grafana startup](../README.md#automatic-installation-from-a-github-release-linux-grafana-115)
using `preinstall`, without compiling or manually copying files. When Grafana
manages the installation itself, you do not need to run the manual `chown` and
`chmod` commands above.

For Windows/Dropbox `EBUSY` build errors, Docker deployment, version upgrades,
timezone behavior, and restart-count limitations, see the
[main README](../README.md#grafana-uptime-and-restart-panel-plugin).
