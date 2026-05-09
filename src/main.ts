import './style.css'

type Player = { id: string; name: string; female: boolean; level: string; unresolved: boolean }
type Brand = { id: string; name: string; tubePrice: number }
type ShuttleUsage = { id: string; brandId: string; count: number }
type Court = { id: string; label: string; courtFee: number; usage: ShuttleUsage[] }
type ExportCfg = { x: number; y: number; scale: number; titleSize: number; cellSize: number }
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

const KEY = 'fengzi_badminton_state_v5'
const makeBrand = (): Brand => ({ id: `b${Date.now()}${Math.random()}`, name: '黄超', tubePrice: 120 })
const makeCourt = (n: number): Court => ({ id: `c${Date.now()}${Math.random()}`, label: `${n}`, courtFee: 70, usage: [] })
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
  exportCfg: { x: 0, y: 0, scale: 1, titleSize: 56, cellSize: 36 },
}

let s: State = load()
let gateClicks: number[] = []
const app = document.querySelector<HTMLDivElement>('#app')!

app.innerHTML = `
<main class="page">
  <header class="topbar card">
    <button id="gate" class="icon-btn" title="连续点三下进入博客">🏸</button>
    <h1>风子的羽毛球场地分配工具</h1>
    <div class="row">
      <button id="clearCache" class="btn subtle">清空缓存</button>
      <button id="exportPreview" class="btn primary">导出前预览</button>
      <button id="exportSchedule" class="btn primary">导出场地排表</button>
      <button id="exportFee" class="btn subtle">导出价格表</button>
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
    </div>
  </section>

  <section class="meta-grid">
    <label class="field"><span>日期</span><input id="date"></label>
    <label class="field"><span>时间</span><input id="time"></label>
    <label class="field"><span>地点</span><input id="place"></label>
    <label class="field"><span>人数</span><input id="count" disabled></label>
  </section>

  <section class="card">
    <div class="subhead">羽毛球品牌与价格（每桶默认12颗）</div>
    <div id="brandList"></div>
    <button id="addBrand" class="btn subtle">+品牌</button>
  </section>

  <section class="card">
    <div class="subhead">选手池（可拖拽，支持拖回池）</div>
    <div id="pool" class="pool"></div>
  </section>

  <section class="card">
    <div class="subhead">场地分配（拖拽自动交换位置）</div>
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
      <label>标题字号<input id="cfgTitle" type="range" min="40" max="72" step="1"></label>
      <label>内容字号<input id="cfgCell" type="range" min="24" max="44" step="1"></label>
      <div class="row">
        <button id="previewClose" class="btn subtle">关闭</button>
        <button id="previewExport" class="btn primary">确认导出排表</button>
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
byId('clearCache').addEventListener('click', () => { localStorage.removeItem(KEY); s = structuredClone(initial); render() })
byId('parse').addEventListener('click', () => { parseRelay(rawEl.value); render() })
byId('addGroup').addEventListener('click', () => { s.groups += 1; save(); renderTable() })
byId('removeGroup').addEventListener('click', () => { s.groups = Math.max(1, s.groups - 1); trimAssignment(); save(); renderTable() })
byId('addCourt').addEventListener('click', () => { s.courts.push(makeCourt(s.courts.length + 1)); save(); renderTable() })
byId('removeCourt').addEventListener('click', () => { s.courts = s.courts.slice(0, Math.max(1, s.courts.length - 1)); trimAssignment(); save(); renderTable() })
byId('addBrand').addEventListener('click', () => { s.brands.push(makeBrand()); save(); renderBrands(); renderTable() })
byId<HTMLInputElement>('bgUpload').addEventListener('change', async (e) => {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (!f) return
  s.bgDataUrl = await fileToDataUrl(f)
  save()
})
byId('exportPreview').addEventListener('click', () => { previewDialog.showModal(); bindPreviewControls(); drawPreview() })
byId('previewClose').addEventListener('click', () => { previewDialog.close() })
byId('previewExport').addEventListener('click', () => exportScheduleImage())
byId('exportSchedule').addEventListener('click', () => exportScheduleImage())
byId('exportFee').addEventListener('click', () => exportFeeImage())

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
    el.addEventListener('input', () => { const b = s.brands.find((x) => x.id === el.dataset.brandPrice); if (!b) return; b.tubePrice = Number(el.value || 0); save(); renderTable() })
  })
  brandListEl.querySelectorAll<HTMLButtonElement>('button[data-brand-del]').forEach((el) => {
    el.addEventListener('click', () => { s.brands = s.brands.filter((x) => x.id !== el.dataset.brandDel); save(); renderBrands(); renderTable() })
  })
}

function renderPool() {
  const assignedIds = new Set(Object.values(s.assignment).filter(Boolean) as string[])
  const poolPlayers = s.players.filter((p) => !assignedIds.has(p.id))
  poolEl.innerHTML = poolPlayers.map((p) => playerCardHtml(p)).join('')
  poolEl.classList.add('dropzone')
  poolEl.addEventListener('dragover', (e) => e.preventDefault())
  poolEl.addEventListener('drop', (e) => {
    e.preventDefault()
    const pid = e.dataTransfer?.getData('text/plain')
    if (!pid) return
    unassignPlayer(pid)
    save()
    render()
  })
  bindPlayerCardEvents(poolEl)
}

function playerCardHtml(p: Player) {
  return `<article class="player-card ${p.unresolved ? 'bad' : ''}" draggable="true" data-player="${p.id}">
    <input data-player-name="${p.id}" value="${esc(p.name)}">
    <input data-player-level="${p.id}" value="${esc(p.level)}" placeholder="中羽等级">
    <button data-player-flower="${p.id}" class="flower">${p.female ? '🌷' : ''}</button>
  </article>`
}

function bindPlayerCardEvents(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>('[data-player]').forEach((el) => {
    el.addEventListener('dragstart', (e) => e.dataTransfer?.setData('text/plain', String(el.dataset.player)))
  })
  root.querySelectorAll<HTMLInputElement>('input[data-player-name]').forEach((el) => {
    el.addEventListener('input', () => {
      const p = s.players.find((x) => x.id === el.dataset.playerName); if (!p) return
      p.name = el.value || '未解析'; p.unresolved = p.name === '未解析'; save()
    })
  })
  root.querySelectorAll<HTMLInputElement>('input[data-player-level]').forEach((el) => {
    el.addEventListener('input', () => {
      const p = s.players.find((x) => x.id === el.dataset.playerLevel); if (!p) return
      p.level = el.value; save()
    })
  })
  root.querySelectorAll<HTMLButtonElement>('button[data-player-flower]').forEach((el) => {
    el.addEventListener('click', (ev) => {
      ev.stopPropagation()
      const p = s.players.find((x) => x.id === el.dataset.playerFlower); if (!p) return
      p.female = !p.female; save(); render()
    })
  })
}

function renderTable() {
  const header = s.courts.map((c) => `<th>
    <input data-court-label="${c.id}" value="${esc(c.label)}号场">
    <input data-court-fee="${c.id}" type="number" step="0.01" value="${c.courtFee}" placeholder="场地费">
    <div class="usage-list">${renderUsage(c)}</div>
    <button data-usage-add="${c.id}" class="btn subtle mini">+用球</button>
  </th>`).join('')
  const rows = Array.from({ length: s.groups }).map((_, gi) => {
    const tds = s.courts.map((c) => {
      const a = slotHtml(c.id, gi, 0)
      const b = slotHtml(c.id, gi, 1)
      return `<td><div class="slot-col">${a}${b}</div></td>`
    }).join('')
    return `<tr><th>第${gi + 1}组</th>${tds}</tr>`
  }).join('')
  tableEl.innerHTML = `<table class="assign-table"><tr><th>场地</th>${header}</tr>${rows}</table>`

  tableEl.querySelectorAll<HTMLInputElement>('input[data-court-label]').forEach((el) => {
    el.addEventListener('input', () => { const c = s.courts.find((x) => x.id === el.dataset.courtLabel); if (!c) return; c.label = el.value.replace('号场', ''); save() })
  })
  tableEl.querySelectorAll<HTMLInputElement>('input[data-court-fee]').forEach((el) => {
    el.addEventListener('input', () => { const c = s.courts.find((x) => x.id === el.dataset.courtFee); if (!c) return; c.courtFee = Number(el.value || 0); save() })
  })
  tableEl.querySelectorAll<HTMLButtonElement>('button[data-usage-add]').forEach((el) => {
    el.addEventListener('click', () => {
      const c = s.courts.find((x) => x.id === el.dataset.usageAdd); if (!c || s.brands.length === 0) return
      c.usage.push({ id: `u${Date.now()}${Math.random()}`, brandId: s.brands[0].id, count: 1 }); save(); renderTable()
    })
  })
  tableEl.querySelectorAll<HTMLSelectElement>('select[data-usage-brand]').forEach((el) => {
    el.addEventListener('change', () => { const [cid, uid] = String(el.dataset.usageBrand).split('|'); const c = s.courts.find((x) => x.id === cid); const u = c?.usage.find((x) => x.id === uid); if (!u) return; u.brandId = el.value; save() })
  })
  tableEl.querySelectorAll<HTMLInputElement>('input[data-usage-count]').forEach((el) => {
    el.addEventListener('input', () => { const [cid, uid] = String(el.dataset.usageCount).split('|'); const c = s.courts.find((x) => x.id === cid); const u = c?.usage.find((x) => x.id === uid); if (!u) return; u.count = Number(el.value || 0); save() })
  })
  tableEl.querySelectorAll<HTMLButtonElement>('button[data-usage-del]').forEach((el) => {
    el.addEventListener('click', () => { const [cid, uid] = String(el.dataset.usageDel).split('|'); const c = s.courts.find((x) => x.id === cid); if (!c) return; c.usage = c.usage.filter((x) => x.id !== uid); save(); renderTable() })
  })

  tableEl.querySelectorAll<HTMLElement>('.slot').forEach((el) => {
    el.addEventListener('dragover', (e) => e.preventDefault())
    el.addEventListener('drop', (e) => {
      e.preventDefault()
      const pid = e.dataTransfer?.getData('text/plain')
      if (!pid) return
      dropToSlot(pid, String(el.dataset.slot))
    })
  })
  tableEl.querySelectorAll<HTMLElement>('[data-slot-player]').forEach((el) => {
    el.addEventListener('dragstart', (e) => e.dataTransfer?.setData('text/plain', String(el.dataset.slotPlayer)))
  })
  tableEl.querySelectorAll<HTMLButtonElement>('button[data-slot-clear]').forEach((el) => {
    el.addEventListener('click', () => { unassignPlayer(String(el.dataset.slotClear)); save(); render() })
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

function findPlayerSlot(playerId: string) {
  return Object.keys(s.assignment).find((k) => s.assignment[k] === playerId) || null
}
function unassignPlayer(playerId: string) {
  Object.keys(s.assignment).forEach((k) => { if (s.assignment[k] === playerId) s.assignment[k] = null })
}
function slotKey(courtId: string, groupIndex: number, pairIndex: number) { return `${courtId}|${groupIndex}|${pairIndex}` }
function trimAssignment() {
  const valid = new Set<string>()
  s.courts.forEach((c) => { for (let g = 0; g < s.groups; g += 1) for (let p = 0; p < 2; p += 1) valid.add(slotKey(c.id, g, p)) })
  Object.keys(s.assignment).forEach((k) => { if (!valid.has(k)) delete s.assignment[k] })
}

function bindPreviewControls() {
  const set = (id: string, val: number) => { byId<HTMLInputElement>(id).value = String(val) }
  set('cfgX', s.exportCfg.x); set('cfgY', s.exportCfg.y); set('cfgScale', s.exportCfg.scale); set('cfgTitle', s.exportCfg.titleSize); set('cfgCell', s.exportCfg.cellSize)
  ;(['cfgX', 'cfgY', 'cfgScale', 'cfgTitle', 'cfgCell'] as const).forEach((id) => {
    byId<HTMLInputElement>(id).oninput = () => {
      s.exportCfg = {
        x: Number(byId<HTMLInputElement>('cfgX').value),
        y: Number(byId<HTMLInputElement>('cfgY').value),
        scale: Number(byId<HTMLInputElement>('cfgScale').value),
        titleSize: Number(byId<HTMLInputElement>('cfgTitle').value),
        cellSize: Number(byId<HTMLInputElement>('cfgCell').value),
      }
      save()
      drawPreview()
    }
  })
}

async function drawPreview() {
  const canvas = byId<HTMLCanvasElement>('previewCanvas')
  const ctx = canvas.getContext('2d')!
  await drawSchedule(ctx, canvas.width, canvas.height)
}

async function exportScheduleImage() {
  const c = document.createElement('canvas')
  c.width = 1800
  c.height = 1200
  await drawSchedule(c.getContext('2d')!, c.width, c.height)
  const a = document.createElement('a')
  a.href = c.toDataURL('image/png')
  a.download = `schedule-${Date.now()}.png`
  a.click()
}

async function drawSchedule(ctx: CanvasRenderingContext2D, w: number, h: number) {
  if (s.bgDataUrl) {
    const bg = await loadImage(s.bgDataUrl)
    ctx.drawImage(bg, 0, 0, w, h)
  } else { ctx.fillStyle = '#f4efe6'; ctx.fillRect(0, 0, w, h) }

  const tableW = (Math.min(1600, 240 + s.courts.length * 360)) * s.exportCfg.scale
  const tableH = (260 + s.groups * 110) * s.exportCfg.scale
  const x0 = (w - tableW) / 2 + s.exportCfg.x
  const y0 = (h - tableH) / 2 + s.exportCfg.y
  const firstCol = 140 * s.exportCfg.scale
  const colW = (tableW - firstCol) / Math.max(1, s.courts.length)
  const row0 = 80 * s.exportCfg.scale
  const row1 = 80 * s.exportCfg.scale
  const rowG = 110 * s.exportCfg.scale

  ctx.fillStyle = '#fff'
  ctx.fillRect(x0, y0, tableW, tableH)
  ctx.strokeStyle = '#222'
  ctx.lineWidth = 2
  ctx.strokeRect(x0, y0, tableW, tableH)
  const yLines = [y0 + row0, y0 + row0 + row1, ...Array.from({ length: s.groups }, (_, i) => y0 + row0 + row1 + (i + 1) * rowG)]
  yLines.forEach((yy) => { ctx.beginPath(); ctx.moveTo(x0, yy); ctx.lineTo(x0 + tableW, yy); ctx.stroke() })
  ctx.beginPath(); ctx.moveTo(x0 + firstCol, y0); ctx.lineTo(x0 + firstCol, y0 + tableH); ctx.stroke()
  for (let i = 1; i < s.courts.length; i += 1) { const xx = x0 + firstCol + i * colW; ctx.beginPath(); ctx.moveTo(xx, y0); ctx.lineTo(xx, y0 + tableH); ctx.stroke() }

  ctx.fillStyle = '#111'
  ctx.font = `700 ${s.exportCfg.titleSize}px "Noto Sans SC"`
  ctx.fillText('场地分配表', x0 + tableW / 2 - 130 * s.exportCfg.scale, y0 - 26)
  ctx.font = `600 ${Math.round(s.exportCfg.cellSize * 0.95)}px "Noto Sans SC"`
  ctx.fillText('日期', x0 + 24, y0 + 50 * s.exportCfg.scale)
  ctx.fillText(`${s.date}`, x0 + firstCol + 10, y0 + 50 * s.exportCfg.scale)
  ctx.fillText(`时间：${s.time}`, x0 + firstCol + colW * Math.max(0, s.courts.length - 1) - 40, y0 + 50 * s.exportCfg.scale)
  ctx.fillText(`场地：${s.place}`, x0 + firstCol + colW * 0.8, y0 + 130 * s.exportCfg.scale)
  ctx.fillText('场地', x0 + 24, y0 + 130 * s.exportCfg.scale)
  s.courts.forEach((c, i) => fitText(ctx, `${c.label}号（${usageText(c)}）`, x0 + firstCol + i * colW + 12, y0 + 130 * s.exportCfg.scale, colW - 18, s.exportCfg.cellSize, 20))

  let gy = y0 + row0 + row1
  for (let g = 0; g < s.groups; g += 1) {
    ctx.font = `700 ${Math.round(s.exportCfg.cellSize * 1.05)}px "Noto Sans SC"`
    ctx.fillText(`第${g + 1}组`, x0 + 16, gy + 66 * s.exportCfg.scale)
    s.courts.forEach((c, i) => {
      const p1 = playerOf(s.assignment[slotKey(c.id, g, 0)])
      const p2 = playerOf(s.assignment[slotKey(c.id, g, 1)])
      fitText(ctx, playerText(p1), x0 + firstCol + i * colW + 10, gy + 44 * s.exportCfg.scale, colW - 20, s.exportCfg.cellSize, 18)
      fitText(ctx, playerText(p2), x0 + firstCol + i * colW + 10, gy + 90 * s.exportCfg.scale, colW - 20, s.exportCfg.cellSize, 18)
      ctx.beginPath()
      ctx.moveTo(x0 + firstCol + i * colW, gy + rowG / 2)
      ctx.lineTo(x0 + firstCol + (i + 1) * colW, gy + rowG / 2)
      ctx.stroke()
    })
    gy += rowG
  }
}

async function exportFeeImage() {
  const c = document.createElement('canvas')
  c.width = 1400
  c.height = 900
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, c.width, c.height)
  ctx.fillStyle = '#111'
  ctx.font = '700 54px "Noto Sans SC"'
  ctx.fillText('费用表', 620, 80)
  ctx.font = '500 34px "Noto Sans SC"'
  ctx.fillText(`日期：${s.date}  时间：${s.time}  地点：${s.place}`, 80, 130)

  const x0 = 80
  const y0 = 180
  const rowH = 70
  const colW = [180, 320, 250, 250, 250]
  const headers = ['场地', '用球明细', '场地费', '球费', '人均(进一分)']
  let x = x0
  headers.forEach((h, i) => { drawCell(ctx, x, y0, colW[i], rowH, h, true); x += colW[i] })
  s.courts.forEach((court, idx) => {
    const yy = y0 + (idx + 1) * rowH
    const ball = ballFee(court)
    const players = playersInCourt(court.id).length || 1
    const per = ceil2((court.courtFee + ball) / players)
    const data = [
      `${court.label}号场`,
      usageText(court),
      court.courtFee.toFixed(2),
      ball.toFixed(2),
      per.toFixed(2),
    ]
    x = x0
    data.forEach((v, i) => { drawCell(ctx, x, yy, colW[i], rowH, v, false); x += colW[i] })
  })
  const a = document.createElement('a')
  a.href = c.toDataURL('image/png')
  a.download = `fee-${Date.now()}.png`
  a.click()
}

function drawCell(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, text: string, bold: boolean) {
  ctx.strokeStyle = '#222'; ctx.strokeRect(x, y, w, h)
  ctx.font = `${bold ? 700 : 500} 30px "Noto Sans SC"`; ctx.fillStyle = '#111'
  fitText(ctx, text, x + 10, y + 44, w - 20, 30, 16)
}
function usageText(c: Court) { return c.usage.map((u) => `${brandName(u.brandId)}x${u.count}`).join('、') || '黄超x0' }
function brandName(id: string) { return s.brands.find((b) => b.id === id)?.name || '未知' }
function ballFee(court: Court) { return court.usage.reduce((sum, u) => sum + ((s.brands.find((b) => b.id === u.brandId)?.tubePrice || 0) / 12) * u.count, 0) }
function playersInCourt(courtId: string) { return Object.keys(s.assignment).filter((k) => k.startsWith(`${courtId}|`) && s.assignment[k]).map((k) => s.assignment[k]!) }
function playerOf(id?: string | null) { return s.players.find((p) => p.id === id) }
function playerText(p?: Player) { return p ? `${p.name}${p.female ? '🌷' : ''}${p.level ? ` ${p.level}` : ''}` : '-' }
function ceil2(v: number) { return Math.ceil(v * 100) / 100 }
function fitText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, start: number, min: number) {
  let size = start
  while (size >= min) { ctx.font = `${ctx.font.includes('700') ? 700 : 500} ${size}px "Noto Sans SC"`; if (ctx.measureText(text).width <= maxW) break; size -= 1 }
  ctx.fillText(text, x, y)
}

function byId<T extends HTMLElement = HTMLElement>(id: string) { return document.getElementById(id)! as T }
function esc(v: string) { return v.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;') }
function save() { localStorage.setItem(KEY, JSON.stringify(s)) }
function load(): State { try { return { ...initial, ...JSON.parse(localStorage.getItem(KEY) || '{}') } as State } catch { return structuredClone(initial) } }
function fileToDataUrl(file: File) { return new Promise<string>((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result || '')); r.onerror = reject; r.readAsDataURL(file) }) }
function loadImage(src: string) { return new Promise<HTMLImageElement>((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = reject; img.src = src }) }
