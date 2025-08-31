// exchange.js — Coins ↔ Crystals Exchange (registers a Store tab)
(function () {
  const BUY = 2500;  // coins → 1 crystal
  const SELL = 2000; // 1 crystal → coins

  const fmt = new Intl.NumberFormat();

  function renderExchange(container){
    container.innerHTML = '';

    const wrap = document.createElement('div');
    wrap.style.display = 'grid';
    wrap.style.gap = '12px';
    wrap.style.maxWidth = '560px';

    const tabs = document.createElement('div');
    tabs.style.display = 'flex';
    tabs.style.gap = '8px';

    const tBuy  = document.createElement('button'); tBuy.className = 'bbx-tab active'; tBuy.textContent = 'Coins → Crystals';
    const tSell = document.createElement('button'); tSell.className = 'bbx-tab';        tSell.textContent = 'Crystals → Coins';
    tabs.append(tBuy, tSell);

    const row = document.createElement('div');
    row.style.display = 'grid';
    row.style.gridTemplateColumns = '1fr auto 1fr';
    row.style.alignItems = 'center';
    row.style.gap = '12px';

    const box = () => {
      const d = document.createElement('div');
      d.style.border = '1px solid rgba(255,255,255,0.12)';
      d.style.borderRadius = '12px';
      d.style.padding = '12px';
      d.style.background = 'rgba(255,255,255,0.04)';
      d.style.display = 'grid';
      d.style.gap = '6px';
      return d;
    };

    const left  = box();
    const lLab  = document.createElement('div'); lLab.style.opacity='.85'; lLab.style.fontSize='12px';
    const input = document.createElement('input'); 
    input.type='number'; input.min='0'; input.step='1'; input.value='0';
    input.style.width='100%'; input.style.padding='10px 12px';
    input.style.border='1px solid rgba(255,255,255,0.18)';
    input.style.borderRadius='10px';
    input.style.background='rgba(0,0,0,0.25)';
    input.style.color='inherit';
    left.append(lLab, input);

    const mid = document.createElement('div'); mid.textContent = '→';
    mid.style.fontWeight='800'; mid.style.opacity='.85'; mid.style.textAlign='center';

    const right = box();
    const rLab  = document.createElement('div'); rLab.style.opacity='.85'; rLab.style.fontSize='12px';
    const out   = document.createElement('div'); out.style.fontSize='20px'; out.style.fontWeight='800'; out.textContent = '0';
    right.append(rLab, out);

    row.append(left, mid, right);

    const chips = document.createElement('div');
    chips.style.display='grid'; chips.style.gridTemplateColumns='repeat(4,minmax(0,1fr))'; chips.style.gap='8px';
    ;[1,5,10,25,50,100,250,1000].forEach(v=>{
      const b = document.createElement('button'); b.className='bbx-btn'; b.textContent = '+'+v;
      b.addEventListener('click', ()=>{ input.value = String(Math.max(0, (parseInt(input.value||'0',10)||0)+v)); update(); });
      chips.appendChild(b);
    });

    const rate = document.createElement('div'); rate.style.opacity='.85'; rate.style.fontSize='12px';
    const help = document.createElement('div'); help.style.opacity='.85'; help.style.fontSize='12px';

    const actions = document.createElement('div'); 
    actions.style.display='flex'; actions.style.gap='10px'; actions.style.alignItems='center'; actions.style.justifyContent='space-between';
    const confirm = document.createElement('button'); confirm.className='bbx-btn primary'; confirm.textContent='Confirm Exchange';
    actions.append(help, confirm);

    wrap.append(tabs, row, chips, rate, actions);
    container.appendChild(wrap);

    function setMode(buyMode){
      tBuy.classList.toggle('active', buyMode);
      tSell.classList.toggle('active', !buyMode);
      lLab.textContent = buyMode ? 'You pay (Coins)' : 'You pay (Crystals)';
      rLab.textContent = buyMode ? 'You receive (Crystals)' : 'You receive (Coins)';
      rate.textContent = buyMode
        ? `Rate: 1 Crystal = ${fmt.format(BUY)} Coins`
        : `Rate: 1 Crystal = ${fmt.format(SELL)} Coins`;
      input.value = '0'; out.textContent = '0'; updateHelp();
    }

    function isBuy(){ return tBuy.classList.contains('active'); }

    function update(){
      const n = Math.max(0, Math.floor(Number(input.value||0)));
      input.value = String(n);
      if (isBuy()){
        const crystals = Math.floor(n / BUY);
        out.textContent = fmt.format(crystals);
        confirm.disabled = crystals <= 0;
      } else {
        const coins = Math.floor(n * SELL);
        out.textContent = fmt.format(coins);
        confirm.disabled = n <= 0;
      }
    }

    function getCoins(){ return window.Economy.getCoins(); }
    function getCrystals(){ return (window.Economy.getCrystals?.() ?? window.Economy.getGems?.() ?? 0); }
    function setCoins(v){ return window.Economy.setCoins(v); }
    function setCrystals(v){ return (window.Economy.setCrystals?.(v) ?? window.Economy.setGems?.(v)); }

    function updateHelp(){
      help.textContent = `Balance — Coins: ${fmt.format(getCoins())} · Crystals: ${fmt.format(getCrystals())}`;
    }

    function flash(msg){
      help.textContent = msg; help.style.color='salmon';
      setTimeout(()=> help.style.color='', 900);
    }

    tBuy.addEventListener('click', ()=>{ setMode(true); update(); });
    tSell.addEventListener('click', ()=>{ setMode(false); update(); });
    input.addEventListener('input', ()=>{ update(); });

    confirm.addEventListener('click', ()=>{
      if (isBuy()){
        const coinsIn   = Math.max(0, Math.floor(Number(input.value||0)));
        const crystals  = Math.floor(coinsIn / BUY);
        const trueCost  = crystals * BUY;
        if (crystals <= 0) return;
        const cur = getCoins();
        if (cur < trueCost) return flash(`Not enough Coins. Need ${fmt.format(trueCost)}.`);
        setCoins(cur - trueCost);
        (window.Economy.addCrystals?.(crystals) ?? window.Economy.addGems?.(crystals));
        toast(`Exchanged ${fmt.format(trueCost)} Coins → ${fmt.format(crystals)} Crystals.`);
      } else {
        const crystalsIn = Math.max(0, Math.floor(Number(input.value||0)));
        if (crystalsIn <= 0) return;
        const curG = getCrystals();
        if (curG < crystalsIn) return flash('Not enough Crystals.');
        setCrystals(curG - crystalsIn);
        const coinsOut = crystalsIn * SELL;
        window.Economy.addCoins(coinsOut);
        toast(`Exchanged ${fmt.format(crystalsIn)} Crystals → ${fmt.format(coinsOut)} Coins.`);
      }
      window.Store?.refreshWallet?.();
      updateHelp();
    });

    // small toast helper using store.js’s style
    function toast(msg){
      let wrap = document.getElementById('toasts');
      if(!wrap){ wrap = document.createElement('div'); wrap.id='toasts'; document.body.appendChild(wrap); }
      const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg;
      wrap.appendChild(t);
      setTimeout(()=>{ t.style.opacity='0'; t.style.transform='translateY(-6px)'; }, 2200);
      setTimeout(()=> t.remove(), 2700);
    }

    setMode(true);
    update();
  }

  function registerExchange(){
  window.Store.registerTab({
      id: 'exchange',
      name: 'Exchange',
      desc: 'Trade Coins ↔ Crystals at fixed rates.',
      render: renderExchange,
      insertAt: 0
  });
  }

  if (window.Store?.registerTab) {
  registerExchange();
  } else {
  window.addEventListener('bbx:storeReady', registerExchange, { once: true });
  }
})();
