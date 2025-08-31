# Glass Smash Simulator  

**Glass Smash Simulator** is a browser-based stress-relief game built for **HackaMind 2025**, designed to align with the theme of **Health & Well-being**.  
Smash virtual glass panes, earn rewards, and unlock power-ups — a fun way to **reduce stress, improve focus, and stay engaged**.  

---

## ✨ Features  

- **Satisfying Glass Physics** – custom-built shard simulation (`shatter.js`) makes every smash unique.  
- **Timing Challenge** – a moving bar with a “Perfect Zone” keeps players focused and engaged.  
- **Rewards System** – earn coins & crystals, stack streaks for bonus payouts.  
- **Power-Ups** – coin doublers, gem doublers, perfect zone expansion, and more.  
- **Customization Store** – unlock new ball skins and backgrounds with in-game currency.  
- **Economy & Exchange** – trade coins ↔ crystals, choose your progression path.  
- **Health & Wellness Theme** – designed as a quick digital stress reliever, turning focus into fun.  

---

## 🎮 How to Play  

1. **Click** the glass pane (or press **Space**) to throw a ball.  
2. **Time your shot** using the power bar — center = maximum power.  
3. **Hit the 🔮 Perfect zone** to earn crystals.  
4. **Stack streaks** for extra rewards.  
5. Spend coins & crystals in the **Store** to unlock skins, backgrounds, and power-ups.  

---

## 🛠 Tech Stack  

Built with pure **web technologies** — no external frameworks:  

- **HTML5 Canvas** – rendering glass panes, ball, shards.  
- **CSS3** – polished UI/animations (meter, HUD, store, modals).  
- **JavaScript** – modular game logic:  
  - `main.js` → core game loop, ball physics, UI updates  
  - `shatter.js` → glass breaking simulation  
  - `sfx.js` → custom sound effects (shattering combos)  
  - `economy.js` → wallet & spending system (coins, crystals)  
  - `store.js` → power-ups, ball skins, backgrounds, inventory  
  - `exchange.js` → trade coins ↔ crystals  
  - `streaks.js` → rewards for consistent perfect throws  
  - `powerups_hud.js` → active boosts tracking  

---

## 🚀 Run Locally  

1. Clone the repo:  
   ```bash
   git clone https://github.com/TheExpertCoder00/glass-smash-simulator.git
   cd glass-smash-simulator
