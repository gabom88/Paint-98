// app.js — Paint 98: interfaz, herramientas, menús y archivos.
import * as R from "./raster.js";
import { icon, iconImg } from "./icons.js";

const $ = (id) => document.getElementById(id);
const cv = $("cv"), ctx = cv.getContext("2d", { willReadFrequently: true });
const ov = $("ov"), octx = ov.getContext("2d");
octx._preview = true;
const selcv = $("selcv"), sctx = selcv.getContext("2d");
const ws = $("workspace"), stage = $("stage"), selbox = $("selbox"), textedit = $("textedit");
const COARSE = matchMedia("(pointer: coarse), (max-width: 700px)").matches;
const OS = COARSE ? 2 : 1; // escala de los dibujitos de opciones

const DEFAULT_PALETTE = [
  "#000000", "#808080", "#800000", "#808000", "#008000", "#008080", "#000080", "#800080", "#808040", "#004040", "#0080ff", "#004080", "#8000ff", "#804000",
  "#ffffff", "#c0c0c0", "#ff0000", "#ffff00", "#00ff00", "#00ffff", "#0000ff", "#ff00ff", "#ffff80", "#00ff80", "#80ffff", "#8080ff", "#ff0080", "#ff8040",
];
const HELP_MSG = "Para obtener Ayuda, haga clic en Temas de Ayuda en el menú Ayuda.";
const TOOLS = [
  ["freesel", "Selección de forma libre", "Selecciona un área de forma libre de la imagen para moverla, copiarla o modificarla."],
  ["select", "Selección", "Selecciona un área rectangular de la imagen para moverla, copiarla o modificarla."],
  ["eraser", "Borrador/Borrador de color", "Borra una parte de la imagen usando el color de fondo seleccionado."],
  ["fill", "Relleno con color", "Rellena un área con el color de dibujo actual."],
  ["picker", "Seleccionar color", "Toma un color de la imagen para dibujar."],
  ["zoom", "Ampliación", "Cambia la ampliación."],
  ["pencil", "Lápiz", "Dibuja una línea a mano alzada de un píxel de ancho."],
  ["brush", "Pincel", "Dibuja con un pincel de la forma y el tamaño seleccionados."],
  ["airbrush", "Aerógrafo", "Dibuja con un aerógrafo del tamaño seleccionado."],
  ["text", "Texto", "Inserta texto en la imagen."],
  ["line", "Línea", "Dibuja una línea recta con el ancho de línea seleccionado."],
  ["curve", "Curva", "Dibuja una línea curva con el ancho de línea seleccionado."],
  ["rect", "Rectángulo", "Dibuja un rectángulo con el estilo de relleno seleccionado."],
  ["poly", "Polígono", "Dibuja un polígono con el estilo de relleno seleccionado."],
  ["ellipse", "Elipse", "Dibuja una elipse con el estilo de relleno seleccionado."],
  ["rrect", "Rectángulo redondeado", "Dibuja un rectángulo redondeado con el estilo de relleno seleccionado."],
];
const TOOLMAP = Object.fromEntries(TOOLS.map((t) => [t[0], t]));
const WIDTHS = [1, 2, 3, 4, 5, 6, 8, 10, 12, 14, 16, 20, 24, 32, 40, 48]; // lápiz, líneas, curvas y figuras
const BRUSH_SHAPES = ["c", "s", "/", "\\"];         // redondo, cuadrado, diagonales
const BRUSH_SIZES = [1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24, 32, 40, 48, 64];
const ERASERS = [2, 4, 6, 8, 10, 12, 16, 20, 24, 32, 40, 48, 64, 80, 100, 128];
const AIRS = [4, 6, 8, 10, 12, 16, 20, 24, 32, 40, 48, 64];
const THEMES = [["std", "Estándar"], ["desert", "Desierto"], ["eggplant", "Berenjena"], ["lilac", "Lila"], ["brick", "Ladrillo"]];
const SIZE_KEYS = { pencil: ["pencil", WIDTHS], brush: ["brush", BRUSH_SIZES], eraser: ["eraser", ERASERS], airbrush: ["air", AIRS],
  line: ["line", WIDTHS], curve: ["line", WIDTHS], rect: ["line", WIDTHS], poly: ["line", WIDTHS], ellipse: ["line", WIDTHS], rrect: ["line", WIDTHS] };
const ZOOMS = [1, 2, 6, 8];
const ZOOM_STEPS = [1, 2, 3, 4, 6, 8];
const SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 36, 48, 72];
const UNDO_LIMIT = 12;

// ---------- Estado ----------
const S = {
  tool: "pencil", prevTool: "pencil",
  primary: "#000000", secondary: "#ffffff", palette: DEFAULT_PALETTE.slice(), palIdx: 0,
  zoom: 1, grid: false, transparent: false,
  opts: { v: 3, pencil: 0, brush: 4, brushShape: 0, eraser: 3, air: 0, line: 0, fill: 0, zoom: 2 },
  theme: "std", dock: "bottom", custom: Array(16).fill("#ffffff"),
  showTools: true, showColors: true, showStatus: true, showFont: true,
  font: { family: "Arial", size: 16, bold: false, italic: false, underline: false },
  fileName: "sin título", dirty: false,
};
try {
  const saved = JSON.parse(localStorage.getItem("paint98.settings") || "{}");
  for (const k of ["tool", "primary", "secondary", "palette", "grid", "transparent", "showTools", "showColors", "showStatus", "showFont", "fileName", "theme", "dock", "custom"]) if (k in saved) S[k] = saved[k];
  if (!THEMES.some((t) => t[0] === S.theme)) S.theme = "std";
  if (!["bottom", "top", "left"].includes(S.dock)) S.dock = "bottom";
  if (!Array.isArray(S.custom) || S.custom.length !== 16) S.custom = Array(16).fill("#ffffff");
  if (saved.opts) {
    if (saved.opts.brushShape == null && saved.opts.brush != null) saved.opts.brushShape = Math.floor(saved.opts.brush / 3);
    if (saved.opts.v !== 3) for (const k of ["pencil", "brush", "eraser", "air", "line", "v"]) delete saved.opts[k]; // listas de tamaños nuevas
    Object.assign(S.opts, saved.opts);
  }
  const lim = { pencil: WIDTHS, line: WIDTHS, brush: BRUSH_SIZES, brushShape: BRUSH_SHAPES, eraser: ERASERS, air: AIRS };
  for (const k in lim) if (!(S.opts[k] >= 0 && S.opts[k] < lim[k].length)) S.opts[k] = 0;
  if (saved.font) Object.assign(S.font, saved.font);
  if (!Array.isArray(S.palette) || S.palette.length !== 28) S.palette = DEFAULT_PALETTE.slice();
  if (!TOOLMAP[S.tool] || S.tool === "picker" || S.tool === "zoom") S.tool = "pencil";
} catch {}
function saveSettings() {
  try {
    const { tool, primary, secondary, palette, grid, transparent, showTools, showColors, showStatus, showFont, fileName, opts, font, theme, dock, custom } = S;
    localStorage.setItem("paint98.settings", JSON.stringify({ tool, primary, secondary, palette, grid, transparent, showTools, showColors, showStatus, showFont, fileName, opts, font, theme, dock, custom }));
  } catch {}
}

let sel = null;   // selección {x,y,w,h, src, poly, floating}
let tb = null;    // caja de texto {x,y,w,h}
let curve = null; // curva en curso
let poly = null;  // polígono en curso
let op = null;    // operación de puntero en curso
let clip = null;  // portapapeles interno (canvas)
const undo = [], redo = [];

// ---------- Utilidades ----------
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
function newCanvas(w, h) { const c = document.createElement("canvas"); c.width = Math.max(1, w); c.height = Math.max(1, h); return c; }
function copyCanvas(src) { const c = newCanvas(src.width, src.height); c.getContext("2d").drawImage(src, 0, 0); return c; }
function lineW() { return WIDTHS[S.opts.line]; }
function pencilSpans() { const w = WIDTHS[S.opts.pencil]; return w === 1 ? [[0, 0, 1]] : R.circleSpans(w); }
function brushSpans() {
  const k = BRUSH_SHAPES[S.opts.brushShape], d = BRUSH_SIZES[S.opts.brush];
  return k === "c" ? R.circleSpans(d) : k === "s" ? R.squareSpans(d) : R.diagSpans(d, k === "/" ? 1 : -1);
}
function status(msg) { $("stMsg").textContent = msg || HELP_MSG; }
function setPos(p) { $("stPos").textContent = p ? `${p.x},${p.y}` : ""; }
function setSize(w, h) { $("stSize").textContent = w != null ? `${w}x${h}` : ""; }

// ---------- Deshacer ----------
function snap() { return ctx.getImageData(0, 0, cv.width, cv.height); }
function pushUndo() {
  undo.push(snap());
  if (undo.length > UNDO_LIMIT) undo.shift();
  redo.length = 0;
  markDirty();
}
function restore(img) {
  if (img.width !== cv.width || img.height !== cv.height) setCanvasSize(img.width, img.height, false);
  ctx.putImageData(img, 0, 0);
}
function doUndo() {
  if (tb) { cancelText(); return; }
  if (curve || poly) { curve = poly = null; clearOv(); return; }
  if (sel) { if (sel.floating) commitSel(); else { sel = null; renderSel(); } }
  if (!undo.length) return;
  redo.push(snap());
  restore(undo.pop());
  markDirty();
}
function doRedo() {
  commitAll();
  if (!redo.length) return;
  undo.push(snap());
  restore(redo.pop());
  markDirty();
}

// ---------- Lienzo ----------
function setCanvasSize(w, h, keep = true, fill = S.secondary) {
  w = clamp(Math.round(w), 1, 8000); h = clamp(Math.round(h), 1, 8000);
  const old = keep ? copyCanvas(cv) : null;
  cv.width = w; cv.height = h; ov.width = w; ov.height = h;
  R.ink(ctx, fill); ctx.fillRect(0, 0, w, h); R.ink(ctx, "#000");
  if (old) ctx.drawImage(old, 0, 0);
  layout();
}
function layout() {
  const z = S.zoom, W = cv.width * z, H = cv.height * z;
  for (const c of [cv, ov]) { c.style.width = W + "px"; c.style.height = H + "px"; }
  const g = $("grid");
  g.hidden = !(S.grid && z >= 4);
  g.style.width = W + "px"; g.style.height = H + "px"; g.style.backgroundSize = `${z}px ${z}px`;
  const [e, s, se] = stage.querySelectorAll(".ch");
  e.style.left = W + 1 + "px"; e.style.top = Math.round(H / 2) - 2 + "px";
  s.style.left = Math.round(W / 2) - 2 + "px"; s.style.top = H + 1 + "px";
  se.style.left = W + 1 + "px"; se.style.top = H + 1 + "px";
  renderSel(true);
  positionText();
  stage.className = "stage t-" + S.tool;
}
function setZoom(z, center) {
  const cx = center ? center.x : (ws.scrollLeft + ws.clientWidth / 2) / S.zoom;
  const cy = center ? center.y : (ws.scrollTop + ws.clientHeight / 2) / S.zoom;
  S.zoom = z;
  layout();
  ws.scrollLeft = cx * z - ws.clientWidth / 2;
  ws.scrollTop = cy * z - ws.clientHeight / 2;
  renderOptions();
}
function clearOv() { octx.clearRect(0, 0, ov.width, ov.height); }
function pt(e) {
  const r = cv.getBoundingClientRect();
  return { x: Math.floor((e.clientX - r.left) / S.zoom), y: Math.floor((e.clientY - r.top) / S.zoom) };
}
function visibleOrigin() {
  return { x: clamp(Math.floor(ws.scrollLeft / S.zoom), 0, cv.width - 1), y: clamp(Math.floor(ws.scrollTop / S.zoom), 0, cv.height - 1) };
}

