import './style.css'

type Player = { id: string; name: string; female: boolean; level: string; unresolved: boolean }
type Brand = { id: string; name: string; tubePrice: number }
type ShuttleUsage = { id: string; brandId: string; count: number }
type Court = { id: string; label: string; usage: ShuttleUsage[] }
type ExportCfg = { x: number; y: number; scale: number; cellSize: number }
type State = {
  raw: string
  date: string
  time: string
  place: string
  players: Player[]
  brands: Brand[]
  groups: number
  courts: Court[]
  assignment: Record<string, string | null>
  bgDataUrl: string
  exportCfg: ExportCfg
}

const KEY = 'fengzi_badminton_state_v6'
const makeBrand = (): Brand => ({ id: `b${Date.now()}${Math.random()}`, name: '黄超', tubePrice: 120 })
const makeCourt = (n: number): Court => ({ id: `c${Date.now()}${Math.random()}`, label: `${n}`, usage: [] })
const initial: State = {
  raw: '',
  date: '',
  time: '',
  place: '',
  players: [],
  brands: [makeBrand()],
  groups: 4,
  courts: [makeCourt(1), makeCourt(2)],
  assignment: {},
  bgDataUrl: '',
  exportCfg: { x: 0, y: 0, scale: 1, cellSize: 34 },
}
let s: State = load()
let gateClicks: number[] = []

restoreFromShare()

const app = document.querySelector<HTMLDivElement>('#app')!
app.innerHTML = `
<main class="page">
  <header class="topbar card">
    <button id="gate" class="icon-btn" title="连续点三下进入博客">🏸</button>
    <h1>风子的羽毛球场地分配工具</h1>
    <div class="row">
      <a class="btn subtle" href="/badmintoncost/">费用页</a>
      <button id="share" class="btn subtle">分享当前排表</button>
      <button id="exportPreview" class="btn primary">导出前预览</button>
      <button id="exportSchedule" class="btn primary">导出场地排表</button>
    </div>
  </header>

  <section class="card">
    <label class="label">接龙输入</label>
    <textarea id="raw" class="textarea" placeholder="时间：2026年05月13日 18:00-22:00&#10;地点：翎动&#10;1. 夜鹭🌷 中羽3.5级"></textarea>
    <div class="row">
      <button id="parse" class="btn primary">解析接龙</button>
      <label class="btn subtle file">上传Chiikawa底图<input id="bgUpload" type="file" accept="image/*"></label>
      <button id="addGroup" class="btn subtle">+组</button>
      <button id="removeGroup" class="btn subtle">-组</button>
      <button id="addCourt" class="btn subtle">+场地</button>
      <button id="removeCourt" class="btn subtle">-场地</button>
      <button id="clearCache" class="btn subtle">清空缓存</button>
    </div>
  </section>

  <section class="meta-grid">
    <label class="field"><span>日期</span><input id="date"></label>
    <label class="field"><span>时间</span><input id="time"></label>
    <label class="field"><span>地点</span><input id="place"></label>
    <label class="field"><span>人数</span><input id="count" disabled></label>
  </section>

  <section class="card">
    <div class="subhead">羽毛球品牌（导出第二行只显示品牌名）</div>
    <div id="brandList"></div>
    <button id="addBrand" class="btn subtle">+品牌</button>
  </section>

  <section class="card">
    <div class="subhead">选手池（可拖回池，手机一行2个）</div>
    <div id="pool" class="pool"></div>
  </section>

  <section class="card">
    <div class="subhead">场地分配（拖拽自动交换）</div>
    <div id="table"></div>
  </section>
</main>

<dialog id="previewDialog" class="preview-dialog">
  <div class="preview-layout">
    <canvas id="previewCanvas" width="1600" height="1000"></canvas>
    <div class="controls">
      <h3>导出微调</h3>
      <label>X偏移<input id="cfgX" type="range" min="-300" max="300" step="1"></label>
      <label>Y偏移<input id="cfgY" type="range" min="-300" max="300" step="1"></label>
      <label>缩放<input id="cfgScale" type="range" min="0.6" max="1.3" step="0.01"></label>
      <label>内容字号<input id="cfgCell" type="range" min="24" max="44" step="1"></label>
      <div class="row">
        <button id="previewClose" class="btn subtle">关闭</button>
        <button id="previewExport" class="btn primary">确认导出</button>
      </div>
    </div>
  </div>
</dialog>
`

