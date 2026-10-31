// Portreti vozača: nešto između vektora i karikature (velika glava, jednostavni oblici, obrub).
// Crta se u kvadrat 120 x 120 jedinica, pa skalira na traženu veličinu.

const INK = 'rgba(30, 24, 20, 0.85)';

const SHOULDERS = { skinny: 60, thin: 68, normal: 78, fit: 76, muscle: 90, sturdy: 86, big: 96, fat: 100 };

function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const f = (c) => Math.max(0, Math.min(255, Math.round(c * k)));
  return `rgb(${f(n >> 16)}, ${f((n >> 8) & 255)}, ${f(n & 255)})`;
}

function ellipse(ctx, x, y, rx, ry, fill, stroke = true) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) ctx.stroke();
}

export function drawPortrait(ctx, look, size, bg) {
  ctx.save();
  ctx.scale(size / 120, size / 120);
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = INK;

  if (bg) {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 120, 120);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.beginPath();
    ctx.arc(60, 52, 46, 0, Math.PI * 2);
    ctx.fill();
  }

  const neck = look.height === 'tall' ? 4 : look.height === 'short' ? -3 : 0;
  const hx = 60, hy = 50 - neck;
  let hw = 25;
  if (look.build === 'fat' || look.build === 'big') hw += 4;
  if (look.chubbyFace) hw += 5;
  if (look.gaunt || look.build === 'skinny') hw -= 3;
  const hh = 30;

  drawBody(ctx, look, hy + hh - 4);
  if (look.hair === 'long' || look.hair === 'ponytail') drawHairBack(ctx, look, hx, hy, hw, hh);

  // vrat i uši
  ctx.fillStyle = look.skin;
  ctx.beginPath();
  ctx.roundRect(hx - 9, hy + hh - 10, 18, 16, 4);
  ctx.fill();
  ctx.stroke();
  ellipse(ctx, hx - hw, hy + 2, 5, 7, look.skin);
  ellipse(ctx, hx + hw, hy + 2, 5, 7, look.skin);

  // glava
  ctx.beginPath();
  ctx.ellipse(hx, hy, hw, hh, 0, 0, Math.PI * 2);
  ctx.fillStyle = look.skin;
  ctx.fill();
  ctx.stroke();
  if (look.chubbyFace) {
    ctx.fillStyle = 'rgba(230, 120, 120, 0.25)';
    ctx.beginPath();
    ctx.arc(hx - hw + 9, hy + 12, 7, 0, Math.PI * 2);
    ctx.arc(hx + hw - 9, hy + 12, 7, 0, Math.PI * 2);
    ctx.fill();
  }
  if (look.gaunt) {
    ctx.strokeStyle = 'rgba(120, 80, 60, 0.45)';
    ctx.beginPath();
    ctx.moveTo(hx - hw + 7, hy + 4);
    ctx.quadraticCurveTo(hx - hw + 9, hy + 13, hx - hw + 12, hy + 18);
    ctx.moveTo(hx + hw - 7, hy + 4);
    ctx.quadraticCurveTo(hx + hw - 9, hy + 13, hx + hw - 12, hy + 18);
    ctx.stroke();
    ctx.strokeStyle = INK;
  }
  if (look.flush) {
    ctx.fillStyle = 'rgba(225, 70, 70, 0.35)';
    ctx.beginPath();
    ctx.arc(hx - 13, hy + 10, 6, 0, Math.PI * 2);
    ctx.arc(hx + 13, hy + 10, 6, 0, Math.PI * 2);
    ctx.fill();
  }
  if (look.beard === 'goatee') drawGoatee(ctx, look, hx, hy, hh);

  drawFace(ctx, look, hx, hy, hw);
  drawHair(ctx, look, hx, hy, hw, hh);
  if (look.glasses) drawGlasses(ctx, look.glasses, hx, hy);
  ctx.restore();
}