// ---------- Guardado automático (IndexedDB) ----------
const idb = (() => {
  let p;
  const open = () => (p ||= new Promise((res, rej) => {
    const r = indexedDB.open("paint98", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("kv");
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  }));
  const tx = (mode, fn) => open().then((db) => new Promise((res, rej) => {
    const t = db.transaction("kv", mode); const q = fn(t.objectStore("kv"));
    t.oncomplete = () => res(q && q.result); t.onerror = () => rej(t.error);
  }));
  return { get: (k) => tx("readonly", (s) => s.get(k)), set: (k, v) => tx("readwrite", (s) => s.put(v, k)) };
})();
let saveTimer = 0;
function markDirty() { S.dirty = true; clearTimeout(saveTimer); saveTimer = setTimeout(autosave, 700); }
function autosave() {
  const c = copyCanvas(cv);
  if (sel && sel.floating) c.getContext("2d").drawImage(selcv, sel.x, sel.y);
  c.toBlob((b) => { if (b) idb.set("image", { blob: b, dirty: S.dirty }).catch(() => {}); }, "image/png");
  saveSettings();
}

// ---------- Selección ----------
function showRect(x, y, w, h, drawing) {
  const z = S.zoom;
  selbox.hidden = false;
  selbox.classList.toggle("drawing", !!drawing);
  Object.assign(selbox.style, { left: x * z + "px", top: y * z + "px", width: Math.max(1, w) * z + "px", height: Math.max(1, h) * z + "px" });
  for (const h of selbox.querySelectorAll(".sh")) h.hidden = !!drawing;
  selcv.hidden = true;
}
let selDirty = true;
function renderSel(full) {
  if (!sel) { selbox.hidden = true; setSize(); return; }
  showRect(sel.x, sel.y, sel.w, sel.h, false);
  if (sel.floating) {
    selcv.hidden = false;
    if (full || selDirty) {
      selcv.width = sel.w; selcv.height = sel.h;
      sctx.imageSmoothingEnabled = false;
      sctx.clearRect(0, 0, sel.w, sel.h);
      sctx.drawImage(sel.src, 0, 0, sel.w, sel.h);
      if (S.transparent) {
        const img = sctx.getImageData(0, 0, sel.w, sel.h), d = img.data, [r, g, b] = R.hexToRgb(S.secondary === "transparent" ? "#ffffff" : S.secondary);
        for (let i = 0; i < d.length; i += 4) if (d[i] === r && d[i + 1] === g && d[i + 2] === b) d[i + 3] = 0;
        sctx.putImageData(img, 0, 0);
      }
      selDirty = false;
    }
  }
  setSize(sel.w, sel.h);
}
function maskCanvas(polyPts, w, h) {
  const m = newCanvas(w, h), mc = m.getContext("2d");
  mc.fillStyle = "#000"; R.polyFill(mc, polyPts);
  return m;
}
function selPixels() { // canvas con el contenido de la selección (sin levantarla)
  if (sel.floating) return copyCanvas(selcv);
  const c = newCanvas(sel.w, sel.h), cc = c.getContext("2d");
  cc.drawImage(cv, sel.x, sel.y, sel.w, sel.h, 0, 0, sel.w, sel.h);
  if (sel.poly) { cc.globalCompositeOperation = "destination-in"; cc.drawImage(maskCanvas(sel.poly, sel.w, sel.h), 0, 0); }
  return c;
}
function liftSel() {
  if (!sel || sel.floating) return;
  pushUndo();
  sel.src = selPixels();
  R.ink(ctx, S.secondary);
  if (sel.poly) R.polyFill(ctx, sel.poly, sel.x, sel.y); else ctx.fillRect(sel.x, sel.y, sel.w, sel.h);
  R.ink(ctx, "#000");
  sel.floating = true;
  selDirty = true;
  renderSel(true);
}
function stampSel() { if (sel && sel.floating) { ctx.drawImage(selcv, sel.x, sel.y); markDirty(); } }
function commitSel() {
  if (!sel) return;
  if (sel.floating) stampSel();
  sel = null;
  renderSel();
}
function commitAll() { commitText(); finishCurve(); finishPoly(); commitSel(); }
function selectAll() {
  commitAll();
  setTool("select");
  sel = { x: 0, y: 0, w: cv.width, h: cv.height, floating: false };
  renderSel(true);
}
function deleteSel() {
  if (!sel) return;
  if (sel.floating) { sel = null; renderSel(); markDirty(); return; }
  pushUndo();
  R.ink(ctx, S.secondary);
  if (sel.poly) R.polyFill(ctx, sel.poly, sel.x, sel.y); else ctx.fillRect(sel.x, sel.y, sel.w, sel.h);
  R.ink(ctx, "#000");
  sel = null; renderSel();
}
async function copySel() {
  if (!sel) return false;
  clip = selPixels();
  try {
    if (navigator.clipboard && window.ClipboardItem) {
      const blob = new Promise((res) => clip.toBlob(res, "image/png"));
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
    }
  } catch {}
  return true;
}
async function cutSel() { if (await copySel()) deleteSel(); }
async function pasteCanvas(c) {
  commitAll();
  if (c.width > cv.width || c.height > cv.height) {
    const r = await dialog({
      title: "Paint 98", icon: "warn",
      html: "La imagen pegada es más grande que el mapa de bits.<br>¿Desea ampliar el mapa de bits?",
      buttons: [["Sí", "yes", true], ["No", "no"], ["Cancelar", "cancel"]],
    });
    if (r.btn === "cancel") return;
    if (r.btn === "yes") { pushUndo(); setCanvasSize(Math.max(cv.width, c.width), Math.max(cv.height, c.height)); }
  }
  setTool("select");
  pushUndo();
  const o = c.width > cv.width || c.height > cv.height ? { x: 0, y: 0 } : visibleOrigin();
  sel = { x: o.x, y: o.y, w: c.width, h: c.height, src: c, floating: true };
  selDirty = true;
  renderSel(true);
}
async function paste() {
  try {
    if (navigator.clipboard && navigator.clipboard.read) {
      const items = await navigator.clipboard.read();
      for (const it of items) {
        const type = it.types.find((t) => t.startsWith("image/"));
        if (type) { await pasteCanvas(await blobToCanvas(await it.getType(type))); return; }
      }
    }
  } catch {}
  if (clip) pasteCanvas(copyCanvas(clip));
}

// ---------- Texto ----------
const fontStr = (z = 1) => `${S.font.italic ? "italic " : ""}${S.font.bold ? "bold " : ""}${S.font.size * z}px ${/\s/.test(S.font.family) ? `"${S.font.family}"` : S.font.family}`;
function positionText() {
  if (!tb) { textedit.hidden = true; return; }
  const z = S.zoom;
  textedit.hidden = false;
  Object.assign(textedit.style, {
    left: tb.x * z + "px", top: tb.y * z + "px", width: tb.w * z + "px", height: tb.h * z + "px",
    font: fontStr(z), lineHeight: "1.2", color: S.primary === "transparent" ? "#808080" : S.primary,
    background: S.transparent || S.secondary === "transparent" ? "transparent" : S.secondary,
    textDecoration: S.font.underline ? "underline" : "none",
  });
}
function openText(x, y, w, h) {
  tb = { x, y, w: Math.max(w, S.font.size * 4), h: Math.max(h, Math.ceil(S.font.size * 1.3)) };
  tb.w = Math.min(tb.w, Math.max(8, cv.width - x)); tb.h = Math.min(tb.h, Math.max(8, cv.height - y));
  textedit.value = "";
  positionText();
  $("fontbar").hidden = !S.showFont;
  setTimeout(() => textedit.focus({ preventScroll: true }), 0);
}
function growText() {
  if (!tb) return;
  const need = Math.ceil(textedit.scrollHeight / S.zoom);
  if (need > tb.h) { tb.h = Math.min(need, cv.height - tb.y); positionText(); }
}
function wrapLines(c, text, maxW) {
  const out = [];
  for (const para of text.split("\n")) {
    let line = "";
    for (const word of para.split(/(\s+)/)) {
      if (!word) continue;
      const tryLine = line + word;
      if (c.measureText(tryLine).width <= maxW || !line) {
        if (c.measureText(tryLine).width > maxW && !/\s/.test(word)) {
          for (const ch of word) { // palabra más larga que la caja: cortar
            if (c.measureText(line + ch).width > maxW && line) { out.push(line); line = ""; }
            line += ch;
          }
        } else line = tryLine;
      } else { out.push(line.replace(/\s+$/, "")); line = /\s/.test(word) ? "" : word; }
    }
    out.push(line);
  }
  return out;
}
function commitText() {
  if (!tb) return;
  const text = textedit.value, t = tb;
  tb = null; positionText(); $("fontbar").hidden = true; textedit.blur();
  if (!text.trim()) return;
  pushUndo();
  const c = newCanvas(t.w, t.h), cc = c.getContext("2d");
  const tcol = S.primary === "transparent" ? "#000000" : S.primary;
  cc.font = fontStr(); cc.textBaseline = "top"; cc.fillStyle = tcol;
  const size = S.font.size, lh = size * 1.2;
  wrapLines(cc, text, t.w).forEach((ln, i) => {
    const y = i * lh + size * 0.1;
    cc.fillText(ln, 0, y);
    if (S.font.underline) cc.fillRect(0, Math.round(y + size * 0.95), Math.ceil(cc.measureText(ln).width), Math.max(1, Math.round(size / 15)));
  });
  // Sin suavizado: cada píxel queda lleno o vacío (como el texto clásico)
  const img = cc.getImageData(0, 0, t.w, t.h), d = img.data, [r, g, b] = R.hexToRgb(tcol);
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] >= 100) { d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255; } else d[i + 3] = 0;
  }
  cc.putImageData(img, 0, 0);
  if (!S.transparent) { R.ink(ctx, S.secondary); ctx.fillRect(t.x, t.y, t.w, t.h); }
  ctx.globalCompositeOperation = S.primary === "transparent" ? "destination-out" : "source-over";
  ctx.drawImage(c, t.x, t.y);
  R.ink(ctx, "#000");
}
function cancelText() { tb = null; positionText(); $("fontbar").hidden = true; }

// ---------- Curva y polígono ----------
function drawCurve(c, k) {
  R.ink(c, k.fg);
  const pts = k.stage === 0 ? [k.p0, k.p3] : R.bezier(k.p0, k.c1, k.c2, k.p3);
  R.polyline(c, pts, R.circleSpans(lineW()), false);
  R.ink(c, "#000");
}
function finishCurve() {
  if (!curve) return;
  if (curve.stage > 0) { pushUndo(); drawCurve(ctx, curve); }
  curve = null; clearOv();
}
function drawPoly(c, p, closed) {
  const pts = p.pts, mode = S.opts.fill;
  if (closed && pts.length > 2 && mode > 0) { R.ink(c, mode === 1 ? p.bg : p.fg); R.polyFill(c, pts); }
  if (!closed || mode !== 2) { R.ink(c, p.fg); R.polyline(c, pts, R.circleSpans(lineW()), closed); }
  R.ink(c, "#000");
}
function finishPoly() {
  if (!poly) return;
  if (poly.pts.length > 1) { pushUndo(); drawPoly(ctx, poly, true); }
  poly = null; clearOv();
}

