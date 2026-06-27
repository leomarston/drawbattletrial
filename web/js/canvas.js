// ============================================================================
// DrawBattle — drawing surface controller.
//
// Tools: brush, eraser, fill (flood), line, eyedropper. Sizes, colors,
// undo/redo, clear. Every committed action is also pushed to `ops` as a plain
// serializable object with NORMALIZED (0..1) coordinates — that array is
// exactly what you'd broadcast over a network (resolution-independent).
// Undo/redo here uses pixel snapshots for robustness; over the wire you'd send
// an 'undo' op instead.
// ============================================================================

const PAPER_TOP = '#ffffff';
const SIZES = [4, 10, 18]; // small / medium / large

export class DrawCanvas {
  constructor(canvasEl, { onColorPick } = {}) {
    this.cv = canvasEl;
    this.ctx = canvasEl.getContext('2d', { willReadFrequently: true });
    this.onColorPick = onColorPick || (() => {});

    this.tool = 'brush';
    this.color = '#FB7185';
    this.size = SIZES[2];
    this.enabled = false;

    this.ops = [];           // serializable history (network model)
    this.snapshots = [];     // ImageData stack for undo/redo
    this.snapIndex = -1;

    this._drawing = false;
    this._pts = [];
    this._preSnapshot = null; // for line preview

    this._resize();
    this._bind();
    window.addEventListener('resize', () => this._resize(true));
  }

