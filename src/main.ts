import './style.css'

type Player = { id: string; name: string; female: boolean; level: string; unresolved: boolean }
type Court = { id: string; label: string; shuttleText: string }
type State = {
  raw: string
  date: string
  time: string
  place: string
  players: Player[]
  groups: number
  courts: Court[]
  assignment: Record<string, string | null>
  bgDataUrl: string
}

const KEY = 'fengzi_badminton_state_v4'
const init: State = {
  raw: '',
  date: '',
  time: '',
  place: '',
  players: [],
  groups: 4,
  courts: [{ id: 'c1', label: '1', shuttleText: '黄超10r/个' }, { id: 'c2', label: '2', shuttleText: '黄超10r/个' }],
  assignment: {},
  bgDataUrl: '',
}
let s: State = load()
let gateClicks: number[] = []
let pickedPlayerId = ''

const app = document.querySelector<HTMLDivElement>('#app')!
app.innerHTML = `
<main class="page">
  <header class="topbar glass">
    <button id="gate" class="icon-btn" title="连续三击进入博客">🏸</button>
    <h1>风子的羽毛球场地分配工具</h1>
    <div class="header-actions">
      <button id="clearCache" class="btn subtle">清空缓存</button>
      <button id="downloadImage" class="btn primary">下载排表图</button>
    </div>
  </header>

  <section class="card">
    <label class="label">接龙输入</label>
    <textarea id="raw" class="textarea" placeholder="时间：2026年05月13日 18:00-22:00&#10;地点：翎动&#10;1. 夜鹭🌷 中羽3.5级"></textarea>
    <div class="toolbar">
      <button id="parse" class="btn primary">解析接龙</button>
      <label class="btn subtle file">上传Chiikawa底图<input id="bgUpload" type="file" accept="image/*"></label>
      <button id="addGroup" class="btn subtle">+组</button>
      <button id="removeGroup" class="btn subtle">-组</button>
      <button id="addCourt" class="btn subtle">+场地</button>
      <button id="removeCourt" class="btn subtle">-场地</button>
    </div>
  </section>

  <section class="meta-grid">
    <label class="field"><span>日期</span><input id="date"></label>
    <label class="field"><span>时间</span><input id="time"></label>
    <label class="field"><span>地点</span><input id="place"></label>
    <label class="field"><span>人数</span><input id="count" disabled></label>
  </section>

  <section class="layout">
    <section class="card pool-wrap">
      <div class="subhead">选手池（可拖拽）</div>
      <div id="pool" class="pool"></div>
    </section>
    <section class="card table-wrap">
      <div id="table"></div>
    </section>
  </section>
</main>
`

const rawEl = byId<HTMLTextAreaElement>('raw')
const dateEl = byId<HTMLInputElement>('date')
const timeEl = byId<HTMLInputElement>('time')
const placeEl = byId<HTMLInputElement>('place')
const countEl = byId<HTMLInputElement>('count')
const poolEl = byId<HTMLDivElement>('pool')
const tableEl = byId<HTMLDivElement>('table')

byId('gate').addEventListener('click', () => {
  const now = Date.now()
  gateClicks = [...gateClicks.filter((x) => now - x < 1400), now]
  if (gateClicks.length >= 3) location.href = '/blog/'
})
byId('clearCache').addEventListener('click', () => { localStorage.removeItem(KEY); s = structuredClone(init); render() })
byId('parse').addEventListener('click', () => { parseRelay(rawEl.value); render() })
byId('downloadImage').addEventListener('click', () => exportExcelStyleImage())
byId('addGroup').addEventListener('click', () => { s.groups += 1; save(); render() })
byId('removeGroup').addEventListener('click', () => { s.groups = Math.max(1, s.groups - 1); trimAssignment(); save(); render() })
byId('addCourt').addEventListener('click', () => {
  const id = `c${Date.now()}`
  s.courts.push({ id, label: `${s.courts.length + 1}`, shuttleText: '黄超10r/个' })
  save()
  render()
})
byId('removeCourt').addEventListener('click', () => { s.courts = s.courts.slice(0, Math.max(1, s.courts.length - 1)); trimAssignment(); save(); render() })
byId<HTMLInputElement>('bgUpload').addEventListener('change', async (e) => {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (!f) return
  s.bgDataUrl = await fileToDataUrl(f)
  save()
})