// ---------- Herramientas: eventos de puntero ----------
function snap45(x0, y0, x, y) {
  const dx = x - x0, dy = y - y0, a = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
  const len = Math.hypot(dx, dy);
  return { x: Math.round(x0 + Math.cos(a) * len), y: Math.round(y0 + Math.sin(a) * len) };
}
function squareEnd(o) {
  if (!o.shift) return { x: o.x, y: o.y };
  const d = Math.max(Math.abs(o.x - o.x0), Math.abs(o.y - o.y0));
  return { x: o.x0 + (o.x >= o.x0 ? d : -d), y: o.y0 + (o.y >= o.y0 ? d : -d) };
}
function spray(o) {
  const r = AIRS[S.opts.air], n = Math.round(r * 0.8) + 2;
  R.ink(ctx, o.fg);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * r;
    ctx.fillRect(Math.round(o.x + Math.cos(a) * d), Math.round(o.y + Math.sin(a) * d), 1, 1);
  }
  R.ink(ctx, "#000");
}
function colorErase(o, x0, y0, x1, y1) {
  const s = ERASERS[S.opts.eraser], h = Math.floor(s / 2);
  const L = Math.max(0, Math.min(x0, x1) - h), T = Math.max(0, Math.min(y0, y1) - h);
  const Rr = Math.min(cv.width, Math.max(x0, x1) - h + s), B = Math.min(cv.height, Math.max(y0, y1) - h + s);
  if (Rr <= L || B <= T) return;
  const img = ctx.getImageData(L, T, Rr - L, B - T), d = img.data, W = Rr - L;
  const [fr, fg, fb, fa] = R.hexToRgb(S.primary), [br, bg, bb, ba] = R.hexToRgb(S.secondary);
  const pts = R.linePoints(x0, y0, x1, y1);
  for (let k = 0; k < pts.length; k += 2) {
    for (let yy = pts[k + 1] - h; yy < pts[k + 1] - h + s; yy++) for (let xx = pts[k] - h; xx < pts[k] - h + s; xx++) {
      if (xx < L || yy < T || xx >= Rr || yy >= B) continue;
      const i = ((yy - T) * W + (xx - L)) * 4;
      const match = fa === 0 ? d[i + 3] === 0 : d[i + 3] !== 0 && d[i] === fr && d[i + 1] === fg && d[i + 2] === fb;
      if (match) { d[i] = br; d[i + 1] = bg; d[i + 2] = bb; d[i + 3] = ba; }
    }
  }
  ctx.putImageData(img, L, T);
}
function pickAt(o) {
  if (o.x < 0 || o.y < 0 || o.x >= cv.width || o.y >= cv.height) return;
  const d = ctx.getImageData(o.x, o.y, 1, 1).data, hex = R.rgbToHex(d[0], d[1], d[2], d[3]);
  if (o.btn === 2) S.secondary = hex; else S.primary = hex;
  renderColors();
}

const H = {
  pencil: {
    down(o) { pushUndo(); o.pushed = true; R.ink(ctx, o.fg); R.stamp(ctx, o.x, o.y, pencilSpans()); R.ink(ctx, "#000"); },
    move(o) { R.ink(ctx, o.fg); R.line(ctx, o.lx, o.ly, o.x, o.y, pencilSpans(), true); R.ink(ctx, "#000"); },
  },
  brush: {
    down(o) { pushUndo(); o.pushed = true; R.ink(ctx, o.fg); R.stamp(ctx, o.x, o.y, brushSpans()); R.ink(ctx, "#000"); },
    move(o) { R.ink(ctx, o.fg); R.line(ctx, o.lx, o.ly, o.x, o.y, brushSpans(), true); R.ink(ctx, "#000"); },
  },
  eraser: {
    down(o) { pushUndo(); o.pushed = true; this.move(o, true); },
    move(o) {
      if (o.btn === 2) return colorErase(o, o.lx, o.ly, o.x, o.y);
      R.ink(ctx, S.secondary);
      R.line(ctx, o.lx, o.ly, o.x, o.y, R.squareSpans(ERASERS[S.opts.eraser]));
      R.ink(ctx, "#000");
    },
  },
  airbrush: {
    down(o) { pushUndo(); o.pushed = true; spray(o); o.timer = setInterval(() => spray(o), 30); },
    move(o) { spray(o); },
    up(o) { clearInterval(o.timer); },
  },
  fill: {
    down(o) {
      if (o.x < 0 || o.y < 0 || o.x >= cv.width || o.y >= cv.height) return;
      const img = snap();
      if (R.floodFill(img, o.x, o.y, R.hexToRgb(o.fg))) { pushUndo(); ctx.putImageData(img, 0, 0); }
    },
  },
  picker: {
    down(o) { pickAt(o); }, move(o) { pickAt(o); },
    up() { setTool(S.prevTool || "pencil"); },
  },
  zoom: {
    up(o) {
      const lvl = ZOOMS[S.opts.zoom];
      setZoom(S.zoom === 1 ? (lvl === 1 ? 4 : lvl) : 1, o);
      setTool(S.prevTool || "pencil");
    },
  },
  line: {
    move(o) {
      clearOv();
      const e = o.shift ? snap45(o.x0, o.y0, o.x, o.y) : o;
      R.ink(octx, o.fg); R.line(octx, o.x0, o.y0, e.x, e.y, R.circleSpans(lineW()));
      setSize(Math.abs(e.x - o.x0) + 1, Math.abs(e.y - o.y0) + 1);
    },
    down(o) { this.move(o); },
    up(o) {
      clearOv(); pushUndo();
      const e = o.shift ? snap45(o.x0, o.y0, o.x, o.y) : o;
      R.ink(ctx, o.fg); R.line(ctx, o.x0, o.y0, e.x, e.y, R.circleSpans(lineW())); R.ink(ctx, "#000");
      setSize();
    },
  },
  curve: {
    down(o) {
      if (!curve) { curve = { stage: 0, p0: [o.x, o.y], p3: [o.x, o.y], fg: o.fg }; }
      else if (curve.stage === 1) { curve.c1 = [o.x, o.y]; curve.c2 = [o.x, o.y]; }
      else curve.c2 = [o.x, o.y];
      this.move(o);
    },
    move(o) {
      if (!curve) return;
      if (curve.stage === 0) curve.p3 = [o.x, o.y];
      else if (curve.stage === 1) { curve.c1 = [o.x, o.y]; curve.c2 = [o.x, o.y]; }
      else curve.c2 = [o.x, o.y];
      clearOv(); drawCurve(octx, curve);
    },
    up() {
      if (!curve) return;
      if (curve.stage === 0) { curve.stage = 1; curve.c1 = curve.p0; curve.c2 = curve.p3; }
      else if (curve.stage === 1) curve.stage = 2;
      else finishCurve();
    },
  },
  poly: {
    down(o) {
      if (!poly) poly = { pts: [[o.x, o.y], [o.x, o.y]], fg: o.fg, bg: o.bg, lastUp: 0 };
      else poly.pts.push([o.x, o.y]);
      this.move(o);
    },
    move(o) {
      if (!poly) return;
      const prev = poly.pts[poly.pts.length - 2];
      const e = o.shift ? snap45(prev[0], prev[1], o.x, o.y) : o;
      poly.pts[poly.pts.length - 1] = [e.x, e.y];
      clearOv(); drawPoly(octx, poly, false);
    },
    up(o, e) {
      if (!poly) return;
      const n = poly.pts.length, last = poly.pts[n - 1], first = poly.pts[0], prev = poly.pts[n - 2];
      const tol = Math.max(2, Math.round((COARSE ? 14 : 6) / S.zoom));
      const now = e.timeStamp;
      if (n > 3 && Math.hypot(last[0] - first[0], last[1] - first[1]) <= tol) { poly.pts.pop(); finishPoly(); return; }
      if (n > 2 && now - poly.lastUp < 400 && Math.hypot(last[0] - prev[0], last[1] - prev[1]) <= tol) { poly.pts.pop(); finishPoly(); return; }
      poly.lastUp = now;
    },
  },
  text: {
    down(o) { if (tb) { commitText(); op = null; return; } o.kind = "textnew"; },
  },
  textnew: {
    move(o) { const L = Math.min(o.x0, o.x), T = Math.min(o.y0, o.y); showRect(L, T, Math.abs(o.x - o.x0) + 1, Math.abs(o.y - o.y0) + 1, true); },
    up(o) {
      selbox.hidden = true;
      const L = clamp(Math.min(o.x0, o.x), 0, cv.width - 1), T = clamp(Math.min(o.y0, o.y), 0, cv.height - 1);
      const w = Math.abs(o.x - o.x0) + 1, h = Math.abs(o.y - o.y0) + 1;
      openText(L, T, w > 6 ? w : 0, h > 6 ? h : 0);
    },
  },
  select: { down(o, e) { selDown(o, e, "selnew"); } },
  freesel: { down(o, e) { selDown(o, e, "freenew"); } },
  selnew: {
    move(o) {
      const L = clamp(Math.min(o.x0, o.x), 0, cv.width), T = clamp(Math.min(o.y0, o.y), 0, cv.height);
      const Rr = clamp(Math.max(o.x0, o.x) + 1, 0, cv.width), B = clamp(Math.max(o.y0, o.y) + 1, 0, cv.height);
      showRect(L, T, Rr - L, B - T, true); setSize(Rr - L, B - T);
      o.rect = [L, T, Rr - L, B - T];
    },
    up(o) {
      const r = o.rect;
      if (r && r[2] > 1 && r[3] > 1) { sel = { x: r[0], y: r[1], w: r[2], h: r[3], floating: false }; renderSel(true); }
      else { sel = null; renderSel(); }
    },
  },
  freenew: {
    down(o) { o.pts = [[clamp(o.x, 0, cv.width - 1), clamp(o.y, 0, cv.height - 1)]]; },
    move(o) {
      const p = [clamp(o.x, 0, cv.width - 1), clamp(o.y, 0, cv.height - 1)], l = o.pts[o.pts.length - 1];
      if (p[0] === l[0] && p[1] === l[1]) return;
      octx.fillStyle = "#000"; R.line(octx, l[0], l[1], p[0], p[1], [[0, 0, 1]]);
      o.pts.push(p);
    },
    up(o) {
      clearOv();
      const xs = o.pts.map((p) => p[0]), ys = o.pts.map((p) => p[1]);
      const L = Math.min(...xs), T = Math.min(...ys), w = Math.max(...xs) - L + 1, h = Math.max(...ys) - T + 1;
      if (o.pts.length < 3 || w < 2 || h < 2) { sel = null; renderSel(); return; }
      sel = { x: L, y: T, w, h, poly: o.pts.map((p) => [p[0] - L, p[1] - T]), floating: false };
      renderSel(true);
    },
  },
  selmove: {
    move(o) {
      sel.x = o.x - o.dx; sel.y = o.y - o.dy;
      if (o.shift) stampSel();
      renderSel(false);
    },
  },
  selresize: {
    move(o) {
      const r = o.r, hd = o.h, dx = o.x - o.x0, dy = o.y - o.y0;
      let x = r.x, y = r.y, w = r.w, h = r.h;
      if (hd.includes("e")) w = Math.max(1, r.w + dx);
      if (hd.includes("s")) h = Math.max(1, r.h + dy);
      if (hd.includes("w")) { w = Math.max(1, r.w - dx); x = r.x + r.w - w; }
      if (hd.includes("n")) { h = Math.max(1, r.h - dy); y = r.y + r.h - h; }
      Object.assign(sel, { x, y, w, h });
      renderSel(true);
    },
  },
  cresize: {
    move(o) {
      const z = S.zoom;
      o.w = o.c !== "s" ? Math.max(1, o.x) : cv.width;
      o.h = o.c !== "e" ? Math.max(1, o.y) : cv.height;
      const g = $("ghost"); g.hidden = false;
      g.style.width = o.w * z + "px"; g.style.height = o.h * z + "px";
      setSize(o.w, o.h);
    },
    up(o) {
      $("ghost").hidden = true; setSize();
      if (o.w && (o.w !== cv.width || o.h !== cv.height)) { pushUndo(); setCanvasSize(o.w, o.h); }
    },
  },
};
for (const k of ["rect", "ellipse", "rrect"]) {
  H[k] = {
    move(o) {
      clearOv();
      const e = squareEnd(o);
      R.shape(octx, k, o.x0, o.y0, e.x, e.y, lineW(), S.opts.fill, o.fg, o.bg);
      setSize(Math.abs(e.x - o.x0) + 1, Math.abs(e.y - o.y0) + 1);
    },
    down(o) { this.move(o); },
    up(o) {
      clearOv(); pushUndo();
      const e = squareEnd(o);
      R.shape(ctx, k, o.x0, o.y0, e.x, e.y, lineW(), S.opts.fill, o.fg, o.bg);
      setSize();
    },
  };
}
function selDown(o, e, kind) {
  const h = e.target.closest(".sh");
  if (sel && h) { liftSel(); o.kind = "selresize"; o.h = h.dataset.h; o.r = { x: sel.x, y: sel.y, w: sel.w, h: sel.h }; return; }
  if (sel && e.target.closest("#selbox")) {
    liftSel();
    if (o.ctrl) stampSel();
    o.kind = "selmove"; o.dx = o.x - sel.x; o.dy = o.y - sel.y;
    return;
  }
  commitSel();
  o.kind = kind;
  H[kind].down?.(o, e);
}