  // ---- sizing (handles devicePixelRatio for crisp lines) -----------------
  _resize(preserve = false) {
    const rect = this.cv.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const prev = preserve && this.cv.width ? this.ctx.getImageData(0, 0, this.cv.width, this.cv.height) : null;
    this.cv.width = Math.round(rect.width * dpr);
    this.cv.height = Math.round(rect.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.w = rect.width; this.h = rect.height;
    if (prev) this.ctx.putImageData(prev, 0, 0);
    else this.clear(true);
  }

  // ---- public API --------------------------------------------------------
  setTool(t) { this.tool = t; }
  setColor(c) { this.color = c; }
  setSizeIndex(i) { this.size = SIZES[Math.max(0, Math.min(SIZES.length - 1, i))]; }
  setEnabled(on) {
    this.enabled = on;
    this.cv.style.pointerEvents = on ? 'auto' : 'none';
    this.cv.style.cursor = on ? 'crosshair' : 'default';
  }

  // Recompute size after the canvas becomes visible / the window resizes.
  relayout() { this._resize(false); }

  // Fresh board for a new turn (clears history too).
  newTurn() {
    this.ops = [];
    this.snapshots = [];
    this.snapIndex = -1;
    this.clear(true);
  }

  clear(silent = false) {
    this.ctx.save();
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.fillStyle = PAPER_TOP;
    this.ctx.fillRect(0, 0, this.cv.width, this.cv.height);
    this.ctx.restore();
    if (!silent) { this.ops.push({ t: 'clear' }); this._snapshot(); }
  }

  undo() {
    if (this.snapIndex <= 0) {
      if (this.snapIndex === 0) { this.snapIndex--; this._blank(); }
      return;
    }
    this.snapIndex--;
    this._restore(this.snapshots[this.snapIndex]);
  }

  redo() {
    if (this.snapIndex >= this.snapshots.length - 1) return;
    this.snapIndex++;
    this._restore(this.snapshots[this.snapIndex]);
  }

  getOps() { return this.ops; }

  // ---- snapshots ---------------------------------------------------------
  _snapshot() {
    const img = this.ctx.getImageData(0, 0, this.cv.width, this.cv.height);
    this.snapshots = this.snapshots.slice(0, this.snapIndex + 1);
    this.snapshots.push(img);
    if (this.snapshots.length > 26) this.snapshots.shift();
    this.snapIndex = this.snapshots.length - 1;
  }
  _restore(img) {
    this.ctx.save();
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.putImageData(img, 0, 0);
    this.ctx.restore();
  }
  _blank() {
    this.ctx.save();
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.fillStyle = PAPER_TOP;
    this.ctx.fillRect(0, 0, this.cv.width, this.cv.height);
    this.ctx.restore();
  }

  // ---- pointer handling --------------------------------------------------
  _bind() {
    this.cv.addEventListener('pointerdown', e => this._down(e));
    this.cv.addEventListener('pointermove', e => this._move(e));
    window.addEventListener('pointerup', e => this._up(e));
  }
  _pos(e) {
    const r = this.cv.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  _down(e) {
    if (!this.enabled) return;
    const p = this._pos(e);

    if (this.tool === 'eyedropper') {
      const c = this._sampleColor(p.x, p.y);
      if (c) { this.color = c; this.onColorPick(c); }
      return;
    }
    if (this.tool === 'fill') {
      this._floodFill(p.x, p.y, this.color);
      this.ops.push({ t: 'fill', x: p.x / this.w, y: p.y / this.h, color: this.color });
      this._snapshot();
      return;
    }

    this._drawing = true;
    this._pts = [p];
    if (this.tool === 'line') {
      this._preSnapshot = this.ctx.getImageData(0, 0, this.cv.width, this.cv.height);
    } else {
      this._stamp(p, p); // dot on click
    }
    this.cv.setPointerCapture?.(e.pointerId);
  }

  _move(e) {
    if (!this._drawing || !this.enabled) return;
    const p = this._pos(e);
    const prev = this._pts[this._pts.length - 1];

    if (this.tool === 'line') {
      this._restore(this._preSnapshot);
      this._stroke(this._pts[0], p, this.color, this.size);
    } else {
      this._stamp(prev, p);
    }
    this._pts.push(p);
  }

  _up() {
    if (!this._drawing) return;
    this._drawing = false;
    const pts = this._pts;
    const norm = pts.map(q => [+(q.x / this.w).toFixed(4), +(q.y / this.h).toFixed(4)]);

    if (this.tool === 'line') {
      this.ops.push({ t: 'line', color: this.color, size: this.size, a: norm[0], b: norm[norm.length - 1] });
    } else {
      this.ops.push({ t: this.tool, color: this.color, size: this.size, pts: norm });
    }
    this._preSnapshot = null;
    this._snapshot();
  }

  // ---- low-level drawing -------------------------------------------------
  _stamp(a, b) {
    if (this.tool === 'eraser') {
      this._stroke(a, b, PAPER_TOP, this.size * 1.6);
    } else {
      this._stroke(a, b, this.color, this.size);
    }
  }
  _stroke(a, b, color, size) {
    const ctx = this.ctx;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(b.x, b.y, size / 2, 0, Math.PI * 2);
    ctx.fill();
  }

  _sampleColor(x, y) {
    const dpr = window.devicePixelRatio || 1;
    const d = this.ctx.getImageData(Math.round(x * dpr), Math.round(y * dpr), 1, 1).data;
    if (d[3] === 0) return null;
    return '#' + [d[0], d[1], d[2]].map(v => v.toString(16).padStart(2, '0')).join('');
  }

  // ---- flood fill (scanline-ish, stack based) ----------------------------
  _floodFill(x, y, hex) {
    const dpr = window.devicePixelRatio || 1;
    const W = this.cv.width, H = this.cv.height;
    const sx = Math.round(x * dpr), sy = Math.round(y * dpr);
    if (sx < 0 || sy < 0 || sx >= W || sy >= H) return;

    const img = this.ctx.getImageData(0, 0, W, H);
    const data = new Uint32Array(img.data.buffer);
    const idx = sy * W + sx;
    const target = data[idx];

    const fill = hexToABGR(hex);
    if (target === fill) return;

    const tol = 60;
    const tr = target & 255, tg = (target >> 8) & 255, tb = (target >> 16) & 255;
    const match = (c) => {
      const r = c & 255, g = (c >> 8) & 255, b = (c >> 16) & 255;
      return Math.abs(r - tr) <= tol && Math.abs(g - tg) <= tol && Math.abs(b - tb) <= tol;
    };

    const stack = [idx];
    while (stack.length) {
      let i = stack.pop();
      if (!match(data[i])) continue;
      // walk left
      let x0 = i % W;
      let left = i;
      while (x0 > 0 && match(data[left - 1])) { left--; x0--; }
      // walk right
      let right = i;
      let x1 = right % W;
      while (x1 < W - 1 && match(data[right + 1])) { right++; x1++; }
      // fill span, push above/below
      for (let s = left; s <= right; s++) {
        data[s] = fill;
        if (s - W >= 0 && match(data[s - W])) stack.push(s - W);
        if (s + W < data.length && match(data[s + W])) stack.push(s + W);
      }
    }
    this.ctx.putImageData(img, 0, 0);
  }

  // ---- bot drawing: render a normalized doodle up to `frac` (0..1) --------
  // Does NOT touch ops/undo — it's local simulation of an opponent drawing.
  renderDoodle(doodle, frac) {
    this._blank();
    const totalPts = doodle.strokes.reduce((n, s) => n + s.pts.length, 0);
    let budget = Math.floor(totalPts * frac);
    for (const s of doodle.strokes) {
      if (budget <= 0) break;
      const n = Math.min(s.pts.length, budget);
      budget -= n;
      for (let i = 1; i < n; i++) {
        this._stroke(
          { x: s.pts[i - 1][0] * this.w, y: s.pts[i - 1][1] * this.h },
          { x: s.pts[i][0] * this.w, y: s.pts[i][1] * this.h },
          s.color, s.size || 6,
        );
      }
    }
  }
}

function hexToABGR(hex) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return (255 << 24) | (b << 16) | (g << 8) | r; // little-endian ABGR
}
