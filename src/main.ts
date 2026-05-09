import './style.css'

type Player = {
  id: string
  raw: string
  name: string
  isFemale: boolean
  level: string
}

type Court = {
  id: string
  name: string
  players: Player[]
}

const app = document.querySelector<HTMLDivElement>('#app')!
let players: Player[] = []
let meta = { date: '', week: '', time: '', place: '', level: '' }
let courts: Court[] = ['5号场', '6号场', '7号场'].map((name, idx) => ({
  id: `c-${idx}`,
  name,
  players: [],
}))
let pickedPlayerId = ''

app.innerHTML = `
<main class="page">
  <header class="hero">
    <h1>Chiikawa 羽毛球场地分配</h1>
    <p>粘贴微信群接龙，自动提取并拖拽分配（手机可用）</p>
  </header>
  <section class="panel">
    <label for="relayInput">接龙原文</label>
    <textarea id="relayInput" placeholder="05月13日，星期三，18:00-22:00，翎动，新手/初级局，标注中羽或者台羽等级..."></textarea>
    <div class="actions">
      <button id="parseBtn">解析接龙</button>
      <button id="resetBtn" class="ghost">重置分配</button>
      <button id="downloadBtn" class="ghost">下载排表JSON</button>
      <button id="apiBtn" class="ghost">生成排表图片(预留API)</button>
    </div>
  </section>
  <section class="meta" id="meta"></section>
  <section class="board" id="board"></section>
</main>
`

const relayInput = document.querySelector<HTMLTextAreaElement>('#relayInput')!
const metaEl = document.querySelector<HTMLElement>('#meta')!
const boardEl = document.querySelector<HTMLElement>('#board')!

document.querySelector('#parseBtn')?.addEventListener('click', () => {
  const text = relayInput.value.trim()
  const parsed = parseRelay(text)
  players = parsed.players
  meta = parsed.meta
  courts = courts.map((c) => ({ ...c, players: [] }))
  pickedPlayerId = ''
  render()
})

document.querySelector('#resetBtn')?.addEventListener('click', () => {
  courts = courts.map((c) => ({ ...c, players: [] }))
  pickedPlayerId = ''
  render()
})

document.querySelector('#downloadBtn')?.addEventListener('click', () => {
  const payload = {
    meta,
    courts: courts.map((c) => ({
      name: c.name,
      players: c.players.map((p) => `${p.name}${p.isFemale ? '🌷' : ''}${p.level ? ` ${p.level}` : ''}`),
    })),
    unassigned: getUnassigned().map((p) => p.name),
  }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `badminton-${Date.now()}.json`
  a.click()
  URL.revokeObjectURL(a.href)
})

document.querySelector('#apiBtn')?.addEventListener('click', async () => {
  alert('图片生成API占位：请在 /api/render 中接入大模型后启用。')
})

function parseRelay(text: string): { meta: typeof meta; players: Player[] } {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  const head = lines[0] ?? ''
  const date = (head.match(/\d{1,2}月\d{1,2}日/) ?? [''])[0]
  const week = (head.match(/星期[一二三四五六日天]/) ?? [''])[0]
  const time = (head.match(/\d{1,2}:\d{2}\s*[-—~～]\s*\d{1,2}:\d{2}/) ?? [''])[0]
  const place = (head.split(/[，,]/).map((s) => s.trim()).find((s) => /馆|羽|动|球|体育|中心/.test(s) && !/星期|月|日|:/.test(s)) ?? '')
  const level = (head.match(/(新手\/初级局|初级局|中级局|高级局|娱乐局)/) ?? [''])[0]

  const parsedPlayers = lines
    .filter((line) => /^\d+\s*[\.、]/.test(line))
    .map((line, i) => {
      const raw = line.replace(/^\d+\s*[\.、]\s*/, '').trim()
      const isFemale = /🌷|💐|🌸/.test(raw)
      const levelMatch = raw.match(/(中羽|台羽)\s*[\d.]+级?|\d+(\.\d+)?级/)
      const levelText = levelMatch ? levelMatch[0] : ''
      const name = raw
        .replace(/（.*?）|\(.*?\)/g, '')
        .replace(/🌷|💐|🌸/g, '')
        .replace(/(中羽|台羽)\s*[\d.]+级?|\d+(\.\d+)?级/g, '')
        .trim()
      return {
        id: `p-${i}`,
        raw,
        name: name || `未命名-${i + 1}`,
        isFemale,
        level: levelText,
      }
    })
  return {
    meta: { date, week, time, place, level },
    players: parsedPlayers,
  }
}

function getUnassigned() {
  const used = new Set(courts.flatMap((c) => c.players.map((p) => p.id)))
  return players.filter((p) => !used.has(p.id))
}

function moveToCourt(playerId: string, courtId: string) {
  const player = players.find((p) => p.id === playerId)
  if (!player) return
  courts = courts.map((c) => ({ ...c, players: c.players.filter((p) => p.id !== playerId) }))
  courts = courts.map((c) => (c.id === courtId ? { ...c, players: [...c.players, player] } : c))
}

function render() {
  metaEl.innerHTML = `
  <div>日期：${meta.date || '待解析'} ${meta.week || ''}</div>
  <div>时间：${meta.time || '待解析'}</div>
  <div>场地：${meta.place || '待解析'}</div>
  <div>局别：${meta.level || '待解析'}</div>
  <div>人数：${players.length}</div>
  `

  const unassigned = getUnassigned()
  boardEl.innerHTML = `
  <article class="pool dropzone" data-court="pool">
    <h3>待分配 (${unassigned.length})</h3>
    <div class="cards" id="poolCards">
      ${unassigned.map(playerCard).join('')}
    </div>
  </article>
  ${courts
    .map(
      (court) => `
    <article class="court dropzone" data-court="${court.id}">
      <h3>${court.name} (${court.players.length})</h3>
      <div class="cards">
        ${court.players.map(playerCard).join('')}
      </div>
    </article>`
    )
    .join('')}
  `
  bindDnD()
}

function playerCard(p: Player) {
  return `<button class="player ${p.isFemale ? 'female' : ''}" draggable="true" data-player="${p.id}">
    <span>${p.name}</span>
    <small>${p.level || (p.isFemale ? '🌷' : '选手')}</small>
  </button>`
}

function bindDnD() {
  document.querySelectorAll<HTMLElement>('[data-player]').forEach((el) => {
    el.addEventListener('dragstart', (e) => {
      e.dataTransfer?.setData('text/plain', el.dataset.player || '')
    })
    el.addEventListener('click', () => {
      pickedPlayerId = el.dataset.player || ''
      document.querySelectorAll('.player').forEach((node) => node.classList.remove('active'))
      el.classList.add('active')
    })
  })

  document.querySelectorAll<HTMLElement>('.dropzone').forEach((z) => {
    z.addEventListener('dragover', (e) => e.preventDefault())
    z.addEventListener('drop', (e) => {
      e.preventDefault()
      const pid = e.dataTransfer?.getData('text/plain')
      const cid = z.dataset.court || ''
      if (!pid || cid === 'pool') return
      moveToCourt(pid, cid)
      render()
    })
    z.addEventListener('click', () => {
      const cid = z.dataset.court || ''
      if (!pickedPlayerId || cid === 'pool') return
      moveToCourt(pickedPlayerId, cid)
      pickedPlayerId = ''
      render()
    })
  })
}

render()
