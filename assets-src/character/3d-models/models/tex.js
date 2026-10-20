import { THREE, canvasTex, rng } from './lib.js';

function flower(g, x, y, r, petals, col, centre, rot = 0) {
  g.fillStyle = col;
  for (let i = 0; i < petals; i++) {
    const a = rot + i / petals * Math.PI * 2;
    g.save(); g.translate(x, y); g.rotate(a);
    g.beginPath(); g.ellipse(0, -r * 0.55, r * 0.2, r * 0.5, 0, 0, Math.PI * 2); g.fill();
    g.restore();
  }
  g.fillStyle = centre; g.beginPath(); g.arc(x, y, r * 0.22, 0, Math.PI * 2); g.fill();
}

export function linen(base = '#e8dfc9', seed = 11) {
  return canvasTex(512, 512, (g, w, h) => {
    const r = rng(seed);
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    g.globalAlpha = 0.09;
    for (let y = 0; y < h; y += 3) { g.fillStyle = r() < .5 ? '#fff' : '#6b5a3c'; g.fillRect(0, y, w, 1); }
    for (let x = 0; x < w; x += 3) { g.fillStyle = r() < .5 ? '#fff' : '#6b5a3c'; g.fillRect(x, 0, 1, h); }
    g.globalAlpha = 0.07;
    for (let i = 0; i < 90; i++) {
      g.strokeStyle = r() < .5 ? '#fff' : '#3a2f1c'; g.lineWidth = 1 + r() * 3;
      g.beginPath(); const x = r() * w, y = r() * h; g.moveTo(x, y); g.quadraticCurveTo(x + r() * 90 - 45, y + r() * 90 - 45, x + r() * 140 - 70, y + r() * 140 - 70); g.stroke();
    }
    g.globalAlpha = 1;
  });
}

export function embroidery(bg = '#3c4b5e', gold = '#d3a13b', red = '#b04a2c', rep = [3, 2]) {
  return canvasTex(512, 512, (g, w, h) => {
    const r = rng(21);
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 9000; i++) { g.globalAlpha = 0.25 * r(); g.fillStyle = r() < .5 ? '#9fb0c4' : '#0c1520'; g.fillRect(r() * w, r() * h, 1.4, 1.4); }
    g.globalAlpha = 1;
    const spots = [[128, 128], [384, 128], [128, 384], [384, 384], [256, 256]];
    // vines
    g.strokeStyle = gold; g.lineWidth = 3; g.lineCap = 'round';
    for (let i = 0; i < spots.length; i++) for (let j = i + 1; j < spots.length; j++) {
      const a = spots[i], b = spots[j];
      if (Math.hypot(a[0] - b[0], a[1] - b[1]) > 230) continue;
      g.beginPath(); g.moveTo(a[0], a[1]); g.bezierCurveTo((a[0] + b[0]) / 2 + 30, a[1] + 20, (a[0] + b[0]) / 2 - 30, b[1] - 20, b[0], b[1]); g.stroke();
    }
    for (let i = 0; i < 70; i++) {
      g.save(); g.translate(r() * w, r() * h); g.rotate(r() * 6.28); g.fillStyle = gold;
      g.beginPath(); g.ellipse(0, 0, 3, 9, 0, 0, 6.28); g.fill(); g.restore();
    }
    for (const s of spots) { flower(g, s[0], s[1], 62, 9, gold, red, r() * 3); flower(g, s[0], s[1], 34, 9, '#e9c25d', red, r() * 3); }
  }, { repeat: rep });
}

export function bib(rep = [1, 1]) {
  return canvasTex(512, 512, (g, w, h) => {
    const r = rng(5);
    g.fillStyle = '#e7dcc3'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#b9a98a'; g.globalAlpha = .5;
    for (let i = -h; i < w; i += 14) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + h, h); g.stroke(); g.beginPath(); g.moveTo(i + h, 0); g.lineTo(i, h); g.stroke(); }
    g.globalAlpha = 1;
    g.fillStyle = '#6e1f26';
    g.fillRect(0, 0, w, 34); g.fillRect(0, h - 34, w, 34); g.fillRect(0, 0, 34, h); g.fillRect(w - 34, 0, 34, h);
    g.fillStyle = '#e1c690';
    for (let x = 12; x < w; x += 24) { g.fillRect(x, 14, 8, 8); g.fillRect(x, h - 22, 8, 8); }
    for (let y = 12; y < h; y += 24) { g.fillRect(14, y, 8, 8); g.fillRect(w - 22, y, 8, 8); }
    for (const [x, y] of [[256, 150], [256, 380], [110, 260], [400, 260]]) flower(g, x, y, 62, 8, '#7b242c', '#e1c690', r() * 2);
  }, { repeat: rep });
}

