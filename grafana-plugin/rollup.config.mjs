import typescript from '@rollup/plugin-typescript';

// Grafana provides these modules via SystemJS; bundle only our own code.
export default {
  input: 'src/module.ts',
  output: {
    file: 'dist/module.js',
    format: 'system',
    sourcemap: true,
  },
  external: (id) => id === 'react' ||
    id === '@grafana/data' || id === '@grafana/runtime',
  plugins: [typescript({ tsconfig: './tsconfig.json' })],
};
