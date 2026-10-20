# Scalbox Uptime & Restart Monitor (Grafana panel)

Frontend-only panel plugin for the English and Italian dashboards included in
[scalbox/pterodactyl_exporter](https://github.com/scalbox/pterodactyl_exporter).
The plugin source is in `src/`, and the ready-built files are in `dist/`.

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

## Install a local build on Linux

These commands assume the default Grafana plugin directory and service account.

1. Create the installation directory:

   ```bash
   sudo install -d -m 755 /var/lib/grafana/plugins/scalbox-uptime-panel
   ```

2. Copy the **contents** of `dist/`:

   ```bash
   sudo cp -a dist/. /var/lib/grafana/plugins/scalbox-uptime-panel/
   ```

3. Assign the files to the Grafana user and group:

   ```bash
   sudo chown -R grafana:grafana /var/lib/grafana/plugins/scalbox-uptime-panel
   ```

4. Set permissions on directories (`755`):

   ```bash
   sudo find /var/lib/grafana/plugins/scalbox-uptime-panel -type d -exec chmod 755 {} +
   ```

5. Set permissions on files (`644`):

   ```bash
   sudo find /var/lib/grafana/plugins/scalbox-uptime-panel -type f -exec chmod 644 {} +
   ```

6. Open Grafana's configuration:

   ```bash
   sudo nano /etc/grafana/grafana.ini
   ```

   In the existing `[plugins]` section, enable only this trusted unsigned plugin:

   ```ini
   [plugins]
   allow_loading_unsigned_plugins = scalbox-uptime-panel
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