const rawEl = byId<HTMLTextAreaElement>('raw')
const dateEl = byId<HTMLInputElement>('date')
const timeEl = byId<HTMLInputElement>('time')
const placeEl = byId<HTMLInputElement>('place')
const countEl = byId<HTMLInputElement>('count')
const brandListEl = byId<HTMLDivElement>('brandList')
const poolEl = byId<HTMLDivElement>('pool')
const tableEl = byId<HTMLDivElement>('table')
const previewDialog = byId<HTMLDialogElement>('previewDialog')

byId('gate').addEventListener('click', () => {
  const now = Date.now()
  gateClicks = [...gateClicks.filter((x) => now - x < 1500), now]
  if (gateClicks.length >= 3) location.href = '/blog/'
})
byId('parse').addEventListener('click', () => { parseRelay(rawEl.value); render() })
byId('addGroup').addEventListener('click', () => { s.groups += 1; save(); renderTable() })
byId('removeGroup').addEventListener('click', () => { s.groups = Math.max(1, s.groups - 1); trimAssignment(); save(); renderTable() })
byId('addCourt').addEventListener('click', () => { s.courts.push(makeCourt(s.courts.length + 1)); save(); renderTable() })
byId('removeCourt').addEventListener('click', () => { s.courts = s.courts.slice(0, Math.max(1, s.courts.length - 1)); trimAssignment(); save(); renderTable() })
byId('addBrand').addEventListener('click', () => { s.brands.push(makeBrand()); save(); renderBrands(); renderTable() })
byId('clearCache').addEventListener('click', () => { localStorage.removeItem(KEY); s = structuredClone(initial); render() })
byId('share').addEventListener('click', () => shareCurrent())
byId('exportPreview').addEventListener('click', () => { previewDialog.showModal(); bindPreviewControls(); drawPreview() })
byId('previewClose').addEventListener('click', () => previewDialog.close())
byId('previewExport').addEventListener('click', () => exportScheduleImage())
byId('exportSchedule').addEventListener('click', () => exportScheduleImage())
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
  renderBrands()
  renderPool()
  renderTable()
}

function renderBrands() {
  brandListEl.innerHTML = s.brands.map((b) => `
    <div class="brand-row">
      <input data-brand-name="${b.id}" value="${esc(b.name)}" placeholder="品牌">
      <input data-brand-price="${b.id}" value="${b.tubePrice}" type="number" step="0.01" placeholder="每桶价格">
      <button data-brand-del="${b.id}" class="btn subtle">删</button>
    </div>
  `).join('')
  brandListEl.querySelectorAll<HTMLInputElement>('input[data-brand-name]').forEach((el) => {
    el.addEventListener('input', () => { const b = s.brands.find((x) => x.id === el.dataset.brandName); if (!b) return; b.name = el.value; save(); renderTable() })
  })
  brandListEl.querySelectorAll<HTMLInputElement>('input[data-brand-price]').forEach((el) => {
    el.addEventListener('input', () => { const b = s.brands.find((x) => x.id === el.dataset.brandPrice); if (!b) return; b.tubePrice = Number(el.value || 0); save() })
  })
  brandListEl.querySelectorAll<HTMLButtonElement>('button[data-brand-del]').forEach((el) => {
    el.addEventListener('click', () => { s.brands = s.brands.filter((x) => x.id !== el.dataset.brandDel); save(); renderBrands(); renderTable() })
  })
}

