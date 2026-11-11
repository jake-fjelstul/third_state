#!/usr/bin/env node
// Fails when hard-coded white text or icons sit on an ink background, or ink
// text sits on a hard-coded white background. In dark mode --indigo / --ink
// are near-white, so both pairs disappear (plan-2026-11-10.md, J5). Use
// var(--on-ink) on ink, and a fixed dark color on fixed-white chips.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('../src', import.meta.url))
const WHITE = /(color|stroke|fill)\s*[:=]\s*\{?\s*['"](#fff|#ffffff|white)['"]/i
const INK_BG = /(background|backgroundColor)\s*:[^\n]*(indigo|--ink\b)/
const INK_TEXT = /\bcolor\s*:\s*(clr\.indigo\b|['"`]var\(--(indigo|ink)\)['"`])/
const WHITE_BG = /(background|backgroundColor)\s*:\s*['"](#fff|#ffffff|white|rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*(0\.[6-9]\d*|1(\.0)?)\s*\))['"]/i

function* files(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) yield* files(p)
    else if (/\.(jsx?|tsx?)$/.test(name)) yield p
  }
}

const problems = []
for (const file of files(ROOT)) {
  const lines = readFileSync(file, 'utf8').split('\n')
  lines.forEach((line, i) => {
    const window = lines.slice(Math.max(0, i - 6), i + 2).join('\n')
    if (WHITE.test(line) && INK_BG.test(window)) {
      problems.push(`${file.replace(ROOT, 'src')}:${i + 1}: white on ink: ${line.trim()}`)
    }
    if (INK_TEXT.test(line) && WHITE_BG.test(lines.slice(Math.max(0, i - 3), i + 4).join('\n'))) {
      problems.push(`${file.replace(ROOT, 'src')}:${i + 1}: ink on fixed white: ${line.trim()}`)
    }
  })
}

if (problems.length) {
  console.error('Text that vanishes in one theme (white on ink: use var(--on-ink); ink on a fixed white chip: use a fixed dark color):\n' + problems.join('\n'))
  process.exit(1)
}
console.log('contrast check: ok')
