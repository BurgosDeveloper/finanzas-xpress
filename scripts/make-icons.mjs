// Genera los iconos PNG de la app a partir de public/favicon.svg
// Uso: npm run icons
import sharp from 'sharp'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const path = (name) => fileURLToPath(new URL(`../public/${name}`, import.meta.url))

const svg = await readFile(path('favicon.svg'))
const targets = [
  ['icon-192.png', 192],
  ['icon-512.png', 512],
  ['apple-touch-icon.png', 180],
]
for (const [name, size] of targets) {
  await sharp(svg, { density: 384 }).resize(size, size).png().toFile(path(name))
  console.log('listo', name)
}