function renderPool() {
  const assigned = new Set(Object.values(s.assignment).filter(Boolean) as string[])
  const inPool = s.players.filter((p) => !assigned.has(p.id))
  poolEl.innerHTML = inPool.map((p) => `
    <article class="player-card ${p.unresolved ? 'bad' : ''}" draggable="true" data-player="${p.id}">
      <input data-player-name="${p.id}" value="${esc(p.name)}">
      <input data-player-level="${p.id}" value="${esc(p.level)}" placeholder="中羽等级">
      <button data-player-flower="${p.id}" class="flower">${p.female ? '🌷' : ''}</button>
    </article>
  `).join('')
  bindPlayerEvents(poolEl)
  poolEl.classList.add('dropzone')
  poolEl.ondragover = (e) => e.preventDefault()
  poolEl.ondrop = (e) => {
    e.preventDefault()
    const pid = e.dataTransfer?.getData('text/plain')
    if (!pid) return
    unassignPlayer(pid)
    save()
    render()
  }
}

function bindPlayerEvents(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>('[data-player]').forEach((el) => {
    el.ondragstart = (e) => e.dataTransfer?.setData('text/plain', String(el.dataset.player))
  })
  root.querySelectorAll<HTMLInputElement>('input[data-player-name]').forEach((el) => {
    el.oninput = () => { const p = s.players.find((x) => x.id === el.dataset.playerName); if (!p) return; p.name = el.value || '未解析'; p.unresolved = p.name === '未解析'; save() }
  })
  root.querySelectorAll<HTMLInputElement>('input[data-player-level]').forEach((el) => {
    el.oninput = () => { const p = s.players.find((x) => x.id === el.dataset.playerLevel); if (!p) return; p.level = el.value; save() }
  })
  root.querySelectorAll<HTMLButtonElement>('button[data-player-flower]').forEach((el) => {
    el.onclick = (ev) => { ev.stopPropagation(); const p = s.players.find((x) => x.id === el.dataset.playerFlower); if (!p) return; p.female = !p.female; save(); render() }
  })
}

function renderTable() {
  const head = s.courts.map((c) => `<th>
    <input data-court-label="${c.id}" value="${esc(c.label)}号场">
    <div class="usage-list">${renderUsage(c)}</div>
    <button data-usage-add="${c.id}" class="btn subtle mini">+用球</button>
  </th>`).join('')
  const body = Array.from({ length: s.groups }).map((_, gi) => {
    const cols = s.courts.map((c) => `<td><div class="slot-col">${slotHtml(c.id, gi, 0)}${slotHtml(c.id, gi, 1)}</div></td>`).join('')
    return `<tr><th>第${gi + 1}组</th>${cols}</tr>`
  }).join('')
  tableEl.innerHTML = `<table class="assign-table"><tr><th>场地</th>${head}</tr>${body}</table>`

  tableEl.querySelectorAll<HTMLInputElement>('input[data-court-label]').forEach((el) => {
    el.oninput = () => { const c = s.courts.find((x) => x.id === el.dataset.courtLabel); if (!c) return; c.label = el.value.replace('号场', ''); save() }
  })
  tableEl.querySelectorAll<HTMLButtonElement>('button[data-usage-add]').forEach((el) => {
    el.onclick = () => { const c = s.courts.find((x) => x.id === el.dataset.usageAdd); if (!c || s.brands.length === 0) return; c.usage.push({ id: `u${Date.now()}${Math.random()}`, brandId: s.brands[0].id, count: 1 }); save(); renderTable() }
  })
  tableEl.querySelectorAll<HTMLSelectElement>('select[data-usage-brand]').forEach((el) => {
    el.onchange = () => { const [cid, uid] = String(el.dataset.usageBrand).split('|'); const c = s.courts.find((x) => x.id === cid); const u = c?.usage.find((x) => x.id === uid); if (!u) return; u.brandId = el.value; save() }
  })
  tableEl.querySelectorAll<HTMLInputElement>('input[data-usage-count]').forEach((el) => {
    el.oninput = () => { const [cid, uid] = String(el.dataset.usageCount).split('|'); const c = s.courts.find((x) => x.id === cid); const u = c?.usage.find((x) => x.id === uid); if (!u) return; u.count = Number(el.value || 0); save() }
  })
  tableEl.querySelectorAll<HTMLButtonElement>('button[data-usage-del]').forEach((el) => {
    el.onclick = () => { const [cid, uid] = String(el.dataset.usageDel).split('|'); const c = s.courts.find((x) => x.id === cid); if (!c) return; c.usage = c.usage.filter((x) => x.id !== uid); save(); renderTable() }
  })

  tableEl.querySelectorAll<HTMLElement>('.slot').forEach((el) => {
    el.ondragover = (e) => e.preventDefault()
    el.ondrop = (e) => {
      e.preventDefault()
      const pid = e.dataTransfer?.getData('text/plain')
      if (!pid) return
      dropToSlot(pid, String(el.dataset.slot))
    }
  })
  tableEl.querySelectorAll<HTMLElement>('[data-slot-player]').forEach((el) => {
    el.ondragstart = (e) => e.dataTransfer?.setData('text/plain', String(el.dataset.slotPlayer))
  })
  tableEl.querySelectorAll<HTMLButtonElement>('button[data-slot-clear]').forEach((el) => {
    el.onclick = () => { unassignPlayer(String(el.dataset.slotClear)); save(); render() }
  })
}

