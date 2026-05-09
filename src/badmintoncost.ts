import './badmintoncost.css'

type Brand = { id: string; name: string; tubePrice: number }
type Usage = { id: string; brandId: string; count: number }
type Court = { id: string; players: number; courtFee: number; usage: Usage[] }
type State = { brands: Brand[]; courts: Court[] }

const KEY = 'fengzi_badminton_cost_v2'
const mkBrand = (): Brand => ({ id: `b${Date.now()}${Math.random()}`, name: '黄超', tubePrice: 120 })
const mkCourt = (): Court => ({ id: `c${Date.now()}${Math.random()}`, players: 6, courtFee: 70, usage: [] })
let s: State = load()
restoreCostFromShare()

const app = document.querySelector<HTMLDivElement>('#app')!
app.innerHTML = `
<main class="cost-page">
  <header class="card top">
    <h1>badmintoncost</h1>
    <div class="row">
      <button id="shareCost" class="btn">分享费用表</button>
      <a class="btn" href="/">返回排表页</a>
    </div>
  </header>
  <section class="card">
    <h2>用球品牌与价格（每桶12颗）</h2>
    <div id="brands"></div>
    <button id="addBrand" class="btn">+品牌</button>
  </section>
  <section class="card">
    <h2>场地费用计算</h2>
    <div id="courts"></div>
    <div class="row">
      <button id="addCourt" class="btn">+场地</button>
      <button id="removeCourt" class="btn">-场地</button>
    </div>
  </section>
</main>
`

const brandsEl = byId<HTMLDivElement>('brands')
const courtsEl = byId<HTMLDivElement>('courts')

byId('addBrand').onclick = () => { s.brands.push(mkBrand()); save(); render() }
byId('addCourt').onclick = () => { s.courts.push(mkCourt()); save(); render() }
byId('removeCourt').onclick = () => { s.courts = s.courts.slice(0, Math.max(1, s.courts.length - 1)); save(); render() }
byId('shareCost').onclick = () => shareCost()

render()

function render() {
  brandsEl.innerHTML = s.brands.map((b) => `
    <div class="brand-row">
      <input data-bn="${b.id}" value="${esc(b.name)}" placeholder="品牌">
      <input data-bp="${b.id}" type="number" step="0.01" value="${b.tubePrice}" placeholder="每桶价格">
      <span data-bv="${b.id}">单颗：${(b.tubePrice / 12).toFixed(2)}</span>
      <button data-bd="${b.id}" class="btn">删</button>
    </div>
  `).join('')

  courtsEl.innerHTML = s.courts.map((c, i) => `
    <article class="court">
      <h3>第${i + 1}片场地</h3>
      <div class="grid">
        <label>人数<input data-cp="${c.id}" type="number" min="1" value="${c.players}"></label>
        <label>场地费<input data-cf="${c.id}" type="number" step="0.01" value="${c.courtFee}"></label>
      </div>
      <div class="usage">${renderUsage(c)}</div>
      <button data-ua="${c.id}" class="btn">+用球</button>
      <div class="result" data-cr="${c.id}">人均：${perCourt(c).toFixed(2)}</div>
    </article>
  `).join('')

  bindEvents()
}

function bindEvents() {
  brandsEl.querySelectorAll<HTMLInputElement>('input[data-bn]').forEach((el) => {
    el.oninput = () => { const b = s.brands.find((x) => x.id === el.dataset.bn); if (!b) return; b.name = el.value; save(); updateUsageSelectLabels() }
  })
  brandsEl.querySelectorAll<HTMLInputElement>('input[data-bp]').forEach((el) => {
    el.oninput = () => {
      const b = s.brands.find((x) => x.id === el.dataset.bp); if (!b) return
      b.tubePrice = Number(el.value || 0)
      save()
      const v = brandsEl.querySelector<HTMLElement>(`[data-bv="${b.id}"]`)
      if (v) v.textContent = `单颗：${(b.tubePrice / 12).toFixed(2)}`
      updateUsageSelectLabels()
      updateCourtResults()
    }
  })
  brandsEl.querySelectorAll<HTMLButtonElement>('button[data-bd]').forEach((el) => {
    el.onclick = () => { s.brands = s.brands.filter((x) => x.id !== el.dataset.bd); save(); render() }
  })

  courtsEl.querySelectorAll<HTMLInputElement>('input[data-cp]').forEach((el) => {
    el.oninput = () => { const c = s.courts.find((x) => x.id === el.dataset.cp); if (!c) return; c.players = Math.max(1, Number(el.value || 1)); save(); updateCourtResults() }
  })
  courtsEl.querySelectorAll<HTMLInputElement>('input[data-cf]').forEach((el) => {
    el.oninput = () => { const c = s.courts.find((x) => x.id === el.dataset.cf); if (!c) return; c.courtFee = Number(el.value || 0); save(); updateCourtResults() }
  })
  courtsEl.querySelectorAll<HTMLButtonElement>('button[data-ua]').forEach((el) => {
    el.onclick = () => { const c = s.courts.find((x) => x.id === el.dataset.ua); if (!c || s.brands.length === 0) return; c.usage.push({ id: `u${Date.now()}${Math.random()}`, brandId: s.brands[0].id, count: 1 }); save(); render() }
  })
  courtsEl.querySelectorAll<HTMLSelectElement>('select[data-ub]').forEach((el) => {
    el.onchange = () => { const [cid, uid] = String(el.dataset.ub).split('|'); const c = s.courts.find((x) => x.id === cid); const u = c?.usage.find((x) => x.id === uid); if (!u) return; u.brandId = el.value; save(); updateCourtResults() }
  })
  courtsEl.querySelectorAll<HTMLInputElement>('input[data-uc]').forEach((el) => {
    el.oninput = () => { const [cid, uid] = String(el.dataset.uc).split('|'); const c = s.courts.find((x) => x.id === cid); const u = c?.usage.find((x) => x.id === uid); if (!u) return; u.count = Number(el.value || 0); save(); updateCourtResults() }
  })
  courtsEl.querySelectorAll<HTMLButtonElement>('button[data-ud]').forEach((el) => {
    el.onclick = () => { const [cid, uid] = String(el.dataset.ud).split('|'); const c = s.courts.find((x) => x.id === cid); if (!c) return; c.usage = c.usage.filter((x) => x.id !== uid); save(); render() }
  })
}

