(() => {
  const canvas = document.getElementById('c')
  const ctx = canvas.getContext('2d')
  const hint = document.getElementById('hint')
  const resetBtn = document.getElementById('resetBtn')
  const addPaneBtn = document.getElementById('addPaneBtn')
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
  }
  window.addEventListener('resize', resize)

  function reset() {
    shards = []
    shatteredOnce = false
    ball = null
    hint.style.display = ''
    panes = [{ rect: basePane, broken: false }]
  }

  resetBtn.addEventListener('click', reset)
  addPaneBtn.addEventListener('click', () => {
    panes.push({ rect: paneRectAt(panes.length), broken: false })
  })

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

  function shardCountFor(power) {
    if (power < 0.25) return 20
    if (power <= 0.75) return 70
    return 20
  }

  function panesToBreakFor(power, total) {
    const k = Math.max(1, Math.round(1 + power * (total - 1)))
    return k
  }

  function coinsPerPane(power) {
    if (power < 0.25) return 10
    if (power <= 0.75) return 30
    return 10
  }

  canvas.addEventListener('pointerdown', e => {
    if (shatteredOnce) return
    const rect = canvas.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    const first = panes[0]?.rect
    if (!(mx >= first.x && mx <= first.x + first.w && my >= first.y && my <= first.y + first.h)) return
    hint.style.display = 'none'

    const raw = meterVal
    const power = Math.max(0, 1 - Math.abs(raw - 0.5) * 2)
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

    const gain = coinsPerPane(power) * broke
    coins += gain
    coinsEl.textContent = coins
    setTimeout(() => { if (ball) ball.active = false }, 200)
    sfx.shatter({ intensity: Math.min(1.5, meterVal + 0.15 * (broke - 1)), duration: 0.55 })
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
  reset()
  loop()
})()
