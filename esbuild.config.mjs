import esbuild from 'esbuild';
import { builtinModules } from 'node:module';
import process from 'process';

const production = process.argv.includes('production');
const builtins = builtinModules.flatMap((moduleName) => (
  moduleName.startsWith('node:') ? [moduleName] : [moduleName, `node:${moduleName}`]
));

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