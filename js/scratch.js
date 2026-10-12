// Scratch-off foil (real <canvas>, pointer events: mouse, touch and pen) + small effects.
window.OF = window.OF || {};

const THEMES = [
  { stops: ["#f6e7bf", "#e8d3a2", "#fff6dc", "#d7ba7a", "#f2e0b3"], ink: "#6d5236" },   // champagne gold
  { stops: ["#fbe3ea", "#e9b4c3", "#fff0f4", "#d99aaa", "#f7d3dc"], ink: "#7a3f52" },   // rose
  { stops: ["#f1f3f5", "#c9ced3", "#fbfcfd", "#aeb5bb", "#e6e9ec"], ink: "#4f5860" }    // silver
];
const reduceMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function wrapText(ctx, text, maxW) {
  const words = String(text).split(/\s+/); const lines = []; let line = "";
  for (const w of words) {
    const t = line ? line + " " + w : w;
    if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t;
  }
  if (line) lines.push(line);
  return lines;
}

function paintFoil(ctx, W, H, dpr, o) {
  const th = THEMES[o.theme % THEMES.length];
  ctx.globalCompositeOperation = "source-over";
  const g = ctx.createLinearGradient(0, 0, W, H);
  th.stops.forEach((c, i) => g.addColorStop(i / (th.stops.length - 1), c));
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // holographic pastel glow
  [["rgba(255,182,213,.35)", .2, .15], ["rgba(190,230,255,.35)", .85, .3], ["rgba(214,255,226,.3)", .4, .9]].forEach(([c, x, y]) => {
    const r = ctx.createRadialGradient(W * x, H * y, 0, W * x, H * y, W * .7);
    r.addColorStop(0, c); r.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = r; ctx.fillRect(0, 0, W, H);
  });
  // diagonal sheen
  ctx.save(); ctx.rotate(-0.5);
  for (let i = -H; i < W * 1.4; i += 26 * dpr) { ctx.fillStyle = (i / (26 * dpr)) % 2 ? "rgba(255,255,255,.10)" : "rgba(0,0,0,.025)"; ctx.fillRect(i, -H, 10 * dpr, H * 3); }
  ctx.restore();
  // speckle texture
  for (let i = 0; i < W * H / 90; i++) {
    ctx.fillStyle = Math.random() > .5 ? "rgba(255,255,255,.35)" : "rgba(90,60,40,.07)";
    ctx.fillRect(Math.random() * W, Math.random() * H, dpr * (Math.random() * 1.6 + .4), dpr * (Math.random() * 1.6 + .4));
  }
  // inner border
  ctx.strokeStyle = "rgba(255,255,255,.7)"; ctx.lineWidth = 2 * dpr; ctx.strokeRect(6 * dpr, 6 * dpr, W - 12 * dpr, H - 12 * dpr);

  // text
  ctx.textAlign = "center"; ctx.fillStyle = th.ink; ctx.shadowColor = "rgba(255,255,255,.7)"; ctx.shadowBlur = 0; ctx.shadowOffsetY = dpr;
  const cx = W / 2, pad = 18 * dpr;
  if (o.interactive) {
    ctx.font = `${Math.round(18 * dpr)}px Caveat, "Segoe Script", cursive`;
    ctx.fillText("Scratch me when…", cx, H * .17);
  } else {
    ctx.font = `${Math.round(30 * dpr)}px serif`; ctx.fillText("🔒", cx, H * .2);
  }
  ctx.font = `700 ${Math.round(17 * dpr)}px "Cormorant Garamond", Georgia, serif`;
  const lines = wrapText(ctx, o.title, W - pad * 2).slice(0, 5);
  const lh = 20 * dpr; let y = H * .5 - ((lines.length - 1) * lh) / 2;
  lines.forEach(l => { ctx.fillText(l, cx, y); y += lh; });
  if (o.hint) {
    ctx.font = `${Math.round(16 * dpr)}px Caveat, "Segoe Script", cursive`; ctx.globalAlpha = .85;
    wrapText(ctx, o.hint, W - pad * 2).slice(0, 3).forEach((l, i) => ctx.fillText(l, cx, H * .8 + i * 17 * dpr));
    ctx.globalAlpha = 1;
  }
  ctx.shadowColor = "transparent";
}

