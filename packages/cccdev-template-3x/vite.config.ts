import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { cpSync, mkdirSync, existsSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '../..');
const outDir = resolve(repoRoot, 'dist');
const extDir = resolve(__dirname, 'extension');

function chromeVersion(raw: string): string {
  const m = raw.trim().match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:\.(\d+))?/);
  if (!m) return '0.0.0';
  return [m[1], m[2] ?? '0', m[3] ?? '0'].join('.');
}

function parseBase(raw: unknown): string {
  const m = String(raw ?? '')
    .trim()
    .match(/^(\d+)\.(\d+)/);
  return m ? `${m[1]}.${m[2]}` : '1.0';
}

function readPackage(): { version: string; cccdev?: { versionBase?: string } } & Record<string, unknown> {
  return JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8')) as {
    version: string;
    cccdev?: { versionBase?: string };
  } & Record<string, unknown>;
}

/** 前兩碼來自 cccdev.versionBase；每次 build 只把第三碼 +1（可超過 9，不進位） */
function resolveVersion(): string {
  if (process.env.CCCDEV_VERSION) return chromeVersion(process.env.CCCDEV_VERSION);
  const pkgPath = join(repoRoot, 'package.json');
  const pkg = readPackage();
  const base = parseBase(pkg.cccdev?.versionBase);
  const current = String(pkg.version || `${base}.0`);
  const prefix = `${base}.`;
  let patch = 0;
  if (current.startsWith(prefix)) {
    const last = parseInt(current.slice(prefix.length).split('.')[0] ?? '0', 10);
    patch = Number.isFinite(last) ? last + 1 : 1;
  }
  pkg.version = `${base}.${patch}`;
  if (!pkg.cccdev || typeof pkg.cccdev !== 'object') pkg.cccdev = {};
  (pkg.cccdev as { versionBase: string }).versionBase = base;
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
  return chromeVersion(pkg.version);
}

function copyExtensionStatic() {
  mkdirSync(outDir, { recursive: true });
  const version = resolveVersion();
  const manifest = JSON.parse(readFileSync(join(extDir, 'manifest.json'), 'utf8')) as Record<string, unknown>;
  manifest.version = version;
  writeFileSync(join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  cpSync(join(extDir, 'background.js'), join(outDir, 'background.js'));
  const iconsSrc = join(extDir, 'icons');
  if (existsSync(iconsSrc)) {
    cpSync(iconsSrc, join(outDir, 'icons'), { recursive: true });
  }
}

export default defineConfig({
  plugins: [
    preact(),
    {
      name: 'copy-chrome-extension-static',
      closeBundle() {
        copyExtensionStatic();
      },
    },
  ],
  base: './',
  build: {
    lib: {
      entry: resolve(__dirname, 'src/main.tsx'),
      name: 'CCDevTools',
      formats: ['iife'],
      fileName: () => 'assets/index.js',
    },
    outDir,
    emptyOutDir: true,
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        assetFileNames: 'assets/[name].[ext]',
      },
    },
  },
});
