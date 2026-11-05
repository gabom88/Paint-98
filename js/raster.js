// raster.js — dibujo "pixelado" (sin antialias), como el Paint clásico.
// Todo se dibuja con fillRect en coordenadas enteras, así queda nítido.

// ---------- Pinceles (listas de tramos [dx, dy, largo]) ----------
export function circleSpans(d) {
  if (d <= 1) return [[0, 0, 1]];
  const r = d / 2, off = Math.floor(d / 2), out = [];
  for (let j = 0; j < d; j++) {
    const yc = j + 0.5 - r;
    const half = Math.sqrt(Math.max(0, r * r - yc * yc));
    const xs = Math.round(r - half), xe = Math.round(r + half);
    if (xe > xs) out.push([xs - off, j - off, xe - xs]);
  }
  return out;
}
export function squareSpans(d) {
  const off = Math.floor(d / 2), out = [];
  for (let j = 0; j < d; j++) out.push([-off, j - off, d]);
  return out;
}
export function diagSpans(d, dir) { // dir 1 = "/", -1 = "\"
  const off = Math.floor(d / 2), out = [];
  // 2 px de ancho para que al arrastrar en horizontal no queden rayas
  const w = d >= 3 ? 2 : 1;
  for (let i = 0; i < d; i++) out.push([i - off, dir > 0 ? off - i : i - off, w]);
  return out;
}

export function stamp(ctx, x, y, spans) {
  for (const s of spans) ctx.fillRect(x + s[0], y + s[1], s[2], 1);
}

// Bresenham: estampa el pincel en cada píxel del segmento.
export function line(ctx, x0, y0, x1, y1, spans, skipFirst = false) {
  x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0;
  const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
  const dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
  let err = dx + dy, first = true;
  for (;;) {
    if (!(first && skipFirst)) stamp(ctx, x0, y0, spans);
    first = false;
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}

export function linePoints(x0, y0, x1, y1) {
  const pts = [];
  x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0;
  const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
  const dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    pts.push(x0, y0);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
  return pts;
}

// ---------- Figuras (rectángulo, elipse, rect. redondeado) ----------
// Caja en píxeles [L, R) x [T, B). Devuelve el tramo [a, b) de la fila y.
function outerSpan(kind, L, T, R, B, rad, y) {
  if (y < T || y >= B) return null;
  if (kind === "rect") return [L, R];
  const yc = y + 0.5;
  if (kind === "ellipse") {
    const cx = (L + R) / 2, cy = (T + B) / 2, rx = (R - L) / 2, ry = (B - T) / 2;
    const d = (yc - cy) / ry;
    if (Math.abs(d) > 1) return null;
    const half = rx * Math.sqrt(1 - d * d);
    const a = Math.round(cx - half), b = Math.round(cx + half);
    return b > a ? [a, b] : [Math.floor(cx), Math.floor(cx) + 1];
  }
  // rrect
  const r = Math.min(rad, (R - L) / 2, (B - T) / 2);
  let inset = 0;
  if (yc < T + r) { const d = T + r - yc; inset = r - Math.sqrt(Math.max(0, r * r - d * d)); }
  else if (yc > B - r) { const d = yc - (B - r); inset = r - Math.sqrt(Math.max(0, r * r - d * d)); }
  const a = Math.round(L + inset), b = Math.round(R - inset);
  return b > a ? [a, b] : null;
}

// mode: 0 = contorno, 1 = contorno + relleno, 2 = solo relleno
export function shape(ctx, kind, x0, y0, x1, y1, w, mode, outline, fill) {
  const L = Math.min(x0, x1), R = Math.max(x0, x1) + 1;
  const T = Math.min(y0, y1), B = Math.max(y0, y1) + 1;
  const rad = 8 + (mode === 2 ? 0 : w); // esquina interior siempre redondeada
  const rows = [];
  for (let y = T; y < B; y++) rows.push(outerSpan(kind, L, T, R, B, rad, y));
  const get = (y) => (y < T || y >= B ? null : rows[y - T]);
  for (let y = T; y < B; y++) {
    const o = get(y);
    if (!o) continue;
    if (mode === 2) { ink(ctx, outline); ctx.fillRect(o[0], y, o[1] - o[0], 1); continue; }
    let a, b, ok = true;
    if (w >= 2 && kind !== "rect") {
      // Interior = la misma figura, más chica por w en todo su contorno:
      // así el grueso es parejo (sin partes planas ni más gruesas).
      const s = outerSpan(kind, L + w, T + w, R - w, B - w, Math.max(0, rad - w), y);
      if (!s || R - L <= 2 * w || B - T <= 2 * w) ok = false; else { a = s[0]; b = s[1]; }
    } else {
      // Grueso 1 (o rectángulo): erosión por filas vecinas, sin huecos
      a = o[0]; b = o[1];
      for (let j = y - w; j <= y + w && ok; j++) {
        const s = get(j);
        if (!s) ok = false; else { a = Math.max(a, s[0]); b = Math.min(b, s[1]); }
      }
      a += w; b -= w;
    }
    if (!ok || b <= a) { ink(ctx, outline); ctx.fillRect(o[0], y, o[1] - o[0], 1); continue; }
    ink(ctx, outline);
    ctx.fillRect(o[0], y, a - o[0], 1);
    ctx.fillRect(b, y, o[1] - b, 1);
    if (mode === 1) { ink(ctx, fill); ctx.fillRect(a, y, b - a, 1); }
  }
  ctx.globalCompositeOperation = "source-over";
}

// ---------- Polígonos ----------
export function polyFill(ctx, pts, ox = 0, oy = 0) { // pts = [[x,y],...] en índices de píxel
  if (pts.length < 3) return;
  let minY = Infinity, maxY = -Infinity;
  for (const p of pts) { minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]); }
  for (let y = Math.ceil(minY); y <= Math.floor(maxY); y++) {
    const xs = [];
    for (let i = 0, n = pts.length; i < n; i++) {
      const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % n];
      if ((ay <= y && by > y) || (by <= y && ay > y)) xs.push(ax + ((y - ay) / (by - ay)) * (bx - ax));
    }
    xs.sort((p, q) => p - q);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const a = Math.ceil(xs[k] - 0.0001), b = Math.floor(xs[k + 1] + 0.0001) + 1;
      if (b > a) ctx.fillRect(a + ox, y + oy, b - a, 1);
    }
  }
}

