/**
 * Ingest AI-generated stone images into app-ready assets.
 *
 * Takes any reasonably-generated gem image (black or solid background) and
 * produces a normalized asset: background keyed out, the stone found by
 * bounding box, scaled and centred to a CANONICAL size (72% of frame height),
 * recomposited on pure black, exported as webp. This is what keeps the stone
 * the same size across frames even when the image model drifts.
 *
 * Usage:
 *   npm i --no-save playwright-core
 *   node tools/gemrig/ingest.mjs <inputDir> [outDir=public/stones]
 *
 * Input filenames are kept: ember.png → ember.webp; tide-4.png →
 * progress frames belong in public/stones/progress (pass it as outDir).
 * Progress frames are also desaturated to enforce the colour law.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { chromium } from 'playwright-core'

const inDir = process.argv[2]
if (!inDir) {
  console.error('usage: node tools/gemrig/ingest.mjs <inputDir> [outDir]')
  process.exit(1)
}
const outDir = resolve(process.argv[3] ?? 'public/stones')
const SIZE = 1024
const FILL = 0.72 // canonical: the stone's height is 72% of the frame
const files = readdirSync(inDir).filter((f) => /\.(png|jpe?g|webp)$/i.test(f))
if (!files.length) {
  console.error('no images in', inDir)
  process.exit(1)
}

// CHROME env overrides the browser binary (e.g. a preinstalled Chromium).
const b = await chromium.launch({
  args: ['--enable-unsafe-swiftshader'],
  ...(process.env.CHROME ? { executablePath: process.env.CHROME } : {}),
})
const page = await b.newPage()

for (const f of files) {
  const mime = /\.png$/i.test(f) ? 'image/png' : /\.webp$/i.test(f) ? 'image/webp' : 'image/jpeg'
  const url = `data:${mime};base64,${readFileSync(resolve(inDir, f)).toString('base64')}`
  const isProgress = /-\d+\.(png|jpe?g|webp)$/i.test(f)
  const out = await page.evaluate(
    async ({ url, SIZE, FILL, grey }) => {
      const img = new Image()
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url })
      const w = img.naturalWidth, h = img.naturalHeight
      const c = document.createElement('canvas')
      c.width = w; c.height = h
      const g = c.getContext('2d', { willReadFrequently: true })
      g.drawImage(img, 0, 0)
      const d = g.getImageData(0, 0, w, h)
      const px = d.data

      // Key on the average of the four corners (black or any solid colour).
      const corner = (x, y) => { const i = (y * w + x) * 4; return [px[i], px[i + 1], px[i + 2]] }
      const cs = [corner(2, 2), corner(w - 3, 2), corner(2, h - 3), corner(w - 3, h - 3)]
      const bg = [0, 1, 2].map((k) => cs.reduce((s, c2) => s + c2[k], 0) / 4)
      const tol = 34

      let minX = w, minY = h, maxX = 0, maxY = 0
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = (y * w + x) * 4
          const dr = px[i] - bg[0], dg = px[i + 1] - bg[1], db = px[i + 2] - bg[2]
          const dist = Math.sqrt(dr * dr + dg * dg + db * db)
          if (dist < tol) {
            px[i + 3] = 0 // background → transparent
          } else {
            // Soft edge: partial alpha near the key colour keeps halos smooth.
            if (dist < tol * 2) px[i + 3] = Math.round(((dist - tol) / tol) * 255)
            if (px[i + 3] > 40) {
              if (x < minX) minX = x
              if (x > maxX) maxX = x
              if (y < minY) minY = y
              if (y > maxY) maxY = y
            }
          }
        }
      }
      if (maxX <= minX || maxY <= minY) return { error: 'nothing found after keying' }
      g.putImageData(d, 0, 0)

      // Normalize: scale the stone's bbox to the canonical fill, centred.
      const bw = maxX - minX, bh = maxY - minY
      const scale = (SIZE * FILL) / Math.max(bw, bh)
      const dw = bw * scale, dh = bh * scale
      const oc = document.createElement('canvas')
      oc.width = oc.height = SIZE
      const og = oc.getContext('2d')
      og.fillStyle = '#000'
      og.fillRect(0, 0, SIZE, SIZE)
      if (grey) og.filter = 'grayscale(1)'
      og.imageSmoothingQuality = 'high'
      og.drawImage(c, minX, minY, bw, bh, (SIZE - dw) / 2, (SIZE - dh) / 2, dw, dh)
      return { data: oc.toDataURL('image/webp', 0.9), bbox: [bw, bh] }
    },
    { url, SIZE, FILL, grey: isProgress },
  )
  if (out.error) {
    console.error(f, '—', out.error)
    continue
  }
  const name = f.replace(/\.(png|jpe?g|webp)$/i, '.webp').toLowerCase()
  const buf = Buffer.from(out.data.split(',')[1], 'base64')
  writeFileSync(resolve(outDir, name), buf)
  console.log(`${f} → ${name} (${Math.round(buf.length / 1024)} KB, stone ${out.bbox[0]}×${out.bbox[1]}px normalized)`)
}
await b.close()
