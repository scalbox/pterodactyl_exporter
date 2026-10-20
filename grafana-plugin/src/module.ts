import { PanelPlugin } from '@grafana/data';
import { UptimePanel } from './UptimePanel';

export interface UptimeOptions {
  language: 'en' | 'it';
}

export const plugin = new PanelPlugin<UptimeOptions>(UptimePanel).setPanelOptions((builder) =>
  builder.addSelect({
    path: 'language',
    name: 'Language / Lingua',
    defaultValue: 'en',
    settings: {
      options: [
        { label: 'English', value: 'en' },
        { label: 'Italiano', value: 'it' },
      ],
    },
  })
);
