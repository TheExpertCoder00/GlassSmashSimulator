(function(){
  const K_COINS = 'gss_coins'
  const K_CRYS = 'gss_crystals'
  function n(v){ return Math.max(0, parseInt(v||'0',10)||0) }
  function getCoins(){ return n(localStorage.getItem(K_COINS)) }
  function getCrystals(){ return n(localStorage.getItem(K_CRYS)) }
  function setCoins(v){ localStorage.setItem(K_COINS, String(n(v))) }
  function setCrystals(v){ localStorage.setItem(K_CRYS, String(n(v))) }
  function addCoins(v){ setCoins(getCoins()+n(v)) }
  function addCrystals(v){ setCrystals(getCrystals()+n(v)) }
  function canSpend(c,cr){ return getCoins()>=n(c) && getCrystals()>=n(cr) }
  function spend(c,cr){ if(!canSpend(c,cr)) return false; setCoins(getCoins()-n(c)); setCrystals(getCrystals()-n(cr)); return true }
  window.Economy = { getCoins, getCrystals, setCoins, setCrystals, addCoins, addCrystals, canSpend, spend }
})()