function drawBody(ctx, look, top) {
  const w = SHOULDERS[look.build] ?? 78;
  const shirt = look.allBlack ? '#141416' : look.shirt;
  if (look.sleeveless) {
    // gole ruke sa strane (za tetovaže)
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(60 + side * (w / 2 - 6), top + 8);
      ctx.quadraticCurveTo(60 + side * (w / 2 + 6), top + 20, 60 + side * (w / 2 + 4), 124);
      ctx.lineTo(60 + side * (w / 2 - 12), 124);
      ctx.closePath();
      ctx.fillStyle = look.skin;
      ctx.fill();
      ctx.stroke();
      if (look.tattoos) {
        ctx.save();
        ctx.strokeStyle = 'rgba(40, 60, 90, 0.85)';
        ctx.lineWidth = 1.6;
        const x = 60 + side * (w / 2 - 1);
        ctx.beginPath();
        ctx.moveTo(x - 4, top + 22);
        ctx.quadraticCurveTo(x + 4 * side, top + 27, x - 3, top + 32);
        ctx.quadraticCurveTo(x + 5 * side, top + 37, x - 2, top + 44);
        ctx.moveTo(x - 5, top + 48);
        ctx.lineTo(x + 3, top + 46);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x, top + 52, 3, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }
  }
  ctx.beginPath();
  const sw = look.sleeveless ? w - 14 : w;
  ctx.moveTo(60 - sw / 2, 124);
  ctx.quadraticCurveTo(60 - sw / 2, top + 4, 60 - 12, top);
  ctx.lineTo(60 + 12, top);
  ctx.quadraticCurveTo(60 + sw / 2, top + 4, 60 + sw / 2, 124);
  ctx.closePath();
  ctx.fillStyle = shirt;
  ctx.fill();
  ctx.stroke();
  if (look.build === 'fat') {
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.18)';
    ctx.beginPath();
    ctx.arc(60, 132, 30, Math.PI * 1.2, Math.PI * 1.8);
    ctx.stroke();
    ctx.strokeStyle = INK;
  }
  if (look.build === 'muscle' || look.build === 'fit') {
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.beginPath();
    ctx.moveTo(60, top + 14);
    ctx.lineTo(60, top + 26);
    ctx.stroke();
    ctx.strokeStyle = INK;
  }
  // ovratnik
  ctx.fillStyle = shade(shirt.startsWith('#') ? shirt : '#555555', 0.8);
  ctx.beginPath();
  ctx.moveTo(60 - 12, top);
  ctx.lineTo(60, top + 10);
  ctx.lineTo(60 + 12, top);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

