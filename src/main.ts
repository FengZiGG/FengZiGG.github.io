import './style.css'

type Player = { id: string; name: string; female: boolean; unresolved: boolean }
type Court = { id: string; label: string; slots: (string | null)[]; shuttleUsage: { brand: string; count: number }[] }
type Brand = { name: string; tubePrice: number }
type State = {
  raw: string
  date: string
  time: string
  place: string
  players: Player[]
  courts: Court[]
  brands: Brand[]
  totalCourtFee: string
  perCourtFee: string
  bgDataUrl: string
}

const KEY = 'fengzi_badminton_state_v2'
let gateClicks: number[] = []
const initial: State = {
  raw: '',
  date: '',
  time: '',
  place: '',
  players: [],
  courts: [1, 2, 3].map((n, i) => ({ id: `c${i}`, label: `${n}`, slots: Array(8).fill(null), shuttleUsage: [] })),
  brands: [{ name: 'RSL5', tubePrice: 95 }],
  totalCourtFee: '',
  perCourtFee: '',
  bgDataUrl: '',
}
let s: State = load()

const app = document.querySelector<HTMLDivElement>('#app')!
app.innerHTML = `
<main class="page" id="page">
  <header class="top">
    <button id="gateIcon" class="gate" title="click 3 times for blog">🏸</button>
    <h1>风子的羽毛球场地分配工具</h1>
    <button id="clearCache">清空缓存</button>
  </header>
  <section class="panel">
    <textarea id="raw" placeholder="时间：2026年05月13日 18:00-22:00&#10;地点：翎动&#10;1. 夜鹭🌷 中羽3.5级"></textarea>
    <div class="row">
      <button id="parse">解析接龙</button>
      <label class="file">背景图<input id="bgUpload" type="file" accept="image/*"></label>
      <button id="download">下载带价格表格图</button>
    </div>
  </section>
  <section class="meta">
    <label>日期<input id="date"></label>
    <label>时间<input id="time"></label>
    <label>地点<input id="place"></label>
    <label>人数<input id="people" disabled></label>
  </section>
  <section class="brands">
    <div class="head"><strong>羽毛球品牌</strong><button id="addBrand">添加品牌</button></div>
    <div id="brandList"></div>
  </section>
  <section class="fees">
    <label>总场地费<input id="totalCourtFee" type="number" step="0.01"></label>
    <label>单片场地费<input id="perCourtFee" type="number" step="0.01"></label>
  </section>
  <section class="tableWrap" id="tableWrap"></section>
</main>
`

const rawEl = byId<HTMLTextAreaElement>('raw')
const dateEl = byId<HTMLInputElement>('date')
const timeEl = byId<HTMLInputElement>('time')
const placeEl = byId<HTMLInputElement>('place')
const peopleEl = byId<HTMLInputElement>('people')
const brandList = byId<HTMLDivElement>('brandList')
const tableWrap = byId<HTMLDivElement>('tableWrap')

byId('gateIcon').addEventListener('click', () => {
  const now = Date.now()
  gateClicks = [...gateClicks.filter((x) => now - x < 1500), now]
  if (gateClicks.length >= 3) location.href = '/blog/'
})
byId('clearCache').addEventListener('click', () => {
  localStorage.removeItem(KEY)
  s = structuredClone(initial)
  render()
})
byId('parse').addEventListener('click', () => {
  parseRelay(rawEl.value)
  render()
})
byId('download').addEventListener('click', () => exportImage())
byId<HTMLInputElement>('bgUpload').addEventListener('change', async (e) => {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (!f) return
  s.bgDataUrl = await fileToDataUrl(f)
  save()
  render()
})
byId('addBrand').addEventListener('click', () => {
  s.brands.push({ name: '', tubePrice: 100 })
  save()
  render()
})

dateEl.addEventListener('input', () => { s.date = dateEl.value; save() })
timeEl.addEventListener('input', () => { s.time = timeEl.value; save() })
placeEl.addEventListener('input', () => { s.place = placeEl.value; save() })
byId<HTMLInputElement>('totalCourtFee').addEventListener('input', (e) => { s.totalCourtFee = (e.target as HTMLInputElement).value; save() })
byId<HTMLInputElement>('perCourtFee').addEventListener('input', (e) => { s.perCourtFee = (e.target as HTMLInputElement).value; save() })

render()

function parseRelay(text: string) {
  s.raw = text
  const lines = text.split(/\r?\n/).map((x) => x.trim()).filter(Boolean)
  const t = lines.find((x) => x.startsWith('时间：'))?.replace('时间：', '').trim() ?? ''
  const p = lines.find((x) => x.startsWith('地点：'))?.replace('地点：', '').trim() ?? ''
  if (t) {
    const m = t.match(/(\d{4}年\d{1,2}月\d{1,2}日)\s*(.*)/)
    s.date = m?.[1] ?? t
    s.time = m?.[2] ?? ''
  }
  if (p) s.place = p
  s.players = lines
    .filter((x) => /^\d+\s*[\.、]/.test(x))
    .map((line, i) => {
      const raw = line.replace(/^\d+\s*[\.、]\s*/, '')
      const female = /🌷|💐|🌸/.test(raw)
      const cleaned = raw.replace(/🌷|💐|🌸/g, '').replace(/(中羽|台羽)\s*[\d.]+级?/g, '').trim()
      const unresolved = cleaned.length === 0
      return { id: `p${i}`, name: unresolved ? '未解析' : cleaned, female, unresolved }
    })
  s.courts = s.courts.map((c) => ({ ...c, slots: Array(8).fill(null) }))
  save()
}

