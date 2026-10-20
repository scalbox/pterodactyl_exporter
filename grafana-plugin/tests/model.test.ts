import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildServers, formatDuration, formatReboot, timelineBins, type UptimeFrame,
} from '../src/model';

const BASE = Date.parse('2026-10-20T10:00:00.000Z');

function frame(name: string, id: string, values: Array<[number, number]>): UptimeFrame {
  return {
    fields: [
      { type: 'time', values: values.map(([time]) => BASE + time * 1_000) },
      {
        type: 'number', labels: { server_name: name, id },
        values: values.map(([, uptime]) => uptime),
      },
    ],
  };
}

test('groups full server names by id and recognizes two observed restarts', () => {
  const frames = [
    frame('My production server with a long display name', '12345678', [
      [0, 600_000], [60, 660_000], [120, 30_000],
      [180, 90_000], [240, 0], [300, 40_000], [360, 100_000],
    ]),
    frame('Another server', '87654321', [[0, 10_000], [360, 370_000]]),
  ];
  const servers = buildServers(frames, BASE, BASE + 360_000);
  const first = servers.find((server) => server.id === '12345678');
  assert.ok(first);
  assert.equal(first.name, 'My production server with a long display name');
  assert.equal(first.status, 'online');
  assert.equal(first.restarts, 2);
  assert.deepEqual(first.restartTimes, [BASE + 120_000, BASE + 300_000]);
  assert.equal(first.uptime, 100_000);
  assert.equal(first.lastReboot, BASE + 260_000);
});

test('stopped server is offline and missing recent samples are unknown', () => {
  const stopped = buildServers([frame('Stopped', 'a', [[0, 100_000], [60, 0]])],
    BASE, BASE + 60_000)[0];
  assert.equal(stopped.status, 'offline');
  assert.equal(stopped.uptime, null);
  const stale = buildServers([frame('Stale', 'b', [[0, 100_000], [60, 160_000]])],
    BASE, BASE + 3_600_000)[0];
  assert.equal(stale.status, 'unknown');
});

test('timeline uses unknown for gaps and status from uptime counter', () => {
  const server = buildServers([frame('Server', 'a', [
    [0, 1_000], [60, 61_000], [120, 0], [180, 61_000],
  ])], BASE, BASE + 240_000)[0];
  const bins = timelineBins(server, BASE, BASE + 240_000, 4);
  assert.deepEqual(bins, ['online', 'online', 'offline', 'online']);
});

test('last reboot respects Grafana selected timezone, including daylight saving', () => {
  const instant = Date.parse('2026-10-20T10:30:15Z');
  const utc = formatReboot(instant, 'en', 'UTC');
  const rome = formatReboot(instant, 'it', 'Europe/Rome');
  assert.match(utc, /10:30:15/);
  assert.match(rome, /12:30:15/);
  const winter = formatReboot(Date.parse('2026-01-20T10:30:15Z'), 'it', 'Europe/Rome');
  assert.match(winter, /11:30:15/);
});

test('formats durations and allows zero / no data', () => {
  assert.equal(formatDuration(null, 'en'), '—');
  assert.equal(formatDuration(0, 'en'), '0 min');
  assert.equal(formatDuration(48 * 3_600_000 + 3_600_000, 'en'), '2d 1h');
});
