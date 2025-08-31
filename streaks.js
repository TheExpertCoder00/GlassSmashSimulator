(function(){
  // ====== CONFIG ======
  const NEED_FOR_BONUS      = 5;     // perfects needed for a payout
  const BASE_COINS          = 100;   // coins per payout (before multipliers)
  const BASE_CRYSTALS       = 3;     // crystals per payout (before multipliers)
  const RESET_AFTER_PAYOUT  = true;  // reset streak immediately after paying

  // ---- badge layout (right side under power bar) ----
  const BADGE_Y_GAP = 28;            // space under the green/red power bar
  const BADGE_MAX_W = 560;           // pill width cap
  const BADGE_X     = 16;            // distance from right edge

  // ====== STATE / HELPERS ======
  const PERSIST_KEY = 'gss_center_streak';
  const fmt = new Intl.NumberFormat(undefined);
  const n = v => Math.max(0, parseInt(v||'0',10)||0);
  const get = () => n(localStorage.getItem(PERSIST_KEY));
  const set = v => { localStorage.setItem(PERSIST_KEY, String(n(v))); updateBadge(); };

  function addCoins(x){ if (x>0) window.Economy?.addCoins?.(x); }
  function addCrystals(x){
    if (x<=0) return;
    if (window.Economy?.addCrystals) window.Economy.addCrystals(x);
    else if (window.Economy?.addGems) window.Economy.addGems(x);
  }

  function readActivePowerups(){
    try { return JSON.parse(localStorage.getItem('bbx_powerups') || '{}'); } catch { return {}; }
  }

  function coinMultiplier(){ // affects coins
    const active = readActivePowerups(), now = Date.now();
    let mul = 0;
    for (const id in active){
      const pu = active[id];
      if (pu.expiresAt && now >= pu.expiresAt) continue;
      if (pu.type === 'consumable' && pu.uses != null && pu.uses <= 0) continue;
      if (pu.effect?.coin_multiplier) mul += pu.effect.coin_multiplier;
      if (pu.effect?.streak_bonus_multiplier) mul += pu.effect.streak_bonus_multiplier;
    }
    return Math.max(0, mul);
  }
  function gemMultiplier(){ // affects crystals
    const active = readActivePowerups(), now = Date.now();
    let mul = 0;
    for (const id in active){
      const pu = active[id];
      if (pu.expiresAt && now >= pu.expiresAt) continue;
      if (pu.type === 'consumable' && pu.uses != null && pu.uses <= 0) continue;
      if (pu.effect?.gem_multiplier) mul += pu.effect.gem_multiplier;
      if (pu.effect?.streak_bonus_multiplier) mul += pu.effect.streak_bonus_multiplier;
    }
    return Math.max(0, mul);
  }
  function perfectWindowBonus(){ // widens perfect zone (matches power-up rules)
    const active = readActivePowerups(), now = Date.now();
    let bonus = 0;
    for (const id in active){
      const pu = active[id];
      if (pu.expiresAt && now >= pu.expiresAt) continue;
      if (pu.type === 'consumable' && pu.uses != null && pu.uses <= 0) continue;
      if (pu.effect?.power_window_pct) bonus += pu.effect.power_window_pct;
    }
    return bonus;
  }

  // ====== PERFECT DETECTION (fallback if you don't dispatch your own event) ======
  function currentMeter(){
    const cursor = document.getElementById('meterCursor');
    const fill   = document.getElementById('meterFill');
    let pct = 0;
    if (cursor?.style?.left?.endsWith('%')) pct = parseFloat(cursor.style.left);
    else if (fill?.style?.width?.endsWith('%')) pct = parseFloat(fill.style.width);
    return Math.max(0, Math.min(1, (pct||0)/100));
  }
  function isPerfectNow(){
    const raw  = currentMeter();
    const half = 0.02 + perfectWindowBonus(); // ±2% baseline + any power-up widening
    return raw >= 0.5 - half && raw <= 0.5 + half;
  }
  function isClickInsidePane(ev){
    const canvas = document.getElementById('c');
    if (!canvas) return false;
    const rect = canvas.getBoundingClientRect();
    const w = window.innerWidth, h = window.innerHeight;
    const PW = Math.min(720, Math.floor(w*0.7));
    const PH = Math.min(420, Math.floor(h*0.6));
    const header = document.querySelector('header');
    const pane = {
      x: Math.floor((w-PW)/2),
      y: Math.floor((h-PH)/2 + (header ? header.offsetHeight*0.15 : 0)),
      w: PW, h: PH
    };
    const mx = ev.clientX - rect.left;
    const my = ev.clientY - rect.top;
    return mx>=pane.x && mx<=pane.x+pane.w && my>=pane.y && my<=pane.y+pane.h;
  }

  // ====== UI BADGE ======
  function ensureBadge(){
    let b = document.getElementById('streakBadge');
    if (b) return b;
    b = document.createElement('div');
    b.id = 'streakBadge';
    // right-side frosted pill
    b.style.position = 'fixed';
    b.style.right = BADGE_X + 'px';
    b.style.left = 'auto';
    b.style.top = '80px'; // temporary; positionBadge() sets real top
    b.style.maxWidth = `min(92vw, ${BADGE_MAX_W}px)`;
    b.style.padding = '8px 14px';
    b.style.borderRadius = '16px';
    b.style.border = '1px solid rgba(255,255,255,.22)';
    b.style.background = 'linear-gradient(180deg, rgba(12,16,24,.68), rgba(12,16,24,.42))';
    b.style.backdropFilter = 'blur(6px) saturate(115%)';
    b.style.boxShadow = '0 10px 26px rgba(0,0,0,.32), inset 0 1px 0 rgba(255,255,255,.08)';
    b.style.font = '700 13px ui-sans-serif, system-ui';
    b.style.color = 'rgba(255,255,255,.96)';
    b.style.lineHeight = '1.25';
    b.style.display = 'inline-flex';
    b.style.alignItems = 'center';
    b.style.gap = '8px';
    b.style.pointerEvents = 'none'; // never blocks clicks
    b.style.zIndex = '10000';
    document.body.appendChild(b);
    return b;
  }
  function positionBadge(){
    const b = ensureBadge();
    const header = document.querySelector('header');
    let top = (header ? header.getBoundingClientRect().bottom : 0) + 8;
    const meterLeaf = document.getElementById('meterFill') || document.getElementById('meterCursor');
    const meterWrap = meterLeaf?.closest?.('#meter, .meter, .power, .powerbar, .gauge, .bar') || meterLeaf;
    if (meterWrap){
      const r = meterWrap.getBoundingClientRect();
      top = Math.max(top, r.bottom + BADGE_Y_GAP);
    } else {
      top += 72;
    }
    b.style.top = Math.round(top) + 'px';
    b.style.right = BADGE_X + 'px';
  }
  function updateBadge(){
    const b = ensureBadge();
    const s = get();
    const left = (NEED_FOR_BONUS - (s % NEED_FOR_BONUS)) % NEED_FOR_BONUS;
    const coinsNext    = Math.floor(BASE_COINS    * (1 + coinMultiplier()));
    const crystalsNext = Math.max(1, Math.floor(BASE_CRYSTALS * (1 + gemMultiplier())));
    b.innerHTML = `
      <span style="opacity:.95">Streak: <span style="font-weight:800">${s}</span> / ${NEED_FOR_BONUS}</span>
      <span style="opacity:.65">🧿</span>
      <span style="opacity:.95">
        Next bonus:
        <span style="font-weight:800">+${fmt.format(coinsNext)} Coins</span>,
        <span style="font-weight:800">+${fmt.format(crystalsNext)} Crystals</span>
        ${left ? `<span style="opacity:.7;margin-left:6px;">(${left} to go)</span>` : ''}
      </span>
    `;
    positionBadge();
  }

  // ====== HIDE WHEN STORE OPEN ======
  function ensureHideCSS(){
    if (document.getElementById('streaks-hide-css')) return;
    const st = document.createElement('style');
    st.id = 'streaks-hide-css';
    // Prefer :has (Chrome/Edge/Safari support). Fallback to sibling selector.
    st.textContent = `
      body:has(#bbx-store:not(.bbx-store-hidden)) #streakBadge { opacity:0; visibility:hidden; transform:translateY(-6px); }
      #bbx-store:not(.bbx-store-hidden) ~ #streakBadge { opacity:0; visibility:hidden; transform:translateY(-6px); }
    `;
    document.head.appendChild(st);
  }
  function watchStoreVisibility(){
    const ov = document.getElementById('bbx-store');
    if (!ov) return;
    const badge = ensureBadge();
    const sync = () => {
      const open = !ov.classList.contains('bbx-store-hidden');
      badge.style.display = open ? 'none' : '';
    };
    new MutationObserver(sync).observe(ov, { attributes:true, attributeFilter:['class'] });
    sync();
  }

  // ====== TOAST ======
  function toast(msg){
    let wrap = document.getElementById('toasts');
    if(!wrap){ wrap = document.createElement('div'); wrap.id='toasts'; document.body.appendChild(wrap); }
    const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg;
    wrap.appendChild(t);
    setTimeout(()=>{ t.style.opacity='0'; t.style.transform='translateY(-6px)'; }, 2200);
    setTimeout(()=> t.remove(), 2700);
  }

  // ====== PAYOUT ======
  function awardAndMaybeReset(s){
    if (s < NEED_FOR_BONUS) return;
    const coins    = Math.floor(BASE_COINS    * (1 + coinMultiplier()));
    const crystals = Math.max(1, Math.floor(BASE_CRYSTALS * (1 + gemMultiplier())));
    addCoins(coins);
    addCrystals(crystals);
    window.Store?.refreshWallet?.();
    window.dispatchEvent(new Event('bbx:walletPing'));
    toast(`🔥 ${NEED_FOR_BONUS}-streak! +${fmt.format(coins)} Coins, +${fmt.format(crystals)} Crystals`);
    if (RESET_AFTER_PAYOUT) set(0); // next cycle starts fresh
  }

  // ====== PUBLIC API & EVENT HOOKS ======
  function onThrow(ev){
    if (!isClickInsidePane(ev)) return;
    record({ perfect: isPerfectNow() });
  }
  function record({ perfect }){
    if (perfect){
      const s = get() + 1;
      set(s);
      awardAndMaybeReset(s);
    } else {
      if (get() !== 0) toast('Streak reset.');
      set(0);
    }
  }

  function boot(){
    ensureHideCSS();
    updateBadge();

    // Fallback: listen to canvas click
    const canvas = document.getElementById('c');
    if (canvas) canvas.addEventListener('pointerdown', onThrow);

    // If/when the Store overlay exists, auto-hide badge while open
    if (document.getElementById('bbx-store')) watchStoreVisibility();
    else window.addEventListener('bbx:storeReady', watchStoreVisibility, { once:true });

    window.addEventListener('resize', positionBadge);
  }

  // tiny API if you want to drive it from game logic
  window.Streaks = { get, reset:()=>set(0), set:v=>set(v), record };

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(boot, 0);
  } else {
    document.addEventListener('DOMContentLoaded', boot);
  }
})();