export function tweed(base = '#1d1c1d', line = '#7c6a50', rep = [4, 4]) {
  return canvasTex(256, 256, (g, w, h) => {
    const r = rng(8);
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 4) { g.globalAlpha = 0.15 + r() * 0.3; g.fillStyle = r() < .3 ? line : '#2e3a46'; g.fillRect(x, 0, 1.5, h); }
    for (let y = 0; y < h; y += 4) { g.globalAlpha = 0.15 + r() * 0.3; g.fillStyle = r() < .3 ? line : '#2e3a46'; g.fillRect(0, y, w, 1.5); }
    g.globalAlpha = 1;
  }, { repeat: rep });
}

export function lame(rep = [2, 3]) {
  return canvasTex(512, 512, (g, w, h) => {
    const r = rng(31);
    const gr = g.createLinearGradient(0, 0, w, h);
    gr.addColorStop(0, '#b3c0c0'); gr.addColorStop(1, '#b3c0c0');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 700; i++) {
      g.strokeStyle = r() < .5 ? '#f4fbfb' : '#4d5d5e'; g.globalAlpha = 0.1 + r() * 0.3; g.lineWidth = 1 + r() * 3;
      const x = r() * w, y = r() * h;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 30, y + 30 + r() * 120); g.stroke();
    }
    g.globalAlpha = 1;
  }, { repeat: rep });
}

export function silverEngrave(rep = [4, 1], base = '#b9bcbc') {
  return canvasTex(256, 64, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#6c6f70'; g.lineWidth = 1.5;
    for (let x = 0; x < w; x += 16) {
      g.beginPath(); g.arc(x + 8, h / 2, 6, 0, 6.28); g.stroke();
      g.beginPath(); g.moveTo(x, 6); g.quadraticCurveTo(x + 8, 18, x + 16, 6); g.stroke();
      g.beginPath(); g.moveTo(x, h - 6); g.quadraticCurveTo(x + 8, h - 18, x + 16, h - 6); g.stroke();
    }
  }, { repeat: rep });
}

export function leopard(rep = [4, 4]) {
  return canvasTex(256, 256, (g, w, h) => {
    const r = rng(77);
    g.fillStyle = '#b33a63'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2500; i++) { g.globalAlpha = .12; g.fillStyle = r() < .5 ? '#6e1d3a' : '#e97aa0'; g.fillRect(r() * w, r() * h, 2, 2); }
    g.globalAlpha = 1;
    for (let i = 0; i < 90; i++) {
      const x = r() * w, y = r() * h, s = 6 + r() * 7;
      for (const [ox, oy] of [[0, 0], [w, 0], [-w, 0], [0, h], [0, -h]]) {
        g.fillStyle = '#2c7a62'; g.beginPath(); g.ellipse(x + ox, y + oy, s, s * 0.8, r() * 3, 0, 6.28); g.fill();
        g.fillStyle = '#10191a'; g.beginPath(); g.ellipse(x + ox + 1, y + oy + 1, s * 0.45, s * 0.35, 0, 0, 6.28); g.fill();
      }
    }
  }, { repeat: rep });
}

export function scribbleSkin(base = '#d6ab90', rep = [1, 1]) {
  return canvasTex(512, 512, (g, w, h) => {
    const r = rng(41);
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 3000; i++) { g.globalAlpha = .1; g.fillStyle = r() < .5 ? '#b58468' : '#f2d2bd'; g.fillRect(r() * w, r() * h, 2, 2); }
    g.globalAlpha = 1;
    // paper patches
    const papers = ['#f0e2c0', '#e9b7a3', '#9bc4be', '#f2cf74', '#e8e0d2'];
    for (let i = 0; i < 26; i++) {
      g.fillStyle = papers[Math.floor(r() * papers.length)]; g.globalAlpha = .85;
      g.fillRect(r() * w, r() * h, 18 + r() * 44, 12 + r() * 30);
    }
    g.globalAlpha = 1;
    const cols = ['#0b5a5e', '#0b5a5e', '#0f2a35', '#a82e20', '#111', '#c96a18', '#12878d'];
    for (let i = 0; i < 260; i++) {
      g.strokeStyle = cols[Math.floor(r() * cols.length)]; g.lineWidth = 4 + r() * 4; g.lineCap = 'round';
      g.beginPath(); let x = r() * w, y = r() * h; g.moveTo(x, y);
      const k = 2 + Math.floor(r() * 4);
      for (let j = 0; j < k; j++) { x += (r() - 0.5) * 38; y += (r() - 0.5) * 38; g.lineTo(x, y); }
      g.stroke();
    }
  }, { repeat: rep });
}

