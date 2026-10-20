import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { PanelProps } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import type { UptimeOptions } from './module';
import {
  buildServers, formatDuration, formatReboot, timelineBins,
  type ServerUptime, type ServerStatus, type UptimeFrame,
} from './model';

type Props = PanelProps<UptimeOptions>;
type Filter = 'all' | 'online' | 'restarted';
type Language = 'en' | 'it';

const PERIODS = [
  { value: 'now-1h', en: 'Last hour', it: 'Ultima ora' },
  { value: 'now-6h', en: 'Last 6 hours', it: 'Ultime 6 ore' },
  { value: 'now-24h', en: 'Last 24 hours', it: 'Ultime 24 ore' },
  { value: 'now-7d', en: 'Last 7 days', it: 'Ultimi 7 giorni' },
  { value: 'now-30d', en: 'Last 30 days', it: 'Ultimi 30 giorni' },
] as const;

const I18N = {
  en: {
    all: 'All', online: 'Online', restarted: 'Restarted', search: 'Search servers or IDs…',
    custom: 'Dashboard range', uptime: 'Uptime', lastReboot: 'Last reboot',
    restarts: 'Restarts', notes: 'Notes', stable: 'No restart detected',
    restartedNote: 'Restart detected', offline: 'Server offline', noData: 'No recent data',
    empty: 'No servers match the filters', missing: 'No uptime metrics received',
    fullName: 'Full server name', resize: 'Drag to resize the server name column',
    dataNote: 'Restart events are estimated from uptime counter resets.',
  },
  it: {
    all: 'Tutti', online: 'Online', restarted: 'Riavviati', search: 'Cerca server o ID…',
    custom: 'Intervallo dashboard', uptime: 'Uptime', lastReboot: 'Ultimo riavvio',
    restarts: 'Riavvii', notes: 'Note', stable: 'Nessun riavvio rilevato',
    restartedNote: 'Riavvio rilevato', offline: 'Server offline', noData: 'Nessun dato recente',
    empty: 'Nessun server corrisponde ai filtri', missing: 'Nessuna metrica uptime ricevuta',
    fullName: 'Nome server completo', resize: 'Trascina per ridimensionare la colonna server',
    dataNote: 'I riavvii sono stimati dai reset del contatore uptime.',
  },
} as const;

