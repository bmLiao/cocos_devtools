import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { cpSync, mkdirSync, existsSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(__dirname, '../../dist');
const extDir = resolve(__dirname, 'extension');

function copyExtensionStatic() {
  mkdirSync(outDir, { recursive: true });
  cpSync(join(extDir, 'manifest.json'), join(outDir, 'manifest.json'));
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
