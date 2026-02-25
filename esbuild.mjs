import * as esbuild from 'esbuild';

const isWatch = process.argv.includes('--watch');

/** @type {import('esbuild').BuildOptions} */
const extensionConfig = {
  entryPoints: ['src/extension.ts'],
  bundle: true,
  external: ['vscode'],
  format: 'cjs',
  platform: 'node',
  outfile: 'out/extension.js',
  sourcemap: true,
};

/** @type {import('esbuild').BuildOptions} */
const webviewConfig = {
  entryPoints: ['webview-src/index.tsx'],
  bundle: true,
  format: 'iife',
  platform: 'browser',
  outdir: 'out',
  entryNames: 'webview',
  sourcemap: true,
  jsx: 'automatic',
  loader: { '.ttf': 'base64' },
};

if (isWatch) {
  const [extCtx, webCtx] = await Promise.all([
    esbuild.context(extensionConfig),
    esbuild.context(webviewConfig),
  ]);
  await Promise.all([extCtx.watch(), webCtx.watch()]);
  console.log('[ERManager] Watching...');
} else {
  await Promise.all([
    esbuild.build(extensionConfig),
    esbuild.build(webviewConfig),
  ]);
  console.log('[ERManager] Build complete');
}