function render() {
  rawEl.value = s.raw
  dateEl.value = s.date
  timeEl.value = s.time
  placeEl.value = s.place
  peopleEl.value = String(s.players.filter((p) => p.name !== '未解析').length)
  byId<HTMLInputElement>('totalCourtFee').value = s.totalCourtFee
  byId<HTMLInputElement>('perCourtFee').value = s.perCourtFee
  renderBrands()
  renderTable()
  byId('page').setAttribute('style', s.bgDataUrl ? `background-image:url(${s.bgDataUrl})` : '')
}

function renderBrands() {
  brandList.innerHTML = s.brands.map((b, i) => `
  <div class="brandRow">
    <input data-brand-name="${i}" value="${esc(b.name)}" placeholder="品牌名">
    <input data-brand-price="${i}" value="${b.tubePrice}" type="number" step="0.01" placeholder="每桶价格(12颗)">
    <button data-brand-del="${i}">删</button>
  </div>`).join('')
  brandList.querySelectorAll<HTMLInputElement>('input[data-brand-name]').forEach((el) => {
    el.addEventListener('input', () => { s.brands[Number(el.dataset.brandName)].name = el.value; save(); renderTable() })
  })
  brandList.querySelectorAll<HTMLInputElement>('input[data-brand-price]').forEach((el) => {
    el.addEventListener('input', () => { s.brands[Number(el.dataset.brandPrice)].tubePrice = Number(el.value || 0); save(); renderTable() })
  })
  brandList.querySelectorAll<HTMLButtonElement>('button[data-brand-del]').forEach((el) => {
    el.addEventListener('click', () => { s.brands.splice(Number(el.dataset.brandDel), 1); save(); render() })
  })
}

function renderTable() {
  const header = s.courts.map((c) => `<th><input data-court-label="${c.id}" value="${esc(c.label)}"></th>`).join('')
  const usage = s.courts.map((c) => `<td>${usageHtml(c)}</td>`).join('')
  const groupRows = [1, 2, 3, 4].map((g) => {
    const cells = s.courts.map((c) => `<td><div class="pair">${slotHtml(c, (g - 1) * 2)}${slotHtml(c, (g - 1) * 2 + 1)}</div></td>`).join('')
    return `<tr><th>第${g}组</th>${cells}</tr>`
  }).join('')
  const feeRow = s.courts.map((c) => `<td>${feePerCourt(c).toFixed(2)}</td>`).join('')
  tableWrap.innerHTML = `
  <table class="tbl">
    <tr><th>场地号</th>${header}</tr>
    <tr><th>用球/数量</th>${usage}</tr>
    ${groupRows}
    <tr><th>人均费用</th>${feeRow}</tr>
  </table>
  <div class="pool">
    ${s.players.map((p) => `<div class="chip ${p.unresolved ? 'bad' : ''}">
      <input data-player-name="${p.id}" value="${esc(p.name)}">
      <button data-player-flower="${p.id}" class="flower">${p.female ? '🌷' : ''}</button>
    </div>`).join('')}
  </div>`

  tableWrap.querySelectorAll<HTMLInputElement>('input[data-court-label]').forEach((el) => {
    el.addEventListener('input', () => {
      const c = s.courts.find((x) => x.id === el.dataset.courtLabel)
      if (!c) return
      c.label = el.value
      save()
    })
  })
  tableWrap.querySelectorAll<HTMLSelectElement>('select[data-slot]').forEach((el) => {
    el.addEventListener('change', () => {
      const [cid, idx] = String(el.dataset.slot).split(':')
      const c = s.courts.find((x) => x.id === cid)
      if (!c) return
      c.slots[Number(idx)] = el.value || null
      save()
      renderTable()
    })
  })
  tableWrap.querySelectorAll<HTMLButtonElement>('button[data-player-flower]').forEach((el) => {
    el.addEventListener('click', () => {
      const p = s.players.find((x) => x.id === el.dataset.playerFlower)
      if (!p) return
      p.female = !p.female
      save()
      renderTable()
    })
  })
  tableWrap.querySelectorAll<HTMLInputElement>('input[data-player-name]').forEach((el) => {
    el.addEventListener('input', () => {
      const p = s.players.find((x) => x.id === el.dataset.playerName)
      if (!p) return
      p.name = el.value || '未解析'
      p.unresolved = p.name === '未解析'
      save()
      renderTable()
    })
  })
  tableWrap.querySelectorAll<HTMLSelectElement>('select[data-use-brand]').forEach((el) => {
    el.addEventListener('change', () => {
      const cid = String(el.dataset.useBrand)
      const c = s.courts.find((x) => x.id === cid)
      if (!c || !el.value) return
      c.shuttleUsage.push({ brand: el.value, count: 1 })
      save()
      renderTable()
    })
  })
  tableWrap.querySelectorAll<HTMLInputElement>('input[data-use-count]').forEach((el) => {
    el.addEventListener('input', () => {
      const [cid, i] = String(el.dataset.useCount).split(':')
      const c = s.courts.find((x) => x.id === cid)
      if (!c) return
      c.shuttleUsage[Number(i)].count = Number(el.value || 0)
      save()
      renderTable()
    })
  })
  tableWrap.querySelectorAll<HTMLButtonElement>('button[data-use-del]').forEach((el) => {
    el.addEventListener('click', () => {
      const [cid, i] = String(el.dataset.useDel).split(':')
      const c = s.courts.find((x) => x.id === cid)
      if (!c) return
      c.shuttleUsage.splice(Number(i), 1)
      save()
      renderTable()
    })
  })
}

