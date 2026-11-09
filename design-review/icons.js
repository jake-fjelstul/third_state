// Lucide-style 24px stroke icons, inlined so the mockups render offline.
const P = {
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  homeFill: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" fill="currentColor"/>',
  users: '<circle cx="9" cy="8" r="4"/><path d="M2 21v-1a6 6 0 0 1 12 0v1"/><path d="M16 4.13a4 4 0 0 1 0 7.75"/><path d="M22 21v-1a6 6 0 0 0-4-5.66"/>',
  calendar: '<rect x="3" y="4.5" width="18" height="17" rx="3"/><path d="M3 10h18M8 2.5v4M16 2.5v4"/>',
  message: '<path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-4-.9L3 20l1.1-4.3A8.4 8.4 0 0 1 3 11.5 8.6 8.6 0 0 1 12 3a8.6 8.6 0 0 1 9 8.5z"/>',
  user: '<circle cx="12" cy="8" r="4.5"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  plusSquare: '<rect x="3" y="3" width="18" height="18" rx="5"/><path d="M12 8v8M8 12h8"/>',
  chevL: '<path d="m15 18-6-6 6-6"/>',
  chevR: '<path d="m9 18 6-6-6-6"/>',
  chevD: '<path d="m6 9 6 6 6-6"/>',
  send: '<path d="M12 19V5M5 12l7-7 7 7"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.5" r="3.5"/>',
  pin: '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  coffee: '<path d="M4 9h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z"/><path d="M17 11h1.5a2.5 2.5 0 0 1 0 5H17"/><path d="M8 3v2M12 3v2"/>',
  lock: '<rect x="4.5" y="10.5" width="15" height="10.5" rx="2.5"/><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"/>',
  more: '<circle cx="5" cy="12" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/><circle cx="19" cy="12" r="1.2" fill="currentColor"/>',
  edit: '<path d="M15.5 4.5 19.5 8.5 8 20H4v-4z"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  zap: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
  check: '<path d="m5 12 5 5 9-10"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>',
  signal: '<path d="M2 20h2M7 20v-4M12 20v-8M17 20V8M22 20V4" stroke-width="2.6"/>',
  wifi: '<path d="M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0"/><circle cx="12" cy="19.5" r="1" fill="currentColor"/>',
}

function ic(name, size = 24, stroke = 1.9, extra = '') {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" ${extra}>${P[name] || ''}</svg>`
}

function statusBar() {
  return `<div class="island"></div><div class="status"><span>9:41</span><span class="sys">${ic('signal', 18, 2)}${ic('wifi', 18, 2.2)}<svg width="27" height="13" viewBox="0 0 27 13"><rect x="0.5" y="0.5" width="23" height="12" rx="3.5" fill="none" stroke="currentColor" opacity=".4"/><rect x="2" y="2" width="18" height="9" rx="2" fill="currentColor"/><rect x="24.5" y="4.5" width="2" height="4" rx="1" fill="currentColor" opacity=".4"/></svg></span></div>`
}

function avatar(initials, size, hue, ringed = false) {
  const inner = `<div class="av" style="width:${size}px;height:${size}px;font-size:${Math.round(size * 0.36)}px;background:hsl(${hue} 42% 52%)">${initials}</div>`
  return ringed ? `<div class="ring"><div class="gap">${inner}</div></div>` : inner
}

function batteryRing(value, size = 30) {
  const r = (size - 4) / 2
  const c = 2 * Math.PI * r
  return `<div class="battery-ring" title="Social battery">
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--surface-3)" stroke-width="3"/>
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--accent)" stroke-width="3" stroke-linecap="round"
        stroke-dasharray="${(c * value) / 100} ${c}" transform="rotate(-90 ${size / 2} ${size / 2})"/>
    </svg>
    <span class="num">${value}</span>
  </div>`
}

function tabbar(active) {
  const items = [
    ['home', 'homeFill'], ['users', 'users'], ['calendar', 'calendar'], ['message', 'message'], ['user', 'user'],
  ]
  return `<div class="tabbar">${items.map(([n, onName], i) =>
    `<div class="t ${i === active ? 'on' : ''}">${ic(i === active ? onName : n, 27, i === active ? 2.2 : 1.8)}${i === 3 ? '<span class="badge"></span>' : ''}</div>`
  ).join('')}</div><div class="home-ind"></div>`
}
