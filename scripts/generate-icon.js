'use strict';

// Renders the app icon at 1024x1024 via an offscreen Electron BrowserWindow,
// then writes build/icon-1024.png. Run via:  electron scripts/generate-icon.js
// The bash driver (scripts/generate-icon.sh) chains sips + iconutil afterwards.

const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

const SIZE = 1024;
const OUT = path.join(__dirname, '..', 'build', 'icon-1024.png');

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  html,body{margin:0;padding:0;background:transparent}
  canvas{display:block}
</style></head><body>
<canvas id="c" width="${SIZE}" height="${SIZE}"></canvas>
<script>
  const S = ${SIZE};
  const c = document.getElementById('c');
  const x = c.getContext('2d');

  // Rounded-square background with indigo gradient
  const r = S * 0.22;
  const g = x.createLinearGradient(0, 0, S, S);
  g.addColorStop(0, '#5b6cff');
  g.addColorStop(1, '#2b2f8a');
  x.fillStyle = g;
  roundRect(x, 0, 0, S, S, r);
  x.fill();

  // Subtle inner highlight
  x.fillStyle = 'rgba(255,255,255,0.06)';
  roundRect(x, S*0.04, S*0.04, S*0.92, S*0.45, r*0.85);
  x.fill();

  // Clock face
  const cx = S/2, cy = S/2;
  const R  = S * 0.34;
  x.fillStyle = '#ffffff';
  x.beginPath(); x.arc(cx, cy, R, 0, Math.PI*2); x.fill();

  // Outer ring
  x.lineWidth = S * 0.018;
  x.strokeStyle = '#1f2436';
  x.beginPath(); x.arc(cx, cy, R, 0, Math.PI*2); x.stroke();

  // Tick marks (12)
  for (let i=0; i<12; i++) {
    const a = (i/12) * Math.PI*2 - Math.PI/2;
    const long = i % 3 === 0;
    const r1 = R * (long ? 0.78 : 0.86);
    const r2 = R * 0.96;
    x.lineWidth = S * (long ? 0.018 : 0.010);
    x.strokeStyle = '#1f2436';
    x.beginPath();
    x.moveTo(cx + Math.cos(a)*r1, cy + Math.sin(a)*r1);
    x.lineTo(cx + Math.cos(a)*r2, cy + Math.sin(a)*r2);
    x.stroke();
  }

  // Hour hand (pointing ~10 o'clock)
  drawHand(-Math.PI/2 - Math.PI/3, R * 0.50, S * 0.030, '#1f2436');
  // Minute hand (pointing ~2 o'clock)
  drawHand(-Math.PI/2 + Math.PI/3, R * 0.72, S * 0.022, '#5b6cff');

  // Center cap
  x.fillStyle = '#1f2436';
  x.beginPath(); x.arc(cx, cy, S * 0.022, 0, Math.PI*2); x.fill();

  // Terminal-prompt chevron in corner badge
  const bx = S * 0.70, by = S * 0.70, br = S * 0.16;
  x.fillStyle = '#1f2436';
  x.beginPath(); x.arc(bx, by, br, 0, Math.PI*2); x.fill();
  x.lineWidth = S * 0.022;
  x.strokeStyle = '#7be38b';
  x.lineCap = 'round'; x.lineJoin = 'round';
  x.beginPath();
  x.moveTo(bx - br*0.30, by - br*0.30);
  x.lineTo(bx + br*0.05, by);
  x.lineTo(bx - br*0.30, by + br*0.30);
  x.stroke();
  // underscore cursor
  x.beginPath();
  x.moveTo(bx + br*0.18, by + br*0.32);
  x.lineTo(bx + br*0.50, by + br*0.32);
  x.stroke();

  function roundRect(ctx, x0, y0, w, h, rr) {
    ctx.beginPath();
    ctx.moveTo(x0+rr, y0);
    ctx.arcTo(x0+w, y0,   x0+w, y0+h, rr);
    ctx.arcTo(x0+w, y0+h, x0,   y0+h, rr);
    ctx.arcTo(x0,   y0+h, x0,   y0,   rr);
    ctx.arcTo(x0,   y0,   x0+w, y0,   rr);
    ctx.closePath();
  }
  function drawHand(angle, length, width, color) {
    x.lineWidth = width;
    x.strokeStyle = color;
    x.lineCap = 'round';
    x.beginPath();
    x.moveTo(cx, cy);
    x.lineTo(cx + Math.cos(angle)*length, cy + Math.sin(angle)*length);
    x.stroke();
  }

  // Signal readiness via title change
  document.title = 'icon-ready';
</script></body></html>`;

app.whenReady().then(async () => {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });

  const win = new BrowserWindow({
    width: SIZE,
    height: SIZE,
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    webPreferences: { offscreen: false, contextIsolation: true, sandbox: true },
  });

  await new Promise((resolve) => {
    win.webContents.once('page-title-updated', (_e, title) => {
      if (title === 'icon-ready') resolve();
    });
    win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
  });

  // Give the renderer one extra frame for paint
  await new Promise((r) => setTimeout(r, 100));

  const image = await win.webContents.capturePage({ x: 0, y: 0, width: SIZE, height: SIZE });
  fs.writeFileSync(OUT, image.toPNG());
  console.log(`wrote ${OUT}`);

  win.destroy();
  app.quit();
});

app.on('window-all-closed', () => app.quit());