// ---------- Puntero: dibujar, y dos dedos para mover/ampliar ----------
const touches = new Map();
let pan = null;
function cancelOp() {
  if (!op) return;
  clearInterval(op.timer);
  if (op.pushed && undo.length) { ctx.putImageData(undo.pop(), 0, 0); }
  if (op.kind === "curve" && curve && curve.stage === 0) curve = null;
  if (op.kind === "poly" && poly) { poly.pts.pop(); if (poly.pts.length < 2) poly = null; }
  if (op.kind === "selnew" || op.kind === "textnew") renderSel();
  if (op.kind === "cresize") $("ghost").hidden = true;
  clearOv();
  if (curve) drawCurve(octx, curve);
  if (poly) drawPoly(octx, poly, false);
  op = null;
}
function touchInfo() {
  const [a, b] = [...touches.values()];
  return { mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, d: Math.hypot(a.x - b.x, a.y - b.y) };
}
ws.addEventListener("pointerdown", (e) => {
  closeMenu();
  if (e.pointerType === "touch") {
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (touches.size === 2) { cancelOp(); pan = touchInfo(); pan.d0 = pan.d; return; }
    if (touches.size > 2) return;
  }
  if (pan) return;
  if (e.target === textedit) return;
  if (e.button === 1) return;
  if (!stage.contains(e.target)) { commitText(); finishCurve(); finishPoly(); if (S.tool !== "select" && S.tool !== "freesel") commitSel(); else commitSel(); return; }
  e.preventDefault();
  try { ws.setPointerCapture(e.pointerId); } catch {}
  const p = pt(e), btn = e.button === 2 ? 2 : 0;
  lastPtr = p; updateEraserCursor(p);
  op = {
    kind: S.tool, id: e.pointerId, btn, fg: btn ? S.secondary : S.primary, bg: btn ? S.primary : S.secondary,
    x0: p.x, y0: p.y, x: p.x, y: p.y, lx: p.x, ly: p.y, shift: e.shiftKey, ctrl: e.ctrlKey || e.metaKey,
  };
  const ch = e.target.closest(".ch");
  if (ch) { commitAll(); op.kind = "cresize"; op.c = ch.dataset.c; return; }
  if (S.tool !== "text") commitText();
  if (!["select", "freesel"].includes(S.tool)) commitSel();
  H[op.kind].down?.call(H[op.kind], op, e);
});
ws.addEventListener("pointermove", (e) => {
  if (e.pointerType === "touch" && touches.has(e.pointerId)) {
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pan && touches.size >= 2) {
      const t = touchInfo();
      ws.scrollLeft -= t.mx - pan.mx; ws.scrollTop -= t.my - pan.my;
      const ratio = t.d / pan.d0;
      if (ratio > 1.5 || ratio < 0.66) {
        const i = ZOOM_STEPS.indexOf(S.zoom) >= 0 ? ZOOM_STEPS.indexOf(S.zoom) : 0;
        const ni = clamp(i + (ratio > 1 ? 1 : -1), 0, ZOOM_STEPS.length - 1);
        if (ni !== i) {
          const r = cv.getBoundingClientRect();
          setZoom(ZOOM_STEPS[ni], { x: (t.mx - r.left) / S.zoom, y: (t.my - r.top) / S.zoom });
        }
        t.d0 = t.d;
      } else t.d0 = pan.d0;
      pan = t;
      return;
    }
  }
  const p = pt(e);
  setPos(p.x >= 0 && p.y >= 0 && p.x < cv.width && p.y < cv.height ? p : null);
  if (e.pointerType === "mouse" || (op && op.id === e.pointerId)) { lastPtr = p; updateEraserCursor(p); }
  if (!op || op.id !== e.pointerId) return;
  if (p.x === op.x && p.y === op.y) return;
  op.lx = op.x; op.ly = op.y; op.x = p.x; op.y = p.y; op.shift = e.shiftKey;
  H[op.kind].move?.call(H[op.kind], op, e);
});
function endPointer(e, cancelled) {
  if (e.pointerType === "touch") {
    touches.delete(e.pointerId);
    if (pan) { if (touches.size === 0) pan = null; return; }
  }
  if (!op || op.id !== e.pointerId) return;
  if (cancelled) { cancelOp(); return; }
  const o = op; op = null;
  if (e.pointerType !== "mouse") { lastPtr = null; updateEraserCursor(); }
  H[o.kind].up?.call(H[o.kind], o, e);
  if (o.pushed) markDirty();
}
ws.addEventListener("pointerup", (e) => endPointer(e, false));
ws.addEventListener("pointercancel", (e) => endPointer(e, true));
ws.addEventListener("pointerleave", () => { setPos(null); lastPtr = null; updateEraserCursor(); });
ws.addEventListener("contextmenu", (e) => e.preventDefault());
ws.addEventListener("wheel", (e) => {
  if (!e.ctrlKey) return;
  e.preventDefault();
  const i = Math.max(0, ZOOM_STEPS.indexOf(S.zoom));
  const ni = clamp(i + (e.deltaY < 0 ? 1 : -1), 0, ZOOM_STEPS.length - 1);
  const r = cv.getBoundingClientRect();
  if (ni !== i) setZoom(ZOOM_STEPS[ni], { x: (e.clientX - r.left) / S.zoom, y: (e.clientY - r.top) / S.zoom });
}, { passive: false });
textedit.addEventListener("input", growText);
textedit.addEventListener("pointerdown", (e) => e.stopPropagation());

// ---------- Cuadro de herramientas ----------
function setTool(t) {
  if (t === S.tool && !["picker", "zoom"].includes(t)) return;
  commitText(); finishCurve(); finishPoly();
  commitSel();
  if (t === "picker" || t === "zoom") { if (S.tool !== "picker" && S.tool !== "zoom") S.prevTool = S.tool; }
  S.tool = t;
  stage.className = "stage t-" + t;
  renderTools(); renderOptions();
  status(TOOLMAP[t][2]);
  updateEraserCursor();
  saveSettings();
}
function renderTools() {
  $("tools").innerHTML = TOOLS.map(([id, name]) =>
    `<button class="tool${S.tool === id ? " on" : ""}" data-t="${id}" title="${name}" aria-label="${name}">${iconImg(id)}</button>`).join("");
}
$("tools").addEventListener("click", (e) => { const b = e.target.closest(".tool"); if (b) setTool(b.dataset.t); });
$("tools").addEventListener("pointerover", (e) => { const b = e.target.closest(".tool"); if (b && e.pointerType === "mouse") status(TOOLMAP[b.dataset.t][2]); });
$("tools").addEventListener("pointerout", () => status(TOOLMAP[S.tool][2]));

function optC(w, h, draw) {
  const c = newCanvas(w, h); c.style.width = w * OS + "px"; c.style.height = h * OS + "px";
  const x = c.getContext("2d"); draw(x); return c;
}
function renderOptions() {
  const box = $("optbox"); box.innerHTML = ""; box.className = "optbox";
  const add = (canvas, on, fn, label) => {
    const d = document.createElement("div"); d.className = "opt" + (on ? " on" : "");
    if (canvas) d.append(canvas); else { d.textContent = label; d.style.color = on ? "#fff" : ""; }
    d.addEventListener("click", fn); box.append(d); return d;
  };
  const t = S.tool;
  if (t === "select" || t === "freesel" || t === "text") {
    [false, true].forEach((tr) => add(optC(30, 20, (c) => {
      if (!tr) { c.fillStyle = "#fff"; c.fillRect(1, 1, 28, 18); }
      c.fillStyle = "#000"; c.fillRect(0, 0, 30, 1); c.fillRect(0, 19, 30, 1); c.fillRect(0, 0, 1, 20); c.fillRect(29, 0, 1, 20);
      c.fillStyle = "#00ffff"; c.fillRect(4, 4, 9, 9);
      R.shape(c, "ellipse", 10, 7, 22, 16, 1, 1, "#000", "#ff0000");
      c.fillStyle = "#ffff00"; R.polyFill(c, [[19, 3], [26, 14], [14, 14]]);
    }), S.transparent === tr, () => { setTransparent(tr); }));
  } else if (t === "eraser") {
    sizeGrid(ERASERS, "eraser", (c, v, on) => { const d = Math.min(14, Math.round(2 + v / 3)); const o = Math.floor((14 - d) / 2); c.fillStyle = ink(on); c.fillRect(o, o, d, d); });
  } else if (t === "zoom") {
    ZOOMS.forEach((z, i) => add(null, S.opts.zoom === i, () => { S.opts.zoom = i; setZoom(z); setTool(S.prevTool || "pencil"); }, z + "x"));
  } else if (t === "brush") {
    const g = document.createElement("div"); g.className = "optgrid";
    BRUSH_SHAPES.forEach((k, i) => {
      const on = S.opts.brushShape === i;
      add(optC(14, 14, (c) => { c.fillStyle = ink(on); R.stamp(c, 7, 7, k === "c" ? R.circleSpans(9) : k === "s" ? R.squareSpans(8) : R.diagSpans(9, k === "/" ? 1 : -1)); }),
        on, () => { S.opts.brushShape = i; renderOptions(); saveSettings(); }).dataset.tip = "Forma";
    });
    g.append(...box.children); box.append(g);
    sizeGrid(BRUSH_SIZES, "brush", (c, v, on) => {
      const k = BRUSH_SHAPES[S.opts.brushShape], d = Math.min(12, v);
      c.fillStyle = ink(on); R.stamp(c, 7, 7, k === "c" ? R.circleSpans(d) : k === "s" ? R.squareSpans(d) : R.diagSpans(Math.max(d, 3), k === "/" ? 1 : -1));
    });
  } else if (t === "airbrush") {
    sizeGrid(AIRS, "air", (c, r, on) => {
      c.fillStyle = ink(on); let seed = 7 + r; const rr = Math.min(7, 2 + r / 5);
      const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      for (let k = 0; k < 10 + r; k++) { const a = rnd() * 6.283, d = Math.sqrt(rnd()) * rr; c.fillRect(Math.round(7 + Math.cos(a) * d), Math.round(7 + Math.sin(a) * d), 1, 1); }
    });
  } else if (["pencil", "line", "curve"].includes(t)) {
    sizeGrid(WIDTHS, t === "pencil" ? "pencil" : "line", widthIcon);
  } else if (["rect", "poly", "ellipse", "rrect"].includes(t)) {
    [0, 1, 2].forEach((m) => add(optC(30, 14, (c) => {
      const on = S.opts.fill === m;
      if (m === 0) { c.fillStyle = ink(on); c.fillRect(3, 2, 24, 1); c.fillRect(3, 11, 24, 1); c.fillRect(3, 2, 1, 10); c.fillRect(26, 2, 1, 10); }
      if (m === 1) { c.fillStyle = "#808080"; c.fillRect(3, 2, 24, 10); c.fillStyle = ink(on); c.fillRect(3, 2, 24, 1); c.fillRect(3, 11, 24, 1); c.fillRect(3, 2, 1, 10); c.fillRect(26, 2, 1, 10); }
      if (m === 2) { c.fillStyle = "#808080"; c.fillRect(3, 2, 24, 10); }
    }), S.opts.fill === m, () => { S.opts.fill = m; renderOptions(); saveSettings(); }));
    sizeGrid(WIDTHS, "line", widthIcon);
  }
}
function widthIcon(c, w, on) { const h = Math.min(12, w); c.fillStyle = ink(on); c.fillRect(1, Math.floor((14 - h) / 2), 12, h); }
function ink(on) { return on ? "#fff" : "#000"; }
// Cuadrícula de 2 columnas con los gruesos: dibujito + número
function sizeGrid(list, key, draw) {
  const box = $("optbox"), g = document.createElement("div");
  g.className = "optgrid sizes";
  list.forEach((v, i) => {
    const on = S.opts[key] === i, d = document.createElement("div");
    d.className = "opt" + (on ? " on" : ""); d.title = v + " px";
    const cnv = optC(14, 14, (c) => draw(c, v, on));
    cnv.style.width = cnv.style.height = "14px"; // nítido; el número indica el tamaño
    d.append(cnv);
    const n = document.createElement("span"); n.className = "n"; n.textContent = v; d.append(n);
    d.addEventListener("click", () => { S.opts[key] = i; renderOptions(); saveSettings(); });
    g.append(d);
  });
  box.append(g);
}
function setTransparent(tr) {
  S.transparent = tr; selDirty = true; renderSel(true); positionText(); renderOptions(); saveSettings();
}

