import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';

await mkdir('dist', { recursive: true });
const plugin = JSON.parse(await readFile('src/plugin.json', 'utf8'));
const releaseVersion = process.env.PLUGIN_VERSION;
if (releaseVersion) {
  if (!/^\d+\.\d+\.\d+$/.test(releaseVersion)) {
    throw new Error('PLUGIN_VERSION must be a stable X.Y.Z version');
  }
  plugin.info.version = releaseVersion;
}
await writeFile('dist/plugin.json', JSON.stringify(plugin, null, 2) + '\n');
await mkdir('dist/img', { recursive: true });
await copyFile('src/img/logo.svg', 'dist/img/logo.svg');