dateEl.addEventListener('input', () => { s.date = dateEl.value; save() })
timeEl.addEventListener('input', () => { s.time = timeEl.value; save() })
placeEl.addEventListener('input', () => { s.place = placeEl.value; save() })

render()

function parseRelay(text: string) {
  s.raw = text
  const lines = text.split(/\r?\n/).map((x) => x.trim()).filter(Boolean)
  const t = lines.find((x) => x.startsWith('时间：'))?.replace('时间：', '').trim() ?? ''
  const p = lines.find((x) => x.startsWith('地点：'))?.replace('地点：', '').trim() ?? ''
  if (t) {
    const m = t.match(/(\d{4}年\d{1,2}月\d{1,2}日)\s*(.*)/)
    s.date = m?.[1] ?? s.date
    s.time = m?.[2] ?? s.time
  }
  if (p) s.place = p
  s.players = lines.filter((x) => /^\d+\s*[\.、]/.test(x)).map((line, i) => {
    const raw = line.replace(/^\d+\s*[\.、]\s*/, '')
    const female = /🌷|💐|🌸/.test(raw)
    const level = (raw.match(/(中羽|台羽)\s*[\d.]+级?/) ?? [''])[0]
    const name = raw.replace(/🌷|💐|🌸/g, '').replace(/(中羽|台羽)\s*[\d.]+级?/g, '').trim()
    const unresolved = name.length === 0
    return { id: `p${i}`, name: unresolved ? '未解析' : name, female, level, unresolved }
  })
  s.assignment = {}
  save()
}

function render() {
  rawEl.value = s.raw
  dateEl.value = s.date
  timeEl.value = s.time
  placeEl.value = s.place
  countEl.value = String(s.players.length)
  renderPool()
  renderTable()
}

function renderPool() {
  poolEl.innerHTML = s.players.map((p) => `
    <article class="player ${p.unresolved ? 'bad' : ''}" data-player="${p.id}" draggable="true">
      <input data-name="${p.id}" value="${esc(p.name)}" />
      <input data-level="${p.id}" value="${esc(p.level)}" placeholder="中羽等级" />
      <button data-flower="${p.id}" class="flower">${p.female ? '🌷' : ''}</button>
    </article>
  `).join('')
  poolEl.querySelectorAll<HTMLElement>('.player').forEach((el) => {
    el.addEventListener('dragstart', (e) => e.dataTransfer?.setData('text/plain', String(el.dataset.player)))
    el.addEventListener('click', () => {
      pickedPlayerId = String(el.dataset.player || '')
      poolEl.querySelectorAll('.player').forEach((x) => x.classList.remove('active'))
      el.classList.add('active')
    })
  })
  poolEl.querySelectorAll<HTMLInputElement>('input[data-name]').forEach((el) => {
    el.addEventListener('input', () => {
      const p = s.players.find((x) => x.id === el.dataset.name); if (!p) return
      p.name = el.value || '未解析'; p.unresolved = p.name === '未解析'; save()
    })
  })
  poolEl.querySelectorAll<HTMLInputElement>('input[data-level]').forEach((el) => {
    el.addEventListener('input', () => {
      const p = s.players.find((x) => x.id === el.dataset.level); if (!p) return
      p.level = el.value; save()
    })
  })
  poolEl.querySelectorAll<HTMLButtonElement>('button[data-flower]').forEach((el) => {
    el.addEventListener('click', (ev) => {
      ev.stopPropagation()
      const p = s.players.find((x) => x.id === el.dataset.flower); if (!p) return
      p.female = !p.female; save(); renderPool(); renderTable()
    })
  })
}

