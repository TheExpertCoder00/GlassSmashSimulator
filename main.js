(() => {
  const canvas = document.getElementById('c')
  const ctx = canvas.getContext('2d')
  const hint = document.getElementById('hint')
  const resetBtn = document.getElementById('resetBtn')
  const buyPaneBtn = document.getElementById('buyPaneBtn')
  const coinsEl = document.getElementById('coins')
  const crystalsEl = document.getElementById('crystals')
  const sfx = new window.SFX()
  const meterFill = document.getElementById('meterFill')
  const meterCursor = document.getElementById('meterCursor')
  const modal = document.getElementById('howtoModal')
  const playBtn = document.getElementById('playBtn')
  const dontShowAgain = document.getElementById('dontShowAgain')

  let w, h, dpr
  let basePane
  let panes = []
  let shards = []
  let shatteredOnce = false
  let ball = null
  const gravity = 1200
  let last = performance.now()

  let meterVal = 0
  let meterDir = 1

  const LS_KEY = 'gss_maxPanes'
  function getMaxUnlocked(){ return Math.max(1, parseInt(localStorage.getItem(LS_KEY)||'1',10)||1) }
  function setMaxUnlocked(n){ localStorage.setItem(LS_KEY, String(Math.max(1,n))) }
  let maxUnlocked = getMaxUnlocked()

  function paneRectAt(i){ const dx = 26*i; return { x: basePane.x+dx, y: basePane.y, w: basePane.w, h: basePane.h } }
  function rebuildPaneRects(){ for(let i=0;i<panes.length;i++) panes[i].rect = paneRectAt(i) }

  function resize(){
    dpr = Math.max(1, Math.min(2, window.devicePixelRatio||1))
    w = canvas.clientWidth = window.innerWidth
    h = canvas.clientHeight = window.innerHeight - document.querySelector('header').offsetHeight - 20
    canvas.width = Math.floor(w*dpr)
    canvas.height = Math.floor(h*dpr)
    ctx.setTransform(dpr,0,0,dpr,0,0)
    const PW = Math.min(720, Math.floor(w*0.7))
    const PH = Math.min(420, Math.floor(h*0.6))
    basePane = { x: Math.floor((w-PW)/2), y: Math.floor((h-PH)/2), w: PW, h: PH }
    rebuildPaneRects()
    updateBuyBtn()
  }
  window.addEventListener('resize', resize)

  function buildPanes(count){ const arr=[]; for(let i=0;i<count;i++) arr.push({ rect: paneRectAt(i), broken:false }); return arr }

  function reset(){
    shards = []
    sparks = []
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
      meterFill.style.width = `${meterVal*100}%`
      meterCursor.style.left = `${meterVal*100}%`
      document.getElementById('meter').style.setProperty('--cursor-x', `${meterVal*100}%`)
    }
    const upHandler = () => {
      window.removeEventListener('mousemove', moveHandler)
      window.removeEventListener('mouseup', upHandler)
    }
    window.addEventListener('mousemove', moveHandler)
    window.addEventListener('mouseup', upHandler)
  })

  function centeredPower(v){ return 1 - 2*Math.abs(v - 0.5) }
  function shardCountFor(power){ if(power<=0.4) return 20; return 70 }
  function panesToBreakFor(power,total){ return Math.max(1, Math.round(1 + power*(total-1))) }
  function coinsPerPane(raw){ if(raw<0.25 || raw>0.75) return 10; return 30 }
  function isPerfect(raw){ return raw >= 0.48 && raw <= 0.52 }

  function coinCost(){ return Math.floor(200*Math.pow(1.8, maxUnlocked-1)) }
  function crystalCost(){ return Math.pow(2, Math.max(0, maxUnlocked-1)) }

  function updateHud(){
    coinsEl.textContent = Economy.getCoins()
    crystalsEl.textContent = Economy.getCrystals()
  }

  function updateBuyBtn(){
    const cc = coinCost()
    const xc = crystalCost()
    buyPaneBtn.textContent = `Buy Pane (${cc}💰, ${xc}🔮)`
    buyPaneBtn.disabled = !Economy.canSpend(cc, xc)
  }

  buyPaneBtn.addEventListener('click', () => {
    const cc = coinCost()
    const xc = crystalCost()
    if(!Economy.spend(cc, xc)) return
    maxUnlocked += 1
    setMaxUnlocked(maxUnlocked)
    panes.push({ rect: paneRectAt(panes.length), broken:false })
    updateHud()
    updateBuyBtn()
  })

  resetBtn.addEventListener('click', reset)
  window.addEventListener('keydown', (e) => {
    if (e.key === 'r' || e.key === 'R') reset()
  })
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
      e.preventDefault() // stops page scroll
      // fake a click in the center of the first pane
      const first = panes[0]?.rect
      if (!first || shatteredOnce) return
      const mx = first.x + first.w/2
      const my = first.y + first.h/2
      const evt = new MouseEvent('pointerdown', { 
        clientX: mx + canvas.getBoundingClientRect().left,
        clientY: my + canvas.getBoundingClientRect().top
      })
      canvas.dispatchEvent(evt)
    }
  })

  let shake = 0
  function addShake(s){ shake = Math.min(22, shake + s) }

  let sparks = []
  function emitSparks(x,y,n,spd){
    for(let i=0;i<n;i++){
      const a = Math.random()*Math.PI*2
      const v = spd*(0.45+Math.random()*0.8)
      sparks.push({x, y, vx: Math.cos(a)*v, vy: Math.sin(a)*v - v*0.15, life: 0.35+Math.random()*0.35, t:0, r: 1.5+Math.random()*1.5})
    }
  }

  let inputBlocked = true
  function showModalIfNeeded(){
    const hide = localStorage.getItem('gss_hideHelp') === '1'
    if (hide){
      inputBlocked = false
      modal.classList.add('hidden')
    } else {
      inputBlocked = true
      modal.classList.remove('hidden')
    }
  }

  playBtn.addEventListener('click', () => {
    if (dontShowAgain.checked) localStorage.setItem('gss_hideHelp','1')
    modal.classList.add('hidden')
    inputBlocked = false
  })

  canvas.addEventListener('pointerdown', e => {
    if (inputBlocked) return
    if (shatteredOnce) return
    const rect = canvas.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    const first = panes[0]?.rect
    if (!(mx>=first.x && mx<=first.x+first.w && my>=first.y && my<=first.y+first.h)) return
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
    ball = { x: bx, y: by, r: 12, vx: speed*dx/len, vy: speed*dy/len, active: true, glow: 1+power*2 }

    const toBreak = panesToBreakFor(power, panes.length)
    const perPaneShards = shardCountFor(power)
    let broke = 0
    for (let i=0;i<panes.length && broke<toBreak;i++){
      if (panes[i].broken) continue
      const p = panes[i].rect
      const impactX = p.x + 2
      shards.push(...window.Shatter.shatterAt(p, impactX, my, perPaneShards))
      panes[i].broken = true
      broke++
      emitSparks(impactX+8, my, 22+Math.floor(power*16), 360+power*420)
    }
    shatteredOnce = true

    const gainCoins = coinsPerPane(raw) * broke
    const gainCrystal = isPerfect(raw) ? 1 : 0
    if (gainCoins) Economy.addCoins(gainCoins)
    if (gainCrystal) Economy.addCrystals(gainCrystal)
    updateHud()
    updateBuyBtn()

    setTimeout(() => { if (ball) ball.active = false }, 200)
    const sfxIntensity = Math.min(1.5, power + 0.15*(broke-1))
    sfx.shatter({ intensity: sfxIntensity, duration: 0.55 })
    addShake(6 + power*9 + (broke-1)*2)
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

  function update(dt){
    meterVal += dt * meterDir * 0.6
    if (meterVal >= 1) { meterVal = 1; meterDir = -1 }
    if (meterVal <= 0) { meterVal = 0; meterDir = 1 }
    meterFill.style.width = (meterVal*100).toFixed(1) + '%'
    meterCursor.style.left = (meterVal*100).toFixed(1) + '%'
    document.getElementById('meter').style.setProperty('--cursor-x', `${(meterVal*100).toFixed(1)}%`)

    if (ball?.active) {
      ball.x += ball.vx * dt
      ball.y += ball.vy * dt
      const floor = h - 8
      if (ball.y + ball.r > floor) {
        ball.y = floor - ball.r
        ball.vy *= -0.4
        ball.vx *= 0.98
        if (Math.abs(ball.vy) < 30) ball.active = false
        emitSparks(ball.x, floor-2, 10, 240)
        addShake(4)
      } else {
        ball.vy += gravity * dt
      }
    }

    if (shards.length) {
      for (const s of shards) {
        if (!s.dead) window.Shatter.updateShard(s, dt, { w, h, gravity })
      }
    }

    if (sparks.length){
      for (let i=sparks.length-1;i>=0;i--){
        const sp = sparks[i]
        sp.t += dt
        if (sp.t >= sp.life){ sparks.splice(i,1); continue }
        sp.vy += gravity*0.9*dt
        sp.x += sp.vx*dt
        sp.y += sp.vy*dt
        if (sp.y > h-8){
          sp.y = h-8
          sp.vy *= -0.35
          sp.vx *= 0.82
        }
      }
    }

    if (shake>0) shake *= 0.88
  }

  function drawBackground(){
    ctx.clearRect(0,0,w,h)
    const g = ctx.createLinearGradient(0,0,w,h)
    g.addColorStop(0, 'rgba(20,30,45,0.9)')
    g.addColorStop(1, 'rgba(10,14,22,0.9)')
    ctx.fillStyle = g
    ctx.fillRect(0,0,w,h)

    ctx.globalCompositeOperation = 'lighter'
    const r1 = ctx.createRadialGradient(w*0.2, h*0.2, 0, w*0.2, h*0.2, 260)
    r1.addColorStop(0, 'rgba(120,200,255,0.18)')
    r1.addColorStop(1, 'rgba(120,200,255,0.0)')
    ctx.fillStyle = r1
    ctx.fillRect(0,0,w,h)

    const r2 = ctx.createRadialGradient(w*0.85, h*0.85, 0, w*0.85, h*0.85, 320)
    r2.addColorStop(0, 'rgba(80,140,240,0.12)')
    r2.addColorStop(1, 'rgba(80,140,240,0.0)')
    ctx.fillStyle = r2
    ctx.fillRect(0,0,w,h)
    ctx.globalCompositeOperation = 'source-over'

    ctx.fillStyle = "rgba(255,255,255,0.06)"
    ctx.fillRect(0,h-8,w,8)

    ctx.globalAlpha = 0.85
    const vg = ctx.createRadialGradient(w/2, h/2, Math.min(w,h)*0.25, w/2, h/2, Math.max(w,h)*0.75)
    vg.addColorStop(0,'rgba(0,0,0,0)')
    vg.addColorStop(1,'rgba(0,0,0,0.45)')
    ctx.fillStyle = vg
    ctx.fillRect(0,0,w,h)
    ctx.globalAlpha = 1
  }

  function drawPaneRect(rect){
    const lg = ctx.createLinearGradient(rect.x, rect.y, rect.x+rect.w, rect.y+rect.h)
    lg.addColorStop(0, "rgba(170,230,255,0.10)")
    lg.addColorStop(0.5, "rgba(180,240,255,0.16)")
    lg.addColorStop(1, "rgba(150,210,255,0.10)")
    ctx.fillStyle = lg
    roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 12)
    ctx.fill()

    ctx.strokeStyle = "rgba(220,245,255,0.85)"
    ctx.lineWidth = 2
    roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 12)
    ctx.stroke()

    ctx.save()
    ctx.globalCompositeOperation = 'screen'
    ctx.fillStyle = 'rgba(255,255,255,0.16)'
    roundRect(ctx, rect.x+4, rect.y+4, rect.w-8, rect.h-8, 10)
    ctx.fill()
    ctx.restore()

    ctx.save()
    ctx.globalAlpha = 0.10
    ctx.beginPath()
    ctx.moveTo(rect.x+10, rect.y+rect.h*0.35)
    ctx.lineTo(rect.x+rect.w-10, rect.y+rect.h*0.2)
    ctx.moveTo(rect.x+10, rect.y+rect.h*0.7)
    ctx.lineTo(rect.x+rect.w-10, rect.y+rect.h*0.55)
    ctx.strokeStyle = 'white'
    ctx.lineWidth = 3
    ctx.stroke()
    ctx.restore()
  }

  function drawSparks(){
    if (!sparks.length) return
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    for (const sp of sparks){
      const k = 1 - sp.t/sp.life
      ctx.globalAlpha = Math.max(0, k)*0.9
      ctx.beginPath()
      ctx.arc(sp.x, sp.y, sp.r*(0.7+1.2*k), 0, Math.PI*2)
      ctx.fillStyle = 'rgba(180,240,255,0.9)'
      ctx.fill()
      ctx.beginPath()
      ctx.arc(sp.x, sp.y, sp.r*2.0*(k), 0, Math.PI*2)
      ctx.fillStyle = 'rgba(120,200,255,0.35)'
      ctx.fill()
    }
    ctx.restore()
  }

  function drawBall(){
    if (!ball?.active) return
    ctx.save()
    ctx.shadowBlur = 28*ball.glow
    ctx.shadowColor = 'rgba(160,220,255,0.7)'
    ctx.fillStyle = 'rgba(255,255,255,0.95)'
    ctx.beginPath()
    ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI*2)
    ctx.fill()
    ctx.shadowBlur = 0
    ctx.strokeStyle = 'rgba(0,0,0,0.45)'
    ctx.lineWidth = 1
    ctx.stroke()
    ctx.restore()
  }

  function draw(){
    let ox = 0, oy = 0
    if (shake>0){ ox = (Math.random()-0.5)*shake; oy = (Math.random()-0.5)*shake }
    ctx.save()
    ctx.translate(ox, oy)

    drawBackground()
    for (let i=panes.length-1;i>=0;i--) if(!panes[i].broken) drawPaneRect(panes[i].rect)
    for (const s of shards) window.Shatter.drawShard(ctx, s)
    drawSparks()
    drawBall()

    ctx.restore()
  }

  function loop(){
    const now = performance.now()
    const dt = Math.min(0.033, (now - last) / 1000)
    last = now
    update(dt)
    draw()
    requestAnimationFrame(loop)
  }

  function bootGlow(){
    const title = document.querySelector('h1')
    if (title) title.classList.add('neon')
  }

  resize()
  if (Economy.getCoins()==null) Economy.setCoins(0)
  if (Economy.getCrystals()==null) Economy.setCrystals(0)
  panes = buildPanes(getMaxUnlocked())
  updateHud()
  updateBuyBtn()
  bootGlow()
  showModalIfNeeded()
  loop()
})()
