import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createElement } from 'react';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import test from 'node:test';
import vm from 'node:vm';

test('compiled SystemJS module loads and renders the Italian Grafana panel', async () => {
  const compiled = await readFile(new URL('../dist/module.js', import.meta.url), 'utf8');
  const result = {};
  let dependencies = [];
  const imports = {
    '@grafana/data': {
      PanelPlugin: class {
        constructor(component) {
          this.component = component;
        }
        setPanelOptions() { return this; }
      },
    },
    react: { ...React, default: React },
    '@grafana/runtime': { locationService: { partial() {} } },
  };

  vm.runInNewContext(compiled, {
    System: {
      register(depNames, declare) {
        dependencies = depNames;
        const declaration = declare((name, value) => { result[name] = value; });
        declaration.setters.forEach((setter, index) => setter(imports[depNames[index]]));
        declaration.execute();
      },
    },
  });
  assert.deepEqual(Array.from(dependencies), ['@grafana/data', 'react', '@grafana/runtime']);
  assert.ok(result.plugin?.component);

  const last = Date.parse('2026-10-20T10:30:15Z');
  const html = renderToStaticMarkup(createElement(result.plugin.component, {
    data: {
      series: [{
        fields: [
          { type: 'time', values: [last - 60_000, last] },
          { type: 'number', labels: { server_name: 'Very long production server name', id: '12345678' },
            values: [3_540_000, 3_600_000] },
        ],
      }],
    },
    timeRange: {
      from: new Date(last - 86_400_000),
      to: new Date(last),
      raw: { from: 'now-24h', to: 'now' },
    },
    options: { language: 'it' }, timeZone: 'Europe/Rome',
    width: 740, height: 360,
  }));

  assert.match(html, /Very long production server name/);
  assert.match(html, /Ultimo riavvio/);
  assert.match(html, /11:30:15/); // 10:30 UTC sample minus 1h uptime => Rome 11:30
  assert.match(html, /Ultime 24 ore/);
});