function renderTable() {
  const head = s.courts.map((c) => `<th><input data-court-label="${c.id}" value="${esc(c.label)}号（${esc(c.shuttleText)}）"></th>`).join('')
  const rows = Array.from({ length: s.groups }).map((_, gi) => {
    const tds = s.courts.map((c) => {
      const a = slotCell(c.id, gi, 0)
      const b = slotCell(c.id, gi, 1)
      return `<td><div class="slot-col">${a}${b}</div></td>`
    }).join('')
    return `<tr><th>第${gi + 1}组</th>${tds}</tr>`
  }).join('')

  tableEl.innerHTML = `
    <table class="assign-table">
      <tr><th>场地</th>${head}</tr>
      ${rows}
    </table>
  `
  tableEl.querySelectorAll<HTMLInputElement>('input[data-court-label]').forEach((el) => {
    el.addEventListener('input', () => {
      const c = s.courts.find((x) => x.id === el.dataset.courtLabel); if (!c) return
      const txt = el.value
      const m = txt.match(/^(.+?)号（(.+)）$/)
      if (m) { c.label = m[1].trim(); c.shuttleText = m[2].trim() }
      else c.label = txt
      save()
    })
  })
  tableEl.querySelectorAll<HTMLElement>('.slot').forEach((el) => {
    el.addEventListener('dragover', (e) => e.preventDefault())
    el.addEventListener('drop', (e) => {
      e.preventDefault()
      const pid = e.dataTransfer?.getData('text/plain')
      if (!pid) return
      setSlot(String(el.dataset.key), pid)
    })
    el.addEventListener('click', () => { if (pickedPlayerId) setSlot(String(el.dataset.key), pickedPlayerId) })
  })
  tableEl.querySelectorAll<HTMLButtonElement>('button[data-clear-slot]').forEach((el) => {
    el.addEventListener('click', () => { s.assignment[String(el.dataset.clearSlot)] = null; save(); renderTable() })
  })
}

function slotCell(courtId: string, groupIndex: number, pairIndex: number) {
  const key = slotKey(courtId, groupIndex, pairIndex)
  const player = s.players.find((p) => p.id === s.assignment[key])
  const txt = player ? `${player.name}${player.female ? '🌷' : ''}${player.level ? ` ${player.level}` : ''}` : '拖拽到这里'
  return `<div class="slot" data-key="${key}">
    <span>${esc(txt)}</span>
    ${player ? `<button data-clear-slot="${key}" class="clear">×</button>` : ''}
  </div>`
}

function setSlot(key: string, playerId: string) {
  Object.keys(s.assignment).forEach((k) => { if (s.assignment[k] === playerId) s.assignment[k] = null })
  s.assignment[key] = playerId
  save()
  renderTable()
}

function slotKey(courtId: string, groupIndex: number, pairIndex: number) { return `${courtId}|${groupIndex}|${pairIndex}` }

function trimAssignment() {
  const allow = new Set<string>()
  s.courts.forEach((c) => {
    for (let g = 0; g < s.groups; g += 1) for (let p = 0; p < 2; p += 1) allow.add(slotKey(c.id, g, p))
  })
  Object.keys(s.assignment).forEach((k) => { if (!allow.has(k)) delete s.assignment[k] })
}