// ---------- Colores ----------
const CHECK = "repeating-conic-gradient(#fff 0 25%, #c0c0c0 0 50%) 0 0 / 6px 6px";
const cssColor = (c) => (c === "transparent" ? CHECK : c);
function renderColors() {
  $("priSw").style.setProperty("--c", cssColor(S.primary));
  $("secSw").style.setProperty("--c", cssColor(S.secondary));
  $("palette").innerHTML = S.palette.map((c, i) => `<div class="sw" data-i="${i}" style="--c:${c}"></div>`).join("");
  if (tb) positionText();
  if (sel && sel.floating && S.transparent) { selDirty = true; renderSel(true); }
  saveSettings();
}
const swColor = (i) => (i === "T" ? "transparent" : S.palette[+i]);
let lastTap = { i: -1, t: 0 }, pressTimer = 0, longPressed = false;
const cbox = $("colorbox");
cbox.addEventListener("pointerdown", (e) => {
  const sw = e.target.closest(".sw[data-i]"); if (!sw) return;
  const i = sw.dataset.i;
  longPressed = false;
  if (e.button === 2) { S.secondary = swColor(i); renderColors(); return; }
  if (e.pointerType !== "mouse") {
    clearTimeout(pressTimer);
    pressTimer = setTimeout(() => { longPressed = true; S.secondary = swColor(i); renderColors(); navigator.vibrate?.(15); }, 450);
  }
});
cbox.addEventListener("pointerup", (e) => {
  clearTimeout(pressTimer);
  const sw = e.target.closest(".sw[data-i]"); if (!sw || e.button === 2 || longPressed) return;
  const i = sw.dataset.i;
  S.primary = swColor(i); if (i !== "T") S.palIdx = +i; renderColors();
  if (i !== "T" && lastTap.i === i && e.timeStamp - lastTap.t < 400) { editColor(+i); lastTap = { i: -1, t: 0 }; }
  else lastTap = { i, t: e.timeStamp };
});
cbox.addEventListener("pointerleave", () => clearTimeout(pressTimer));
cbox.addEventListener("contextmenu", (e) => e.preventDefault());
$("curcol").addEventListener("click", () => { [S.primary, S.secondary] = [S.secondary, S.primary]; renderColors(); });
$("swMore").addEventListener("click", async () => {
  const c = await colorEditor(S.primary === "transparent" ? "#000000" : S.primary);
  if (c) { S.primary = c; renderColors(); }
});
async function editColor(i = S.palIdx) {
  const c = await colorEditor(S.palette[i]);
  if (c) { S.palette[i] = c; S.primary = c; S.palIdx = i; renderColors(); }
}

// Conversión de color (escala clásica: matiz 0-239, sat y lum 0-240)
function hslToRgb(h, s, l) {
  h = (h / 240) * 360; s /= 240; l /= 240;
  const k = (n) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = (n) => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1))));
  return [f(0), f(8), f(4)];
}
function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  let h = 0, s = 0;
  if (d) {
    s = d / (1 - Math.abs(2 * l - 1));
    h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h = (h * 60 + 360) % 360;
  }
  return [Math.round((h / 360) * 240) % 240, Math.round(s * 240), Math.round(l * 240)];
}
const BASIC = (() => {
  const hues = [0, 20, 40, 80, 120, 140, 160, 200], rows = [[240, 200], [240, 160], [240, 120], [240, 80], [240, 45]], out = [];
  for (const [s, l] of rows) for (const h of hues) out.push(R.rgbToHex(...hslToRgb(h, s, l)));
  for (const v of [0, 36, 73, 109, 146, 182, 219, 255]) out.push(R.rgbToHex(v, v, v));
  return out;
})();
let customIdx = 0;
// Ventana "Modificar colores": cuadrícula de colores + espectro para elegir cualquier color.
function colorEditor(initial) {
  let [r, g, b] = R.hexToRgb(initial), [h, s, l] = rgbToHsl(r, g, b);
  const SW = 180, SH = 150;
  const cells = (list, cls) => list.map((c, i) => `<div class="cc ${cls}" data-k="${i}" style="--c:${c}"></div>`).join("");
  let body;
  const hex = () => R.rgbToHex(r, g, b);
  function paint(skip) {
    const lc = body.querySelector("#ceLum"), x = lc.getContext("2d"), gr = x.createLinearGradient(0, 0, 0, SH);
    for (let i = 0; i <= 10; i++) gr.addColorStop(i / 10, R.rgbToHex(...hslToRgb(h, s, 240 - i * 24)));
    x.fillStyle = gr; x.fillRect(0, 0, 14, SH);
    const cross = body.querySelector("#ceCross"); cross.style.left = 2 + (h / 239) * (SW - 1) + "px"; cross.style.top = 2 + (1 - s / 240) * (SH - 1) + "px";
    body.querySelector("#ceArrow").style.top = 2 + (1 - l / 240) * (SH - 1) + "px";
    body.querySelector("#cePrev").style.background = hex();
    const vals = { ceH: h, ceS: s, ceL: l, ceR: r, ceG: g, ceB: b };
    for (const id in vals) if (id !== skip) body.querySelector("#" + id).value = vals[id];
    body.querySelectorAll(".cc").forEach((el) => el.classList.toggle("sel", el.style.getPropertyValue("--c").trim().toLowerCase() === hex()));
  }
  const fromHsl = (skip) => { [r, g, b] = hslToRgb(h, s, l); paint(skip); };
  const fromRgb = (skip) => { [h, s, l] = rgbToHsl(r, g, b); paint(skip); };
  const setHex = (c) => { [r, g, b] = R.hexToRgb(c); fromRgb(); };
  const drag = (el, fn) => el.addEventListener("pointerdown", (e) => {
    e.preventDefault(); el.setPointerCapture(e.pointerId);
    const go = (ev) => { const rc = el.getBoundingClientRect(); fn(clamp((ev.clientX - rc.left - 2) / (rc.width - 4), 0, 1), clamp((ev.clientY - rc.top - 2) / (rc.height - 4), 0, 1)); };
    go(e); el.onpointermove = go; el.onpointerup = () => (el.onpointermove = null);
  });
  const p = dialog({
    title: "Modificar colores", cls: "wide",
    html: `<div class="ce">
      <div class="ce-left"><div>Colores <u>b</u>ásicos:</div><div class="cegrid">${cells(BASIC, "basic")}</div>
        <div>Colores <u>p</u>ersonalizados:</div><div class="cegrid" id="ceCustom">${cells(S.custom, "cust")}</div></div>
      <div class="ce-right">
        <div class="ce-spec" id="ceSpecBox"><canvas id="ceSpec" width="${SW}" height="${SH}"></canvas><i id="ceCross"></i></div>
        <div class="ce-lum" id="ceLumBox"><canvas id="ceLum" width="14" height="${SH}"></canvas><i id="ceArrow"></i></div>
        <div class="ce-bottom"><div class="ce-prev"><div id="cePrev"></div><span>Color|Sólido</span></div>
          <div class="ce-fields">
            <label for="ceH">Matiz:</label><input id="ceH" class="field" type="number" min="0" max="239">
            <label for="ceR">Rojo:</label><input id="ceR" class="field" type="number" min="0" max="255">
            <label for="ceS">Sat:</label><input id="ceS" class="field" type="number" min="0" max="240">
            <label for="ceG">Verde:</label><input id="ceG" class="field" type="number" min="0" max="255">
            <label for="ceL">Lum:</label><input id="ceL" class="field" type="number" min="0" max="240">
            <label for="ceB">Azul:</label><input id="ceB" class="field" type="number" min="0" max="255">
          </div></div>
        <button class="btn98" id="ceAdd">Agregar a los colores personalizados</button>
      </div></div>`,
    buttons: [["Aceptar", "ok", true], ["Cancelar", "cancel"]],
    init(bd) {
      body = bd;
      const sc = bd.querySelector("#ceSpec"), x = sc.getContext("2d"), img = x.createImageData(SW, SH);
      for (let yy = 0; yy < SH; yy++) for (let xx = 0; xx < SW; xx++) {
        const [cr, cg, cb] = hslToRgb((xx / (SW - 1)) * 239, (1 - yy / (SH - 1)) * 240, 120), i = (yy * SW + xx) * 4;
        img.data[i] = cr; img.data[i + 1] = cg; img.data[i + 2] = cb; img.data[i + 3] = 255;
      }
      x.putImageData(img, 0, 0);
      drag(bd.querySelector("#ceSpecBox"), (fx, fy) => { h = Math.round(fx * 239); s = Math.round((1 - fy) * 240); if (l === 0 || l === 240) l = 120; fromHsl(); });
      drag(bd.querySelector("#ceLumBox"), (fx, fy) => { l = Math.round((1 - fy) * 240); fromHsl(); });
      bd.addEventListener("click", (e) => {
        const c = e.target.closest(".cc"); if (!c) return;
        if (c.classList.contains("cust")) customIdx = +c.dataset.k;
        setHex(c.style.getPropertyValue("--c").trim());
      });
      for (const [id, a, mx] of [["ceH", "h", 239], ["ceS", "s", 240], ["ceL", "l", 240], ["ceR", "r", 255], ["ceG", "g", 255], ["ceB", "b", 255]]) {
        bd.querySelector("#" + id).addEventListener("input", (e) => {
          const v = clamp(parseInt(e.target.value, 10) || 0, 0, mx);
          if (a === "h") h = v; if (a === "s") s = v; if (a === "l") l = v; if (a === "r") r = v; if (a === "g") g = v; if (a === "b") b = v;
          "hsl".includes(a) ? fromHsl(id) : fromRgb(id);
        });
      }
      bd.querySelector("#ceAdd").addEventListener("click", () => {
        S.custom[customIdx] = hex(); customIdx = (customIdx + 1) % 16;
        bd.querySelector("#ceCustom").innerHTML = cells(S.custom, "cust"); saveSettings(); paint();
      });
      paint();
    },
  });
  return p.then((res) => (res.btn === "ok" ? hex() : null));
}

// ---------- Acomodar el cuadro de colores (abajo, arriba o izquierda) ----------
function applyDock() {
  const main = $("main");
  if (S.dock === "top") main.before(cbox);
  else if (S.dock === "left") main.insertBefore(cbox, $("workspace"));
  else main.after(cbox);
  cbox.classList.toggle("vertical", S.dock === "left");
  layout();
}
function dockZone(x, y) {
  const r = $("win").getBoundingClientRect(), m = $("main").getBoundingClientRect();
  if (x < r.left + r.width * 0.28 && y > m.top && y < m.bottom) return "left";
  return y < r.top + r.height * 0.4 ? "top" : "bottom";
}
$("cgrip").addEventListener("pointerdown", (e) => {
  e.preventDefault();
  const g = $("dockGhost"), grip = $("cgrip");
  grip.setPointerCapture(e.pointerId);
  const show = (ev) => {
    const z = dockZone(ev.clientX, ev.clientY), m = $("main").getBoundingClientRect(), w = $("win").getBoundingClientRect();
    const cw = cbox.classList.contains("vertical") ? 0 : cbox.offsetHeight, th = cw || 60;
    const R2 = z === "left" ? { left: m.left + ($("toolbox").hidden ? 0 : $("toolbox").offsetWidth), top: m.top, width: COARSE ? 64 : 44, height: m.height }
      : z === "top" ? { left: w.left + 3, top: m.top - (S.dock === "top" ? th : 0), width: w.width - 6, height: th }
      : { left: w.left + 3, top: m.bottom - (S.dock === "bottom" ? 0 : th), width: w.width - 6, height: th };
    Object.assign(g.style, { left: R2.left + "px", top: R2.top + "px", width: R2.width + "px", height: R2.height + "px" });
    g.hidden = false;
  };
  show(e);
  grip.onpointermove = show;
  grip.onpointerup = grip.onpointercancel = (ev) => {
    grip.onpointermove = grip.onpointerup = grip.onpointercancel = null; g.hidden = true;
    if (ev.type === "pointerup") { S.dock = dockZone(ev.clientX, ev.clientY); applyDock(); saveSettings(); }
  };
});