function drawFace(ctx, look, hx, hy, hw) {
  const ey = hy - 1;
  const ex = 10;
  // obrve
  ctx.lineWidth = 2.4;
  ctx.strokeStyle = shade(look.hairColor, 0.8);
  ctx.beginPath();
  if (look.brow === 'raised') {
    ctx.moveTo(hx - ex - 6, ey - 10);
    ctx.lineTo(hx - ex + 5, ey - 9);
    ctx.moveTo(hx + ex - 5, ey - 12);
    ctx.quadraticCurveTo(hx + ex + 1, ey - 17, hx + ex + 7, ey - 13);
  } else {
    ctx.moveTo(hx - ex - 6, ey - 9);
    ctx.quadraticCurveTo(hx - ex, ey - 12, hx - ex + 6, ey - 10);
    ctx.moveTo(hx + ex - 6, ey - 10);
    ctx.quadraticCurveTo(hx + ex, ey - 12, hx + ex + 6, ey - 9);
  }
  ctx.stroke();
  ctx.lineWidth = 2;
  ctx.strokeStyle = INK;

  // oči
  for (const side of [-1, 1]) {
    const x = hx + side * ex;
    if (look.eyes === 'narrow') {
      ctx.beginPath();
      ctx.moveTo(x - 4.5, ey);
      ctx.quadraticCurveTo(x, ey - 2.5, x + 4.5, ey);
      ctx.stroke();
      ctx.fillStyle = '#2a201a';
      ctx.fillRect(x - 1.5, ey - 1.6, 3, 1.8);
    } else if (look.eyes === 'sleepy') {
      ellipse(ctx, x, ey, 5, 4, '#fff', false);
      ctx.fillStyle = '#2a201a';
      ctx.beginPath();
      ctx.arc(x + side * 0.5, ey + 1.2, 2.2, 0, Math.PI * 2);
      ctx.fill();
      // teški kapci
      ctx.fillStyle = look.skin;
      ctx.beginPath();
      ctx.ellipse(x, ey - 2.2, 5.6, 3.6, 0, Math.PI, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x - 5.4, ey - 0.6);
      ctx.lineTo(x + 5.4, ey - 0.6);
      ctx.stroke();
    } else {
      const r = look.eyes === 'wide' ? 5.6 : 4.4;
      ellipse(ctx, x, ey, r, r * (look.eyes === 'wide' ? 1 : 0.9), '#fff', false);
      ctx.fillStyle = '#2a201a';
      ctx.beginPath();
      ctx.arc(x + (look.eyes === 'wide' ? side * -1.2 : 0), ey + 0.5, look.eyes === 'wide' ? 2 : 2.4, 0, Math.PI * 2);
      ctx.fill();
      if (look.female) {
        ctx.beginPath();
        ctx.moveTo(x + side * 3.5, ey - 3.5);
        ctx.lineTo(x + side * 6, ey - 5.5);
        ctx.stroke();
      }
    }
  }

  // nos
  ctx.strokeStyle = 'rgba(140, 80, 60, 0.7)';
  ctx.beginPath();
  ctx.moveTo(hx, ey + 3);
  ctx.quadraticCurveTo(hx + 4, ey + 9, hx - 1, ey + 11);
  ctx.stroke();
  if (look.mouth === 'tipsy') {
    ctx.fillStyle = 'rgba(220, 70, 70, 0.55)';
    ctx.beginPath();
    ctx.arc(hx + 1, ey + 9.5, 3.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = INK;

  // usta
  const my = hy + 17;
  ctx.beginPath();
  switch (look.mouth) {
    case 'goofy':
      ctx.moveTo(hx - 9, my - 2);
      ctx.quadraticCurveTo(hx, my + 10, hx + 9, my - 2);
      ctx.closePath();
      ctx.fillStyle = '#6b2a2a';
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.fillRect(hx - 6, my - 1.5, 4, 3);
      ctx.fillRect(hx + 1, my - 1.5, 4, 3);
      ctx.fillStyle = '#e57b8a';
      ctx.beginPath();
      ctx.ellipse(hx + 2, my + 4, 3.5, 2, 0, 0, Math.PI * 2);
      ctx.fill();
      return;
    case 'tipsy':
      ctx.moveTo(hx - 8, my);
      ctx.quadraticCurveTo(hx - 4, my + 4, hx, my + 1);
      ctx.quadraticCurveTo(hx + 4, my - 2, hx + 9, my + 3);
      break;
    case 'smirk':
      ctx.moveTo(hx - 7, my + 1);
      ctx.quadraticCurveTo(hx + 2, my + 3, hx + 9, my - 3);
      break;
    case 'odd':
      ctx.moveTo(hx - 7, my + 2);
      ctx.lineTo(hx - 2, my - 1);
      ctx.lineTo(hx + 3, my + 2);
      ctx.lineTo(hx + 7, my - 1);
      break;
    default:
      ctx.moveTo(hx - 8, my);
      ctx.quadraticCurveTo(hx, my + 6, hx + 8, my);
  }
  if (look.female) {
    ctx.strokeStyle = '#b5485f';
    ctx.lineWidth = 2.6;
  }
  ctx.stroke();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
}

function drawGoatee(ctx, look, hx, hy, hh) {
  ctx.fillStyle = look.hairColor;
  ctx.beginPath();
  ctx.moveTo(hx - 10, hy + 15);
  ctx.quadraticCurveTo(hx, hy + 11, hx + 10, hy + 15);
  ctx.quadraticCurveTo(hx + 8, hy + hh + 3, hx, hy + hh + 4);
  ctx.quadraticCurveTo(hx - 8, hy + hh + 3, hx - 10, hy + 15);
  ctx.fill();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
  ctx.beginPath();
  ctx.ellipse(hx, hy + 9, 13, 5, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawGlasses(ctx, kind, hx, hy) {
  const ey = hy - 1;
  ctx.lineWidth = 2.4;
  ctx.strokeStyle = '#1b1b1f';
  ctx.fillStyle = 'rgba(200, 225, 240, 0.25)';
  for (const side of [-1, 1]) {
    ctx.beginPath();
    if (kind === 'square') ctx.roundRect(hx + side * 10 - 8, ey - 6, 16, 12, 2);
    else ctx.arc(hx + side * 10, ey, 7.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(hx - 2.5, ey - 1);
  ctx.lineTo(hx + 2.5, ey - 1);
  ctx.stroke();
  ctx.lineWidth = 2;
  ctx.strokeStyle = INK;
}

function drawHairBack(ctx, look, hx, hy, hw, hh) {
  ctx.fillStyle = look.hairColor;
  ctx.beginPath();
  if (look.hair === 'long') {
    ctx.moveTo(hx - hw - 4, hy - 6);
    ctx.quadraticCurveTo(hx - hw - 10, hy + 30, hx - hw - 2, hy + 48);
    ctx.lineTo(hx + hw + 2, hy + 48);
    ctx.quadraticCurveTo(hx + hw + 10, hy + 30, hx + hw + 4, hy - 6);
  } else {
    // rep iza glave, vidi se s desne strane
    ctx.moveTo(hx + hw - 4, hy - 16);
    ctx.quadraticCurveTo(hx + hw + 22, hy - 10, hx + hw + 12, hy + 30);
    ctx.quadraticCurveTo(hx + hw + 4, hy + 10, hx + hw - 2, hy - 2);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

function drawHair(ctx, look, hx, hy, hw, hh) {
  const c = look.hairColor;
  ctx.fillStyle = c;
  const top = hy - hh;
  switch (look.hair) {
    case 'buzz': {
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(hx, hy, hw, hh, 0, 0, Math.PI * 2);
      ctx.clip();
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.ellipse(hx, top + 6, hw + 2, 15, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.beginPath();
      ctx.ellipse(hx, hy, hw, hh, 0, Math.PI * 1.08, Math.PI * 1.92);
      ctx.stroke();
      break;
    }
    case 'curly': {
      for (let i = 0; i < 11; i++) {
        const a = Math.PI * (1.02 + (i / 10) * 0.96);
        const x = hx + Math.cos(a) * (hw + 1), y = hy + Math.sin(a) * (hh - 2);
        ellipse(ctx, x, y, 7.5, 7, c);
      }
      ellipse(ctx, hx - 7, top + 6, 9, 7, c);
      ellipse(ctx, hx + 7, top + 5, 9, 7, c);
      ellipse(ctx, hx, top + 9, 8, 6, c);
      break;
    }
    case 'receding': {
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(hx + side * (hw + 1), hy + 4);
        ctx.quadraticCurveTo(hx + side * (hw + 4), hy - 14, hx + side * (hw - 8), top + 8);
        ctx.quadraticCurveTo(hx + side * (hw - 6), hy - 6, hx + side * (hw - 3), hy + 4);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      // par vlasi na vrhu
      ctx.beginPath();
      ctx.moveTo(hx - 4, top + 2);
      ctx.quadraticCurveTo(hx, top - 4, hx + 3, top + 2);
      ctx.moveTo(hx + 1, top + 1);
      ctx.quadraticCurveTo(hx + 5, top - 4, hx + 8, top + 3);
      ctx.strokeStyle = c;
      ctx.stroke();
      ctx.strokeStyle = INK;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.beginPath();
      ctx.ellipse(hx - 6, top + 9, 7, 3.5, -0.3, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'baldTop': {
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(hx + side * (hw + 1), hy + 6);
        ctx.quadraticCurveTo(hx + side * (hw + 3), hy - 10, hx + side * (hw - 4), hy - 16);
        ctx.quadraticCurveTo(hx + side * (hw - 3), hy - 4, hx + side * (hw - 2), hy + 6);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.beginPath();
      ctx.ellipse(hx - 7, top + 8, 9, 4, -0.3, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'sidepart':
    case 'sidepartGel': {
      // fade sa strane
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(hx, hy, hw, hh, 0, 0, Math.PI * 2);
      ctx.clip();
      ctx.globalAlpha = 0.45;
      ctx.fillRect(hx - hw - 2, top, hw * 2 + 4, hh * 0.8);
      ctx.restore();
      ctx.beginPath();
      ctx.moveTo(hx - hw - 1, hy - 6);
      ctx.quadraticCurveTo(hx - hw - 2, top - 6, hx + 2, top - 6);
      ctx.quadraticCurveTo(hx + hw + 8, top - 4, hx + hw + 2, hy - 8);
      ctx.quadraticCurveTo(hx + 6, top + 4, hx - 8, top + 8);
      ctx.quadraticCurveTo(hx - hw + 2, top + 12, hx - hw - 1, hy - 6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = look.hair === 'sidepartGel' ? 'rgba(255, 255, 255, 0.45)' : 'rgba(255, 255, 255, 0.25)';
      ctx.beginPath();
      ctx.moveTo(hx - 8, top - 1);
      ctx.quadraticCurveTo(hx + 6, top - 5, hx + hw - 2, top + 4);
      ctx.moveTo(hx - 4, top + 3);
      ctx.quadraticCurveTo(hx + 8, top, hx + hw, top + 9);
      ctx.stroke();
      ctx.strokeStyle = INK;
      break;
    }
    case 'gelled': {
      ctx.beginPath();
      ctx.moveTo(hx - hw - 1, hy - 4);
      ctx.quadraticCurveTo(hx - hw - 4, top - 10, hx, top - 9);
      ctx.quadraticCurveTo(hx + hw + 4, top - 10, hx + hw + 1, hy - 4);
      ctx.quadraticCurveTo(hx + hw - 4, top + 8, hx, top + 7);
      ctx.quadraticCurveTo(hx - hw + 4, top + 8, hx - hw - 1, hy - 4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      for (const dx of [-10, -2, 6]) {
        ctx.beginPath();
        ctx.moveTo(hx + dx, top + 4);
        ctx.quadraticCurveTo(hx + dx + 2, top - 4, hx + dx + 8, top - 7);
        ctx.stroke();
      }
      ctx.strokeStyle = INK;
      break;
    }
    case 'short': {
      ctx.beginPath();
      ctx.moveTo(hx - hw, hy - 4);
      ctx.quadraticCurveTo(hx - hw - 1, top - 3, hx, top - 3);
      ctx.quadraticCurveTo(hx + hw + 1, top - 3, hx + hw, hy - 4);
      ctx.quadraticCurveTo(hx + hw - 6, top + 9, hx, top + 8);
      ctx.quadraticCurveTo(hx - hw + 6, top + 9, hx - hw, hy - 4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
    }
    case 'ponytail':
    case 'long': {
      ctx.beginPath();
      ctx.moveTo(hx - hw - 2, hy + (look.hair === 'long' ? 10 : -2));
      ctx.quadraticCurveTo(hx - hw - 3, top - 5, hx, top - 5);
      ctx.quadraticCurveTo(hx + hw + 3, top - 5, hx + hw + 2, hy + (look.hair === 'long' ? 10 : -2));
      ctx.quadraticCurveTo(hx + hw - 4, top + 6, hx + 4, top + 9);
      ctx.quadraticCurveTo(hx - 6, top + 12, hx - hw + 2, hy - 2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      if (look.hair === 'ponytail') {
        ctx.fillStyle = '#d94f6e';
        ctx.beginPath();
        ctx.arc(hx + hw + 1, hy - 14, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 'bob': {
      ctx.beginPath();
      ctx.moveTo(hx - hw - 4, hy + 14);
      ctx.quadraticCurveTo(hx - hw - 6, top - 6, hx, top - 6);
      ctx.quadraticCurveTo(hx + hw + 6, top - 6, hx + hw + 4, hy + 14);
      ctx.lineTo(hx + hw - 3, hy + 14);
      ctx.quadraticCurveTo(hx + hw - 2, top + 10, hx - 4, top + 9);
      ctx.quadraticCurveTo(hx - hw + 1, top + 14, hx - hw + 3, hy + 14);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
    }
    case 'bowl': {
      ctx.beginPath();
      ctx.moveTo(hx - hw - 3, hy - 2);
      ctx.quadraticCurveTo(hx - hw - 5, top - 8, hx, top - 8);
      ctx.quadraticCurveTo(hx + hw + 5, top - 8, hx + hw + 3, hy - 2);
      ctx.lineTo(hx - hw - 3, hy - 2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      for (let x = hx - hw + 2; x < hx + hw; x += 5) {
        ctx.beginPath();
        ctx.moveTo(x, hy - 3);
        ctx.lineTo(x + 1, hy - 9);
        ctx.stroke();
      }
      ctx.strokeStyle = INK;
      break;
    }
  }
}
