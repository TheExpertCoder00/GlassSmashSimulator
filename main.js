(() => {
  const canvas = document.getElementById('c')
  const ctx = canvas.getContext('2d')
  const hint = document.getElementById('hint')
  const resetBtn = document.getElementById('resetBtn')
  const buyPaneBtn = document.getElementById('buyPaneBtn')
  const coinsEl = document.getElementById('coins')
  const sfx = new window.SFX()
  const meterFill = document.getElementById('meterFill')
  const meterCursor = document.getElementById('meterCursor')

  let w, h, dpr
  let basePane
  let panes = []
  let shards = []
  let shatteredOnce = false
  let ball = null
  let coins = 0
  const gravity = 1200
  let last = performance.now()

  let meterVal = 0
  let meterDir = 1

  const LS_KEY = 'gss_maxPanes'

  function getMaxUnlocked() {
    const v = parseInt(localStorage.getItem(LS_KEY) || '1', 10)
    return Math.max(1, v)
  }

  function setMaxUnlocked(n) {
    localStorage.setItem(LS_KEY, String(Math.max(1, n)))
  }

  let maxUnlocked = getMaxUnlocked()

  function paneRectAt(i) {
    const dx = 26 * i
    return { x: basePane.x + dx, y: basePane.y, w: basePane.w, h: basePane.h }
  }

  function rebuildPaneRects() {
    for (let i = 0; i < panes.length; i++) panes[i].rect = paneRectAt(i)
  }

  function resize() {
    dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1))
    w = canvas.clientWidth = window.innerWidth
    h = canvas.clientHeight = window.innerHeight - document.querySelector('header').offsetHeight - 20
    canvas.width = Math.floor(w * dpr)
    canvas.height = Math.floor(h * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    const PW = Math.min(720, Math.floor(w * 0.7))
    const PH = Math.min(420, Math.floor(h * 0.6))
    basePane = { x: Math.floor((w - PW) / 2), y: Math.floor((h - PH) / 2), w: PW, h: PH }
    rebuildPaneRects()
    updateBuyBtn()
  }
  window.addEventListener('resize', resize)

  function buildPanes(count) {
    const arr = []
    for (let i = 0; i < count; i++) arr.push({ rect: paneRectAt(i), broken: false })
    return arr
  }

  function reset() {
    shards = []
    shatteredOnce = false
    ball = null
    hint.style.display = ''
    maxUnlocked = getMaxUnlocked()
    panes = buildPanes(maxUnlocked)
    updateBuyBtn()
  }

  const meterWidth = 320

  meterCursor.addEventListener('mousedown', (e) => {
    const startX = e.clientX
    const startMeterVal = meterVal
    const moveHandler = (m) => {
      const dx = m.clientX - startX
      meterVal = Math.max(0, Math.min(1, startMeterVal + dx / meterWidth))
      meterFill.style.width = `${meterVal * 100}%`
      meterCursor.style.left = `${meterVal * 100}%`
    }
    const upHandler = () => {
      window.removeEventListener('mousemove', moveHandler)
      window.removeEventListener('mouseup', upHandler)
    }
    window.addEventListener('mousemove', moveHandler)
    window.addEventListener('mouseup', upHandler)
  })

  function centeredPower(v) {
    return 1 - 2 * Math.abs(v - 0.5)
  }

  function shardCountFor(power) {
    if (power <= 0.4) return 20
    return 70
  }

  function panesToBreakFor(power, total) {
    return Math.max(1, Math.round(1 + power * (total - 1)))
  }

  function coinsPerPane(rawMeter) {
    if (rawMeter < 0.25 || rawMeter > 0.75) return 10
    return 30
  }

  function paneCost() {
    return Math.floor(200 * Math.pow(1.8, maxUnlocked - 1))
  }

  function updateBuyBtn() {
    const cost = paneCost()
    buyPaneBtn.textContent = `Buy Pane (${cost})`
    buyPaneBtn.disabled = coins < cost
  }

  buyPaneBtn.addEventListener('click', () => {
    const cost = paneCost()
    if (coins < cost) return
    coins -= cost
    coinsEl.textContent = coins
    maxUnlocked += 1
    setMaxUnlocked(maxUnlocked)
    panes.push({ rect: paneRectAt(panes.length), broken: false })
    updateBuyBtn()
  })

  resetBtn.addEventListener('click', reset)

  canvas.addEventListener('pointerdown', e => {
    if (shatteredOnce) return
    const rect = canvas.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    const first = panes[0]?.rect
    if (!(mx >= first.x && mx <= first.x + first.w && my >= first.y && my <= first.y + first.h)) return
    hint.style.display = 'none'

    const raw = meterVal
    const power = centeredPower(raw)
    const bx = first.x - 120
    const by = my
    const dx = mx - bx, dy = my - by
    const len = Math.hypot(dx, dy) || 1
    const baseSpeed = 600
    const maxBoost = 1200
    const speed = baseSpeed + power * maxBoost
    ball = { x: bx, y: by, r: 12, vx: speed * dx / len, vy: speed * dy / len, active: true }

    const toBreak = panesToBreakFor(power, panes.length)
    const perPaneShards = shardCountFor(power)
    let broke = 0
    for (let i = 0; i < panes.length && broke < toBreak; i++) {
      if (panes[i].broken) continue
      const p = panes[i].rect
      const impactX = p.x + 2
      shards.push(...window.Shatter.shatterAt(p, impactX, my, perPaneShards))
      panes[i].broken = true
      broke++
    }
    shatteredOnce = true

    const gain = coinsPerPane(raw) * broke
    coins += gain
    coinsEl.textContent = coins
    updateBuyBtn()
    setTimeout(() => { if (ball) ball.active = false }, 200)
    sfx.shatter({ intensity: Math.min(1.5, power + 0.15 * (broke - 1)), duration: 0.55 })
  })

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.arcTo(x + w, y, x + w, y + h, r)
    ctx.arcTo(x + w, y + h, x, y + h, r)
    ctx.arcTo(x, y + h, x, y, r)
    ctx.arcTo(x, y, x + w, y, r)
    ctx.closePath()
  }

  function update(dt) {
    meterVal += dt * meterDir * 0.6
    if (meterVal >= 1) { meterVal = 1; meterDir = -1 }
    if (meterVal <= 0) { meterVal = 0; meterDir = 1 }
    meterFill.style.width = (meterVal * 100).toFixed(1) + '%'
    meterCursor.style.left = (meterVal * 100).toFixed(1) + '%'

    if (ball?.active) {
      ball.x += ball.vx * dt
      ball.y += ball.vy * dt
      const floor = h - 8
      if (ball.y + ball.r > floor) {
        ball.y = floor - ball.r
        ball.vy *= -0.4
        ball.vx *= 0.98
        if (Math.abs(ball.vy) < 30) ball.active = false
      } else {
        ball.vy += gravity * dt
      }
    }
    if (shards.length) {
      for (const s of shards) {
        if (!s.dead) window.Shatter.updateShard(s, dt, { w, h, gravity })
      }
    }
  }

  function drawPaneRect(rect) {
    ctx.fillStyle = "rgba(160,220,255,0.08)"
    roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 8)
    ctx.fill()
    ctx.strokeStyle = "rgba(200,240,255,0.75)"
    ctx.lineWidth = 2
    roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 8)
    ctx.stroke()
  }

  function draw() {
    ctx.clearRect(0, 0, w, h)
    ctx.fillStyle = "rgba(255,255,255,0.06)"
    ctx.fillRect(0, h - 8, w, 8)

    for (let i = panes.length - 1; i >= 0; i--) {
      if (!panes[i].broken) drawPaneRect(panes[i].rect)
    }
    for (const s of shards) window.Shatter.drawShard(ctx, s)

    if (ball?.active) {
      ctx.beginPath()
      ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2)
      ctx.fillStyle = "rgba(255,255,255,0.9)"
      ctx.fill()
      ctx.strokeStyle = "rgba(0,0,0,0.5)"
      ctx.lineWidth = 1
      ctx.stroke()
    }
  }

  function loop() {
    const now = performance.now()
    const dt = Math.min(0.033, (now - last) / 1000)
    last = now
    update(dt)
    draw()
    requestAnimationFrame(loop)
  }

  resize()
  panes = buildPanes(maxUnlocked)
  coinsEl.textContent = coins
  updateBuyBtn()
  loop()

  resetBtn.addEventListener('click', reset)
})()