async function exportExcelStyleImage() {
  const w = 1800
  const h = 1200
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!

  if (s.bgDataUrl) {
    const bg = await loadImage(s.bgDataUrl)
    ctx.drawImage(bg, 0, 0, w, h)
  } else {
    ctx.fillStyle = '#f3ece3'
    ctx.fillRect(0, 0, w, h)
  }

  const tableW = Math.min(1480, 280 + s.courts.length * 380)
  const tableH = 280 + s.groups * 120
  const x0 = (w - tableW) / 2
  const y0 = (h - tableH) / 2 + 20
  const firstCol = 150
  const colW = (tableW - firstCol) / Math.max(1, s.courts.length)

  ctx.fillStyle = '#fff'
  ctx.fillRect(x0, y0, tableW, tableH)
  ctx.strokeStyle = '#222'
  ctx.lineWidth = 2
  ctx.strokeRect(x0, y0, tableW, tableH)

  const rowHeights = [90, 90, ...Array.from({ length: s.groups }, () => 120)]
  let y = y0
  rowHeights.forEach((rh) => { y += rh; ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x0 + tableW, y); ctx.stroke() })
  ctx.beginPath(); ctx.moveTo(x0 + firstCol, y0); ctx.lineTo(x0 + firstCol, y0 + tableH); ctx.stroke()
  for (let i = 1; i < s.courts.length; i += 1) { const x = x0 + firstCol + i * colW; ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y0 + tableH); ctx.stroke() }

  ctx.fillStyle = '#111'
  ctx.font = '700 54px "Noto Sans SC"'
  ctx.fillText('场地分配表', x0 + tableW / 2 - 150, y0 - 30)

  ctx.font = '600 42px "Noto Sans SC"'
  ctx.fillText('日期', x0 + 36, y0 + 58)
  ctx.font = '500 38px "Noto Sans SC"'
  ctx.fillText(`${s.date}`, x0 + firstCol + 18, y0 + 58)
  ctx.fillText(`时间：${s.time}`, x0 + firstCol + colW * Math.max(0, s.courts.length - 1) - 80, y0 + 58)
  ctx.fillText(`场地：${s.place}`, x0 + firstCol + colW * 0.8, y0 + 140)

  ctx.font = '700 38px "Noto Sans SC"'
  ctx.fillText('场地', x0 + 36, y0 + 148)
  s.courts.forEach((c, i) => fitText(ctx, `${c.label}号（${c.shuttleText}）`, x0 + firstCol + i * colW + 16, y0 + 148, colW - 30, 36, 24))

  let yy = y0 + rowHeights[0] + rowHeights[1]
  for (let g = 0; g < s.groups; g += 1) {
    ctx.font = '700 42px "Noto Sans SC"'
    ctx.fillText(`第${g + 1}组`, x0 + 20, yy + 70)
    s.courts.forEach((c, i) => {
      const p1 = s.players.find((p) => p.id === s.assignment[slotKey(c.id, g, 0)])
      const p2 = s.players.find((p) => p.id === s.assignment[slotKey(c.id, g, 1)])
      fitText(ctx, playerTxt(p1), x0 + firstCol + i * colW + 12, yy + 50, colW - 24, 36, 20)
      fitText(ctx, playerTxt(p2), x0 + firstCol + i * colW + 12, yy + 102, colW - 24, 36, 20)
      ctx.beginPath()
      ctx.moveTo(x0 + firstCol + i * colW, yy + 60)
      ctx.lineTo(x0 + firstCol + (i + 1) * colW, yy + 60)
      ctx.stroke()
    })
    yy += 120
  }

  const a = document.createElement('a')
  a.href = canvas.toDataURL('image/png')
  a.download = `schedule-excel-${Date.now()}.png`
  a.click()
}

function playerTxt(p?: Player) {
  if (!p) return '-'
  return `${p.name}${p.female ? '🌷' : ''}${p.level ? ` ${p.level}` : ''}`
}

function fitText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, start: number, min: number) {
  let size = start
  while (size >= min) {
    ctx.font = `500 ${size}px "Noto Sans SC"`
    if (ctx.measureText(text).width <= maxW) break
    size -= 1
  }
  ctx.fillText(text, x, y)
}

function byId<T extends HTMLElement = HTMLElement>(id: string) { return document.getElementById(id)! as T }
function esc(v: string) { return v.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;') }
function save() { localStorage.setItem(KEY, JSON.stringify(s)) }
function load() { try { return { ...init, ...JSON.parse(localStorage.getItem(KEY) || '{}') } as State } catch { return structuredClone(init) } }
function fileToDataUrl(file: File) { return new Promise<string>((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result || '')); r.onerror = reject; r.readAsDataURL(file) }) }
function loadImage(src: string) { return new Promise<HTMLImageElement>((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = reject; img.src = src }) }
