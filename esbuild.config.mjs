import builtins from 'builtin-modules';
import esbuild from 'esbuild';
import process from 'process';

const production = process.argv.includes('production');

await esbuild.build({
  banner: {
    js: '/* Owen Wiki Template Obsidian plugin */',
  },
  bundle: true,
  entryPoints: ['src/main.ts'],
  external: [
    'obsidian',
    'electron',
    '@codemirror/autocomplete',
    '@codemirror/collab',
    '@codemirror/commands',
    '@codemirror/language',
    '@codemirror/lint',
    '@codemirror/search',
    '@codemirror/state',
    '@codemirror/view',
    '@lezer/common',
    '@lezer/highlight',
    '@lezer/lr',
    ...builtins,
  ],
  format: 'cjs',
  logLevel: 'info',
  minify: production,
  outfile: 'main.js',
  platform: 'browser',
  sourcemap: production ? false : 'inline',
  target: 'es2018',
  treeShaking: true,
});