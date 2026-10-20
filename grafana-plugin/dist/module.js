System.register(['@grafana/data', 'react', '@grafana/runtime'], (function (exports) {
    'use strict';
    var PanelPlugin, useState, useRef, useMemo, useEffect, React, locationService;
    return {
        setters: [function (module) {
            PanelPlugin = module.PanelPlugin;
        }, function (module) {
            useState = module.useState;
            useRef = module.useRef;
            useMemo = module.useMemo;
            useEffect = module.useEffect;
            React = module.default;
        }, function (module) {
            locationService = module.locationService;
        }],
        execute: (function () {

            function readAt(values, index) {
                return typeof values.get === 'function' ? values.get(index) : values[index];
            }
            function median(numbers) {
                if (!numbers.length) {
                    return 60000;
                }
                const sorted = [...numbers].sort((a, b) => a - b);
                return sorted[Math.floor(sorted.length / 2)];
            }
            function isRestart(previous, current) {
                if (current.uptime <= 0) {
                    return false;
                }
                if (previous.uptime <= 0) {
                    return true;
                }
                // Ignore small counter jitter but detect drops even if uptime is still positive.
                const tolerance = Math.max(5000, (current.time - previous.time) * 0.15);
                return current.uptime < previous.uptime - tolerance;
            }
            /**
             * Values come from pterodactyl_server_uptime_milliseconds{server_name=~"$server"}.
             * Restart counts are observations (counter drops or 0 -> positive), not an
             * authoritative restart counter: a restart between two polls can be missed.
             */
            function buildServers(frames, from, to) {
                const grouped = new Map();
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
                                sampleGap: 60000,
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
                    server.samples = server.samples.filter((sample, i, samples) => i === samples.length - 1 || sample.time !== samples[i + 1].time);
                    const samples = server.samples;
                    if (!samples.length) {
                        continue;
                    }
                    const gaps = samples.slice(1).map((sample, index) => sample.time - samples[index].time)
                        .filter((gap) => gap > 0);
                    server.sampleGap = median(gaps);
                    // Prometheus may downsample historical ranges; tolerate ~3 scrape steps.
                    const staleAfter = Math.max(60000, Math.min(15 * 60000, server.sampleGap * 3));
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
            function timelineBins(server, from, to, bins = 96) {
                const samples = server.samples;
                const freshness = Math.max(60000, Math.min(15 * 60000, server.sampleGap * 3));
                const result = [];
                let index = -1;
                for (let bin = 0; bin < bins; bin++) {
                    const at = from + ((bin + 0.5) / bins) * (to - from);
                    while (index + 1 < samples.length && samples[index + 1].time <= at) {
                        index++;
                    }
                    if (index === -1 || at - samples[index].time > freshness) {
                        result.push('unknown');
                    }
                    else {
                        result.push(samples[index].uptime > 0 ? 'online' : 'offline');
                    }
                }
                return result;
            }
            function formatDuration(ms, language) {
                if (ms === null || !Number.isFinite(ms)) {
                    return '—';
                }
                const minutes = Math.floor(ms / 60000);
                const days = Math.floor(minutes / 1440);
                const hours = Math.floor((minutes % 1440) / 60);
                const mins = minutes % 60;
                return days > 0 ? `${days}d ${hours}h` : hours > 0 ? `${hours}h ${mins}m` :
                    language === 'it' ? `${mins} min` : `${mins} min`;
            }
            function formatReboot(timestamp, language, grafanaTimeZone) {
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
                }
                catch {
                    return new Date(timestamp).toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
                }
            }

            const PERIODS = [
                { value: 'now-1h', en: 'Last hour', it: 'Ultima ora' },
                { value: 'now-6h', en: 'Last 6 hours', it: 'Ultime 6 ore' },
                { value: 'now-24h', en: 'Last 24 hours', it: 'Ultime 24 ore' },
                { value: 'now-7d', en: 'Last 7 days', it: 'Ultimi 7 giorni' },
                { value: 'now-30d', en: 'Last 30 days', it: 'Ultimi 30 giorni' },
            ];
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
            };
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
            const STATUS_COLOR = {
                online: '#49a96b',
                offline: '#c85b59',
                unknown: '#515b68',
            };
            function Timeline({ server, from, to, language }) {
                const bins = useMemo(() => timelineBins(server, from, to), [server, from, to]);
                return (React.createElement("div", { className: "scalbox-uptime-timeline", title: `${server.name} · ${server.restarts} ${I18N[language].restarts.toLowerCase()}` },
                    bins.map((status, index) => (React.createElement("span", { className: "scalbox-uptime-bin", key: index, style: { flex: 1, backgroundColor: STATUS_COLOR[status] } }))),
                    server.restartTimes.map((at) => (React.createElement("span", { className: "scalbox-uptime-restart", key: at, style: { left: `${Math.max(0.5, Math.min(99.5, ((at - from) / (to - from)) * 100))}%` }, title: formatReboot(at, language, 'UTC') }, "\u25BC")))));
            }
            const UptimePanel = ({ data, timeRange, width, height, options, timeZone }) => {
                const language = options.language === 'it' ? 'it' : 'en';
                const txt = I18N[language];
                const [filter, setFilter] = useState('all');
                const [search, setSearch] = useState('');
                const [columnWidth, setColumnWidth] = useState(170);
                const dragging = useRef(null);
                const from = timeRange.from.valueOf();
                const to = timeRange.to.valueOf();
                const servers = useMemo(() => buildServers(data.series, from, to), [data.series, from, to]);
                const selectedPeriod = typeof timeRange.raw.from === 'string' &&
                    PERIODS.some((period) => period.value === timeRange.raw.from) && timeRange.raw.to === 'now'
                    ? timeRange.raw.from : 'custom';
                const onlineCount = servers.filter((server) => server.status === 'online').length;
                const restartedCount = servers.filter((server) => server.restarts > 0).length;
                const visible = servers.filter((server) => (filter === 'all' || (filter === 'online' && server.status === 'online') ||
                    (filter === 'restarted' && server.restarts > 0)) &&
                    `${server.name} ${server.id}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
                const displayNameWidth = Math.min(columnWidth, Math.max(120, Math.floor(width * 0.47)));
                const rowHeight = Math.max(44, Math.floor((height - 47) / 6));
                const gridColumns = `${displayNameWidth}px minmax(20px, 1fr) 83px`;
                useEffect(() => {
                    const move = (event) => {
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
                const startResize = (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    dragging.current = { startX: event.clientX, startWidth: displayNameWidth };
                };
                return (React.createElement("div", { className: "scalbox-uptime-panel", style: { width, height } },
                    React.createElement("style", null, CSS),
                    React.createElement("div", { className: "scalbox-uptime-toolbar" },
                        React.createElement("div", { className: "scalbox-uptime-pills" }, [
                            ['all', txt.all, servers.length],
                            ['online', txt.online, onlineCount],
                            ['restarted', txt.restarted, restartedCount],
                        ].map(([key, label, count]) => (React.createElement("button", { key: key, className: filter === key ? 'active' : '', type: "button", onClick: () => setFilter(key), "aria-pressed": filter === key },
                            label,
                            React.createElement("span", { className: "scalbox-uptime-count" }, count))))),
                        React.createElement("input", { className: "scalbox-uptime-search", type: "search", "aria-label": txt.search, placeholder: txt.search, value: search, onChange: (event) => setSearch(event.target.value) }),
                        React.createElement("select", { className: "scalbox-uptime-select", "aria-label": txt.custom, value: selectedPeriod, onChange: (event) => {
                                if (event.target.value !== 'custom') {
                                    // Keep the panel query and selected period consistent by using
                                    // Grafana's own dashboard time picker / URL state.
                                    locationService.partial({ from: event.target.value, to: 'now' });
                                }
                            } },
                            selectedPeriod === 'custom' && React.createElement("option", { value: "custom" }, txt.custom),
                            PERIODS.map((period) => (React.createElement("option", { key: period.value, value: period.value }, language === 'it' ? period.it : period.en))))),
                    React.createElement("div", { className: "scalbox-uptime-scroll" }, visible.length === 0 ? (React.createElement("div", { className: "scalbox-uptime-empty" }, servers.length === 0 ? txt.missing : txt.empty)) : visible.map((server) => {
                        const statusNote = server.status === 'unknown' ? txt.noData :
                            server.status === 'offline' ? txt.offline :
                                server.restarts ? txt.restartedNote : txt.stable;
                        return (React.createElement("div", { className: "scalbox-uptime-item", style: { height: rowHeight }, key: server.key },
                            React.createElement("div", { className: "scalbox-uptime-primary", style: { gridTemplateColumns: gridColumns } },
                                React.createElement("div", { className: "scalbox-uptime-server", title: `${txt.fullName}: ${server.name} (ID: ${server.id})` },
                                    React.createElement("span", { className: `scalbox-uptime-dot ${server.status}` }),
                                    React.createElement("span", { className: "scalbox-uptime-name" }, server.name),
                                    React.createElement("span", { className: "scalbox-uptime-resize", role: "separator", "aria-label": txt.resize, title: txt.resize, onPointerDown: startResize })),
                                React.createElement(Timeline, { server: server, from: from, to: to, language: language }),
                                React.createElement("span", { className: "scalbox-uptime-value", title: txt.uptime }, formatDuration(server.uptime, language))),
                            React.createElement("div", { className: "scalbox-uptime-meta" },
                                React.createElement("span", { title: `${txt.lastReboot}: ${formatReboot(server.lastReboot, language, timeZone)}` },
                                    txt.lastReboot,
                                    ": ",
                                    React.createElement("strong", null, formatReboot(server.lastReboot, language, timeZone))),
                                React.createElement("span", null,
                                    txt.restarts,
                                    ": ",
                                    React.createElement("strong", null, server.restarts)),
                                React.createElement("span", { title: `${txt.notes}: ${statusNote}. ${txt.dataNote}` },
                                    txt.notes,
                                    ": ",
                                    React.createElement("strong", null, statusNote)))));
                    }))));
            };

            const plugin = exports("plugin", new PanelPlugin(UptimePanel).setPanelOptions((builder) => builder.addSelect({
                path: 'language',
                name: 'Language / Lingua',
                defaultValue: 'en',
                settings: {
                    options: [
                        { label: 'English', value: 'en' },
                        { label: 'Italiano', value: 'it' },
                    ],
                },
            })));

        })
    };
}));
//# sourceMappingURL=module.js.map
