export type ServerStatus = 'online' | 'offline' | 'unknown';

export interface UptimeSample {
  time: number;
  uptime: number;
}

export interface ServerUptime {
  key: string;
  name: string;
  id: string;
  samples: UptimeSample[];
  status: ServerStatus;
  uptime: number | null;
  lastReboot: number | null;
  restarts: number;
  restartTimes: number[];
  sampleGap: number;
}

interface Values {
  length: number;
  [index: number]: unknown;
  get?(index: number): unknown;
}

export interface UptimeFrame {
  name?: string;
  fields: Array<{
    type: string;
    name?: string;
    labels?: Record<string, string>;
    values: Values;
  }>;
}

function readAt(values: Values, index: number): unknown {
  return typeof values.get === 'function' ? values.get(index) : values[index];
}

function median(numbers: number[]): number {
  if (!numbers.length) {
    return 60_000;
  }
  const sorted = [...numbers].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function isRestart(previous: UptimeSample, current: UptimeSample): boolean {
  if (current.uptime <= 0) {
    return false;
  }
  if (previous.uptime <= 0) {
    return true;
  }
  // Ignore small counter jitter but detect drops even if uptime is still positive.
  const tolerance = Math.max(5_000, (current.time - previous.time) * 0.15);
  return current.uptime < previous.uptime - tolerance;
}

/**
 * Values come from pterodactyl_server_uptime_milliseconds{server_name=~"$server"}.
 * Restart counts are observations (counter drops or 0 -> positive), not an
 * authoritative restart counter: a restart between two polls can be missed.
 */
export function buildServers(frames: UptimeFrame[], from: number, to: number): ServerUptime[] {
  const grouped = new Map<string, ServerUptime>();

  for (const frame of frames) {
    const time = frame.fields.find((field) => field.type === 'time');
    if (!time) {
      continue;
    }

    for (const field of frame.fields.filter((item) => item.type === 'number')) {
      const labels = field.labels ?? {};
      const name = labels.server_name || frame.name || 'Unknown server';
      const id = labels.id || '—';
      const key = id === '—' ? name : id;
      let server = grouped.get(key);
      if (!server) {
        server = {
          key, name, id, samples: [], status: 'unknown',
          uptime: null, lastReboot: null, restarts: 0, restartTimes: [],
          sampleGap: 60_000,
        };
        grouped.set(key, server);
      }
      server.name = labels.server_name || server.name;

      const len = Math.min(time.values.length, field.values.length);
      for (let index = 0; index < len; index++) {
        const timestamp = Number(readAt(time.values, index));
        const uptime = Number(readAt(field.values, index));
        if (Number.isFinite(timestamp) && Number.isFinite(uptime) &&
          timestamp >= from && timestamp <= to && uptime >= 0) {
          server.samples.push({ time: timestamp, uptime });
        }
      }
    }
  }

  for (const server of grouped.values()) {
    server.samples.sort((a, b) => a.time - b.time);
    server.samples = server.samples.filter((sample, i, samples) =>
      i === samples.length - 1 || sample.time !== samples[i + 1].time
    );
    const samples = server.samples;
    if (!samples.length) {
      continue;
    }

    const gaps = samples.slice(1).map((sample, index) => sample.time - samples[index].time)
      .filter((gap) => gap > 0);
    server.sampleGap = median(gaps);
    // Prometheus may downsample historical ranges; tolerate ~3 scrape steps.
    const staleAfter = Math.max(60_000, Math.min(15 * 60_000, server.sampleGap * 3));
    const last = samples[samples.length - 1];
    server.status = to - last.time > staleAfter
      ? 'unknown'
      : last.uptime > 0 ? 'online' : 'offline';
    server.uptime = server.status === 'online' ? last.uptime : null;
    const positive = [...samples].reverse().find((sample) => sample.uptime > 0);
    server.lastReboot = positive ? positive.time - positive.uptime : null;

    for (let i = 1; i < samples.length; i++) {
      if (isRestart(samples[i - 1], samples[i])) {
        server.restartTimes.push(samples[i].time);
      }
    }
    server.restarts = server.restartTimes.length;
  }

  return [...grouped.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** Sample-state lookup for a uniformly spaced SVG timeline. */
export function timelineBins(server: ServerUptime, from: number, to: number, bins = 96): ServerStatus[] {
  const samples = server.samples;
  const freshness = Math.max(60_000, Math.min(15 * 60_000, server.sampleGap * 3));
  const result: ServerStatus[] = [];
  let index = -1;

  for (let bin = 0; bin < bins; bin++) {
    const at = from + ((bin + 0.5) / bins) * (to - from);
    while (index + 1 < samples.length && samples[index + 1].time <= at) {
      index++;
    }
    if (index === -1 || at - samples[index].time > freshness) {
      result.push('unknown');
    } else {
      result.push(samples[index].uptime > 0 ? 'online' : 'offline');
    }
  }
  return result;
}

export function formatDuration(ms: number | null, language: 'en' | 'it'): string {
  if (ms === null || !Number.isFinite(ms)) {
    return '—';
  }
  const minutes = Math.floor(ms / 60_000);
  const days = Math.floor(minutes / 1_440);
  const hours = Math.floor((minutes % 1_440) / 60);
  const mins = minutes % 60;
  return days > 0 ? `${days}d ${hours}h` : hours > 0 ? `${hours}h ${mins}m` :
    language === 'it' ? `${mins} min` : `${mins} min`;
}

export function formatReboot(
  timestamp: number | null, language: 'en' | 'it', grafanaTimeZone: string
): string {
  if (timestamp === null || !Number.isFinite(timestamp)) {
    return '—';
  }
  const timeZone = grafanaTimeZone.toLowerCase() === 'browser' || !grafanaTimeZone
    ? undefined
    : grafanaTimeZone.toLowerCase() === 'utc' ? 'UTC' : grafanaTimeZone;
  try {
    return new Intl.DateTimeFormat(language === 'it' ? 'it-IT' : 'en-GB', {
      timeZone, day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    }).format(new Date(timestamp));
  } catch {
    return new Date(timestamp).toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
  }
}
