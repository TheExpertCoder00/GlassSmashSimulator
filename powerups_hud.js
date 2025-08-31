(function(){
  const LS = 'bbx_powerups';

  // Map store IDs -> display
  const META = {
    pu_power_window_10: { name:'Perfect Zone +5%', icon:'➿', sub:'10 throws' },
    pu_coin_doubler_5m: { name:'Coin x2',          icon:'💰', sub:'5 min'     },
    pu_gem_doubler_3m:  { name:'Gem x2',           icon:'💎', sub:'3 min'     },
  };

  const $ = (q,r=document)=>r.querySelector(q);

  function read(){ try{ return JSON.parse(localStorage.getItem(LS)||'{}'); }catch{ return {}; } }
  function write(v){ localStorage.setItem(LS, JSON.stringify(v)); }

  const msLeft = t => Math.max(0, (t||0) - Date.now());
  const fmt = ms => {
    const s = Math.ceil(ms/1000);
    if (s>=60){ const m=(s/60)|0, r=s%60; return `${m}:${String(r).padStart(2,'0')}`; }
    return `${s}s`;
  };

  function ensurePanel(){
    let p = document.getElementById('powerups-panel');
    if(!p){ p = document.createElement('div'); p.id='powerups-panel'; p.className='powerups-panel'; document.body.appendChild(p); }
    return p;
  }

  function buildTile(id, pu){
    const meta = META[id] || { name:id, icon:'✨', sub:'' };
    const tile = document.createElement('div');
    tile.className = 'pu-tile';
    tile.dataset.id = id; // <- reliable lookup

    // top content
    const ico  = document.createElement('div'); ico.className='pu-ico'; ico.textContent = meta.icon;
    const box  = document.createElement('div'); box.className='pu-meta';
    const name = document.createElement('div'); name.className='pu-name'; name.textContent = meta.name;
    const sub  = document.createElement('div'); sub.className='pu-sub';
    sub.textContent = meta.sub || (pu.uses!=null ? 'Consumable' : '');
    box.appendChild(name); box.appendChild(sub);
    tile.appendChild(ico); tile.appendChild(box);

    // bottom progress
    const bottom = document.createElement('div'); bottom.className='pu-bottom';
    const bar = document.createElement('div'); bar.className='pu-hbar';
    const fill = document.createElement('div'); fill.className='pu-hfill';
    bar.appendChild(fill);
    const timetxt = document.createElement('div'); timetxt.className='pu-htime';

    if (pu.expiresAt){
      const left = msLeft(pu.expiresAt);
      const total = pu.effect?.durationMs || (left||1);
      fill.style.width = `${Math.max(0, 1 - left/total) * 100}%`;
      timetxt.textContent = fmt(left);
    } else if (pu.uses != null){
      const totalUses = Math.max(1, Number(pu.effect?.uses || 0) || 1);
      const used = Math.max(0, Math.min(totalUses, totalUses - Number(pu.uses||0)));
      fill.style.width = `${(used/totalUses) * 100}%`;
      const badge = document.createElement('div'); badge.className='pu-uses'; badge.textContent = `×${pu.uses}`;
      tile.appendChild(badge);
      timetxt.textContent = 'Ready';
      sub.textContent = `${pu.uses} throws left`;
    } else {
      fill.style.width = '0%';
      timetxt.textContent = '';
    }

    bottom.appendChild(bar);
    bottom.appendChild(timetxt);
    tile.appendChild(bottom);
    return tile;
  }

  function render(){
    const panel = ensurePanel();
    const active = read();

    const ids = Object.keys(active).filter(id => {
      const pu = active[id];
      if (!pu) return false;
      if (pu.expiresAt && msLeft(pu.expiresAt) <= 0) return false;
      if (pu.uses != null && Number(pu.uses) <= 0) return false;
      return true;
    });

    if (!ids.length){ panel.innerHTML = ''; panel.style.display = 'none'; return; }
    panel.style.display = '';

    panel.innerHTML = '';
    ids.forEach(id => panel.appendChild(buildTile(id, active[id])));
  }

  // ----- Live DOM updates (no stale storage reads) -----
  function onUse(ev){
    const { id, uses } = ev.detail || {};
    const panel = ensurePanel();
    const tile = panel.querySelector(`.pu-tile[data-id="${id}"]`);

    if (!tile){ render(); return; }

    // If now zero or below: remove instantly.
    if (uses == null || uses <= 0){
      tile.remove();
      // hide panel if nothing left
      if (!panel.children.length) panel.style.display = 'none';
      return;
    }

    // Update badge, subtitle and progress bar in place.
    const badge = tile.querySelector('.pu-uses'); if (badge) badge.textContent = `×${uses}`;
    const sub = tile.querySelector('.pu-sub'); if (sub) sub.textContent = `${uses} throws left`;

    const fill = tile.querySelector('.pu-hfill');
    const active = read(); const pu = active?.[id];
    // If storage hasn’t written yet, compute using effect uses from META/pu if available
    const totalUses = Math.max(1, Number(pu?.effect?.uses || 0) || Number(META[id]?.sub?.match(/\d+/)?.[0]) || 1);
    const used = Math.max(0, Math.min(totalUses, totalUses - uses));
    if (fill) fill.style.width = `${(used/totalUses) * 100}%`;
  }

  window.addEventListener('bbx:powerupActivated', render);
  window.addEventListener('bbx:powerupExpired', render);
  window.addEventListener('bbx:powerupUse', onUse);

  // Heartbeat: keep timers & counts perfect, and prune stale tiles.
  setInterval(()=>{
    const panel = $('#powerups-panel'); if(!panel) return;
    const active = read();
    let changed = false;

    for (const id of Object.keys(active)){
      const pu = active[id];
      if (pu.expiresAt && msLeft(pu.expiresAt) <= 0) { delete active[id]; changed = true; }
      else if (pu.uses != null && Number(pu.uses) <= 0) { delete active[id]; changed = true; }
    }
    if (changed){ write(active); render(); return; }

    // sync each visible tile
    [...panel.children].forEach(tile=>{
      const id = tile.dataset.id;
      const pu = active[id];

      // if storage no longer has it, drop instantly
      if (!pu){ tile.remove(); return; }

      const fill = tile.querySelector('.pu-hfill');
      const timetxt = tile.querySelector('.pu-htime');
      const badge = tile.querySelector('.pu-uses');
      const sub = tile.querySelector('.pu-sub');

      if (pu.expiresAt && fill && timetxt){
        const left = msLeft(pu.expiresAt);
        const total = pu.effect?.durationMs || (left||1);
        fill.style.width = `${Math.max(0, 1 - left/total) * 100}%`;
        timetxt.textContent = fmt(left);
      } else if (pu.uses != null){
        if (Number(pu.uses) <= 0){ tile.remove(); return; }
        const totalUses = Math.max(1, Number(pu.effect?.uses || 0) || 1);
        const used = Math.max(0, Math.min(totalUses, totalUses - Number(pu.uses)));
        if (fill) fill.style.width = `${(used/totalUses) * 100}%`;
        if (badge) badge.textContent = `×${pu.uses}`;
        if (sub) sub.textContent = `${pu.uses} throws left`;
        if (timetxt) timetxt.textContent = 'Ready';
      }
    });

    // hide panel if empty after pruning
    if (!panel.children.length) panel.style.display = 'none';
  }, 200);

  // boot
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', render); else render();
})();