export function collage() {
  return canvasTex(256, 256, (g, w, h) => {
    const r = rng(52);
    g.fillStyle = '#efe3c8'; g.fillRect(0, 0, w, h);
    const cols = ['#c8492e', '#1f8f8c', '#e9a73c', '#d7cdb4', '#2b4c7e', '#e7a9a0', '#f3ecd9'];
    for (let i = 0; i < 40; i++) { g.fillStyle = cols[Math.floor(r() * cols.length)]; g.globalAlpha = .9; g.fillRect(r() * w, r() * h, 30 + r() * 60, 20 + r() * 50); }
    g.globalAlpha = 1;
    g.strokeStyle = '#1a1a1a'; g.lineWidth = 3;
    for (let i = 0; i < 30; i++) { g.beginPath(); let x = r() * w, y = r() * h; g.moveTo(x, y); g.lineTo(x + (r() - .5) * 50, y + (r() - .5) * 50); g.stroke(); }
    g.fillStyle = '#c0301f'; g.beginPath(); g.ellipse(w * 0.5, h * 0.78, 22, 8, 0, 0, 6.28); g.fill();
    g.fillStyle = '#1a1a1a'; g.fillRect(w * 0.27, h * 0.3, 40, 8); g.fillRect(w * 0.6, h * 0.3, 40, 8);
  });
}

export function crackedBronze(rep = [1, 1]) {
  return canvasTex(512, 512, (g, w, h) => {
    const r = rng(63);
    g.fillStyle = '#5b3a31'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 700; i++) {
      g.globalAlpha = 0.35; g.fillStyle = ['#8a5a44', '#3b2622', '#6f6a4a', '#7c3d3a', '#2b2b25'][Math.floor(r() * 5)];
      g.beginPath(); g.ellipse(r() * w, r() * h, 3 + r() * 14, 3 + r() * 10, r() * 3, 0, 6.28); g.fill();
    }
    g.globalAlpha = 0.9; g.strokeStyle = '#140d0b'; g.lineWidth = 1.4;
    for (let i = 0; i < 80; i++) {
      g.beginPath(); let x = r() * w, y = r() * h; g.moveTo(x, y);
      for (let k = 0; k < 6; k++) { x += (r() - 0.5) * 50; y += (r() - 0.3) * 40; g.lineTo(x, y); }
      g.stroke();
    }
    g.globalAlpha = 1;
  }, { repeat: rep });
}

export function maskCream({ seed = 9, gold = '#cfa761', lizard = false, density = 1, dark = false } = {}) {
  return canvasTex(1024, 512, (g, w, h) => {
    const r = rng(seed);
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#efe6d2'); gr.addColorStop(1, '#d9ccb0');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 5000; i++) { g.globalAlpha = 0.07; g.fillStyle = r() < .5 ? '#fff' : '#7b6a4c'; g.fillRect(r() * w, r() * h, 2, 2); }
    g.globalAlpha = 0.9; g.strokeStyle = gold; g.fillStyle = gold; g.lineWidth = 2;
    // filigree centred on the face (u = 0.5)
    for (let i = 0; i < 320 * density; i++) {
      const x = w * 0.5 + (r() - 0.5) * w * 0.34, y = r() * h * 0.95;
      if (r() < 0.5) { g.beginPath(); g.ellipse(x, y, 2 + r() * 4, 6 + r() * 12, r() * 6, 0, 6.28); g.fill(); }
      else { g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + r() * 50 - 25, y + r() * 50 - 25, x + r() * 70 - 35, y + r() * 70 - 35); g.stroke(); }
    }
    for (const [x, y, s] of [[w * 0.5, h * 0.2, 46], [w * 0.4, h * 0.45, 28], [w * 0.6, h * 0.45, 28]]) flower(g, x, y, s, 12, gold, '#b99047', 0);
    if (lizard) {
      g.globalAlpha = 1; g.fillStyle = '#2f5c8f';
      const x = w * 0.605, y = h * 0.52;
      g.beginPath(); g.ellipse(x, y, 7, 30, 0.1, 0, 6.28); g.fill();
      g.beginPath(); g.ellipse(x - 2, y - 36, 6, 8, 0, 0, 6.28); g.fill();
      g.lineWidth = 5; g.strokeStyle = '#2f5c8f';
      for (const [dx, dy] of [[-16, -16], [16, -16], [-15, 14], [15, 14]]) { g.beginPath(); g.moveTo(x, y + dy * .6); g.lineTo(x + dx, y + dy); g.stroke(); }
      g.beginPath(); g.moveTo(x, y + 28); g.quadraticCurveTo(x + 8, y + 48, x - 4, y + 60); g.stroke();
    }
    g.globalAlpha = 1;
  });
}

