# Scalbox - Pterodactyl Uptime & Restart Monitor (Grafana panel)

Experimental, frontend-only Grafana panel for Pterodactyl server uptime and
restart monitoring. It was developed by Scalbox as part of
[scalbox/pterodactyl_exporter](https://github.com/scalbox/pterodactyl_exporter).

The source code is available in [`src/`](src/), the built plugin in
[`dist/`](dist/), and the standard English/Italian dashboards in
[`../dashboards/`](../dashboards/).

## What the plugin does

The plugin displays a per-server uptime timeline, detects probable restarts
from changes in uptime, and provides filters, server-name search, and a
timezone-aware estimate of the last reboot. It complements Grafana's built-in
Table and Time series panels with a specialized interactive view.

The exporter exposes the `pterodactyl_server_uptime_milliseconds` metric
used by this panel. No additional service needs to run on game servers.

## Current status

**BETA — DISABLED.** The plugin is **not included or referenced** in either
bundled English or Italian dashboard JSON file. These dashboards use only
standard Grafana panels, including **Uptime - History** and
**Uptime - Summary** (with Italian equivalents).

The source code, compiled files, build instructions, and release packaging are
preserved for development and testing. Installing this unsigned beta plugin
does **not** automatically add a panel to the dashboards. To test it, manually
create a Grafana panel using the `scalbox-pterodactyl-uptime` visualization
and a Prometheus uptime query.

The beta plugin is not currently recommended for normal production dashboard
use. It remains entirely optional.

## Table of contents

- [What the plugin does](#what-the-plugin-does)
- [Current status](#current-status)
- [Compile from source](#compile-from-source)
- [Features and limitations](#features-and-limitations)
- [Install a compiled beta plugin](#install-a-compiled-beta-plugin)
  - [Automatic installation from a GitHub Release (Linux, Grafana 11.5+)](#automatic-installation-from-a-github-release-linux-grafana-115)
  - [Manual installation from a ZIP](#manual-installation-from-a-zip)
- [Install a local build on Linux](#install-a-local-build-on-linux)
- [Build troubleshooting](#build-troubleshooting)
- [Releases and distribution](#releases-and-distribution)
- [Grafana compatibility](#grafana-compatibility)

## Compile from source

Use **Node.js 22 LTS** and npm. On Linux, perform **each step in order**.
On Windows PowerShell or macOS, the npm commands are the same; only the
Linux-specific installation commands below differ.

1. **Verify Node.js and npm**:

   ```bash
   node --version
   ```

   ```bash
   npm --version
   ```

2. **Clone the repository** if you do not already have a local checkout:

   ```bash
   git clone https://github.com/scalbox/pterodactyl_exporter.git
   ```

3. **Open the plugin's source directory**:

   ```bash
   cd pterodactyl_exporter/grafana-plugin
   ```

   If the repository is already cloned, run `cd` from its parent directory
   or navigate directly to the existing `grafana-plugin/` folder.

4. **Install the exact locked dependencies**:

   ```bash
   npm ci
   ```

5. **Run tests, validate TypeScript and compile the plugin**:

   ```bash
   npm run check
   ```

   To compile without running the tests, use `npm run build` instead.

6. **Verify the generated files**:

   ```bash
   ls -l dist/module.js dist/plugin.json dist/img/logo.svg
   ```

**What does `scripts/copy-plugin-json.mjs` do?** It is a build helper, not an
additional command to run manually. `npm run build` first validates the
TypeScript code and compiles the Grafana SystemJS module with Rollup, then
automatically runs this script. It copies `src/plugin.json` and the SVG logo
into `dist/`. If the release workflow provides the `PLUGIN_VERSION`
environment variable (for example `1.0.13`), the script also updates
`dist/plugin.json` to that version so it matches the Git tag.
The script is **source/build tooling only** and is not included in the
installable release ZIP.

## Features and limitations

Grafana's standard Table, Time series and State timeline panels cover
individual needs, but a single built-in panel cannot combine this specific
two-line-per-server layout with all the interactive filters, restart markers,
resizable name column and internal scrolling. The plugin provides that
alternative view without installing software on Pterodactyl game servers. It
uses the same metric `pterodactyl_server_uptime_milliseconds`.

Features currently implemented in the beta source:

- Uptime timeline per server (green = running, red = stopped, grey = missing
  samples), with orange restart markers derived from detected uptime resets.
- **All / Online / Restarted** filters with counts and case-insensitive search
  by full server name or server ID.
- A time selector (1 hour, 6 hours, 24 hours, 7 days or 30 days) **synchronized
  with Grafana's dashboard time range**, so the Prometheus query fetches data
  for the selected interval. Changing it also changes the dashboard's other
  panels, as does Grafana's own time picker.
- Full server names on hover, ellipsis for long names and a draggable separator
  to resize the server-name column.
- Two lines per server: timeline/current uptime, then **Last reboot (complete
  date and time), Restarts and Notes**. The reboot date/time is formatted using
  the **timezone selected in the Grafana dashboard**, including DST.
- Internal **vertical scrolling**, sized to display about six server entries at
  a time with the standard 12-grid-unit panel height.
- English and Italian labels supported through the plugin's panel language
  setting. The imported dashboards do not configure or load the beta panel.

**Accuracy note:** The exporter currently exposes an uptime gauge, not a
separate authoritative restart-event history. The plugin **estimates** restarts
from uptime counter decreases or transitions from zero to a positive value.
Restarts that occur entirely between two Prometheus samples may be missed.
The last reboot time is estimated from `sample timestamp - measured uptime`.
An uptime of zero is shown as offline, and stale/missing samples as unknown.
Notes are automatically derived status messages; they are not editable.
Past history is limited by your Prometheus retention and scrape interval.

## Install a compiled beta plugin

**Beta — disabled in the supplied dashboards.** These installation steps are
preserved for developers and testers. Regular dashboard users should skip
plugin installation: both dashboards already provide native uptime panels.

The **source code** is in
[`src/`](src/), and the **ready-built plugin**
is committed in [`dist/`](dist/).
Every new version tag published through the GitHub Actions release workflow
also builds/tests the plugin and adds the installable asset
`scalbox-pterodactyl-uptime-1.0.13.zip` to the
[GitHub Releases](https://github.com/scalbox/pterodactyl_exporter/releases)
page alongside the Python packages.


**Plugin ID update:** use a release created after the plugin was renamed.
Older release ZIP files have a different plugin ID and folder name, and are
not compatible with the new configuration examples below. When upgrading an
existing installation, remove the previously installed plugin directory,
install the new release ZIP, and manually configure a test panel if needed.
The bundled dashboard JSON files do not reference the plugin.

### Automatic installation from a GitHub Release (Linux, Grafana 11.5+)

**Added by Scalbox in this fork.** On a self-hosted Linux instance of
**Grafana 11.5 or newer**, Grafana can download and install our plugin directly
from the ZIP published in [GitHub Releases](https://github.com/scalbox/pterodactyl_exporter/releases)
when Grafana starts. No local Node.js build or manual extraction is needed.

1. **Open Grafana's configuration file**:

   ```bash
   sudo nano /etc/grafana/grafana.ini
   ```

   Edit the existing `[plugins]` section (do not create a duplicate). Add:

   ```ini
   [plugins]
   allow_loading_unsigned_plugins = scalbox-pterodactyl-uptime
   preinstall = scalbox-pterodactyl-uptime@1.0.13@https://github.com/scalbox/pterodactyl_exporter/releases/download/1.0.13/scalbox-pterodactyl-uptime-1.0.13.zip
   ```

   The release workflow sets the **same version** in the plugin ID, download
   URL and ZIP filename in this example, **only after the ZIP is published**.
   Use the resulting versioned entry in your own `grafana.ini`. The Grafana
   host must be able to reach GitHub and follow ZIP download redirects. If
   other plugins are already listed in `preinstall`, preserve them and append
   this entry with a comma.

2. **Restart Grafana**:

   ```bash
   sudo systemctl restart grafana-server
   ```

   **Inspect the logs** if installation fails:

   ```bash
   sudo journalctl -u grafana-server -b --no-pager -n 80
   ```

   After installation finishes, check **Administration > Plugins and data >
   Plugins** in Grafana. To test the beta, create a panel manually;
   the bundled dashboards do not contain the plugin visualization. Grafana
   installs `preinstall` plugins in the background, so the plugin might not
   appear immediately after the service starts.

3. **Upgrade to a new release:** change the version and **both** versioned URL
   components to the new tag, then restart Grafana. Because this plugin is
   downloaded from a **custom GitHub URL** rather than the official Grafana
   catalog, **do not assume Grafana will discover or install new GitHub
   releases automatically**. Pinning a version makes deployments predictable.

   Grafana refuses to load this unsigned plugin unless the exact plugin ID is
   allowed as shown. Only permit code from a source you trust; this exception
   does **not** disable signature checks for every plugin.

For Grafana **older than 11.5**, use the manual ZIP installation below (or
Grafana's CLI with `--pluginUrl`). This is a server-side installation:
**Grafana does not currently offer a ZIP upload button in its normal web UI**.

### Manual installation from a ZIP

Follow these steps on a standard **Linux installation of Grafana**. The ZIP
already contains the required `scalbox-pterodactyl-uptime/` directory. You need
`curl` and `unzip` installed. Use a release that includes the plugin ZIP.

1. **Use the published plugin version maintained by the release workflow:**

   ```bash
   PLUGIN_VERSION="1.0.13"
   ```

2. **Download the compiled plugin** from GitHub Releases:

   ```bash
   curl -fL -o "scalbox-pterodactyl-uptime-$PLUGIN_VERSION.zip" "https://github.com/scalbox/pterodactyl_exporter/releases/download/$PLUGIN_VERSION/scalbox-pterodactyl-uptime-$PLUGIN_VERSION.zip"
   ```

3. **Create Grafana's plugin directory** if needed:

   ```bash
   sudo install -d -m 755 /var/lib/grafana/plugins
   ```

4. **Extract the plugin**, keeping the directory name supplied in the ZIP:

   ```bash
   sudo unzip "scalbox-pterodactyl-uptime-$PLUGIN_VERSION.zip" -d /var/lib/grafana/plugins/
   ```

   If an older copy is already installed, `unzip` may ask whether to
   overwrite existing files. Back up any local modifications before upgrading.

5. **Assign ownership to Grafana's service account**:

   ```bash
   sudo chown -R grafana:grafana /var/lib/grafana/plugins/scalbox-pterodactyl-uptime
   ```

6. **Grant directory permissions** (`755`: read/traverse access):

   ```bash
   sudo find /var/lib/grafana/plugins/scalbox-pterodactyl-uptime -type d -exec chmod 755 {} +
   ```

7. **Grant file permissions** (`644`: Grafana can read the JavaScript,
   metadata and images; executable permission is unnecessary):

   ```bash
   sudo find /var/lib/grafana/plugins/scalbox-pterodactyl-uptime -type f -exec chmod 644 {} +
   ```

8. **Allow this specific unsigned plugin.** Edit Grafana's configuration:

   ```bash
   sudo nano /etc/grafana/grafana.ini
   ```

   In the existing `[plugins]` section (do not add a duplicate), set:

   ```ini
   [plugins]
   allow_loading_unsigned_plugins = scalbox-pterodactyl-uptime
   ```

   This permits only the named custom plugin, not all unsigned plugins.
   Only use an unsigned plugin if you trust/review its source.

9. **Restart Grafana** to load the plugin:

   ```bash
   sudo systemctl restart grafana-server
   ```

10. **Check the logs** if the plugin is missing or fails to load:

    ```bash
    sudo journalctl -u grafana-server -b --no-pager -n 80
    ```

11. **Open Grafana** and check **Administration > Plugins and data > Plugins**.
    To evaluate the beta, manually create a panel with the custom visualization
    and a Prometheus uptime query. The [Italian](../dashboards/Pterodactyl-Server-Network-it.json)
    and [English](../dashboards/Pterodactyl-Server-Network-en.json) dashboards
    work independently and do not contain the plugin panel.

These commands assume Grafana runs as user/group `grafana:grafana` and uses the
default plugin path `/var/lib/grafana/plugins/`. Adjust both for a customized
Grafana service or plugin directory. Do **not** use `chmod 777`.

**Grafana running in Docker/Compose:** mount the extracted plugin directory
inside the container at `/var/lib/grafana/plugins/scalbox-pterodactyl-uptime/` and
set `GF_PLUGINS_ALLOW_LOADING_UNSIGNED_PLUGINS=scalbox-pterodactyl-uptime`. File
ownership must be readable by the Grafana user **inside the container**.
The plugin runs only in Grafana; no daemon is added to Pterodactyl game servers.

## Install a local build on Linux

These steps are for development and beta testing after running
[Compile from source](#compile-from-source). The imported dashboards do not
require or use the custom plugin.

1. **Create the Grafana plugin directory**:

   ```bash
   sudo install -d -m 755 /var/lib/grafana/plugins/scalbox-pterodactyl-uptime
   ```

2. **Copy the compiled files (the contents of `dist/`)**:

   ```bash
   sudo cp -a dist/. /var/lib/grafana/plugins/scalbox-pterodactyl-uptime/
   ```

3. **Set the owner and group**:

   ```bash
   sudo chown -R grafana:grafana /var/lib/grafana/plugins/scalbox-pterodactyl-uptime
   ```

4. **Set directory permissions**:

    ```bash
    sudo find /var/lib/grafana/plugins/scalbox-pterodactyl-uptime -type d -exec chmod 755 {} +
    ```

5. **Set file permissions**:

    ```bash
    sudo find /var/lib/grafana/plugins/scalbox-pterodactyl-uptime -type f -exec chmod 644 {} +
    ```

6. **Open Grafana's configuration file**:

    ```bash
    sudo nano /etc/grafana/grafana.ini
    ```

    In the existing `[plugins]` section add
    `allow_loading_unsigned_plugins = scalbox-pterodactyl-uptime`, as shown in
    [manual installation](#manual-installation-from-a-zip).

7. **Restart Grafana**:

    ```bash
    sudo systemctl restart grafana-server
    ```

    If needed, inspect the service logs:

    ```bash
    sudo journalctl -u grafana-server -b --no-pager -n 80
    ```

## Build troubleshooting

**Windows / Dropbox troubleshooting:** `npm ci` deliberately removes an
existing `node_modules/` before reinstalling packages. On Windows,
`npm error EBUSY: resource busy or locked, rmdir ...\\node_modules\\...`
means that another process is holding files open. If your checkout is under
Dropbox or OneDrive, pause synchronization, close programs using the folder
(e.g. IDEs and terminals running Node), then retry `npm ci`.
If the folder continues to be locked, build from a local non-synchronized copy.
In **PowerShell**, starting from the original `grafana-plugin` folder:

```powershell
$buildDir = Join-Path $env:LOCALAPPDATA 'Scalbox\grafana-plugin-build'
New-Item -ItemType Directory -Path $buildDir -Force | Out-Null
robocopy . $buildDir /E /XD node_modules
Set-Location $buildDir
npm ci
npm run check
```

The compiled plugin will then be in `$buildDir\dist`. This copies the
current source files, including any local edits, but excludes the locked
`node_modules/` directory. Avoid running npm commands in two terminals at
once. Do not delete or replace `package-lock.json` to work around EBUSY.

**Warnings versus errors:** `npm warn ERESOLVE` and deprecation notices
from transitive Grafana 10.3.1 development dependencies are warnings, not
build failures. If `npm ci` finishes with `added ... packages`, continue
with `npm run check`. `npm audit` can report issues in the development
toolchain even though these packages are not bundled into the compiled
plugin; use `npm audit --omit=dev` to separately inspect production
dependencies. Do **not** run `npm audit fix --force` without reviewing
the proposed dependency and compatibility changes.

## Releases and distribution

The release workflow is in
[`.github/workflows/publish-docker.yml`](../.github/workflows/publish-docker.yml):
it runs `npm ci` and `npm run check`, packages the resulting `dist` under
its plugin-ID directory, and uploads the versioned ZIP as a GitHub Release
asset when a stable tag (for example, `1.0.13`) is pushed. The same workflow
continues to publish the original Python and Docker artifacts.

**GitHub Releases vs Grafana catalog:** the workflow automatically publishes the
compiled plugin ZIP to **GitHub Releases** on each stable version tag. This
does **not** list it in Grafana's official plugin catalog or make the web UI's
**Install** button available. Official catalog distribution requires a plugin
submission, Grafana Labs review and signing; review is not automated by this
workflow.

## Grafana compatibility

The dashboards' built-in uptime table requires **no custom plugin** and uses
the existing Prometheus datasource. The **beta uptime plugin is currently
disabled in the supplied dashboards**, while its source and build instructions
remain available for testing. The experimental plugin targets Grafana **10.3
or newer** and can only be tested where administrators permit its unsigned ID;
managed Grafana services may not allow unsigned plugins.