OF.mountFoil = function (cell, canvas, o) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const sparks = cell.querySelector(".sparks");
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  let W = 0, H = 0, scratched = false, done = false, drawing = false, last = null, lastSpark = 0, lastCheck = 0;

  const size = () => {
    const r = canvas.getBoundingClientRect();
    if (!r.width || scratched) return;
    W = canvas.width = Math.round(r.width * dpr); H = canvas.height = Math.round(r.height * dpr);
    paintFoil(ctx, W, H, dpr, o);
  };
  new ResizeObserver(size).observe(canvas);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(size);

  if (!o.interactive) return { reveal() {} };

  const clearedRatio = () => {
    const d = ctx.getImageData(0, 0, W, H).data; let n = 0, t = 0;
    for (let i = 3; i < d.length; i += 4 * 37) { t++; if (d[i] < 40) n++; }
    return n / t;
  };
  const finish = () => {
    if (done) return; done = true; drawing = false;
    canvas.classList.add("gone");
    setTimeout(() => canvas.remove(), 700);
    o.onReveal && o.onReveal();
  };
  // Once she has really scratched, it stays open: finish while dragging at 35%, or as soon as she lifts her finger at 12%.
  const check = (lifted) => { if (!done && clearedRatio() > (lifted ? 0.12 : 0.35)) finish(); };
  const pos = e => { const r = canvas.getBoundingClientRect(); return { x: (e.clientX - r.left) * (W / r.width), y: (e.clientY - r.top) * (H / r.height), cx: e.clientX - r.left, cy: e.clientY - r.top }; };
  const brush = 22 * dpr;

  const stroke = (a, b) => {
    ctx.globalCompositeOperation = "destination-out"; ctx.lineCap = ctx.lineJoin = "round"; ctx.lineWidth = brush * 2;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  };
  const spark = p => {
    if (reduceMotion() || !sparks) return;
    const now = performance.now(); if (now - lastSpark < 45) return; lastSpark = now;
    const s = document.createElement("span"); s.className = "sp"; s.textContent = Math.random() > .5 ? "✦" : "♡";
    s.style.left = p.cx + (Math.random() * 24 - 12) + "px"; s.style.top = p.cy + (Math.random() * 24 - 12) + "px";
    s.addEventListener("animationend", () => s.remove()); sparks.append(s);
  };

  canvas.addEventListener("pointerdown", e => {
    if (done) return; e.preventDefault();
    try { canvas.setPointerCapture(e.pointerId); } catch {}
    drawing = true; scratched = true; last = pos(e); stroke(last, last); spark(last);
    o.onStart && o.onStart();
  });
  canvas.addEventListener("pointermove", e => {
    if (!drawing || done) return; e.preventDefault();
    const p = pos(e); stroke(last, p); last = p; spark(p);
    const now = performance.now(); if (now - lastCheck > 160) { lastCheck = now; check(false); }
  });
  const up = () => { if (!drawing) return; drawing = false; o.onEnd && o.onEnd(); check(true); };
  canvas.addEventListener("pointerup", up);
  canvas.addEventListener("pointercancel", up);
  canvas.addEventListener("contextmenu", e => e.preventDefault());

  return { reveal: () => { scratched = true; finish(); } };
};

/* ───────── effects ───────── */
OF.burst = function (x, y, n = 16) {
  if (reduceMotion()) return;
  const sym = ["♡", "💗", "✦", "🌸", "✨"];
  for (let i = 0; i < n; i++) {
    const s = document.createElement("span"); s.className = "burst"; s.textContent = sym[i % sym.length];
    const a = (Math.PI * 2 * i) / n + Math.random() * .4, d = 70 + Math.random() * 90;
    s.style.left = x + "px"; s.style.top = y + "px";
    s.style.setProperty("--dx", Math.cos(a) * d + "px"); s.style.setProperty("--dy", Math.sin(a) * d - 30 + "px");
    s.addEventListener("animationend", () => s.remove()); document.body.append(s);
  }
};

OF.sound = { on: false };
OF.chime = function () {
  if (!OF.sound.on) return;
  try {
    const ac = OF._ac || (OF._ac = new (window.AudioContext || window.webkitAudioContext)());
    [659.25, 783.99, 1046.5].forEach((f, i) => {
      const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime + i * .11;
      o.type = "sine"; o.frequency.value = f; g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(.13, t + .02); g.gain.exponentialRampToValueAtTime(.0001, t + .7);
      o.connect(g).connect(ac.destination); o.start(t); o.stop(t + .75);
    });
  } catch {}
};