const CSS = `
.scalbox-uptime-panel{display:flex;flex-direction:column;min-width:0;width:100%;height:100%;overflow:hidden;
  color:var(--text-primary,#ddd);font-family:inherit;font-size:12px}
.scalbox-uptime-panel *{box-sizing:border-box}
.scalbox-uptime-toolbar{display:flex;flex-wrap:nowrap;align-items:center;gap:8px;min-height:46px;padding:5px 8px;
  border-bottom:1px solid rgba(180,190,205,.16)}
.scalbox-uptime-pills{display:flex;gap:2px;background:rgba(110,120,138,.13);padding:3px;border-radius:7px;flex-shrink:0}
.scalbox-uptime-pills button{font:inherit;border:0;border-radius:5px;padding:5px 8px;background:transparent;
  color:var(--text-secondary,#aab4c0);cursor:pointer;white-space:nowrap}
.scalbox-uptime-pills button.active{background:rgba(85,135,190,.31);color:var(--text-primary,#fff);font-weight:600}
.scalbox-uptime-pills button:hover:not(.active){background:rgba(170,180,190,.12)}
.scalbox-uptime-count{opacity:.75;font-size:10px;margin-left:4px}
.scalbox-uptime-search{background:rgba(110,120,138,.10);color:inherit;border:1px solid rgba(170,185,205,.21);
  border-radius:5px;padding:6px 8px;min-width:70px;width:100%;outline:none;font:inherit}
.scalbox-uptime-search:focus{border-color:#5794f2}
.scalbox-uptime-select{background:var(--background-secondary,#252831);color:inherit;border:1px solid rgba(170,185,205,.24);
  border-radius:5px;padding:6px;max-width:150px;flex-shrink:0;font:inherit;cursor:pointer}
.scalbox-uptime-scroll{flex:1;min-height:0;overflow-y:auto;scrollbar-width:thin;scrollbar-color:#566274 transparent}
.scalbox-uptime-item{border-bottom:1px solid rgba(160,175,195,.11);display:flex;flex-direction:column;
  justify-content:center;gap:5px;padding:4px 8px;overflow:hidden}
.scalbox-uptime-item:nth-child(even){background:rgba(130,150,175,.035)}
.scalbox-uptime-primary{display:grid;align-items:center;column-gap:12px;min-width:0;height:20px}
.scalbox-uptime-server{display:flex;align-items:center;position:relative;gap:6px;min-width:0;overflow:hidden;
  padding-right:9px;white-space:nowrap}
.scalbox-uptime-name{font-weight:600;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.scalbox-uptime-dot{height:7px;width:7px;flex-shrink:0;border-radius:50%;background:#808a97}
.scalbox-uptime-dot.online{background:#56bd76;box-shadow:0 0 6px rgba(86,189,118,.25)}
.scalbox-uptime-dot.offline{background:#e66b68}
.scalbox-uptime-resize{position:absolute;right:0;top:0;height:100%;width:7px;cursor:col-resize;border-right:2px solid transparent}
.scalbox-uptime-resize:hover{border-right-color:#76a6ee}
.scalbox-uptime-timeline{position:relative;display:flex;height:13px;min-width:0;overflow:visible;border-radius:3px;
  background:rgba(95,110,130,.15)}
.scalbox-uptime-bin{height:100%;min-width:0}
.scalbox-uptime-bin:first-child{border-radius:3px 0 0 3px}
.scalbox-uptime-bin:last-child{border-radius:0 3px 3px 0}
.scalbox-uptime-restart{position:absolute;top:-6px;color:#ffae55;font-size:13px;font-weight:900;
  line-height:12px;transform:translateX(-50%);text-shadow:0 1px 2px #12151b}
.scalbox-uptime-value{text-align:right;font-weight:700;font-size:13px;white-space:nowrap;font-variant-numeric:tabular-nums}
.scalbox-uptime-meta{display:flex;align-items:center;gap:15px;min-width:0;font-size:10px;line-height:15px;
  color:var(--text-secondary,#9faabb);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.scalbox-uptime-meta strong{font-weight:500;color:var(--text-primary,#d4d9e3)}
.scalbox-uptime-meta span{min-width:0;overflow:hidden;text-overflow:ellipsis}
.scalbox-uptime-empty{height:100%;display:flex;align-items:center;justify-content:center;text-align:center;
  color:var(--text-secondary,#9faabb);padding:24px}
@media(max-width:610px){
  .scalbox-uptime-toolbar{gap:4px;padding:4px}
  .scalbox-uptime-pills button{padding:5px}
  .scalbox-uptime-primary{column-gap:6px}
  .scalbox-uptime-meta{gap:8px;font-size:9px}
  .scalbox-uptime-select{max-width:108px}
}
`;

const STATUS_COLOR: Record<ServerStatus, string> = {
  online: '#49a96b',
  offline: '#c85b59',
  unknown: '#515b68',
};

function Timeline({ server, from, to, language }: {
  server: ServerUptime; from: number; to: number; language: Language;
}) {
  const bins = useMemo(() => timelineBins(server, from, to), [server, from, to]);
  return (
    <div className="scalbox-uptime-timeline" title={`${server.name} · ${server.restarts} ${I18N[language].restarts.toLowerCase()}`}>
      {bins.map((status, index) => (
        <span className="scalbox-uptime-bin" key={index}
          style={{ flex: 1, backgroundColor: STATUS_COLOR[status] }} />
      ))}
      {server.restartTimes.map((at) => (
        <span className="scalbox-uptime-restart" key={at}
          style={{ left: `${Math.max(0.5, Math.min(99.5, ((at - from) / (to - from)) * 100))}%` }}
          title={formatReboot(at, language, 'UTC')}>▼</span>
      ))}
    </div>
  );
}

