(() => {
  const canvas = document.getElementById('c')
  const ctx = canvas.getContext('2d')
  const hint = document.getElementById('hint')
  const resetBtn = document.getElementById('resetBtn')
  const buyPaneBtn = document.getElementById('buyPaneBtn')
  const coinsEl = document.getElementById('coins')
  const crystalsEl = document.getElementById('crystals')
  const sfx = new window.SFX()
  const meter = document.getElementById('meter')
  const meterFill = document.getElementById('meterFill')
  const meterCursor = document.getElementById('meterCursor')
  const modal = document.getElementById('howtoModal')
  const playBtn = document.getElementById('playBtn')
  const dontShowAgain = document.getElementById('dontShowAgain')

  document.documentElement.style.height = '100%'
  document.body.style.height = '100%'
  document.body.style.overflow = 'hidden'
  const header = document.querySelector('header')
  canvas.style.position = 'fixed'
  canvas.style.inset = '0'
  canvas.style.width = '100vw'
  canvas.style.height = '100vh'
  canvas.style.zIndex = '0'
  if (header) { header.style.position = 'relative'; header.style.zIndex = '6' }
  if (meter) {
    meter.style.position = 'fixed'
    meter.style.left = '16px'
    meter.style.right = '16px'
    meter.style.height = meter.style.height || '18px'
    meter.style.display = 'block'
    meter.style.zIndex = '7'
  }

  function positionMeter(){
    if (!meter) return
    const top = (header ? header.offsetHeight + 8 : 8)
    meter.style.top = top + 'px'
  }
  positionMeter()
  window.addEventListener('resize', positionMeter)

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

  const MAX_DRAW_STACK = 4;
  function paneRectAt(i){
    const layer = Math.min(i, MAX_DRAW_STACK - 1); // cap visual layers
    const step = 10;                                // px diagonal offset per layer
    return {
      x: basePane.x + layer * step,
      y: basePane.y - layer * step,
      w: basePane.w,
      h: basePane.h
    };
  }
  function rebuildPaneRects(){ for(let i=0;i<panes.length;i++) panes[i].rect = paneRectAt(i) }

  function resize(){
    dpr = Math.max(1, Math.min(2, window.devicePixelRatio||1))
    w = canvas.clientWidth = window.innerWidth
    h = canvas.clientHeight = window.innerHeight
    canvas.width = Math.floor(w*dpr)
    canvas.height = Math.floor(h*dpr)
    ctx.setTransform(dpr,0,0,dpr,0,0)
    const PW = Math.min(720, Math.floor(w*0.7))
    const PH = Math.min(420, Math.floor(h*0.6))
    basePane = { x: Math.floor((w-PW)/2), y: Math.floor((h-PH)/2 + (header? header.offsetHeight*0.15 : 0)), w: PW, h: PH }
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
      meter.style.setProperty('--cursor-x', `${meterVal*100}%`)
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

  const gradients = {
    bg_arena_blue: ['#0ea5e9', '#1e3a8a'],
    bg_sunset: ['#ff7e5f', '#feb47b'],
    bg_cyber: ['#0f0c29', '#302b63', '#24243e'],
    bg_mint: ['#d9f99d', '#10b981']
  }
  const ballColors = {
    ball_basic: '#f48c06',
    ball_ice: '#a8dadc',
    ball_void: '#111217',
    ball_lava: '#ff5400',
    ball_neo: '#39ff14'
  }

  function getEquippedInitial(){
    try{
      const raw = localStorage.getItem('bbx_inventory')
      if(!raw) return { ball:'ball_basic', background:'bg_arena_blue' }
      const inv = JSON.parse(raw)
      const b = inv?.equipped?.ball || 'ball_basic'
      const bg = inv?.equipped?.background || 'bg_arena_blue'
      return { ball:b, background:bg }
    }catch(e){
      return { ball:'ball_basic', background:'bg_arena_blue' }
    }
  }
  let equipped = getEquippedInitial()
  window.addEventListener('bbx:inventoryChanged', (e) => {
    const { kind, id } = e.detail || {};
    if (kind === 'ball') equipped.ball = id;
    if (kind === 'background') equipped.background = id;
  });

  let coinMul = 0
  let gemMul = 0
  let powerWinBonus = 0

  function readActivePowerups(){
    try{
      const raw = localStorage.getItem('bbx_powerups')
      if(!raw) return {}
      return JSON.parse(raw)||{}
    }catch(e){
      return {}
    }
  }
  function recalcBoosts(){
    coinMul = 0
    gemMul = 0
    powerWinBonus = 0
    const active = readActivePowerups()
    const now = Date.now()
    for (const id in active){
      const pu = active[id]
      if (pu.expiresAt && now>=pu.expiresAt) continue
      if (pu.type==='consumable' && pu.uses!=null && pu.uses<=0) continue
      if (pu.effect?.coin_multiplier) coinMul += pu.effect.coin_multiplier
      if (pu.effect?.gem_multiplier) gemMul += pu.effect.gem_multiplier
      if (pu.effect?.power_window_pct) powerWinBonus += pu.effect.power_window_pct
    }
    updateCrystalZoneVisual();
  }
  function consumeOneUseAllConsumables(){
    const active = readActivePowerups()
    let changed = false
    for(const id in active){
      const pu = active[id]
      if(pu.type==='consumable' && pu.uses!=null && pu.uses>0){
        pu.uses -= 1
        changed = true
        if(pu.uses<=0){
          delete active[id]
          window.dispatchEvent(new CustomEvent('bbx:powerupExpired', { detail: { id } }))
        }
      }
    }
    if(changed) localStorage.setItem('bbx_powerups', JSON.stringify(active))
  }
  window.addEventListener('bbx:powerupActivated', () => { recalcBoosts(); updateCrystalZoneVisual(); });
  window.addEventListener('bbx:powerupExpired', () => { recalcBoosts(); updateCrystalZoneVisual(); });

  function isPerfect(raw){
    const side = 0.02 + powerWinBonus;
    return raw >= 0.5 - side && raw <= 0.5 + side
  }
  function updateCrystalZoneVisual() {
    const zone = document.getElementById('crystalZone');
    if (!zone) return;
    const half = 0.02 + powerWinBonus;
    zone.style.left = (50 - half * 100) + '%';
    zone.style.width = (half * 2 * 100) + '%';
  }

  function coinCost(){ return Math.floor(200*Math.pow(1.8, maxUnlocked-1)) }
  function crystalCost(){ return Math.pow(2, Math.max(0, maxUnlocked-1)) }

  function getG(){ return (Economy.getGems ? Economy.getGems() : (Economy.getCrystals ? Economy.getCrystals() : 0)) }
  function spendG(n){
    if (Economy.spendGems) return Economy.spendGems(n)
    if (Economy.spendCrystals) return Economy.spendCrystals(n)
    if (Economy.setCrystals && Economy.getCrystals && Economy.getCrystals() >= n){ Economy.setCrystals(Economy.getCrystals()-n); return true }
    return false
  }
  if (!Economy.canSpend) Economy.canSpend = (c,g) => (Economy.getCoins() >= c) && (getG() >= g)
  if (!Economy.spend) Economy.spend = (c,g) => {
    const okC = c ? (Economy.spendCoins ? Economy.spendCoins(c) : false) : true
    if (!okC) return false
    if (!g) return true
    const okG = spendG(g)
    if (!okG && c && Economy.addCoins) Economy.addCoins(c)
    return okG
  }

  function updateHud(){
    coinsEl.textContent = Economy.getCoins()
    crystalsEl.textContent = (Economy.getCrystals ? Economy.getCrystals() : (Economy.getGems ? Economy.getGems() : 0))
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
    window.dispatchEvent(new Event('bbx:walletPing'))
  })

  resetBtn.addEventListener('click', reset)
  window.addEventListener('keydown', (e) => {
    if (e.key === 'r' || e.key === 'R') reset()
  })
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
      e.preventDefault()
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
  document.addEventListener('touchmove', (e)=>{ e.preventDefault() }, { passive:false })

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

    recalcBoosts()
    let gainCoins = coinsPerPane(raw) * broke
    gainCoins = Math.floor(gainCoins * (1 + Math.max(0, coinMul)))
    let gainCrystal = isPerfect(raw) ? 1 : 0
    gainCrystal = Math.floor(gainCrystal * (1 + Math.max(0, gemMul)))
    if (gainCoins) Economy.addCoins(gainCoins)
    if (gainCrystal) {
      if (Economy.addCrystals) Economy.addCrystals(gainCrystal)
      else if (Economy.addGems) Economy.addGems(gainCrystal)
    }
    consumeOneUseAllConsumables()
    updateHud()
    updateBuyBtn()
    window.dispatchEvent(new Event('bbx:walletPing'))

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
    meter.style.setProperty('--cursor-x', `${(meterVal*100).toFixed(1)}%`)

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
    const gsel = gradients[equipped.background]
    if (gsel){
      const g = ctx.createLinearGradient(0,0,w,h)
      const stops = gsel.length-1
      gsel.forEach((c,i)=> g.addColorStop(stops? i/stops : 0, c))
      ctx.fillStyle = g
      ctx.fillRect(0,0,w,h)
    } else {
      const g = ctx.createLinearGradient(0,0,w,h)
      g.addColorStop(0, 'rgba(20,30,45,0.9)')
      g.addColorStop(1, 'rgba(10,14,22,0.9)')
      ctx.fillStyle = g
      ctx.fillRect(0,0,w,h)
    }

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

  function drawPaneBadge(rect, extra){
    const r = 12
    const pad = 10
    const x = rect.x + rect.w - pad - 32
    const y = rect.y + pad
    ctx.save()
    ctx.globalAlpha = 0.9
    ctx.fillStyle = 'rgba(15,24,40,0.75)'
    ctx.strokeStyle = 'rgba(200,240,255,0.6)'
    ctx.lineWidth = 1.5
    roundRect(ctx, x, y, 32, 22, r*0.5)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = 'rgba(200,240,255,0.95)'
    ctx.font = '12px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('+'+extra, x+16, y+11)
    ctx.restore()
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
    const bc = ballColors[equipped.ball] || '#ffffff'
    ctx.save()
    ctx.shadowBlur = 28*ball.glow
    ctx.shadowColor = 'rgba(160,220,255,0.7)'
    ctx.fillStyle = bc
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

    // --- Draw at most 4 unbroken panes as a neat stack
    const visible = panes.filter(p => !p.broken)
    const toShow = visible.slice(0, 4)  // topmost first in your logic
    for (let i = toShow.length - 1; i >= 0; i--) { // back -> front
      const p = toShow[i]
      ctx.save()
      // fade the ghosts
      const alpha = i === 0 ? 1.0 : (0.55 - (i-1)*0.12)
      ctx.globalAlpha = Math.max(0.18, alpha)
      drawPaneRect(p.rect)
      ctx.restore()
    }

    // If more remain, show a compact “+N” badge at the corner
    const extra = Math.max(0, visible.length - 4)
    if (extra > 0) drawPaneBadge(toShow[0]?.rect || basePane, extra)

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
  if (Economy.getCoins==null || Economy.getCoins()==null) { if (Economy.setCoins) Economy.setCoins(0) }
  if ((Economy.getCrystals==null || Economy.getCrystals()==null) && Economy.setCrystals) { Economy.setCrystals(0) }
  panes = buildPanes(getMaxUnlocked())
  updateHud()
  updateBuyBtn()
  bootGlow()
  showModalIfNeeded()
  window.dispatchEvent(new Event('bbx:walletPing'))
  recalcBoosts();
  loop()
})()
