// Powerups HUD v4 — bottom progress bar + time text, no close button.
(function(){
  const LS = 'bbx_powerups';

  // Map your existing store IDs -> labels/icons
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

  function render(){
    const panel = ensurePanel();
    const active = read();

    // Hide consumables with 0 uses immediately
    const ids = Object.keys(active).filter(id => !(active[id]?.uses === 0));

    if (!ids.length){ panel.innerHTML = ''; panel.style.display = 'none'; return; }
    panel.style.display = '';

    panel.innerHTML = '';
    ids.forEach(id=>{
      const pu = active[id];
      const meta = META[id] || { name:id, icon:'✨', sub:'' };

      const tile = document.createElement('div'); tile.className='pu-tile';

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
        // consumable: show remaining uses, full bar
        fill.style.width = '100%';
        const badge = document.createElement('div'); badge.className='pu-uses'; badge.textContent = `×${pu.uses}`;
        tile.appendChild(badge);
        timetxt.textContent = 'Ready';
      } else {
        fill.style.width = '0%';
        timetxt.textContent = '';
      }

      bottom.appendChild(bar);
      bottom.appendChild(timetxt);
      tile.appendChild(bottom);

      panel.appendChild(tile);
    });
  }

  // live updates from your game/store
  window.addEventListener('bbx:powerupActivated', render);
  window.addEventListener('bbx:powerupExpired', render);

  // heartbeat so time/width and disappearance track storage perfectly
  setInterval(()=>{
    const panel = $('#powerups-panel'); if(!panel) return;
    const active = read();
    let anyChange = false;

    // remove stale, update timers
    for (const id of Object.keys(active)){
      const pu = active[id];
      if (pu.expiresAt && msLeft(pu.expiresAt) <= 0){
        delete active[id]; anyChange = true; continue;
      }
      if (pu.uses === 0){ delete active[id]; anyChange = true; continue; }
    }
    if (anyChange){ write(active); document.dispatchEvent(new CustomEvent('bbx:powerupExpired')); }

    // update widths/times in-place
    [...panel.children].forEach(tile=>{
      const name = tile.querySelector('.pu-name')?.textContent;
      const id = Object.keys(META).find(k => META[k].name === name) || name;
      const pu = active[id]; if (!pu) return;

      const fill = tile.querySelector('.pu-hfill');
      const timetxt = tile.querySelector('.pu-htime');

      if (pu.expiresAt && fill && timetxt){
        const left = msLeft(pu.expiresAt);
        const total = pu.effect?.durationMs || (left||1);
        fill.style.width = `${Math.max(0, 1 - left/total) * 100}%`;
        timetxt.textContent = fmt(left);
      }
    });
  }, 250);

  // boot
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', render); else render();
})();
