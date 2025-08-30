// Very basic canvas loop: draws a "glass pane" and a ball that flies in.
// No shatter, no sound. This is just scaffolding.

(() => {
  const canvas = document.getElementById('c');
  const ctx = canvas.getContext('2d');
  const hint = document.getElementById('hint');
  const resetBtn = document.getElementById('resetBtn');

  let w, h, dpr;
  let pane;             // {x,y,w,h}
  let ball = null;      // {x,y,r,vx,vy,active}
  const gravity = 1200; // px/s^2
  let last = performance.now();

  function resize() {
    dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    w = canvas.clientWidth = window.innerWidth;
    h = canvas.clientHeight = window.innerHeight - document.querySelector('header').offsetHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const PW = Math.min(720, Math.floor(w * 0.7));
    const PH = Math.min(420, Math.floor(h * 0.6));
    pane = {
      x: Math.floor((w - PW) / 2),
      y: Math.floor((h - PH) / 2),
      w: PW, h: PH
    };
  }
  window.addEventListener('resize', resize);
  resize();

  function reset() {
    ball = null;
    hint.style.display = '';
  }
  resetBtn.addEventListener('click', reset);

  canvas.addEventListener('pointerdown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    if (!pointInRect(mx, my, pane)) return;
    hint.style.display = 'none';

    // Spawn a ball at the left side aiming at the click point
    const bx = pane.x - 120;
    const by = my;
    const dx = mx - bx, dy = my - by;
    const len = Math.hypot(dx, dy) || 1;
    const speed = 900;

    ball = {
      x: bx, y: by, r: 12,
      vx: speed * dx / len,
      vy: speed * dy / len,
      active: true
    };
  });

  function pointInRect(px, py, r) {
    return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function update(dt) {
    if (ball?.active) {
      ball.x += ball.vx * dt;
      ball.y += ball.vy * dt;

      // simple floor bounce
      const floor = h - 8;
      if (ball.y + ball.r > floor) {
        ball.y = floor - ball.r;
        ball.vy *= -0.4;
        ball.vx *= 0.98;
        if (Math.abs(ball.vy) < 30) ball.active = false;
      } else {
        ball.vy += gravity * dt;
      }
    }
  }

  function draw() {
    ctx.clearRect(0, 0, w, h);

    // floor
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    ctx.fillRect(0, h - 8, w, 8);

    // glass pane (just a rectangle with edge + fill)
    ctx.fillStyle = "rgba(160,220,255,0.08)";
    roundRect(ctx, pane.x, pane.y, pane.w, pane.h, 8);
    ctx.fill();

    ctx.strokeStyle = "rgba(200,240,255,0.75)";
    ctx.lineWidth = 2;
    roundRect(ctx, pane.x, pane.y, pane.w, pane.h, 8);
    ctx.stroke();

    // ball
    if (ball?.active) {
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.5)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  function loop() {
    const now = performance.now();
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;
    update(dt);
    draw();
    requestAnimationFrame(loop);
  }
  loop();
})();
