#!/usr/bin/env node
// Fails when hard-coded white text or icons sit on an ink background.
// In dark mode --indigo / --ink are near-white, so white-on-ink disappears
// (plan-2026-11-10.md, J5). Use var(--on-ink) instead.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('../src', import.meta.url))
const WHITE = /(color|stroke|fill)\s*[:=]\s*\{?\s*['"](#fff|#ffffff|white)['"]/i
const INK_BG = /(background|backgroundColor)\s*:[^\n]*(indigo|--ink\b)/

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
    if (!WHITE.test(line)) return
    const window = lines.slice(Math.max(0, i - 6), i + 2).join('\n')
    if (INK_BG.test(window)) problems.push(`${file.replace(ROOT, 'src')}:${i + 1}: ${line.trim()}`)
  })
}

if (problems.length) {
  console.error('White text/icons on an ink background (use var(--on-ink)):\n' + problems.join('\n'))
  process.exit(1)
}
console.log('contrast check: ok')