function slotHtml(c: Court, idx: number) {
  const opts = ['<option value="">-</option>']
  s.players.forEach((p) => opts.push(`<option value="${p.id}" ${c.slots[idx] === p.id ? 'selected' : ''}>${esc(p.name)}${p.female ? '🌷' : ''}</option>`))
  return `<select data-slot="${c.id}:${idx}">${opts.join('')}</select>`
}
function usageHtml(c: Court) {
  const opts = ['<option value="">添加品牌</option>']
  s.brands.forEach((b) => opts.push(`<option value="${esc(b.name)}">${esc(b.name)}</option>`))
  const rows = c.shuttleUsage.map((u, i) => `<div class="useRow"><span>${esc(u.brand)}</span><input data-use-count="${c.id}:${i}" value="${u.count}" type="number"><button data-use-del="${c.id}:${i}">x</button></div>`).join('')
  return `${rows}<select data-use-brand="${c.id}">${opts.join('')}</select>`
}
function feePerCourt(c: Court) {
  const courtFee = s.totalCourtFee ? Number(s.totalCourtFee || 0) / s.courts.length : Number(s.perCourtFee || 0)
  const ballFee = c.shuttleUsage.reduce((sum, u) => {
    const b = s.brands.find((x) => x.name === u.brand)
    return sum + (b ? (b.tubePrice / 12) * u.count : 0)
  }, 0)
  const n = c.slots.filter(Boolean).length || 1
  return Math.ceil(((courtFee + ballFee) / n) * 100) / 100
}

async function exportImage() {
  const canvas = document.createElement('canvas')
  canvas.width = 1600
  canvas.height = 1000
  const ctx = canvas.getContext('2d')!
  if (s.bgDataUrl) {
    const img = await loadImage(s.bgDataUrl)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  } else {
    ctx.fillStyle = '#f8f2ea'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }
  ctx.fillStyle = '#4a2a20'
  ctx.font = '700 50px "Noto Sans SC"'
  ctx.fillText('风子的羽毛球场地分配工具', 430, 80)
  ctx.font = '500 30px "Noto Sans SC"'
  ctx.fillText(`日期 ${s.date} 时间 ${s.time} 地点 ${s.place}`, 110, 140)
  let y = 220
  s.courts.forEach((c) => {
    ctx.font = '700 38px "Noto Sans SC"'
    ctx.fillText(`${c.label}号场`, 100, y)
    c.slots.forEach((pid, i) => {
      const p = s.players.find((x) => x.id === pid)
      fitText(ctx, `${i + 1}. ${p ? `${p.name}${p.female ? '🌷' : ''}` : '-'}`, 330 + Math.floor(i / 4) * 560, y - 5 + (i % 4) * 45, 520)
    })
    y += 220
  })
  const a = document.createElement('a')
  a.href = canvas.toDataURL('image/png')
  a.download = `schedule-${Date.now()}.png`
  a.click()
}
function fitText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number) {
  let size = 28
  while (size > 14) {
    ctx.font = `500 ${size}px "Noto Sans SC"`
    if (ctx.measureText(text).width <= maxWidth) break
    size -= 1
  }
  ctx.fillText(text, x, y)
}

function byId<T extends HTMLElement = HTMLElement>(id: string) { return document.getElementById(id)! as T }
function esc(v: string) { return v.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;') }
function save() { localStorage.setItem(KEY, JSON.stringify(s)) }
function load(): State {
  try { return { ...initial, ...JSON.parse(localStorage.getItem(KEY) || '{}') } as State }
  catch { return structuredClone(initial) }
}
function fileToDataUrl(file: File) { return new Promise<string>((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result || '')); r.onerror = reject; r.readAsDataURL(file) }) }
function loadImage(src: string) { return new Promise<HTMLImageElement>((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = reject; img.src = src }) }
