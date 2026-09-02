import { defineConfig } from 'vite'
import webExtension, { readJsonFile } from 'vite-plugin-web-extension'

function generateManifest() {
  const manifest = readJsonFile('src/manifest.json')
  const pkg = readJsonFile('package.json')
  return {
    name: pkg.name,
    description: pkg.description,
    version: pkg.version,
    ...manifest,
  }
}

export default defineConfig({
  build: {
    minify: false,
    outDir: 'build',
  },
  // public/media/... 会被原样拷贝进构建产物，manifest 与 popup 均按
  // /media/... 路径引用。
  plugins: [
    webExtension({
      manifest: generateManifest,
      additionalInputs: ['src/offscreen.html'],
      // Chrome is the default target so a plain `vite build` works on any OS.
      browser: process.env.VITE_TARGET_BROWSER ?? 'chrome',
    }),
  ],
})