// ---------- Temas de color ----------
const THEME_COLORS = { std: "#000080", desert: "#008080", eggplant: "#602860", lilac: "#5a4eb1", brick: "#800000" };
function applyTheme() {
  document.documentElement.dataset.theme = S.theme;
  document.querySelector('meta[name="theme-color"]').content = THEME_COLORS[S.theme];
}
function setTheme(t) { S.theme = t; applyTheme(); saveSettings(); }

// ---------- Más o menos grueso con las teclas + y - (también mientras se dibuja) ----------
let lastPtr = null, stTimer = 0;
function bumpSize(dir) {
  if (S.tool === "text") {
    const i = SIZES.indexOf(S.font.size), ni = clamp((i < 0 ? 4 : i) + dir, 0, SIZES.length - 1);
    S.font.size = SIZES[ni]; fontChanged(); flash(`Tamaño de letra: ${S.font.size}`); return;
  }
  const m = SIZE_KEYS[S.tool]; if (!m) return;
  const [k, list] = m, ni = clamp(S.opts[k] + dir, 0, list.length - 1);
  if (ni === S.opts[k]) return;
  S.opts[k] = ni; renderOptions(); saveSettings();
  flash(`Grueso: ${list[ni]} px`);
  updateEraserCursor();
  if (op && ["line", "rect", "ellipse", "rrect", "curve", "poly"].includes(op.kind)) H[op.kind].move.call(H[op.kind], op);
  else if (!op) { clearOv(); if (curve) drawCurve(octx, curve); if (poly) drawPoly(octx, poly, false); }
}
function flash(msg) { status(msg); clearTimeout(stTimer); stTimer = setTimeout(() => status(TOOLMAP[S.tool][2]), 1500); }

// Cursor de la goma: un cuadro del tamaño real de la goma
function updateEraserCursor(p = lastPtr) {
  const c = $("ecur");
  if (S.tool !== "eraser" || !p) { c.hidden = true; return; }
  const s = ERASERS[S.opts.eraser], h = Math.floor(s / 2), z = S.zoom;
  Object.assign(c.style, { left: (p.x - h) * z + "px", top: (p.y - h) * z + "px", width: s * z + "px", height: s * z + "px" });
  c.hidden = false;
}

// ---------- Archivos ----------
function blobToCanvas(blob) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(blob), img = new Image();
    img.onload = () => {
      const c = newCanvas(img.naturalWidth, img.naturalHeight), cc = c.getContext("2d");
      cc.drawImage(img, 0, 0); URL.revokeObjectURL(url); res(c);
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error("imagen")); };
    img.src = url;
  });
}
function setTitle() {
  $("title").textContent = `${S.fileName} - Paint 98`;
  document.title = `${S.fileName} - Paint 98`;
}
async function askSave() { // true = seguir, false = cancelar
  if (!S.dirty) return true;
  const r = await dialog({
    title: "Paint 98", icon: "warn",
    html: `¿Desea guardar los cambios de ${esc(S.fileName)}?`,
    buttons: [["Sí", "yes", true], ["No", "no"], ["Cancelar", "cancel"]],
  });
  if (r.btn === "cancel") return false;
  if (r.btn === "yes") return await exportPNG();
  return true;
}
function defaultSize() {
  return { w: clamp(ws.clientWidth - 22, 64, 1600), h: clamp(ws.clientHeight - 22, 64, 1600) };
}
async function fileNew() {
  commitAll();
  if (!(await askSave())) return;
  const d = defaultSize();
  undo.length = 0; redo.length = 0;
  setCanvasSize(d.w, d.h, false, "#ffffff");
  S.fileName = "sin título"; setTitle();
  setZoom(1, { x: 0, y: 0 }); ws.scrollLeft = 0; ws.scrollTop = 0;
  markDirty(); S.dirty = false;
}
function fileOpen() { $("fileOpen").value = ""; $("fileOpen").click(); }
$("fileOpen").addEventListener("change", async (e) => {
  const f = e.target.files[0]; if (!f) return;
  try { await openImage(f, f.name); } catch { msgBox("Paint 98 no puede leer este archivo.<br>No es un archivo de imagen válido o su formato no es compatible."); }
});
async function openImage(blob, name) {
  const c = await blobToCanvas(blob);
  commitAll();
  if (!(await askSave())) return;
  undo.length = 0; redo.length = 0;
  setCanvasSize(c.width, c.height, false, "transparent");
  ctx.drawImage(c, 0, 0);
  S.fileName = (name || "imagen").replace(/\.[^.]+$/, "") || "imagen"; setTitle();
  const fit = Math.min(ws.clientWidth / c.width, ws.clientHeight / c.height);
  setZoom(1, { x: 0, y: 0 }); ws.scrollLeft = 0; ws.scrollTop = 0;
  void fit;
  markDirty(); S.dirty = false; saveSettings();
}
function pasteFrom() { $("filePasteFrom").value = ""; $("filePasteFrom").click(); }
$("filePasteFrom").addEventListener("change", async (e) => {
  const f = e.target.files[0]; if (!f) return;
  try { pasteCanvas(await blobToCanvas(f)); } catch { msgBox("Paint 98 no puede leer este archivo."); }
});
function flatCanvas() {
  const c = copyCanvas(cv);
  if (sel && sel.floating) c.getContext("2d").drawImage(selcv, sel.x, sel.y);
  return c;
}
async function saveBlob(blob, name) {
  const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (window.showSaveFilePicker) {
    try {
      const h = await window.showSaveFilePicker({ suggestedName: name, types: [{ description: "Imagen PNG", accept: { "image/png": [".png"] } }] });
      const w = await h.createWritable(); await w.write(blob); await w.close(); return true;
    } catch (err) { if (err && err.name === "AbortError") return false; }
  }
  const file = new File([blob], name, { type: "image/png" });
  if (isIOS && navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file] }); return true; } catch (err) { if (err && err.name === "AbortError") return false; }
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  return true;
}
async function exportPNG(source) {
  const isSel = source instanceof HTMLCanvasElement;
  const r = await dialog({
    title: isSel ? "Copiar en" : "Guardar como",
    html: `<div class="row"><label for="dName">Nombre de archivo:</label></div>
      <div class="row"><input id="dName" class="field" style="width:100%" value="${esc(isSel ? "selección" : S.fileName)}"></div>
      <div class="row"><label>Guardar como tipo:</label></div>
      <div class="row"><select class="field" style="width:100%"><option>PNG (*.png)</option></select></div>`,
    buttons: [["Guardar", "ok", true], ["Cancelar", "cancel"]],
    init: (b) => { const i = b.querySelector("#dName"); i.focus(); i.select(); },
  });
  if (r.btn !== "ok") return false;
  let name = (r.body.querySelector("#dName").value.trim() || "sin título").replace(/[\\/:*?"<>|]/g, "_");
  const c = isSel ? source : flatCanvas();
  const blob = await new Promise((res) => c.toBlob(res, "image/png"));
  const ok = await saveBlob(blob, name.replace(/\.png$/i, "") + ".png");
  if (ok && !isSel) { S.fileName = name.replace(/\.png$/i, ""); S.dirty = false; setTitle(); saveSettings(); autosave(); }
  return ok;
}
async function shareImg() {
  const c = flatCanvas();
  const blob = await new Promise((res) => c.toBlob(res, "image/png"));
  const file = new File([blob], S.fileName + ".png", { type: "image/png" });
  try { await navigator.share({ files: [file], title: S.fileName }); } catch {}
}
function printImg() {
  $("printArea").innerHTML = `<img src="${flatCanvas().toDataURL()}" alt="">`;
  setTimeout(() => window.print(), 60);
}
function viewBitmap() {
  const v = $("viewbmp");
  v.style.backgroundImage = `url(${flatCanvas().toDataURL()})`;
  v.classList.toggle("actual", cv.width <= innerWidth && cv.height <= innerHeight);
  v.hidden = false;
}
$("viewbmp").addEventListener("click", () => ($("viewbmp").hidden = true));

// ---------- Imagen ----------
function transformCanvas(src, f) {
  const w = src.width, h = src.height;
  if (f === "h" || f === "v" || f === 180) {
    const c = newCanvas(w, h), x = c.getContext("2d");
    if (f === "h") { x.translate(w, 0); x.scale(-1, 1); }
    if (f === "v") { x.translate(0, h); x.scale(1, -1); }
    if (f === 180) { x.translate(w, h); x.rotate(Math.PI); }
    x.drawImage(src, 0, 0); return c;
  }
  const c = newCanvas(h, w), x = c.getContext("2d");
  if (f === 90) { x.translate(h, 0); x.rotate(Math.PI / 2); } else { x.translate(0, w); x.rotate(-Math.PI / 2); }
  x.drawImage(src, 0, 0); return c;
}
function stretchSkew(src, sx, sy, kx, ky, bg) {
  const w = Math.max(1, Math.round(src.width * sx)), h = Math.max(1, Math.round(src.height * sy));
  const st = newCanvas(w, h), sc = st.getContext("2d");
  sc.imageSmoothingEnabled = false; sc.drawImage(src, 0, 0, w, h);
  if (!kx && !ky) return st;
  const tx = Math.tan((kx * Math.PI) / 180), ty = Math.tan((ky * Math.PI) / 180);
  const W = Math.round(w + Math.abs(tx) * h), Hh = Math.round(h + Math.abs(ty) * w);
  const c = newCanvas(W, Hh), x = c.getContext("2d");
  if (bg && bg !== "transparent") { x.fillStyle = bg; x.fillRect(0, 0, W, Hh); }
  x.imageSmoothingEnabled = false;
  x.setTransform(1, ty, tx, 1, tx < 0 ? -tx * h : 0, ty < 0 ? -ty * w : 0);
  x.drawImage(st, 0, 0);
  return c;
}
function applyImage(fn, bgForWhole) { // aplica a la selección (si hay) o a toda la imagen
  commitText(); finishCurve(); finishPoly();
  if (sel) {
    liftSel();
    sel.src = fn(sel.src, null); sel.w = sel.src.width; sel.h = sel.src.height; selDirty = true; renderSel(true); markDirty();
    return;
  }
  pushUndo();
  const out = fn(copyCanvas(cv), bgForWhole ? S.secondary : null);
  setCanvasSize(out.width, out.height, false);
  ctx.drawImage(out, 0, 0);
}
function invertColors() {
  applyImage((src) => {
    const c = copyCanvas(src), x = c.getContext("2d"), img = x.getImageData(0, 0, c.width, c.height), d = img.data;
    for (let i = 0; i < d.length; i += 4) { d[i] = 255 - d[i]; d[i + 1] = 255 - d[i + 1]; d[i + 2] = 255 - d[i + 2]; }
    x.putImageData(img, 0, 0); return c;
  });
}
async function flipRotateDlg() {
  const r = await dialog({
    title: "Voltear y girar",
    html: `<fieldset class="g98"><legend>Voltear o girar</legend>
      <label class="rl"><input type="radio" name="fr" value="h" checked>Voltear horizontalmente</label>
      <label class="rl"><input type="radio" name="fr" value="v">Voltear verticalmente</label>
      <label class="rl"><input type="radio" name="fr" value="r">Girar en grados</label>
      <div style="padding-left:24px">
      <label class="rl"><input type="radio" name="deg" value="90" checked>90°</label>
      <label class="rl"><input type="radio" name="deg" value="180">180°</label>
      <label class="rl"><input type="radio" name="deg" value="270">270°</label></div></fieldset>`,
    buttons: [["Aceptar", "ok", true], ["Cancelar", "cancel"]],
  });
  if (r.btn !== "ok") return;
  const v = r.body.querySelector("[name=fr]:checked").value;
  const f = v === "r" ? +r.body.querySelector("[name=deg]:checked").value : v;
  applyImage((src) => transformCanvas(src, f));
}
async function stretchDlg() {
  const r = await dialog({
    title: "Expandir y contraer",
    html: `<fieldset class="g98"><legend>Expandir</legend>
      <div class="row"><label for="sh">Horizontal:</label><input id="sh" class="field" type="number" min="1" max="500" value="100"> %</div>
      <div class="row"><label for="sv">Vertical:</label><input id="sv" class="field" type="number" min="1" max="500" value="100"> %</div></fieldset>
      <fieldset class="g98"><legend>Inclinar</legend>
      <div class="row"><label for="kh">Horizontal:</label><input id="kh" class="field" type="number" min="-89" max="89" value="0"> grados</div>
      <div class="row"><label for="kv">Vertical:</label><input id="kv" class="field" type="number" min="-89" max="89" value="0"> grados</div></fieldset>`,
    buttons: [["Aceptar", "ok", true], ["Cancelar", "cancel"]],
  });
  if (r.btn !== "ok") return;
  const g = (id, d, a, b) => { const n = parseFloat(r.body.querySelector(id).value); return isFinite(n) ? clamp(n, a, b) : d; };
  const sh = g("#sh", 100, 1, 500) / 100, sv = g("#sv", 100, 1, 500) / 100, kh = g("#kh", 0, -89, 89), kv = g("#kv", 0, -89, 89);
  if (Math.round(cv.width * sh) * Math.round(cv.height * sv) > 40e6) return msgBox("La imagen resultante es demasiado grande.");
  applyImage((src, bg) => stretchSkew(src, sh, sv, kh, kv, bg), true);
}
async function attributesDlg() {
  commitAll();
  const r = await dialog({
    title: "Atributos",
    html: `<div class="row"><label for="aw">Ancho:</label><input id="aw" class="field" type="number" min="1" max="8000" value="${cv.width}"></div>
      <div class="row"><label for="ah">Alto:</label><input id="ah" class="field" type="number" min="1" max="8000" value="${cv.height}"></div>
      <fieldset class="g98" style="margin-top:10px"><legend>Unidades</legend>
      <label class="rl"><input type="radio" name="u" checked>Píxeles</label></fieldset>`,
    buttons: [["Aceptar", "ok", true], ["Cancelar", "cancel"], ["Predeterminado", "def"]],
  });
  if (r.btn === "def") { const d = defaultSize(); pushUndo(); setCanvasSize(d.w, d.h); return; }
  if (r.btn !== "ok") return;
  const w = parseInt(r.body.querySelector("#aw").value, 10), h = parseInt(r.body.querySelector("#ah").value, 10);
  if (!(w > 0 && h > 0)) return;
  if (w !== cv.width || h !== cv.height) { pushUndo(); setCanvasSize(w, h); }
}
function clearImage() {
  commitText(); finishCurve(); finishPoly();
  if (sel) { deleteSel(); return; }
  pushUndo(); R.ink(ctx, S.secondary); ctx.fillRect(0, 0, cv.width, cv.height); R.ink(ctx, "#000");
}
async function zoomDlg() {
  const r = await dialog({
    title: "Zoom personalizado",
    html: `<div class="row">Zoom actual: ${S.zoom * 100}%</div><fieldset class="g98"><legend>Zoom a</legend>
      ${[1, 2, 4, 6, 8].map((z) => `<label class="rl"><input type="radio" name="z" value="${z}"${z === S.zoom ? " checked" : ""}>${z * 100}%</label>`).join("")}</fieldset>`,
    buttons: [["Aceptar", "ok", true], ["Cancelar", "cancel"]],
  });
  if (r.btn !== "ok") return;
  const c = r.body.querySelector("[name=z]:checked"); if (c) setZoom(+c.value);
}

// ---------- Diálogos ----------
function dialog({ title, html, icon: ic, buttons = [["Aceptar", "ok", true]], init, cls = "" }) {
  return new Promise((resolve) => {
    const m = $("modal");
    m.innerHTML = `<div class="window dlg ${cls}" role="dialog" aria-label="${esc(title)}">
      <div class="titlebar"><span class="ttext">${esc(title)}</span><div class="tbtns"><button class="tbtn close" data-b="cancel" aria-label="Cerrar"></button></div></div>
      <div class="body">${ic ? `<div class="msgrow">${iconImg(ic)}<div>${html}</div></div>` : html}</div>
      <div class="btns">${buttons.map(([l, v, d]) => `<button class="btn98${d ? " def" : ""}" data-b="${v}">${l}</button>`).join("")}</div></div>`;
    m.hidden = false;
    const body = m.querySelector(".body");
    const done = (btn) => { m.hidden = true; m.onclick = null; document.removeEventListener("keydown", key, true); resolve({ btn, body }); m.innerHTML = ""; };
    const key = (e) => {
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); done(buttons.some((b) => b[1] === "cancel") ? "cancel" : buttons[0][1]); }
      else if (e.key === "Enter" && e.target.tagName !== "BUTTON") { e.preventDefault(); e.stopPropagation(); done((buttons.find((b) => b[2]) || buttons[0])[1]); }
    };
    document.addEventListener("keydown", key, true);
    m.onclick = (e) => { const b = e.target.closest("[data-b]"); if (b) { const body2 = body; done(b.dataset.b === "cancel" && !buttons.some((x) => x[1] === "cancel") ? buttons[0][1] : b.dataset.b); void body2; } };
    if (init) init(body); else m.querySelector(".btn98.def")?.focus();
  });
}
function msgBox(html) { return dialog({ title: "Paint 98", icon: "warn", html }); }
function aboutDlg() {
  dialog({
    title: "Acerca de Paint 98",
    html: `<div class="about"><img src="icons/icon-192.png" alt=""><div>
      <b>Paint 98</b><br>Versión 1.0<br><br>
      Programa de dibujo con estilo de escritorio clásico, hecho en JavaScript.
      Funciona en el navegador y sin conexión, y se puede instalar en la pantalla de inicio.
      <hr>Tamaño de la imagen: ${cv.width} x ${cv.height} píxeles</div></div>`,
  });
}
function helpDlg() {
  dialog({
    title: "Temas de Ayuda: Paint 98",
    html: `<div class="help">
      <p><b>Dibujar:</b> elige una herramienta y arrastra sobre la imagen. Clic izquierdo usa el color de primer plano; clic derecho, el de fondo.</p>
      <p><b>Colores:</b> toca un color para elegirlo. Mantén presionado un color para ponerlo como color de fondo. Toca dos veces para modificarlo. Toca el cuadro de colores actuales para intercambiarlos.</p>
      <p><b>Pantalla táctil:</b> usa dos dedos para mover la imagen; sepáralos o júntalos para ampliar o reducir.</p>
      <p><b>Más espacio:</b> el botón a la derecha del menú (o Ver ▸ Cuadro de herramientas) oculta las herramientas.</p>
      <p><b>Curva:</b> traza la línea y luego toca una o dos veces para doblarla. <b>Polígono:</b> toca cada vértice y termina tocando el punto inicial (o doble clic).</p>
      <p><b>Selección:</b> arrastra para mover; usa los cuadritos para cambiar el tamaño. Ctrl + arrastrar copia; Mayús + arrastrar deja un rastro.</p>
      <p><b>Mayús</b> al dibujar: líneas rectas a 45°, cuadrados y círculos perfectos.</p>
      <p><b>Teclas + y −:</b> hacen más grueso o más delgado el trazo de la herramienta actual, incluso mientras estás dibujando (antes de soltar el clic).</p>
      <p><b>Transparente:</b> el cuadro con cuadrícula de la paleta pinta transparencia; al guardar como PNG esa zona queda transparente. El cuadro de colores (arcoíris) abre el selector de cualquier color.</p>
      <p><b>Cuadro de colores:</b> arrástralo por su agarradera (las rayitas) para ponerlo abajo, arriba o a la izquierda.</p>
      <p><b>Temas:</b> toca el ícono de arriba a la izquierda para cambiar los colores de la ventana.</p>
      <p><b>Archivo:</b> "Abrir o importar imagen" carga cualquier imagen; "Guardar como PNG" la exporta. Tu dibujo se guarda solo en este dispositivo.</p></div>`,
  });
}