export const UptimePanel: React.FC<Props> = ({ data, timeRange, width, height, options, timeZone }) => {
  const language: Language = options.language === 'it' ? 'it' : 'en';
  const txt = I18N[language];
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [columnWidth, setColumnWidth] = useState(170);
  const dragging = useRef<{ startX: number; startWidth: number } | null>(null);
  const from = timeRange.from.valueOf();
  const to = timeRange.to.valueOf();
  const servers = useMemo(
    () => buildServers(data.series as unknown as UptimeFrame[], from, to),
    [data.series, from, to]
  );
  const selectedPeriod = typeof timeRange.raw.from === 'string' &&
    PERIODS.some((period) => period.value === timeRange.raw.from) && timeRange.raw.to === 'now'
    ? timeRange.raw.from : 'custom';
  const onlineCount = servers.filter((server) => server.status === 'online').length;
  const restartedCount = servers.filter((server) => server.restarts > 0).length;
  const visible = servers.filter((server) =>
    (filter === 'all' || (filter === 'online' && server.status === 'online') ||
      (filter === 'restarted' && server.restarts > 0)) &&
    `${server.name} ${server.id}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())
  );
  const displayNameWidth = Math.min(columnWidth, Math.max(120, Math.floor(width * 0.47)));
  const rowHeight = Math.max(44, Math.floor((height - 47) / 6));
  const gridColumns = `${displayNameWidth}px minmax(20px, 1fr) 83px`;

  useEffect(() => {
    const move = (event: PointerEvent) => {
      if (dragging.current) {
        const next = dragging.current.startWidth + event.clientX - dragging.current.startX;
        setColumnWidth(Math.round(Math.max(120, Math.min(width * 0.47, next))));
      }
    };
    const stop = () => { dragging.current = null; };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
    };
  }, [width]);

  const startResize = (event: ReactPointerEvent<HTMLSpanElement>) => {
    event.preventDefault();
    event.stopPropagation();
    dragging.current = { startX: event.clientX, startWidth: displayNameWidth };
  };

  return (
    <div className="scalbox-uptime-panel" style={{ width, height }}>
      <style>{CSS}</style>
      <div className="scalbox-uptime-toolbar">
        <div className="scalbox-uptime-pills">
          {([
            ['all', txt.all, servers.length],
            ['online', txt.online, onlineCount],
            ['restarted', txt.restarted, restartedCount],
          ] as Array<[Filter, string, number]>).map(([key, label, count]) => (
            <button key={key} className={filter === key ? 'active' : ''}
              type="button" onClick={() => setFilter(key)}
              aria-pressed={filter === key}>
              {label}<span className="scalbox-uptime-count">{count}</span>
            </button>
          ))}
        </div>
        <input className="scalbox-uptime-search" type="search"
          aria-label={txt.search} placeholder={txt.search}
          value={search} onChange={(event) => setSearch(event.target.value)} />
        <select className="scalbox-uptime-select" aria-label={txt.custom}
          value={selectedPeriod} onChange={(event) => {
            if (event.target.value !== 'custom') {
              // Keep the panel query and selected period consistent by using
              // Grafana's own dashboard time picker / URL state.
              locationService.partial({ from: event.target.value, to: 'now' });
            }
          }}>
          {selectedPeriod === 'custom' && <option value="custom">{txt.custom}</option>}
          {PERIODS.map((period) => (
            <option key={period.value} value={period.value}>
              {language === 'it' ? period.it : period.en}
            </option>
          ))}
        </select>
      </div>
      <div className="scalbox-uptime-scroll">
        {visible.length === 0 ? (
          <div className="scalbox-uptime-empty">
            {servers.length === 0 ? txt.missing : txt.empty}
          </div>
        ) : visible.map((server) => {
          const statusNote = server.status === 'unknown' ? txt.noData :
            server.status === 'offline' ? txt.offline :
              server.restarts ? txt.restartedNote : txt.stable;
          return (
            <div className="scalbox-uptime-item" style={{ height: rowHeight }} key={server.key}>
              <div className="scalbox-uptime-primary" style={{ gridTemplateColumns: gridColumns }}>
                <div className="scalbox-uptime-server"
                  title={`${txt.fullName}: ${server.name} (ID: ${server.id})`}>
                  <span className={`scalbox-uptime-dot ${server.status}`} />
                  <span className="scalbox-uptime-name">{server.name}</span>
                  <span className="scalbox-uptime-resize" role="separator"
                    aria-label={txt.resize} title={txt.resize}
                    onPointerDown={startResize} />
                </div>
                <Timeline server={server} from={from} to={to} language={language} />
                <span className="scalbox-uptime-value" title={txt.uptime}>
                  {formatDuration(server.uptime, language)}
                </span>
              </div>
              <div className="scalbox-uptime-meta">
                <span title={`${txt.lastReboot}: ${formatReboot(server.lastReboot, language, timeZone)}`}>
                  {txt.lastReboot}: <strong>{formatReboot(server.lastReboot, language, timeZone)}</strong>
                </span>
                <span>{txt.restarts}: <strong>{server.restarts}</strong></span>
                <span title={`${txt.notes}: ${statusNote}. ${txt.dataNote}`}>
                  {txt.notes}: <strong>{statusNote}</strong>
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