function renderUsage(c: Court) {
  return c.usage.map((u) => {
    const opts = s.brands.map((b) => `<option value="${b.id}" ${b.id === u.brandId ? 'selected' : ''}>${esc(b.name)}</option>`).join('')
    return `<div class="usage-row">
      <select data-usage-brand="${c.id}|${u.id}">${opts}</select>
      <input data-usage-count="${c.id}|${u.id}" type="number" value="${u.count}" min="0">
      <button data-usage-del="${c.id}|${u.id}" class="btn subtle mini">删</button>
    </div>`
  }).join('')
}

function slotHtml(courtId: string, g: number, p: number) {
  const key = slotKey(courtId, g, p)
  const pid = s.assignment[key]
  const player = s.players.find((x) => x.id === pid)
  if (!player) return `<div class="slot" data-slot="${key}"><span>拖拽到这里</span></div>`
  return `<div class="slot filled" data-slot="${key}">
    <article class="slot-player" draggable="true" data-slot-player="${player.id}">
      <span>${esc(player.name)}${player.female ? '🌷' : ''}${player.level ? ` ${esc(player.level)}` : ''}</span>
      <button data-slot-clear="${player.id}" class="slot-del">×</button>
    </article>
  </div>`
}

function dropToSlot(playerId: string, targetKey: string) {
  const sourceKey = findPlayerSlot(playerId)
  const targetPlayerId = s.assignment[targetKey] || null
  if (sourceKey) s.assignment[sourceKey] = targetPlayerId
  s.assignment[targetKey] = playerId
  save()
  render()
}
function findPlayerSlot(playerId: string) { return Object.keys(s.assignment).find((k) => s.assignment[k] === playerId) || null }
function unassignPlayer(playerId: string) { Object.keys(s.assignment).forEach((k) => { if (s.assignment[k] === playerId) s.assignment[k] = null }) }
function slotKey(courtId: string, gi: number, pi: number) { return `${courtId}|${gi}|${pi}` }
function trimAssignment() {
  const valid = new Set<string>()
  s.courts.forEach((c) => { for (let g = 0; g < s.groups; g += 1) for (let p = 0; p < 2; p += 1) valid.add(slotKey(c.id, g, p)) })
  Object.keys(s.assignment).forEach((k) => { if (!valid.has(k)) delete s.assignment[k] })
}