// ---------- Menús ----------
const canShare = !!(navigator.canShare && navigator.canShare({ files: [new File([""], "a.png", { type: "image/png" })] }));
const MENUS = [
  ["&Archivo", () => [
    ["&Nuevo", "Ctrl+N", fileNew],
    ["&Abrir o importar imagen...", "Ctrl+O", fileOpen],
    ["&Guardar como PNG...", "Ctrl+S", () => { commitText(); exportPNG(); }],
    canShare && ["&Compartir imagen...", "", shareImg],
    "-",
    ["&Imprimir...", "Ctrl+P", printImg],
    "-",
    ["Ce&rrar imagen", "", closeWin],
  ]],
  ["&Edición", () => [
    ["&Deshacer", "Ctrl+Z", doUndo, { dis: !undo.length && !tb && !curve && !poly && !(sel && sel.floating) }],
    ["&Repetir", "Ctrl+Y", doRedo, { dis: !redo.length }],
    "-",
    ["Cor&tar", "Ctrl+X", cutSel, { dis: !sel }],
    ["&Copiar", "Ctrl+C", copySel, { dis: !sel }],
    ["&Pegar", "Ctrl+V", paste],
    ["&Borrar selección", "Supr", deleteSel, { dis: !sel }],
    ["&Seleccionar todo", "Ctrl+A", selectAll],
    "-",
    ["C&opiar en...", "", async () => { if (sel) exportPNG(selPixels()); }, { dis: !sel }],
    ["P&egar desde...", "", pasteFrom],
  ]],
  ["&Ver", () => [
    ["Cuadro de &herramientas", "Ctrl+T", () => toggleView("showTools"), { chk: S.showTools }],
    ["Cuadro de &colores", "Ctrl+L", () => toggleView("showColors"), { chk: S.showColors }],
    ["&Barra de estado", "", () => toggleView("showStatus"), { chk: S.showStatus }],
    ["Colores &abajo", "", () => { S.dock = "bottom"; applyDock(); saveSettings(); }, { chk: S.dock === "bottom" }],
    ["Colores a&rriba", "", () => { S.dock = "top"; applyDock(); saveSettings(); }, { chk: S.dock === "top" }],
    ["Colores a la &izquierda", "", () => { S.dock = "left"; applyDock(); saveSettings(); }, { chk: S.dock === "left" }],
    ["Barra de herramientas &Texto", "", () => { S.showFont = !S.showFont; $("fontbar").hidden = !(S.showFont && tb); saveSettings(); }, { chk: S.showFont, dis: S.tool !== "text" }],
    "-",
    ["Zoom &normal", "Ctrl+RePág", () => setZoom(1), { chk: S.zoom === 1 }],
    ["Zoom &grande", "Ctrl+AvPág", () => setZoom(4), { chk: S.zoom === 4 }],
    ["Zoom &personalizado...", "", zoomDlg],
    ["&Mostrar cuadrícula", "Ctrl+G", () => { S.grid = !S.grid; layout(); saveSettings(); }, { chk: S.grid, dis: S.zoom < 4 }],
    "-",
    ["&Ver mapa de bits", "Ctrl+F", viewBitmap],
  ]],
  ["&Imagen", () => [
    ["&Voltear o girar...", "Ctrl+R", flipRotateDlg],
    ["&Expandir o contraer...", "Ctrl+W", stretchDlg],
    ["&Invertir colores", "Ctrl+I", invertColors],
    ["&Atributos...", "Ctrl+E", attributesDlg],
    ["&Borrar imagen", "Ctrl+Mayús+N", clearImage],
    "-",
    ["&Dibujar opaco", "", () => setTransparent(!S.transparent), { chk: !S.transparent }],
  ]],
  ["&Colores", () => [
    ["&Modificar colores...", "", () => editColor()],
    ["&Más colores...", "", () => $("swMore").click()],
    ["&Restablecer colores", "", () => { S.palette = DEFAULT_PALETTE.slice(); renderColors(); }],
  ]],
  ["Ay&uda", () => [
    ["&Temas de Ayuda", "F1", helpDlg],
    "-",
    ["&Acerca de Paint 98", "", aboutDlg],
  ]],
];
const ul = (s) => esc(s).replace(/&amp;(.)/, "<u>$1</u>");
$("menus").innerHTML = MENUS.map(([l], i) => `<div class="mlabel" data-m="${i}">${ul(l)}</div>`).join("");
let openIdx = -1, menuItems = [];
function openMenu(i) {
  commitText();
  openIdx = i;
  document.querySelectorAll(".mlabel").forEach((el, k) => el.classList.toggle("open", k === i));
  $("sysIcon").classList.toggle("open", i === "sys");
  menuItems = (i === "sys" ? SYSMENU : MENUS[i][1])().filter(Boolean);
  const dd = $("dropdown");
  dd.innerHTML = menuItems.map((it, k) => it === "-" ? `<div class="msep"></div>` :
    `<div class="mi${it[3]?.dis ? " dis" : ""}" data-k="${k}"><span class="chk">${it[3]?.chk ? "✓" : ""}</span><span class="lbl">${ul(it[0])}</span><span class="key">${COARSE ? "" : esc(it[1])}</span></div>`).join("");
  dd.hidden = false;
  const r = (i === "sys" ? $("sysIcon") : document.querySelector(`.mlabel[data-m="${i}"]`)).getBoundingClientRect();
  dd.style.top = r.bottom + "px";
  dd.style.left = Math.max(2, Math.min(r.left, innerWidth - dd.offsetWidth - 2)) + "px";
}
function closeMenu() {
  if (openIdx === -1) return;
  openIdx = -1; $("dropdown").hidden = true; $("sysIcon").classList.remove("open");
  document.querySelectorAll(".mlabel.open").forEach((el) => el.classList.remove("open"));
}
$("menus").addEventListener("pointerdown", (e) => {
  const l = e.target.closest(".mlabel"); if (!l) return;
  e.preventDefault();
  const i = +l.dataset.m;
  if (openIdx === i) closeMenu(); else openMenu(i);
});
$("menus").addEventListener("pointerover", (e) => {
  const l = e.target.closest(".mlabel");
  if (l && openIdx !== -1 && +l.dataset.m !== openIdx) openMenu(+l.dataset.m);
});
$("dropdown").addEventListener("click", (e) => {
  const mi = e.target.closest(".mi"); if (!mi || mi.classList.contains("dis")) return;
  const it = menuItems[+mi.dataset.k];
  closeMenu();
  it[2]();
});
document.addEventListener("pointerdown", (e) => {
  if (openIdx !== -1 && !e.target.closest("#dropdown") && !e.target.closest("#menus") && !e.target.closest("#sysIcon")) closeMenu();
}, true);

