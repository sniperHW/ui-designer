/** 构建候选扁平图标：纯 Node PNG 编码，独立于设计工具与现有素材。 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { deflateSync } from 'node:zlib'

const [kind, output] = process.argv.slice(2)
if (kind !== 'bow-heavy' || !output) {
  console.error('用法：node scripts/ui_asset_pipeline/build_flat_icon_candidate.mjs bow-heavy <输出 PNG>')
  process.exit(1)
}

const SIZE = 66
const AA = 4
const width = SIZE * AA
const pixels = new Uint8Array(width * width * 4)
const white = [244, 248, 255]
const toPixel = (value) => value * AA * SIZE / 22

function paint(x, y) {
  if (x < 0 || y < 0 || x >= width || y >= width) return
  const index = (Math.floor(y) * width + Math.floor(x)) * 4
  pixels[index] = white[0]
  pixels[index + 1] = white[1]
  pixels[index + 2] = white[2]
  pixels[index + 3] = 255
}

function line(a, b, thickness) {
  const [x1, y1] = a.map(toPixel)
  const [x2, y2] = b.map(toPixel)
  const radius = toPixel(thickness) / 2
  const minX = Math.floor(Math.min(x1, x2) - radius)
  const maxX = Math.ceil(Math.max(x1, x2) + radius)
  const minY = Math.floor(Math.min(y1, y2) - radius)
  const maxY = Math.ceil(Math.max(y1, y2) + radius)
  const dx = x2 - x1
  const dy = y2 - y1
  const length2 = dx * dx + dy * dy
  for (let y = minY; y <= maxY; y += 1) for (let x = minX; x <= maxX; x += 1) {
    const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / length2))
    const px = x1 + t * dx
    const py = y1 + t * dy
    if ((x - px) ** 2 + (y - py) ** 2 <= radius ** 2) paint(x, y)
  }
}

function polygon(points) {
  const path = points.map(([x, y]) => [toPixel(x), toPixel(y)])
  const xs = path.map(([x]) => x)
  const ys = path.map(([, y]) => y)
  const minX = Math.floor(Math.min(...xs))
  const maxX = Math.ceil(Math.max(...xs))
  const minY = Math.floor(Math.min(...ys))
  const maxY = Math.ceil(Math.max(...ys))
  for (let y = minY; y <= maxY; y += 1) for (let x = minX; x <= maxX; x += 1) {
    let inside = false
    for (let i = 0, j = path.length - 1; i < path.length; j = i++) {
      const [xi, yi] = path[i]
      const [xj, yj] = path[j]
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
    }
    if (inside) paint(x, y)
  }
}

// 更具象但仍保持扁平的“战术弓 + 上弦箭”：弓臂、弓弦、握把、箭羽和箭头各自清晰可辨。
const limb = [[3.4, 2.1], [7.2, 3.2], [10.8, 6.1], [12.7, 9.2], [13.2, 11]]
const lowerLimb = limb.map(([x, y]) => [x, 22 - y])
for (let i = 0; i < limb.length - 1; i += 1) line(limb[i], limb[i + 1], 2.15)
for (let i = 0; i < lowerLimb.length - 1; i += 1) line(lowerLimb[i], lowerLimb[i + 1], 2.15)
line([3.45, 2.15], [3.45, 19.85], 1.05)
line([3.45, 2.15], [4.7, 3.1], 1.05)
line([3.45, 19.85], [4.7, 18.9], 1.05)
line([5.2, 11], [18.2, 11], 1.55)
polygon([[20.4, 11], [16.4, 8.45], [16.4, 13.55]])
polygon([[7.9, 11], [5.15, 8.25], [4.55, 10.15], [6.65, 11]])
polygon([[7.9, 11], [5.15, 13.75], [4.55, 11.85], [6.65, 11]])
line([11.5, 9.25], [11.5, 12.75], 2.2)

function crc32(buffer) {
  let crc = 0xffffffff
  for (const byte of buffer) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1))
  }
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const typeBytes = Buffer.from(type)
  const result = Buffer.alloc(12 + data.length)
  result.writeUInt32BE(data.length, 0)
  typeBytes.copy(result, 4)
  data.copy(result, 8)
  result.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])), 8 + data.length)
  return result
}

const outputPixels = Buffer.alloc(SIZE * (SIZE * 4 + 1))
for (let y = 0; y < SIZE; y += 1) {
  const row = y * (SIZE * 4 + 1)
  outputPixels[row] = 0
  for (let x = 0; x < SIZE; x += 1) {
    let alpha = 0
    for (let yy = 0; yy < AA; yy += 1) for (let xx = 0; xx < AA; xx += 1) alpha += pixels[((y * AA + yy) * width + x * AA + xx) * 4 + 3]
    const i = row + 1 + x * 4
    outputPixels[i] = white[0]
    outputPixels[i + 1] = white[1]
    outputPixels[i + 2] = white[2]
    outputPixels[i + 3] = Math.round(alpha / (AA * AA))
  }
}
const header = Buffer.alloc(13)
header.writeUInt32BE(SIZE, 0)
header.writeUInt32BE(SIZE, 4)
header[8] = 8
header[9] = 6
const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', deflateSync(outputPixels)), chunk('IEND', Buffer.alloc(0))])
mkdirSync(dirname(output), { recursive: true })
writeFileSync(output, png)
console.log(`✓ 已生成真 RGBA 候选：${output}`)