function bindPreviewControls() {
  byId<HTMLInputElement>('cfgX').value = String(s.exportCfg.x)
  byId<HTMLInputElement>('cfgY').value = String(s.exportCfg.y)
  byId<HTMLInputElement>('cfgScale').value = String(s.exportCfg.scale)
  byId<HTMLInputElement>('cfgCell').value = String(s.exportCfg.cellSize)
  ;(['cfgX', 'cfgY', 'cfgScale', 'cfgCell'] as const).forEach((id) => {
    byId<HTMLInputElement>(id).oninput = () => {
      s.exportCfg = {
        x: Number(byId<HTMLInputElement>('cfgX').value),
        y: Number(byId<HTMLInputElement>('cfgY').value),
        scale: Number(byId<HTMLInputElement>('cfgScale').value),
        cellSize: Number(byId<HTMLInputElement>('cfgCell').value),
      }
      save()
      drawPreview()
    }
  })
}
async function drawPreview() { const c = byId<HTMLCanvasElement>('previewCanvas'); await drawSchedule(c.getContext('2d')!, c.width, c.height) }
async function exportScheduleImage() { const c = document.createElement('canvas'); c.width = 1800; c.height = 1200; await drawSchedule(c.getContext('2d')!, c.width, c.height); downloadCanvas(c, `schedule-${Date.now()}.png`) }

async function drawSchedule(ctx: CanvasRenderingContext2D, w: number, h: number) {
  if (s.bgDataUrl) { const bg = await loadImage(s.bgDataUrl); ctx.drawImage(bg, 0, 0, w, h) }
  else { ctx.fillStyle = '#f4efe6'; ctx.fillRect(0, 0, w, h) }

  const c = s.exportCfg
  const tableW = (Math.min(1600, 240 + s.courts.length * 360)) * c.scale
  const tableH = (310 + s.groups * 110 + 220) * c.scale
  const x0 = (w - tableW) / 2 + c.x
  const y0 = (h - tableH) / 2 + c.y
  const firstCol = 150 * c.scale
  const colW = (tableW - firstCol) / Math.max(1, s.courts.length)
  const r1 = 78 * c.scale
  const r2 = 78 * c.scale
  const rg = 110 * c.scale
  const rLast = 220 * c.scale

  ctx.fillStyle = '#fff'
  ctx.fillRect(x0, y0, tableW, tableH)
  ctx.strokeStyle = '#222'
  ctx.lineWidth = 2
  ctx.strokeRect(x0, y0, tableW, tableH)

  const yLines = [y0 + r1, y0 + r1 + r2, ...Array.from({ length: s.groups }, (_, i) => y0 + r1 + r2 + (i + 1) * rg), y0 + r1 + r2 + s.groups * rg + rLast]
  yLines.forEach((yy) => { ctx.beginPath(); ctx.moveTo(x0, yy); ctx.lineTo(x0 + tableW, yy); ctx.stroke() })

  ctx.beginPath(); ctx.moveTo(x0 + firstCol, y0); ctx.lineTo(x0 + firstCol, y0 + tableH); ctx.stroke()
  for (let i = 1; i < s.courts.length; i += 1) { const xx = x0 + firstCol + i * colW; ctx.beginPath(); ctx.moveTo(xx, y0); ctx.lineTo(xx, y0 + r1 + r2 + s.groups * rg); ctx.stroke() }

  ctx.fillStyle = '#111'
  ctx.font = `700 ${Math.round(c.cellSize * 1.1)}px "Noto Sans SC"`
  ctx.fillText('日期', x0 + 24, y0 + 48 * c.scale)
  ctx.fillText(`时间：${s.time}`, x0 + firstCol + colW * Math.max(0, s.courts.length - 1) - 20, y0 + 48 * c.scale)
  ctx.fillText(`地点：${s.place}`, x0 + firstCol + colW * 0.8, y0 + 48 * c.scale)
  fitText(ctx, s.date, x0 + firstCol + 14, y0 + 48 * c.scale, colW - 18, c.cellSize, 16)

  ctx.fillText('场地', x0 + 24, y0 + r1 + 48 * c.scale)
  s.courts.forEach((court, i) => fitText(ctx, usageBrandText(court), x0 + firstCol + i * colW + 12, y0 + r1 + 48 * c.scale, colW - 16, c.cellSize, 16))

  let gy = y0 + r1 + r2
  for (let g = 0; g < s.groups; g += 1) {
    ctx.fillText(`第${g + 1}组`, x0 + 16, gy + 64 * c.scale)
    s.courts.forEach((court, i) => {
      const p1 = playerOf(s.assignment[slotKey(court.id, g, 0)])
      const p2 = playerOf(s.assignment[slotKey(court.id, g, 1)])
      fitText(ctx, playerText(p1), x0 + firstCol + i * colW + 12, gy + 44 * c.scale, colW - 20, c.cellSize, 14)
      fitText(ctx, playerText(p2), x0 + firstCol + i * colW + 12, gy + 92 * c.scale, colW - 20, c.cellSize, 14)
      ctx.beginPath(); ctx.moveTo(x0 + firstCol + i * colW, gy + rg / 2); ctx.lineTo(x0 + firstCol + (i + 1) * colW, gy + rg / 2); ctx.stroke()
    })
    gy += rg
  }

  const noteY = y0 + r1 + r2 + s.groups * rg
  ctx.fillStyle = '#c1121f'
  ctx.font = `700 ${Math.round(c.cellSize * 0.92)}px "Noto Sans SC"`
  const notes = [
    '免责声明：自愿参加具有一定风险的文体活动，因其他参加者的非故意行为受到损害的，受害人不得要求其他参加者承担相应责任。',
    '1.最后半小时可以串场、分组人员可以按实力调整',
    '2.禁止霸场，私自开单',
    '3.低强度局禁止带职业选手',
    '4.第一局输的下，接下来开始每组打两局，换对手依次轮转',
  ]
  notes.forEach((line, i) => fitText(ctx, line, x0 + 14, noteY + 40 * c.scale + i * 36 * c.scale, tableW - 24, c.cellSize * 0.9, 12))
}