function toggleView(k) {
  S[k] = !S[k];
  applyView();
  saveSettings();
}
function applyView() {
  $("toolbox").hidden = !S.showTools;
  $("colorbox").hidden = !S.showColors;
  $("statusbar").hidden = !S.showStatus;
  $("toggleTools").classList.toggle("on", S.showTools);
  layout();
}
const SYSMENU = () => [
  ...THEMES.map(([id, name]) => [`Tema: ${name}`, "", () => setTheme(id), { chk: S.theme === id }]),
  "-",
  ["Mi&nimizar", "", minimize],
  ["Ma&ximizar", "", () => $("btnMax").click()],
  "-",
  ["&Cerrar", "Alt+F4", closeWin],
];
$("sysIcon").addEventListener("pointerdown", (e) => { e.preventDefault(); e.stopPropagation(); if (openIdx === "sys") closeMenu(); else openMenu("sys"); });
$("toggleTools").innerHTML = iconImg("tools");
$("toggleTools").addEventListener("click", () => toggleView("showTools"));

// ---------- Barra de fuentes ----------
$("fSize").innerHTML = SIZES.map((s) => `<option>${s}</option>`).join("");
function syncFontbar() {
  $("fFamily").value = S.font.family; $("fSize").value = String(S.font.size);
  $("fBold").classList.toggle("on", S.font.bold); $("fItalic").classList.toggle("on", S.font.italic); $("fUnder").classList.toggle("on", S.font.underline);
}
function fontChanged() { syncFontbar(); positionText(); growText(); saveSettings(); if (tb) textedit.focus({ preventScroll: true }); }
$("fFamily").addEventListener("change", (e) => { S.font.family = e.target.value; fontChanged(); });
$("fSize").addEventListener("change", (e) => { S.font.size = +e.target.value; fontChanged(); });
for (const [id, k] of [["fBold", "bold"], ["fItalic", "italic"], ["fUnder", "underline"]]) {
  $(id).addEventListener("pointerdown", (e) => e.preventDefault()); // no quitar el foco del texto
  $(id).addEventListener("click", () => { S.font[k] = !S.font[k]; fontChanged(); });
}
$("fontClose").addEventListener("click", () => { S.showFont = false; $("fontbar").hidden = true; saveSettings(); });
// Arrastrar la barra de fuentes por su título
$("fontbar").querySelector(".titlebar").addEventListener("pointerdown", (e) => {
  if (e.target.closest("button")) return;
  const fb = $("fontbar"), r = fb.getBoundingClientRect(), dx = e.clientX - r.left, dy = e.clientY - r.top;
  e.preventDefault();
  const mv = (ev) => { fb.style.transform = "none"; fb.style.left = clamp(ev.clientX - dx, 0, innerWidth - 60) + "px"; fb.style.top = clamp(ev.clientY - dy, 0, innerHeight - 30) + "px"; };
  const up = () => { removeEventListener("pointermove", mv); removeEventListener("pointerup", up); };
  addEventListener("pointermove", mv); addEventListener("pointerup", up);
});

// ---------- Ventana ----------
document.documentElement.style.setProperty("--ic-close", `url(${icon("close")})`);
document.documentElement.style.setProperty("--ic-min", `url(${icon("min")})`);
document.documentElement.style.setProperty("--ic-max", `url(${icon("max")})`);
document.documentElement.style.setProperty("--ic-restore", `url(${icon("restore")})`);
function minimize() {
  commitText();
  $("win").hidden = true;
  let tbar = $("taskbar");
  if (!tbar) {
    tbar = document.createElement("div"); tbar.id = "taskbar";
    tbar.innerHTML = `<button class="btn98" id="tbStart"><img class="px" src="icons/logo-32.png" alt="">Inicio</button>
      <button class="btn98 task" id="tbTask"><img class="px" src="icons/logo-32.png" alt="">${esc(S.fileName)} - Paint 98</button>`;
    const di = document.createElement("button"); di.className = "deskicon"; di.id = "deskIcon";
    di.innerHTML = `<img src="icons/icon-192.png" alt=""><span>Paint 98</span>`;
    document.body.append(tbar, di);
    for (const el of [tbar.querySelector("#tbTask"), tbar.querySelector("#tbStart"), di]) el.addEventListener("click", restoreWin);
  }
  tbar.hidden = false; $("deskIcon").hidden = false;
}
function restoreWin() { $("taskbar").hidden = true; $("deskIcon").hidden = true; $("win").hidden = false; layout(); }
async function closeWin() {
  commitAll();
  if (!(await askSave())) return;
  S.dirty = false;
  fileNew();
}
$("btnMin").addEventListener("click", minimize);
$("btnMax").addEventListener("click", () => {
  if (document.fullscreenElement) document.exitFullscreen?.();
  else document.documentElement.requestFullscreen?.().catch(() => {});
});
document.addEventListener("fullscreenchange", () => $("btnMax").classList.toggle("restore", !!document.fullscreenElement));
$("btnClose").addEventListener("click", closeWin);
$("titlebar").addEventListener("dblclick", () => $("btnMax").click());

// ---------- Teclado, pegar y soltar archivos ----------
document.addEventListener("keydown", (e) => {
  if (!$("modal").hidden) return;
  if (!$("viewbmp").hidden) { $("viewbmp").hidden = true; e.preventDefault(); return; }
  const typing = e.target === textedit || e.target.matches?.("input, select, textarea");
  if (e.key === "Escape") {
    closeMenu();
    if (op) cancelOp();
    else if (tb) cancelText();
    else if (curve || poly) { curve = poly = null; clearOv(); }
    else if (sel) commitSel();
    return;
  }
  if (e.key === "F1") { e.preventDefault(); helpDlg(); return; }
  const mod = e.ctrlKey || e.metaKey;
  if (typing && !(mod && ["s", "o", "n"].includes(e.key.toLowerCase()))) return;
  if ((e.key === "Delete" || e.key === "Backspace") && sel) { e.preventDefault(); deleteSel(); return; }
  if (!mod && !e.altKey) {
    if (e.key === "+" || e.key === "=" || e.code === "NumpadAdd") { e.preventDefault(); bumpSize(1); return; }
    if (e.key === "-" || e.key === "_" || e.code === "NumpadSubtract") { e.preventDefault(); bumpSize(-1); return; }
  }
  if (!mod) return;
  const k = e.key.toLowerCase();
  const map = {
    n: () => (e.shiftKey ? clearImage() : fileNew()), o: fileOpen, s: () => { commitText(); exportPNG(); }, p: printImg,
    z: () => (e.shiftKey ? doRedo() : doUndo()), y: doRedo, x: cutSel, c: copySel, a: selectAll,
    t: () => toggleView("showTools"), l: () => toggleView("showColors"), g: () => { S.grid = !S.grid; layout(); },
    r: flipRotateDlg, w: stretchDlg, i: invertColors, e: attributesDlg, f: viewBitmap,
    pageup: () => setZoom(1), pagedown: () => setZoom(4),
  };
  if (k === "v") return; // lo maneja el evento "paste"
  if (map[k]) { e.preventDefault(); map[k](); }
});
document.addEventListener("paste", async (e) => {
  if (e.target === textedit || e.target.matches?.("input, textarea")) return;
  const item = [...(e.clipboardData?.items || [])].find((i) => i.type.startsWith("image/"));
  e.preventDefault();
  if (item) { pasteCanvas(await blobToCanvas(item.getAsFile())); return; }
  if (clip) pasteCanvas(copyCanvas(clip));
});
addEventListener("dragover", (e) => e.preventDefault());
addEventListener("drop", (e) => {
  e.preventDefault();
  const f = [...(e.dataTransfer?.files || [])].find((x) => x.type.startsWith("image/"));
  if (f) openImage(f, f.name).catch(() => msgBox("Paint 98 no puede leer este archivo."));
});
document.addEventListener("gesturestart", (e) => e.preventDefault());
addEventListener("resize", () => { closeMenu(); layout(); });
addEventListener("pagehide", autosave);
document.addEventListener("visibilitychange", () => { if (document.hidden) autosave(); });

// ---------- Inicio ----------
async function init() {
  applyTheme(); applyDock();
  renderTools(); renderOptions(); renderColors(); syncFontbar(); applyView();
  status(); setTitle();
  let restored = false;
  try {
    const rec = await idb.get("image");
    if (rec && rec.blob) {
      const c = await blobToCanvas(rec.blob);
      setCanvasSize(c.width, c.height, false, "transparent");
      ctx.drawImage(c, 0, 0);
      S.dirty = !!rec.dirty;
      restored = true;
    }
  } catch {}
  if (!restored) { const d = defaultSize(); setCanvasSize(d.w, d.h, false, "#ffffff"); }
  stage.className = "stage t-" + S.tool;
  if ("serviceWorker" in navigator && location.protocol !== "file:") navigator.serviceWorker.register("sw.js").catch(() => {});
}
init();
window.__paint = { S, cv, setTool, get sel() { return sel; } }; // para pruebas
