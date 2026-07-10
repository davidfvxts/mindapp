/**
 * Bake the five milestone gems + the rock to public/stones/*.webp.
 *
 * The finished stones are pre-rendered artwork — a real 3D pipeline
 * (three.js, physically lit, ACES tone mapping) run offline, shipped as
 * static images. Re-run this only when changing a stone's look; the app
 * itself has NO runtime 3D dependency.
 *
 * Usage:
 *   npm i --no-save three@0.170.0 playwright-core
 *   npx http-server -p 8899 .        (or: python3 -m http.server 8899)
 *   node tools/gemrig/bake.mjs [ember,tide,...]
 */
import { writeFileSync } from 'node:fs'
import { chromium } from 'playwright-core'

const BASE = process.env.GEMRIG_BASE ?? 'http://localhost:8899/tools/gemrig/gem.html'
const OUT = new URL('../../public/stones/', import.meta.url).pathname

const stones = process.argv[2] ? process.argv[2].split(',') : ['ember', 'tide', 'iris', 'aurora', 'solstice', 'rock']

// CHROME env overrides the browser binary (e.g. a preinstalled Chromium).
const b = await chromium.launch({
  args: ['--enable-unsafe-swiftshader'],
  ...(process.env.CHROME ? { executablePath: process.env.CHROME } : {}),
})
const page = await b.newPage({ viewport: { width: 1100, height: 1100 } })
page.on('pageerror', (e) => console.log('PAGE ERR:', String(e).slice(0, 400)))

for (const s of stones) {
  await page.goto(`${BASE}?stone=${s}&size=1024`)
  await page.waitForFunction(() => window.__done, null, { timeout: 120000 })
  const webp = await page.evaluate(() => window.__webp)
  const buf = Buffer.from(webp.split(',')[1], 'base64')
  writeFileSync(`${OUT}${s}.webp`, buf)
  console.log(s, 'baked —', Math.round(buf.length / 1024), 'KB')
}
await b.close()