function usageBrandText(court: Court) {
  const names = court.usage.map((u) => brandName(u.brandId))
  return `${court.label}号（${Array.from(new Set(names)).join('、') || '黄超'}）`
}
function brandName(id: string) { return s.brands.find((b) => b.id === id)?.name || '未知' }
function playerOf(id?: string | null) { return s.players.find((p) => p.id === id) }
function playerText(p?: Player) { return p ? `${p.name}${p.female ? '🌷' : ''}${p.level ? ` ${p.level}` : ''}` : '-' }
function fitText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, start: number, min: number) {
  let size = start
  while (size >= min) { ctx.font = `${ctx.font.includes('700') ? 700 : 500} ${size}px "Noto Sans SC"`; if (ctx.measureText(text).width <= maxW) break; size -= 1 }
  ctx.fillText(text, x, y)
}

function shareCurrent() {
  const payload = {
    date: s.date, time: s.time, place: s.place, players: s.players, brands: s.brands, groups: s.groups, courts: s.courts, assignment: s.assignment,
  }
  const data = btoa(unescape(encodeURIComponent(JSON.stringify(payload))))
  const url = `${location.origin}${location.pathname}#share=${data}`
  navigator.clipboard.writeText(url).then(() => alert('分享链接已复制')).catch(() => prompt('复制链接', url))
}
function restoreFromShare() {
  const m = location.hash.match(/share=([^&]+)/)
  if (!m) return
  try {
    const data = JSON.parse(decodeURIComponent(escape(atob(m[1]))))
    s = { ...s, ...data }
    save()
  } catch {}
}

function downloadCanvas(c: HTMLCanvasElement, name: string) { const a = document.createElement('a'); a.href = c.toDataURL('image/png'); a.download = name; a.click() }
function byId<T extends HTMLElement = HTMLElement>(id: string) { return document.getElementById(id)! as T }
function esc(v: string) { return v.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;') }
function save() { localStorage.setItem(KEY, JSON.stringify(s)) }
function load(): State { try { return { ...initial, ...JSON.parse(localStorage.getItem(KEY) || '{}') } as State } catch { return structuredClone(initial) } }
function fileToDataUrl(file: File) { return new Promise<string>((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result || '')); r.onerror = reject; r.readAsDataURL(file) }) }
function loadImage(src: string) { return new Promise<HTMLImageElement>((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = reject; img.src = src }) }
