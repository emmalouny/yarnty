import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join, posix, relative, sep } from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Writes the built file list into the service worker at build time.
 *
 * Without this the service worker could only precache the shell, because
 * Vite fingerprints asset filenames and they aren't known when sw.js is
 * written. That left a hole big enough to drive the whole product through:
 * on a first visit the worker installs but is not yet controlling the page,
 * so the JS and CSS requests never pass through it and are never cached.
 * Lose signal before your second visit and the app is a white screen —
 * which is precisely the situation it exists to survive.
 */
function precacheManifest(outDir = 'dist'): Plugin {
  return {
    name: 'yarnty:precache-manifest',
    apply: 'build',
    async closeBundle() {
      const files: string[] = []

      async function walk(dir: string): Promise<void> {
        for (const entry of await readdir(dir, { withFileTypes: true })) {
          const full = join(dir, entry.name)
          if (entry.isDirectory()) await walk(full)
          else files.push('/' + relative(outDir, full).split(sep).join(posix.sep))
        }
      }

      await walk(outDir)

      // sw.js must never cache itself, and _headers is a Cloudflare build
      // artefact that is never requested by the page.
      const precache = files.filter((file) => file !== '/sw.js' && file !== '/_headers').sort()

      // Changing any asset changes this id, which renames the cache and so
      // evicts the previous build rather than serving a mix of the two.
      const buildId = precache.find((file) => file.endsWith('.js'))?.match(/-([^-.]+)\.js$/)?.[1]

      const swPath = join(outDir, 'sw.js')
      const source = await readFile(swPath, 'utf8')
      await writeFile(
        swPath,
        source
          .replace('self.__PRECACHE__', JSON.stringify(precache))
          .replace('self.__BUILD_ID__', JSON.stringify(buildId ?? 'dev')),
        'utf8',
      )
    },
  }
}

export default defineConfig({
  plugins: [react(), precacheManifest()],
  server: { host: true }, // so the PWA can be opened from a phone on the same wifi
})
