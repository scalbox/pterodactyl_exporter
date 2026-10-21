// ==UserScript==
// @name         Scalbox Grafana - Panel tooltip for server legends
// @namespace    https://github.com/scalbox/pterodactyl_exporter
// @version      1.0.0
// @description  Show only server names in legends while retaining "panel - server" on hover.
// @match        *://*/d/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(() => {
  "use strict";

  // Native Grafana Time series panels use the same display name in legends
  // and tooltips. The dashboard supplies "panel - server" as the series name;
  // this userscript shortens only the visible legend name.
  // The selector is deliberately limited to Grafana legend containers.
  const LEGEND_SELECTOR = [
    '[data-testid="viz-legend"]',
    '[data-testid="viz-legend-table"]',
    '[class*="viz-legend"]',
    '[class*="VizLegend"]',
    '.u-legend'
  ].join(", ");

  // RX/TX suffixes are preserved for combined network charts.
  const SERIES_PATTERN = /^(.+?) - (.+?)( · (?:RX|TX))?$/;
  const converted = new WeakMap();
  let pending = false;

  function transformName(node) {
    if (!(node instanceof HTMLElement) || node.children.length > 0) return;
    const raw = node.textContent?.trim();
    if (!raw) return;
    const match = raw.match(SERIES_PATTERN);
    if (!match) return;

    const panel = match[1].trim();
    const server = match[2].trim();
    const direction = match[3] || "";
    if (!panel || !server) return;

    const fullName = `${panel} - ${server}${direction}`;
    const previous = converted.get(node);
    if (previous?.fullName === fullName) return;

    node.textContent = server + direction;
    node.setAttribute("title", fullName);
    converted.set(node, { fullName });
  }

  function scan() {
    pending = false;
    document.querySelectorAll(LEGEND_SELECTOR).forEach((legend) => {
      // Leaf nodes only: never touch the table panels or the graph tooltip.
      legend.querySelectorAll("span, div, a").forEach(transformName);
    });
  }

  function schedule() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(scan);
  }

  new MutationObserver(schedule).observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true
  });
  schedule();
})();