export function beads(rep = [1, 14]) {
  return canvasTex(64, 64, (g, w, h) => {
    g.fillStyle = '#2c3e8a'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 3; i++) {
      const x = 12 + i * 20;
      for (let y = 6; y < h; y += 14) {
        const gr = g.createRadialGradient(x - 3, y - 3, 1, x, y, 8);
        gr.addColorStop(0, '#a9c1ff'); gr.addColorStop(0.5, '#3b57c4'); gr.addColorStop(1, '#16225a');
        g.fillStyle = gr; g.beginPath(); g.arc(x, y, 7, 0, 6.28); g.fill();
      }
    }
    g.fillStyle = '#d6b45a'; for (let y = 10; y < h; y += 28) { g.beginPath(); g.arc(8, y + 7, 3, 0, 6.28); g.fill(); }
  }, { repeat: rep });
}

export function dragon(rep = [1, 1]) {
  return canvasTex(512, 512, (g, w, h) => {
    const r = rng(14);
    g.fillStyle = '#0a0a0b'; g.fillRect(0, 0, w, h);
    g.lineCap = 'round';
    for (let k = 0; k < 3; k++) {
      let x0 = 80 + k * 160;
      g.strokeStyle = k % 2 ? '#c8a24a' : '#5fa05b'; g.lineWidth = 9;
      g.beginPath(); g.moveTo(x0, 20);
      for (let y = 20; y < h; y += 30) g.lineTo(x0 + Math.sin(y * 0.03 + k) * 44, y + 30);
      g.stroke();
      g.fillStyle = g.strokeStyle;
      for (let y = 40; y < h; y += 14) { g.beginPath(); g.arc(x0 + Math.sin(y * 0.03 + k) * 44, y, 4 + r() * 2, 0, 6.28); g.fill(); }
    }
  }, { repeat: rep });
}

export function saddleRug() {
  return canvasTex(512, 512, (g, w, h) => {
    const r = rng(90);
    g.fillStyle = '#8a1f2a'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 6000; i++) { g.globalAlpha = .18; g.fillStyle = r() < .5 ? '#4e0f16' : '#c9505a'; g.fillRect(r() * w, r() * h, 2, 2); }
    g.globalAlpha = 1; g.strokeStyle = '#d2b36a'; g.lineWidth = 3; g.lineCap = 'round';
    g.strokeRect(24, 24, w - 48, h - 48); g.strokeRect(40, 40, w - 80, h - 80);
    for (let i = 0; i < 26; i++) {
      const x = 70 + r() * (w - 140), y = 70 + r() * (h - 140);
      g.beginPath(); g.moveTo(x, y); g.bezierCurveTo(x + 30, y - 40, x + 60, y + 20, x + 90, y - 20); g.stroke();
      flower(g, x + 40, y + 6, 18, 6, '#d2b36a', '#8a1f2a', r() * 3);
    }
    g.fillStyle = '#c4a073'; g.globalAlpha = .5;
    for (let i = 0; i < 40; i++) g.fillRect(r() * w, r() * h, 10 + r() * 30, 6 + r() * 14);
    g.globalAlpha = 1;
  });
}

export function furTex(base = '#c9d0e4', seed = 4) {
  return canvasTex(256, 256, (g, w, h) => {
    const r = rng(seed);
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 1400; i++) {
      g.globalAlpha = 0.18; g.strokeStyle = r() < .5 ? '#f4f6ff' : '#8e97b6'; g.lineWidth = 1 + r() * 1.5;
      const x = r() * w, y = r() * h; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - .5) * 6, y + 8 + r() * 24); g.stroke();
    }
    g.globalAlpha = 1;
  }, { repeat: [3, 3] });
}

export function skinWrinkle(base = '#cfc2b8', seed = 6) {
  return canvasTex(256, 256, (g, w, h) => {
    const r = rng(seed);
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 300; i++) { g.globalAlpha = .12; g.fillStyle = ['#8d5a4a', '#e4d6cc', '#a9877a'][Math.floor(r() * 3)]; g.beginPath(); g.arc(r() * w, r() * h, 2 + r() * 8, 0, 6.28); g.fill(); }
    g.globalAlpha = 0.25; g.strokeStyle = '#6a463a'; g.lineWidth = 1.2;
    for (let i = 0; i < 70; i++) { g.beginPath(); const x = r() * w, y = r() * h; g.moveTo(x, y); g.quadraticCurveTo(x + 14, y + 6, x + 30, y); g.stroke(); }
    g.globalAlpha = 1;
  });
}