export function polyline(ctx, pts, spans, closed) {
  for (let i = 0; i + 1 < pts.length; i++) line(ctx, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], spans);
  if (closed && pts.length > 2) { const a = pts[pts.length - 1], b = pts[0]; line(ctx, a[0], a[1], b[0], b[1], spans); }
  if (pts.length === 1) stamp(ctx, pts[0][0], pts[0][1], spans);
}

export function bezier(p0, c1, c2, p3) {
  const len = Math.hypot(c1[0] - p0[0], c1[1] - p0[1]) + Math.hypot(c2[0] - c1[0], c2[1] - c1[1]) + Math.hypot(p3[0] - c2[0], p3[1] - c2[1]);
  const n = Math.max(2, Math.ceil(len / 3));
  const out = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t;
    const x = u * u * u * p0[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * p3[0];
    const y = u * u * u * p0[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * p3[1];
    out.push([Math.round(x), Math.round(y)]);
  }
  return out;
}

// ---------- Relleno (bote de pintura): coincidencia exacta ----------
export function floodFill(img, x, y, rgba) {
  const w = img.width, h = img.height;
  if (x < 0 || y < 0 || x >= w || y >= h) return false;
  const px = new Uint32Array(img.data.buffer);
  const target = px[y * w + x];
  const fill = ((rgba[3] << 24) | (rgba[2] << 16) | (rgba[1] << 8) | rgba[0]) >>> 0;
  if (target === fill) return false;
  const stack = [x, y];
  while (stack.length) {
    const sy = stack.pop(), sx = stack.pop();
    const row = sy * w;
    if (px[row + sx] !== target) continue;
    let x1 = sx;
    while (x1 > 0 && px[row + x1 - 1] === target) x1--;
    let up = false, down = false;
    for (let xx = x1; xx < w && px[row + xx] === target; xx++) {
      px[row + xx] = fill;
      if (sy > 0) {
        const t = px[row - w + xx] === target;
        if (t && !up) { stack.push(xx, sy - 1); up = true; } else if (!t) up = false;
      }
      if (sy < h - 1) {
        const t = px[row + w + xx] === target;
        if (t && !down) { stack.push(xx, sy + 1); down = true; } else if (!t) down = false;
      }
    }
  }
  return true;
}

// ---------- Colores ----------
// "transparent" = color transparente: en el lienzo borra (alfa 0);
// en la vista previa (ctx._preview) se pinta con cuadrícula.
let checker = null;
export function checkerPattern(ctx) {
  if (!checker) {
    checker = document.createElement("canvas"); checker.width = checker.height = 8;
    const c = checker.getContext("2d");
    c.fillStyle = "#ffffff"; c.fillRect(0, 0, 8, 8);
    c.fillStyle = "#c0c0c0"; c.fillRect(0, 0, 4, 4); c.fillRect(4, 4, 4, 4);
  }
  return ctx.createPattern(checker, "repeat");
}
export function ink(ctx, color) {
  if (color === "transparent") {
    if (ctx._preview) { ctx.globalCompositeOperation = "source-over"; ctx.fillStyle = checkerPattern(ctx); }
    else { ctx.globalCompositeOperation = "destination-out"; ctx.fillStyle = "#000"; }
  } else { ctx.globalCompositeOperation = "source-over"; ctx.fillStyle = color; }
}
export function hexToRgb(hex) {
  if (hex === "transparent") return [0, 0, 0, 0];
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255];
}
export function rgbToHex(r, g, b, a = 255) {
  if (a === 0) return "transparent";
  return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
}
