(function(){
  const TAU = Math.PI * 2;
  const rand = (a, b) => a + Math.random() * (b - a);

  function polygonArea(pts) {
    let a = 0;
    for (let i=0;i<pts.length;i++){
      const p = pts[i], q = pts[(i+1)%pts.length];
      a += p.x*q.y - q.x*p.y;
    }
    return a/2;
  }

  function perimeterSamples(rect, count) {
    const pts = [];
    const {x, y, w, h} = rect;
    const per = 2*(w + h);
    for (let i=0;i<count;i++){
      const t = i / count * per;
      let px, py, tt = t;
      if (tt <= w) { px = x + tt; py = y; }
      else if ((tt -= w) <= h) { px = x + w; py = y + tt; }
      else if ((tt -= h) <= w) { px = x + w - tt; py = y + h; }
      else { tt -= w; px = x; py = y + h - tt; }
      px += rand(-3,3); py += rand(-3,3); // organic cracks
      pts.push({x:px, y:py});
    }
    return pts;
  }

  function makeShard(tri) {
    const area = polygonArea(tri);
    const cx = tri.reduce((s, p, i) => {
      const p1 = tri[i], p2 = tri[(i+1)%tri.length];
      const cross = p1.x*p2.y - p2.x*p1.y;
      return s + (p1.x + p2.x)*cross;
    }, 0) / (6*area);
    const cy = tri.reduce((s, p, i) => {
      const p1 = tri[i], p2 = tri[(i+1)%tri.length];
      const cross = p1.x*p2.y - p2.x*p1.y;
      return s + (p1.y + p2.y)*cross;
    }, 0) / (6*area);

    return {
      tri, cx, cy,
      vx: 0, vy: 0,
      angle: 0, angVel: 0,
      dead: false
    };
  }

  function shatterAt(rect, ix, iy, count=34) {
    // Create a radial fan of triangles from impact to perimeter points
    const per = perimeterSamples(rect, count)
      .sort((a,b) => Math.atan2(a.y-iy, a.x-ix) - Math.atan2(b.y-iy, b.x-ix));

    const shards = [];
    for (let i=0;i<per.length;i++){
      const a = per[i];
      const b = per[(i+1)%per.length];
      shards.push(makeShard([{x:ix,y:iy}, a, b]));
    }
    // apply outward impulse + spin
    for (const s of shards) {
      const dx = s.cx - ix, dy = s.cy - iy;
      const m = Math.hypot(dx, dy) || 1;
      const nx = dx/m, ny = dy/m;
      const impulse = rand(300, 900);
      s.vx = nx*impulse + rand(-90,90);
      s.vy = ny*impulse + rand(-50,50) - 200;
      s.angVel = rand(-4,4);
    }
    return shards;
  }

  function updateShard(s, dt, world) {
    // world: {w,h,gravity}
    s.vy += world.gravity * dt;
    s.cx += s.vx * dt;
    s.cy += s.vy * dt;
    s.angle += s.angVel * dt;

    // floor
    const floor = world.h - 8;
    if (s.cy > floor){
      s.cy = floor;
      s.vy *= -0.35;
      s.vx *= 0.98;
      s.angVel *= 0.8;
      if (Math.abs(s.vy) < 20) {
        s.vy = 0; s.vx *= 0.95; s.angVel *= 0.7;
        if (Math.abs(s.vx) < 4 && Math.abs(s.angVel) < 0.2) s.dead = true;
      }
    }
    // side walls
    if (s.cx < 8) { s.cx = 8; s.vx *= -0.4; }
    if (s.cx > world.w-8) { s.cx = world.w-8; s.vx *= -0.4; }
  }

  function drawShard(ctx, s) {
    const {tri, cx, cy, angle} = s;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.beginPath();
    for (let i=0;i<tri.length;i++){
      const px = tri[i].x - cx;
      const py = tri[i].y - cy;
      if (i===0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();

    const g = ctx.createLinearGradient(-20,-20,60,60);
    g.addColorStop(0, "rgba(160,220,255,0.20)");
    g.addColorStop(0.7, "rgba(160,220,255,0.08)");
    g.addColorStop(1, "rgba(220,250,255,0.18)");
    ctx.fillStyle = g;
    ctx.fill();

    ctx.strokeStyle = "rgba(200,240,255,0.7)";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.restore();
  }

  window.Shatter = { shatterAt, updateShard, drawShard };
})();