function updateCourtResults() {
  courtsEl.querySelectorAll<HTMLElement>('[data-cr]').forEach((el) => {
    const c = s.courts.find((x) => x.id === el.dataset.cr)
    if (!c) return
    el.textContent = `人均：${perCourt(c).toFixed(2)}`
  })
}

function updateUsageSelectLabels() {
  courtsEl.querySelectorAll<HTMLSelectElement>('select[data-ub]').forEach((sel) => {
    const [cid, uid] = String(sel.dataset.ub).split('|')
    const c = s.courts.find((x) => x.id === cid)
    const u = c?.usage.find((x) => x.id === uid)
    if (!u) return
    sel.querySelectorAll('option').forEach((op) => {
      const b = s.brands.find((x) => x.id === op.value)
      if (!b) return
      op.textContent = `${b.name}（${(b.tubePrice / 12).toFixed(2)}/颗）`
      if (op.value === u.brandId) op.selected = true
    })
  })
}

function renderUsage(c: Court) {
  return c.usage.map((u) => {
    const opts = s.brands.map((b) => `<option value="${b.id}" ${b.id === u.brandId ? 'selected' : ''}>${esc(b.name)}（${(b.tubePrice / 12).toFixed(2)}/颗）</option>`).join('')
    return `<div class="usage-row">
      <select data-ub="${c.id}|${u.id}">${opts}</select>
      <input data-uc="${c.id}|${u.id}" type="number" min="0" value="${u.count}">
      <button data-ud="${c.id}|${u.id}" class="btn">删</button>
    </div>`
  }).join('')
}

function perCourt(c: Court) {
  const ball = c.usage.reduce((sum, u) => sum + ((s.brands.find((b) => b.id === u.brandId)?.tubePrice || 0) / 12) * u.count, 0)
  return ceil2((c.courtFee + ball) / Math.max(1, c.players))
}
function ceil2(v: number) { return Math.ceil(v * 100) / 100 }

function shareCost() {
  const payload = {
    bs: s.brands.map((b) => [b.id, b.name, b.tubePrice]),
    cs: s.courts.map((c) => [c.id, c.players, c.courtFee, c.usage.map((u) => [u.id, u.brandId, u.count])]),
  }
  const code = toBase64Url(JSON.stringify(payload))
  const url = `${location.origin}${location.pathname}?s=${code}`
  navigator.clipboard.writeText(url).then(() => alert('费用表分享链接已复制')).catch(() => prompt('复制链接', url))
}

function restoreCostFromShare() {
  const code = new URLSearchParams(location.search).get('s')
  if (!code) return
  try {
    const p = JSON.parse(fromBase64Url(code)) as {
      bs?: Array<[string, string, number]>
      cs?: Array<[string, number, number, Array<[string, string, number]>]>
    }
    if (p.bs?.length) s.brands = p.bs.map((x) => ({ id: x[0], name: x[1], tubePrice: Number(x[2] || 0) }))
    if (p.cs?.length) {
      s.courts = p.cs.map((x) => ({
        id: x[0],
        players: Math.max(1, Number(x[1] || 1)),
        courtFee: Number(x[2] || 0),
        usage: (x[3] || []).map((u) => ({ id: u[0], brandId: u[1], count: Number(u[2] || 0) })),
      }))
    }
    save()
  } catch {}
}

function toBase64Url(text: string) {
  const b64 = btoa(unescape(encodeURIComponent(text)))
  return b64.replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}
function fromBase64Url(text: string) {
  const b64 = text.replaceAll('-', '+').replaceAll('_', '/')
  const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4))
  return decodeURIComponent(escape(atob(b64 + pad)))
}

function byId<T extends HTMLElement = HTMLElement>(id: string) { return document.getElementById(id)! as T }
function esc(v: string) { return v.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;') }
function save() { localStorage.setItem(KEY, JSON.stringify(s)) }
function load(): State {
  try {
    return { brands: [mkBrand()], courts: [mkCourt()], ...JSON.parse(localStorage.getItem(KEY) || '{}') } as State
  } catch {
    return { brands: [mkBrand()], courts: [mkCourt()] }
  }
}
