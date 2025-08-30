(() => {
  const canvas = document.getElementById('c')
  const ctx = canvas.getContext('2d')
  const hint = document.getElementById('hint')
  const resetBtn = document.getElementById('resetBtn')
  const coinsEl = document.getElementById('coins')
  const sfx = new window.SFX()
  const meterFill = document.getElementById('meterFill')
  const meterCursor = document.getElementById('meterCursor')

  let w, h, dpr
  let pane
  let shards = []
  let shattered = false
  let ball = null
  let coins = 0
  const gravity = 1200
  let last = performance.now()

  let meterVal = 0
  let meterDir = 1

  function resize() {
    dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1))
    w = canvas.clientWidth = window.innerWidth
    h = canvas.clientHeight = window.innerHeight - document.querySelector('header').offsetHeight - 20
    canvas.width = Math.floor(w * dpr)
    canvas.height = Math.floor(h * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    const PW = Math.min(720, Math.floor(w * 0.7))
    const PH = Math.min(420, Math.floor(h * 0.6))
    pane = { x: Math.floor((w - PW) / 2), y: Math.floor((h - PH) / 2), w: PW, h: PH }
  }
  window.addEventListener('resize', resize)
  resize()

  function reset() {
    shards = []
    shattered = false
    ball = null
    hint.style.display = ''
  }
  resetBtn.addEventListener('click', reset)

  const meterWidth = 320

  meterCursor.addEventListener('mousedown', (e) => {
    const startX = e.clientX
    const startMeterVal = meterVal

    const moveHandler = (moveEvent) => {
      const dx = moveEvent.clientX - startX
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

  canvas.addEventListener('pointerdown', e => {
    if (shattered) return
    const rect = canvas.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    if (!(mx >= pane.x && mx <= pane.x + pane.w && my >= pane.y && my <= pane.y + pane.h)) return
    hint.style.display = 'none'

    const power = meterVal
    const bx = pane.x - 120
    const by = my
    const dx = mx - bx, dy = my - by
    const len = Math.hypot(dx, dy) || 1
    const baseSpeed = 600
    const maxBoost = 1200
    const speed = baseSpeed + power * maxBoost
    ball = { x: bx, y: by, r: 12, vx: speed * dx / len, vy: speed * dy / len, active: true }

    let shardCount = 0
    if (power < 0.2 || power > 0.8) {
      shardCount = 20
    } else if (power >= 0.2 && power <= 0.8) {
      shardCount = 50
    }

    shards = window.Shatter.shatterAt(pane, pane.x + 2, my, shardCount)
    shattered = true

    let coinsGained = 0
    if (power < 0.25) {
      coinsGained = 10
    } else if (power >= 0.25 && power <= 0.75) {
      coinsGained = 30
    } else {
      coinsGained = 10
    }

    coins += coinsGained
    coinsEl.textContent = coins
    setTimeout(() => { if (ball) ball.active = false }, 200)

    sfx.shatter({ intensity: meterVal, duration: 0.5 })
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

  function draw() {
    ctx.clearRect(0, 0, w, h)
    ctx.fillStyle = "rgba(255,255,255,0.06)"
    ctx.fillRect(0, h - 8, w, 8)
    if (!shattered) {
      ctx.fillStyle = "rgba(160,220,255,0.08)"
      roundRect(ctx, pane.x, pane.y, pane.w, pane.h, 8)
      ctx.fill()
      ctx.strokeStyle = "rgba(200,240,255,0.75)"
      ctx.lineWidth = 2
      roundRect(ctx, pane.x, pane.y, pane.w, pane.h, 8)
      ctx.stroke()
    } else {
      for (const s of shards) window.Shatter.drawShard(ctx, s)
    }
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
  loop()
})()
