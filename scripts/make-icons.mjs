import sharp from 'sharp'
import { readFileSync } from 'node:fs'
const svg = readFileSync('public/icons/icon.svg')
for (const s of [192, 512]) await sharp(svg).resize(s, s).png().toFile(`public/icons/icon-${s}.png`)
console.log('icons ok')
