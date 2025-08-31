(function(){
  const BBX_EXT = { renderers: {} };
  function registerExternalTab({ id, name, desc, render, insertAt = 0 }) {
    const tab = { id, name, desc, items: [], _external: true };
    Catalog.categories.splice(insertAt, 0, tab);
    BBX_EXT.renderers[id] = render;

    const tabsEl = document.querySelector('#bbx-tabs');
    if (tabsEl) {
      const b = document.createElement('button');
      b.className = 'bbx-tab';
      b.textContent = name;
      b.dataset.cat = id;
      b.addEventListener('click', () => selectCategory(id));
      tabsEl.appendChild(b);
    }
  }
  const PRICE_MUL = 3;
  const scaled = (price) => ({
    coins: Math.ceil((price.coins || 0) * PRICE_MUL),
    gems:  Math.ceil((price.gems  || 0) * PRICE_MUL),
  });

  const LS_KEYS = {
    WALLET: 'bbx_wallet',
    INVENTORY: 'bbx_inventory',
    EQUIPPED: 'bbx_equipped',
    POWERUPS: 'bbx_powerups' // active timers
  };

  const q = (sel, root=document) => root.querySelector(sel);
  const qa = (sel, root=document) => Array.from(root.querySelectorAll(sel));

  const fmt = new Intl.NumberFormat(undefined);

  const Economy = {
    getCoins: () => window.Economy.getCoins(),
    getGems:  () => window.Economy.getCrystals(), // store expects “gems”
    addCoins: (n) => window.Economy.addCoins(n),
    addGems:  (n) => window.Economy.addCrystals(n),
    spendCoins: (n) => {
      if (window.Economy.getCoins() >= n) {
        window.Economy.setCoins(window.Economy.getCoins() - n);
        return true;
      }
      return false;
    },
    spendGems: (n) => {
      if (window.Economy.getCrystals() >= n) {
        window.Economy.setCrystals(window.Economy.getCrystals() - n);
        return true;
      }
      return false;
    }
  };

  // ---------- Inventory Model ----------
  const Inventory = (() => {
    const defaults = {
      owned: {}, // { itemId: true }
      // Equipped selections
      equipped: {
        ball: 'ball_basic',
        background: 'bg_arena_blue'
      }
    };
    function read(){
      const raw = localStorage.getItem(LS_KEYS.INVENTORY);
      if (!raw) { localStorage.setItem(LS_KEYS.INVENTORY, JSON.stringify(defaults)); return structuredClone(defaults); }
      try { return Object.assign(structuredClone(defaults), JSON.parse(raw)); } catch{ return structuredClone(defaults); }
    }
    function write(data){ localStorage.setItem(LS_KEYS.INVENTORY, JSON.stringify(data)); }
    function own(id){ const inv = read(); inv.owned[id] = true; write(inv); return inv; }
    function isOwned(id){ return !!read().owned[id]; }
    function getEquipped(kind){ return read().equipped[kind]; }
    function setEquipped(kind, id){
      const inv = read(); inv.equipped[kind] = id; write(inv);
      window.dispatchEvent(new CustomEvent('bbx:inventoryChanged', { detail: { kind, id, equipped: structuredClone(inv.equipped) } }));
      return inv;
    }
    return { read, write, own, isOwned, getEquipped, setEquipped };
  })();

  // ---------- Catalog ----------
  const Catalog = (() => {
    // Price helper
    const C = (coins=0, gems=0)=> ({ coins, gems });

    const categories = [
      {
        id: 'powerups',
        name: 'Power-Ups',
        desc: 'Temporary boosts to help you shatter more glass.',
        items: [
          {
            id: 'pu_power_window_10',
            name: 'Calm Focus: Perfect Percentage +5% (10 throws)',
            price: C(500,0),
            preview: { kind: 'icon', svg: iconGauge() },
            type: 'consumable',
            effect: { power_window_pct: 0.05, uses: 10 },
          },
          {
            id: 'pu_coin_doubler_5m',
            name: 'Endorphin Rush: Coin x2 (5 min)',
            price: C(800,0),
            preview: { kind: 'icon', svg: iconCoins() },
            type: 'timer',
            effect: { coin_multiplier: 1.0, durationMs: 5*60*1000 },
          },
          {
            id: 'pu_gem_doubler_3m',
            name: 'Locked In: Gem x2 (3 min)',
            price: C(0,5),
            preview: { kind: 'icon', svg: iconGem() },
            type: 'timer',
            effect: { gem_multiplier: 1.0, durationMs: 3*60*1000 },
          },
        ]
      },
      {
        id: 'balls',
        name: 'Ball Skins',
        desc: 'Pick a ball that matches your vibe.',
        items: [
          { id:'ball_basic', name:'Classic Orange', price: C(0,0), preview:{kind:'ball', color:'#f48c06'} },
          { id:'ball_ice', name:'Ice Glass', price: C(600,0), preview:{kind:'ball', color:'#a8dadc'}, glow:true },
          { id:'ball_void', name:'Void', price: C(900,0), preview:{kind:'ball', color:'#0b0b0f'}, glow:true },
          { id:'ball_lava', name:'Lava Core', price: C(0,8), preview:{kind:'ball', color:'#ff5400'}, flame:true },
          { id:'ball_neo', name:'Neon Pulse', price: C(1200,0), preview:{kind:'ball', color:'#39ff14'}, glow:true },
          { id:'ball_galaxy', name:'Galaxy Swirl', price: C(1500,3), preview:{kind:'ball', color:'#7b2ff7'}, glow:true },
          { id:'ball_gold', name:'Golden Glory', price: C(2500,0), preview:{kind:'ball', color:'#ffd700'}, glow:true },
          { id:'ball_plasma', name:'Plasma Surge', price: C(1800,4), preview:{kind:'ball', color:'#00f5ff'}, glow:true },
          { id:'ball_shadow', name:'Shadow Orb', price: C(1400,2), preview:{kind:'ball', color:'#222'}, glow:true },
          { id:'ball_ruby', name:'Ruby Core', price: C(2000,5), preview:{kind:'ball', color:'#ff1744'}, glow:true },
          { id:'ball_emerald', name:'Emerald Gleam', price: C(1600,3), preview:{kind:'ball', color:'#00e676'}, glow:true },
          { id:'ball_solar', name:'Solar Flare', price: C(2200,6), preview:{kind:'ball', color:'#ff9100'}, glow:true }
        ]
      },
      {
        id: 'backgrounds',
        name: 'Backgrounds',
        desc: 'Change the mood of the arena.',
        items: [
          { id:'bg_arena_blue', name:'Arena Blue', price: C(0,0), preview:{kind:'bg', gradient:['#0ea5e9','#1e3a8a']} },
          { id:'bg_sunset', name:'Sunset Drift', price: C(1000,0), preview:{kind:'bg', gradient:['#ff7e5f','#feb47b']} },
          { id:'bg_cyber', name:'Cyber Grid', price: C(0,20), preview:{kind:'bg', gradient:['#0f0c29','#302b63','#24243e']} },
          { id:'bg_mint', name:'Mint Frost', price: C(1000,0), preview:{kind:'bg', gradient:['#d9f99d','#10b981']} },
          { id:'bg_starry', name:'Starry Night', price: C(0,12), preview:{kind:'bg', gradient:['#0f2027','#203a43','#2c5364']} },
          { id:'bg_volcano', name:'Volcano Ash', price: C(1600,3), preview:{kind:'bg', gradient:['#2b0f0f','#ff4500']} },
          { id:'bg_ocean', name:'Ocean Depths', price: C(12000,0), preview:{kind:'bg', gradient:['#1a2980','#26d0ce']} },
          { id:'bg_forest', name:'Enchanted Forest', price: C(10000,2), preview:{kind:'bg', gradient:['#134e5e','#71b280']} },
          { id:'bg_nebula', name:'Nebula Glow', price: C(0,15), preview:{kind:'bg', gradient:['#42275a','#734b6d']} },
          { id:'bg_aurora', name:'Aurora Lights', price: C(18000,4), preview:{kind:'bg', gradient:['#00c6ff','#0072ff']} },
          { id:'bg_desert', name:'Desert Dusk', price: C(14000,0), preview:{kind:'bg', gradient:['#f7971e','#ffd200']} },
          { id:'bg_celestial', name:'Celestial Realm', price: C(1000000,50), preview:{kind:'bg', gradient:['#000428','#004e92','#00c6ff','#7b2ff7']} }
        ]
      }
    ];

    // Pre-own freebies
    const freebies = ['ball_basic','bg_arena_blue'];
    freebies.forEach(id => Inventory.own(id));

    function findItem(id){
      for (const cat of categories){
        const found = cat.items.find(i=> i.id===id);
        if (found) return { cat, item: found };
      }
      return null;
    }
    return { categories, findItem };
  })();

  // ---------- UI Injection ----------
  const styles = `
  :root {
    --bbx-bg: rgba(12, 14, 24, 0.92);
    --bbx-panel: rgba(20, 24, 40, 0.95);
    --bbx-accent: #60a5fa;
    --bbx-muted: #94a3b8;
    --bbx-card: rgba(255,255,255,0.06);
    --bbx-card-hover: rgba(255,255,255,0.12);
    --bbx-good: #34d399;
    --bbx-warn: #f59e0b;
    --bbx-danger: #ef4444;
  }
  .bbx-store-hidden { display:none !important; }
  .bbx-store-overlay {
    position: fixed; inset: 0;
    background: radial-gradient(1200px 600px at 70% -20%, rgba(96,165,250,0.08), transparent), var(--bbx-bg);
    backdrop-filter: blur(4px);
    z-index: 9999;
    display: grid; place-items: center;
    padding: 24px;
    font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Noto Sans, Ubuntu, Cantarell, Helvetica, Arial, "Apple Color Emoji","Segoe UI Emoji";
    color: #e5e7eb;
  }
  .bbx-panel {
    width: min(1100px, 95vw);
    max-height: 90vh;
    background: var(--bbx-panel);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 18px;
    box-shadow: 0 20px 60px rgba(0,0,0,0.5);
    display: grid;
    grid-template-rows: auto 1fr;
    overflow: hidden;
  }
  .bbx-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 14px 18px; gap: 16px;
    border-bottom: 1px solid rgba(255,255,255,0.07);
    background: linear-gradient(180deg, rgba(255,255,255,0.04), transparent);
  }
  .bbx-title { font-size: 18px; font-weight: 700; letter-spacing: 0.2px; }
  .bbx-wallet { display:flex; gap: 12px; align-items:center; }
  .bbx-pill { display:flex; gap:8px; align-items:center; padding:6px 10px; border-radius: 999px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.08); }
  .bbx-pill svg { width: 16px; height: 16px; }
  .bbx-close { background: transparent; color: #e5e7eb; border: 1px solid rgba(255,255,255,0.16); border-radius: 10px; padding: 6px 10px; cursor:pointer; }
  .bbx-body { display:grid; grid-template-columns: 240px 1fr; min-height: 520px; }
  .bbx-nav { border-right: 1px solid rgba(255,255,255,0.07); padding: 12px; display:flex; flex-direction: column; gap: 8px; }
  .bbx-tab { background: transparent; text-align:left; width:100%; padding:10px 12px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.08); color:#cbd5e1; cursor:pointer; }
  .bbx-tab.active { background: rgba(96,165,250,0.1); border-color: var(--bbx-accent); color: #e5e7eb; }
  .bbx-content { padding: 16px; overflow:auto; }
  .bbx-catdesc { color: var(--bbx-muted); margin: 6px 0 16px; font-size: 13px; }
  .bbx-grid { display:grid; grid-template-columns: repeat(auto-fill, minmax(220px,1fr)); gap: 14px; }
  .bbx-card { background: var(--bbx-card); border:1px solid rgba(255,255,255,0.08); border-radius: 14px; overflow:hidden; display:flex; flex-direction:column; }
  .bbx-prev { aspect-ratio: 16/10; display:grid; place-items:center; background:linear-gradient(180deg, rgba(255,255,255,0.04), transparent); }
  .bbx-info { padding: 12px; display:flex; flex-direction:column; gap:8px; }
  .bbx-name { font-weight: 700; }
  .bbx-price { display:flex; gap:10px; align-items:center; flex-wrap: wrap; }
  .bbx-price .bbx-pill { background: rgba(255,255,255,0.04); }
  .bbx-actions { display:flex; gap:8px; }
  .bbx-btn { flex:1; padding:9px 12px; border-radius:10px; border: 1px solid rgba(255,255,255,0.16); background: rgba(255,255,255,0.06); color:#e5e7eb; cursor:pointer; }
  .bbx-btn.primary { background: linear-gradient(180deg, #3b82f6, #2563eb); border-color: #1d4ed8; }
  .bbx-btn.success { background: linear-gradient(180deg, #10b981, #059669); border-color: #047857; }
  .bbx-btn:disabled { opacity:0.6; cursor:not-allowed; }
  .bbx-owned { color: var(--bbx-good); font-weight:700; font-size:12px; }
  .bbx-fab {
    position: fixed; right: 16px; bottom: 16px; z-index: 9999;
    padding: 12px 14px; border-radius: 14px; border: 1px solid rgba(255,255,255,0.2);
    background: linear-gradient(180deg, rgba(59,130,246,0.25), rgba(37,99,235,0.25));
    backdrop-filter: blur(6px);
    color: #e5e7eb; display:flex; align-items:center; gap:8px; cursor:pointer;
    box-shadow: 0 8px 30px rgba(0,0,0,0.4);
  }
  .bbx-fab:hover { transform: translateY(-1px); }
  .bbx-mini { font-size: 11px; color: var(--bbx-muted); }
  canvas.bbx-ball { width:100%; height:100%; }
  .bbx-bgprev { width:100%; height:100%; border-radius: 12px; }
  `;

  function ensureStyles(){
    if (!document.getElementById('bbx-store-styles')){
      const s = document.createElement('style');
      s.id = 'bbx-store-styles';
      s.textContent = styles;
      document.head.appendChild(s);
    }
  }

  // ---------- SVG Icons ----------
  function iconCoins(){ return `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 3c4.97 0 9 1.79 9 4s-4.03 4-9 4-9-1.79-9-4 4.03-4 9-4Zm9 7.5V17c0 2.21-4.03 4-9 4s-9-1.79-9-4V10.5c1.91 1.79 5.83 2.5 9 2.5s7.09-.71 9-2.5Z"/></svg>`; }
  function iconGem(){ return `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="m12 2 4.95 2.475L22 10l-10 12L2 10l5.05-5.525L12 2Zm0 4.236L8.9 4.618 6.2 7.6l5.8 9.86 5.8-9.86-2.7-2.982L12 6.236Z"/></svg>`; }
  function iconStore(){ return `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M4 4h16l-1 6a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4L4 4Zm2 14a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-4.5a6.5 6.5 0 0 1-2 .5H8a6.5 6.5 0 0 1-2-.5V18Z"/></svg>`; }
  function iconGauge(){ return `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 3a9 9 0 1 0 9 9h-2a7 7 0 1 1-7-7V3Zm0 6a1 1 0 0 0-.894.553l-3 6a1 1 0 1 0 1.788.894l3-6A1 1 0 0 0 12 9Z"/></svg>`; }
  function iconEquip(){ return `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.285 2.859 8.57 14.572l-4.856-4.857L1.999 11.43l6.57 6.57L22.713 3.855l-2.428-.996Z"/></svg>`; }

  // ---------- Renderers ----------
  function addAlpha(hex, a = 0.33) {
    const m3 = /^#([0-9a-f]{3})$/i.exec(hex);
    const m6 = /^#([0-9a-f]{6})$/i.exec(hex);
    let r,g,b;
    if (m3) {
      r = parseInt(m3[1][0] + m3[1][0], 16);
      g = parseInt(m3[1][1] + m3[1][1], 16);
      b = parseInt(m3[1][2] + m3[1][2], 16);
    } else if (m6) {
      r = parseInt(m6[1].slice(0,2), 16);
      g = parseInt(m6[1].slice(2,4), 16);
      b = parseInt(m6[1].slice(4,6), 16);
    } else {
      // fallback: if it's already a valid CSS color, just return it
      return hex;
    }
    return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, a))})`;
  }

  function ballPreview(el, color, opts={}){
    const c = document.createElement('canvas'); c.className = 'bbx-ball'; el.appendChild(c);
    const ctx = c.getContext('2d');
    const DPR = Math.min(2, window.devicePixelRatio||1);
    function draw(){
      const w = el.clientWidth||300, h = el.clientHeight||180;
      c.width = w*DPR; c.height = h*DPR; c.style.width = w+'px'; c.style.height = h+'px';
      ctx.scale(DPR,DPR);
      ctx.clearRect(0,0,w,h);
      // ball
      const r = Math.min(w,h)*0.35, cx = w*0.5, cy = h*0.55;
      // glow
      if (opts.glow){
        ctx.save();
        const grad = ctx.createRadialGradient(cx,cy,r*0.2,cx,cy,r*1.6);
        grad.addColorStop(0, addAlpha(color, 0.33)); // ← safe alpha color
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.arc(cx,cy,r*1.3,0,Math.PI*2); ctx.fill();
        ctx.restore();
      }
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.fill();
      // seams
      ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(cx,cy,r*0.95, -1.0, 2.2); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx,cy,r*0.95, 2.1, 5.3); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx-r, cy); ctx.bezierCurveTo(cx-r*0.4, cy-r*0.8, cx+r*0.4, cy+r*0.8, cx+r, cy); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx, cy-r); ctx.bezierCurveTo(cx+r*0.8, cy-r*0.4, cx-r*0.8, cy+r*0.4, cx, cy+r); ctx.stroke();
      // highlight
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.beginPath(); ctx.ellipse(cx-r*0.35, cy-r*0.35, r*0.25, r*0.15, -0.6, 0, Math.PI*2); ctx.fill();
    }
    const ro = new ResizeObserver(draw); ro.observe(el); draw();
  }

  function bgPreview(el, gradient){
    const d = document.createElement('div'); d.className = 'bbx-bgprev';
    const g = Array.isArray(gradient) ? gradient : [gradient, '#000'];
    d.style.background = `linear-gradient(135deg, ${g.join(',')})`;
    el.appendChild(d);
  }

  function iconPreview(el, svg){
    const wrap = document.createElement('div'); wrap.style.width='84px'; wrap.style.height='84px'; wrap.style.display='grid'; wrap.style.placeItems='center';
    wrap.innerHTML = svg; el.appendChild(wrap);
    const svgel = wrap.querySelector('svg'); if (svgel){ svgel.style.width='64px'; svgel.style.height='64px'; svgel.style.opacity='0.9'; }
  }

  function pricePills(price){
    const p2 = scaled(price);
    const pills = document.createElement('div'); pills.className='bbx-price';
    if (p2.coins>0){
      const p = pill(iconCoins(), fmt.format(p2.coins));
      pills.appendChild(p);
    }
    if (p2.gems>0){
      const p = pill(iconGem(), fmt.format(p2.gems));
      pills.appendChild(p);
    }
    if (p2.coins===0 && p2.gems===0){
      const p = pill(iconStore(), 'Free'); pills.appendChild(p);
    }
    return pills;
  }
  function pill(svg, text){
    const el = document.createElement('div'); el.className='bbx-pill';
    const s = document.createElement('span'); s.innerHTML = svg; el.appendChild(s);
    const t = document.createElement('span'); t.textContent = text; el.appendChild(t);
    return el;
  }

  function canAfford(price){
    const p2 = scaled(price);
    return Economy.getCoins() >= p2.coins && Economy.getGems() >= p2.gems;
  }
  function charge(price){
    const p2 = scaled(price);
    const okCoins = (p2.coins||0)===0 || Economy.spendCoins(p2.coins);
    if (!okCoins) return false;
    const okGems = (p2.gems||0)===0 || Economy.spendGems(p2.gems);
    if (!okGems){ // refund coins if gems fail
      if (p2.coins) Economy.addCoins(p2.coins);
      return false;
    }
    return true;
  }

  function toast(msg){
    let wrap = document.getElementById('toasts');
    if(!wrap){ wrap = document.createElement('div'); wrap.id='toasts'; document.body.appendChild(wrap); }
    const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg;
    wrap.appendChild(t);
    setTimeout(()=>{ t.style.opacity='0'; t.style.transform='translateY(-6px)'; }, 2200);
    setTimeout(()=> t.remove(), 2700);
  }

  // ---------- Power-up timers ----------
  const PowerTimers = (()=>{
    function read(){
      const raw = localStorage.getItem(LS_KEYS.POWERUPS);
      if (!raw) return {};
      try { return JSON.parse(raw); } catch{ return {}; }
    }
    function write(obj){ localStorage.setItem(LS_KEYS.POWERUPS, JSON.stringify(obj)); }
    function activate(item){
      const active = read();
      const now = Date.now();
      let expiresAt = null;
      if (item.type==='timer' && item.effect.durationMs){
        expiresAt = now + item.effect.durationMs;
      } else if (item.type==='consumable' && item.effect.uses){
        // track uses remaining; no expiresAt
      }
      active[item.id] = {
        id: item.id,
        effect: item.effect,
        type: item.type,
        expiresAt,
        uses: item.effect.uses || null
      };
      write(active);
      window.dispatchEvent(new CustomEvent('bbx:powerupActivated', { detail: active[item.id] }));
    }
    function consumeUse(id){
      const active = read(); const pu = active[id]; if (!pu || pu.uses==null) return;
      pu.uses = Math.max(0, pu.uses-1);
      if (pu.uses===0){ delete active[id]; window.dispatchEvent(new CustomEvent('bbx:powerupExpired', { detail: { id } })); }
      write(active);
    }
    function tick(){
      const active = read();
      const now = Date.now();
      let changed = false;
      for (const [id, pu] of Object.entries(active)){
        if (pu.expiresAt && now >= pu.expiresAt){
          delete active[id];
          window.dispatchEvent(new CustomEvent('bbx:powerupExpired', { detail: { id } }));
          changed = true;
        }
      }
      if (changed) write(active);
    }
    setInterval(tick, 1000);
    return { read, activate, consumeUse };
  })();

  // ---------- UI Build ----------
  function buildOverlay(){
    ensureStyles();
    const overlay = document.createElement('div'); overlay.className = 'bbx-store-overlay bbx-store-hidden'; overlay.id='bbx-store';
    overlay.innerHTML = `
      <div class="bbx-panel">
        <div class="bbx-header">
          <div style="display:flex; align-items:center; gap:10px;">
            <div class="bbx-title">Glass Smash — Store</div>
            <div class="bbx-mini">Power-ups, skins & backgrounds</div>
          </div>
          <div class="bbx-wallet">
            <div class="bbx-pill"><span>${iconCoins()}</span><span id="bbx-wallet-coins">0</span></div>
            <div class="bbx-pill"><span>${iconGem()}</span><span id="bbx-wallet-gems">0</span></div>
            <button class="bbx-close" id="bbx-close">Close</button>
          </div>
        </div>
        <div class="bbx-body">
          <nav class="bbx-nav" id="bbx-tabs"></nav>
          <main class="bbx-content">
            <div id="bbx-catdesc" class="bbx-catdesc"></div>
            <div class="bbx-grid" id="bbx-grid"></div>
          </main>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    // Tabs
    const tabsEl = q('#bbx-tabs', overlay);
    Catalog.categories.forEach((cat, i)=>{
      const b = document.createElement('button'); b.className='bbx-tab'+(i===0?' active':'');
      b.textContent = cat.name; b.dataset.cat = cat.id;
      b.addEventListener('click', ()=> selectCategory(cat.id));
      tabsEl.appendChild(b);
    });

    q('#bbx-close', overlay).addEventListener('click', toggle);

    const fab = document.createElement('button'); fab.className='bbx-fab'; fab.id='bbx-store-fab'; fab.innerHTML = `<div class="fab-emoji">🏠</div><div class="fab-label">Store</div>`;
    fab.addEventListener('click', open);
    document.body.appendChild(fab);

    // Default view
    selectCategory(Catalog.categories[0].id);
    refreshWallet();

    return overlay;
  }

  function selectCategory(catId){
    const { categories } = Catalog;
    const cat = categories.find(c=>c.id===catId) || categories[0];
    qa('.bbx-tab').forEach(t=> t.classList.toggle('active', t.dataset.cat===cat.id));
    const grid = q('#bbx-grid');
    const desc = q('#bbx-catdesc');

    // If an external renderer was registered, use it
    if (BBX_EXT.renderers[cat.id]) {
      desc.textContent = cat.desc;
      BBX_EXT.renderers[cat.id](grid);
      return;
    }

    // Default category rendering
    desc.textContent = cat.desc;
    grid.innerHTML = '';
    cat.items.forEach(item => grid.appendChild(itemCard(cat, item)));
  }

  function itemCard(cat, item){
    const owned = Inventory.isOwned(item.id);
    const card = document.createElement('div'); card.className='bbx-card';
    const prev = document.createElement('div'); prev.className='bbx-prev';
    if (item.preview.kind==='ball'){ ballPreview(prev, item.preview.color, { glow: !!item.glow }); }
    else if (item.preview.kind==='bg'){ bgPreview(prev, item.preview.gradient); }
    else if (item.preview.kind==='icon'){ iconPreview(prev, item.preview.svg); }
    card.appendChild(prev);

    const info = document.createElement('div'); info.className='bbx-info';
    const name = document.createElement('div'); name.className='bbx-name'; name.textContent = item.name;
    info.appendChild(name);

    const price = pricePills(item.price); info.appendChild(price);

    const actions = document.createElement('div'); actions.className='bbx-actions';

    if (cat.id==='balls' || cat.id==='backgrounds'){
      const kind = (cat.id==='balls') ? 'ball' : 'background';
      const equippedId = Inventory.getEquipped(kind);
      const isEquipped = equippedId === item.id;
      const ownLabel = document.createElement('div'); ownLabel.className='bbx-owned bbx-mini';

      if (owned){
        ownLabel.textContent = isEquipped ? 'Equipped' : 'Owned';
        info.appendChild(ownLabel);
        const equipBtn = button(isEquipped ? 'Equipped' : 'Equip', isEquipped ? 'success' : 'primary');
        equipBtn.disabled = isEquipped;
        equipBtn.addEventListener('click', ()=> {
          Inventory.setEquipped(kind, item.id);
          selectCategory(cat.id); // rerender
          toast(`Equipped: ${item.name}`);
        });
        actions.appendChild(equipBtn);
      } else {
        const buyBtn = button('Buy', 'primary');
        buyBtn.disabled = !canAfford(item.price);
        buyBtn.addEventListener('click', ()=> {
          if (!canAfford(item.price)) return;
          if (!charge(item.price)) return alert('Not enough currency.');
          Inventory.own(item.id);
          // Auto-equip on first buy for convenience
          Inventory.setEquipped(kind, item.id);
          refreshWallet();
          selectCategory(cat.id);
        });
        actions.appendChild(buyBtn);
      }
    } else if (cat.id==='powerups'){
      const buyBtn = button('Activate', 'primary');
      buyBtn.disabled = !canAfford(item.price);
      buyBtn.addEventListener('click', ()=> {
        if (!canAfford(item.price)) return;
        if (!charge(item.price)) return alert('Not enough currency.');
        PowerTimers.activate(item);
        refreshWallet();
        toast(`Activated: ${item.name}`);
        window.dispatchEvent(new Event('bbx:walletPing'));
        // brief success state
        buyBtn.textContent = 'Activated!';
        buyBtn.classList.remove('primary'); buyBtn.classList.add('success');
        buyBtn.disabled = true; setTimeout(()=>{ selectCategory(cat.id); }, 800);
        toast(`Purchased: ${item.name}`);
      });
      actions.appendChild(buyBtn);
      const hint = document.createElement('div'); hint.className='bbx-mini';
      hint.textContent = item.type==='timer' ? 'Timed boost will start now.' : 'Uses are consumed on throws.';
      info.appendChild(hint);
    }

    info.appendChild(actions);
    card.appendChild(info);
    return card;
  }

  function button(text, kind){
    const b = document.createElement('button'); b.className = 'bbx-btn' + (kind? (' '+kind): '');
    b.innerText = text; return b;
  }

  function refreshWallet(){
    const c = Economy.getCoins(), g = Economy.getGems();
    const cEl = q('#bbx-wallet-coins'); if (cEl) cEl.textContent = fmt.format(c);
    const gEl = q('#bbx-wallet-gems');  if (gEl) gEl.textContent = fmt.format(g);

    updateGlobalHud();
  }

  function updateGlobalHud(){
    const c = Economy.getCoins();
    const g = Economy.getGems();
    const hc = document.getElementById('coins');
    const hg = document.getElementById('crystals');
    if (hc) hc.textContent = fmt.format(c);
    if (hg) hg.textContent = fmt.format(g);
  }

  window.addEventListener('bbx:walletPing', refreshWallet);
  setInterval(refreshWallet, 1000);
  // ---------- Public API ----------
  function open(){ q('#bbx-store')?.classList.remove('bbx-store-hidden'); refreshWallet(); }
  function close(){ q('#bbx-store')?.classList.add('bbx-store-hidden'); }
  function toggle(){ const el=q('#bbx-store'); if (!el) return; el.classList.toggle('bbx-store-hidden'); if (!el.classList.contains('bbx-store-hidden')) refreshWallet(); }

  // Boot
  document.addEventListener('DOMContentLoaded', ()=> {
    buildOverlay();
    window.dispatchEvent(new Event('bbx:storeReady'));

    });
  window.Store = { open, close, toggle, Catalog, Inventory };

  // expose hook + helpers for external tabs:
  window.Store.registerTab   = registerExternalTab;
  window.Store.refreshWallet = refreshWallet;
  window.Store.selectCategory = selectCategory;

  // tell dependents Store is ready
  window.dispatchEvent(new Event('bbx:storeReady'));
})();
