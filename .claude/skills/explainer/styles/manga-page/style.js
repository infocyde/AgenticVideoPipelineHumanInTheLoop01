  // ===================================================================================================
  // MANGA PAGE style helpers. Inlined into each explainer by `npm run explainer -- new`.
  // Part 1 is the reference source (styles/manga-panel.js) exactly as received. The paste was truncated
  // inside pencilRough(), so that function and everything after it (the reference's own explainer(),
  // draw(), explainerSound() and its finishing pass) are missing.
  // Part 2 holds PROVISIONAL stand-ins written to the style card (finish pass, panels, slams, page turn,
  // arrows, lettering). Replace them with the reference's own versions once the full source is in
  // styles/manga-page/reference.js.
  // ===================================================================================================

  // ---------- Part 1: reference source (verbatim) ----------
  // ---------- black & white manga page ----------
  const TAU = Math.PI * 2;
  function poly(ctx, pts) { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.closePath(); }
  function catmull(pts, n = 8, closed = false) {
    const out = [], N = pts.length, get = (i) => closed ? pts[(i + N) % N] : pts[Math.max(0, Math.min(N - 1, i))];
    const segs = closed ? N : N - 1;
    for (let i = 0; i < segs; i++) {
      const p0 = get(i - 1), p1 = get(i), p2 = get(i + 1), p3 = get(i + 2);
      for (let k = 0; k < n; k++) {
        const t = k / n, t2 = t * t, t3 = t2 * t;
        out.push([0, 1].map((j) => 0.5 * ((2 * p1[j]) + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3)));
      }
    }
    if (!closed) out.push(pts[N - 1]);
    return out;
  }
  // brush stroke with taper: pts polyline, w max width, prof(t) width profile
  function brush(ctx, pts, w, prof = (t) => Math.pow(Math.sin(Math.PI * Math.min(1, Math.max(0, t))), 0.55)) {
    const n = pts.length, L = [], R = [];
    for (let i = 0; i < n; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)], tx = b[0] - a[0], ty = b[1] - a[1], m = Math.hypot(tx, ty) || 1;
      const ww = w * prof(i / (n - 1)) / 2 + 0.25;
      L.push([pts[i][0] - ty / m * ww, pts[i][1] + tx / m * ww]); R.push([pts[i][0] + ty / m * ww, pts[i][1] - tx / m * ww]);
    }
    ctx.beginPath(); ctx.moveTo(L[0][0], L[0][1]); for (const p of L) ctx.lineTo(p[0], p[1]); for (let i = n - 1; i >= 0; i--) ctx.lineTo(R[i][0], R[i][1]); ctx.closePath(); ctx.fill();
  }
  const bz = (p0, p1, p2, p3, n = 24) => { const o = []; for (let k = 0; k <= n; k++) { const t = k / n, m = 1 - t; o.push([m * m * m * p0[0] + 3 * m * m * t * p1[0] + 3 * m * t * t * p2[0] + t * t * t * p3[0], m * m * m * p0[1] + 3 * m * m * t * p1[1] + 3 * m * t * t * p2[1] + t * t * t * p3[1]]); } return o; };
  // radial focus lines (集中線)
  function focusLines(ctx, cx, cy, r0, r1, n, r, wMax = 4.5) {
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const a = r() * TAU, w = r.range(0.4, wMax) * (r.chance(0.15) ? 2 : 1), ri = r0 * r.range(1, 1.6), da = w / r1;
      ctx.moveTo(cx + Math.cos(a) * ri, cy + Math.sin(a) * ri);
      ctx.lineTo(cx + Math.cos(a - da) * r1, cy + Math.sin(a - da) * r1);
      ctx.lineTo(cx + Math.cos(a + da) * r1, cy + Math.sin(a + da) * r1);
      ctx.closePath();
    }
    ctx.fill();
  }
  // hand-brushed katakana for SFX (stroke paths in a unit box; each stroke tapers like a brush)
  const KANA = {
    'コ': [[[0.12, 0.22], [0.5, 0.2], [0.82, 0.18], [0.84, 0.5], [0.86, 0.86]], [[0.14, 0.86], [0.5, 0.86], [0.86, 0.86]]],
    'ゴ': [[[0.08, 0.26], [0.45, 0.24], [0.76, 0.22], [0.78, 0.55], [0.8, 0.9]], [[0.1, 0.9], [0.45, 0.9], [0.8, 0.9]], [[0.86, 0.02], [0.9, 0.16]], [[0.99, -0.02], [1.03, 0.12]]],
    'ピ': [[[0.24, 0.08], [0.22, 0.5], [0.26, 0.86], [0.55, 0.88], [0.86, 0.84]], [[0.24, 0.5], [0.5, 0.42], [0.74, 0.32]], ['o', 0.9, 0.12, 0.09]],
    'ッ': [[[0.18, 0.36], [0.26, 0.56]], [[0.44, 0.3], [0.52, 0.5]], [[0.82, 0.3], [0.78, 0.62], [0.55, 0.86], [0.3, 0.98]]],
    'ド': [[[0.38, 0.02], [0.38, 0.5], [0.38, 0.98]], [[0.4, 0.4], [0.6, 0.48], [0.78, 0.6]], [[0.74, 0.04], [0.78, 0.18]], [[0.88, 0.0], [0.92, 0.14]]],
    'ク': [[[0.42, 0.04], [0.3, 0.26], [0.12, 0.46]], [[0.36, 0.2], [0.6, 0.2], [0.86, 0.2], [0.76, 0.56], [0.5, 0.84], [0.24, 0.98]]],
    'ン': [[[0.14, 0.16], [0.26, 0.24], [0.38, 0.36]], [[0.12, 0.92], [0.5, 0.78], [0.76, 0.52], [0.92, 0.22]]],
  };
  function kanaStrokes(ctx, ch, x, y, size, rot, skew, extra, prof) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.transform(1, 0, skew, 1, 0, 0);
    for (const st of KANA[ch]) {
      if (st[0] === 'o') { ctx.beginPath(); ctx.arc((st[1] - 0.5) * size, (st[2] - 0.5) * size, st[3] * size, 0, TAU); ctx.lineWidth = size * 0.05 + extra * 2; ctx.stroke(); continue; }
      const pts = catmull(st.map(([u, v]) => [(u - 0.5) * size, (v - 0.5) * size]), 6);
      const n = pts.length, L = [], R = [];
      for (let i = 0; i < n; i++) {
        const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)], tx = b[0] - a[0], ty = b[1] - a[1], m = Math.hypot(tx, ty) || 1;
        const tt = i / (n - 1), ww = size * 0.14 * prof(tt, st.length) / 2 + extra;
        L.push([pts[i][0] - ty / m * ww, pts[i][1] + tx / m * ww]); R.push([pts[i][0] + ty / m * ww, pts[i][1] - tx / m * ww]);
      }
      ctx.beginPath(); ctx.moveTo(L[0][0], L[0][1]); for (const p of L) ctx.lineTo(p[0], p[1]);
      // rounded brush head
      for (let i = n - 1; i >= 0; i--) ctx.lineTo(R[i][0], R[i][1]); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.arc(pts[0][0], pts[0][1], size * 0.14 * prof(0, st.length) / 2 + extra, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }
  function sfx(ctx, ch, x, y, size, rot, skew = -0.2, outline = 8) {
    const prof = (tt, len) => len <= 2 ? (1.25 - tt * 0.9) : (1.1 - 0.75 * Math.pow(tt, 1.6));
    ctx.save(); ctx.lineCap = 'round';
    ctx.fillStyle = '#000'; ctx.strokeStyle = '#000'; kanaStrokes(ctx, ch, x, y, size, rot, skew, outline + 2.2, prof);
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#fff'; kanaStrokes(ctx, ch, x, y, size, rot, skew, outline, prof);
    ctx.fillStyle = '#000'; ctx.strokeStyle = '#000'; kanaStrokes(ctx, ch, x, y, size, rot, skew, 0, prof);
    ctx.restore();
  }
  function bubble(ctx, cx, cy, rx, ry, tail, lines, font, lh, r) {
    const pts = [];
    for (let k = 0; k < 60; k++) { const a = k / 60 * TAU; pts.push([cx + Math.cos(a) * rx * (1 + 0.03 * Math.sin(a * 3)), cy + Math.sin(a) * ry]); }
    // tail
    const ta = Math.atan2(tail[1] - cy, tail[0] - cx);
    const b1 = [cx + Math.cos(ta - 0.22) * rx * 0.85, cy + Math.sin(ta - 0.22) * ry * 0.85], b2 = [cx + Math.cos(ta + 0.22) * rx * 0.85, cy + Math.sin(ta + 0.22) * ry * 0.85];
    const tailP = [b1, [(b1[0] + tail[0]) / 2 + 6, (b1[1] + tail[1]) / 2 - 4], tail, [(b2[0] + tail[0]) / 2 + 2, (b2[1] + tail[1]) / 2 + 2], b2];
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 2.6;
    poly(ctx, pts); ctx.stroke(); poly(ctx, tailP); ctx.stroke();
    poly(ctx, pts); ctx.fill(); poly(ctx, tailP); ctx.fill();
    ctx.fillStyle = '#000'; ctx.font = font; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    lines.forEach((l, i) => ctx.fillText(l, cx, cy + (i - (lines.length - 1) / 2) * lh));
    ctx.restore();
  }

  // ===== EXPLAINER HELPERS =====
  // extra hand-built katakana for the explainer SFX
  Object.assign(KANA, {
    'ブ': [[[0.12, 0.22], [0.5, 0.2], [0.84, 0.2], [0.72, 0.6], [0.36, 0.96]], [[0.86, 0.0], [0.9, 0.14]], [[0.99, -0.03], [1.03, 0.11]]],
    'ー': [[[0.06, 0.5], [0.5, 0.48], [0.94, 0.5]]],
    'カ': [[[0.12, 0.3], [0.5, 0.29], [0.84, 0.27], [0.83, 0.62], [0.76, 0.92], [0.6, 0.84]], [[0.46, 0.04], [0.42, 0.5], [0.14, 0.96]]],
    'チ': [[[0.78, 0.06], [0.5, 0.16], [0.24, 0.22]], [[0.1, 0.46], [0.5, 0.44], [0.9, 0.44]], [[0.52, 0.2], [0.52, 0.62], [0.3, 0.96]]],
    'ポ': [[[0.1, 0.32], [0.5, 0.31], [0.82, 0.3]], [[0.46, 0.04], [0.46, 0.6], [0.44, 0.94]], [[0.28, 0.54], [0.12, 0.8]], [[0.64, 0.54], [0.82, 0.8]], ['o', 0.9, 0.1, 0.08]],
    'グ': [[[0.4, 0.04], [0.28, 0.26], [0.1, 0.46]], [[0.34, 0.2], [0.58, 0.2], [0.82, 0.2], [0.72, 0.56], [0.46, 0.84], [0.2, 0.98]], [[0.86, 0.0], [0.9, 0.14]], [[0.99, -0.03], [1.03, 0.11]]],
  });
  // cached screentone dot patterns (45 degree grid). Large tile (16x16 cells) with per-dot ink-spread jitter so the
  // tone reads as printed Letratone, not a clean vector pattern.
  const TONES = {};
  function tone(ctx, d) {
    const key = Math.round(d * 20);
    if (!TONES[key]) {
      const p = 5.4 * Math.SQRT2, NC = 16, c = H.layer(Math.round(p * NC), Math.round(p * NC)), x = c.getContext('2d'), s = c.width / NC;
      const rr = Math.min(s * 0.5, s / Math.SQRT2 * Math.sqrt((key / 20) / Math.PI) * 1.0), jr = H.rng(400 + key);
      x.fillStyle = '#111';
      const J = []; for (let i = 0; i < NC; i++) { J.push([]); for (let j = 0; j < NC; j++) J[i].push([jr.range(0.86, 1.1), jr.range(0.86, 1.1), jr.range(-0.3, 0.3), jr.range(-0.3, 0.3)]); }
      for (let i = -1; i <= NC; i++) for (let j = -1; j <= NC; j++) {
        const q = J[(i + NC) % NC][(j + NC) % NC];
        [[i * s, j * s, q[0]], [i * s + s / 2, j * s + s / 2, q[1]]].forEach(([px, py, f]) => { x.beginPath(); x.ellipse(px + q[2], py + q[3], rr * f, rr * f * 0.94, q[2] * 3, 0, TAU); x.fill(); });
      }
      TONES[key] = ctx.createPattern(c, 'repeat');
    }
    return TONES[key];
  }
  // gradated screentone (gradation tone) in a w x h box: density lerps d0 -> d1 along y. Cached.
  const GTONES = {};
  function gradTone(w, h, d0, d1, y0 = 0, y1 = h, fx0 = w, fx1 = w + 1) {
    const key = [w, h, d0, d1, y0, y1, fx0, fx1].join(',');
    if (!GTONES[key]) {
      const c = H.layer(w, h), x = c.getContext('2d'), p = 5.4, c45 = Math.SQRT1_2, N = Math.ceil((w + h) / p) + 2, jr = H.rng(91);
      x.fillStyle = '#111'; x.beginPath();
      for (let i = -N; i < N; i++) for (let j = 0; j < N; j++) {
        const px = (i + j) * p * c45, py = (j - i) * p * c45;
        if (px < -4 || py < -4 || px > w + 4 || py > h + 4) continue;
        const d = H.lerp(d0, d1, H.clamp((py - y0) / (y1 - y0))) * (1 - H.clamp((px - fx0) / (fx1 - fx0)));
        if (d < 0.02) continue;
        const rad = Math.min(p * 0.72, p * Math.sqrt(d / Math.PI)) * jr.range(0.88, 1.08);
        x.moveTo(px + rad, py); x.arc(px, py, rad, 0, TAU);
      }
      x.fill(); GTONES[key] = c;
    }
    return GTONES[key];
  }
  // closed brush-inked loop: line weight swells on the shadow side (normal facing down-right), thin on the lit side
  function inkLoop(c, pts, w, jr) {
    const n = pts.length, L = [], R = [];
    let area = 0; for (let i = 0; i < n; i++) { const a = pts[i], b = pts[(i + 1) % n]; area += a[0] * b[1] - b[0] * a[1]; }
    const sgn = area > 0 ? 1 : -1;
    for (let i = 0; i < n; i++) {
      const a = pts[(i - 1 + n) % n], b = pts[(i + 1) % n], tx = b[0] - a[0], ty = b[1] - a[1], m = Math.hypot(tx, ty) || 1;
      const nx = ty / m * sgn, ny = -tx / m * sgn; // outward normal
      const lit = H.clamp(nx * 0.55 + ny * 0.83, -1, 1);
      const ww = w * (0.62 + 0.38 * lit) / 2 + 0.3;
      const jx = jr ? jr.range(-0.8, 0.8) : 0, jy = jr ? jr.range(-0.8, 0.8) : 0;
      const px = pts[i][0] + jx * 0.5, py = pts[i][1] + jy * 0.5;
      L.push([px + nx * ww, py + ny * ww]); R.push([px - nx * ww * 0.85, py - ny * ww * 0.85]);
    }
    c.beginPath(); c.moveTo(L[0][0], L[0][1]); for (const p of L) c.lineTo(p[0], p[1]); c.closePath();
    c.moveTo(R[0][0], R[0][1]); for (let i = n - 1; i >= 0; i--) c.lineTo(R[i][0], R[i][1]); c.closePath();
    c.fill('evenodd');
  }
  const rrPts = (x, y, w, h, rad, n = 6) => {
    const o = [], cs = [[x + w - rad, y + rad, -Math.PI / 2], [x + w - rad, y + h - rad, 0], [x + rad, y + h - rad, Math.PI / 2], [x + rad, y + rad, Math.PI]];
    cs.forEach(([cx, cy, a0]) => { for (let k = 0; k <= n; k++) { const a = a0 + k / n * Math.PI / 2; o.push([cx + Math.cos(a) * rad, cy + Math.sin(a) * rad]); } });
    return o;
  };
  const ellPts = (cx, cy, rx, ry, n = 36, a0 = 0, a1 = TAU, closed = true) => { const o = []; const m = closed ? n : n + 1; for (let k = 0; k < m; k++) { const a = a0 + (a1 - a0) * k / n; o.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]); } return o; };
  // (reference continues with pencilRough(): non-photo-blue layout rough for an un-inked panel. Truncated in the paste.)

  // ---------- Part 2: PROVISIONAL helpers (not from the reference; replace when the full source arrives) ----------
  const INK = '#0d0d0d', PAPER = '#f7f5ef';
  // Frame counter for "boiling" on twos: focus lines and SFX re-seed every 2 frames at 24 fps.
  const boil = (t, rate = 12) => Math.floor(t * rate);
  // Paper page, cached once (fibrous white stock).
  let PAGE = null;
  function styleBase(ctx, W, H_) {
    if (!PAGE) { PAGE = H.layer(W, H_); H.paper(PAGE.getContext('2d'), W, H_, PAPER, 11, 0.022); }
    ctx.drawImage(PAGE, 0, 0, W, H_);
  }
  // Finishing pass, run last on every frame: print grain that boils on twos and a faint scan falloff at the edges.
  function styleFinish(ctx, W, H_, t) {
    H.vignette(ctx, W, H_, 0.07);
    H.grain(ctx, W, H_, 0.05, 7 + boil(t));
  }
  // Panel slam: scale overshoot + camera shake for `dur` seconds after t0. Returns a transform to apply around (cx, cy).
  function slam(t, t0, amp = 10, dur = 0.28) {
    const u = (t - t0) / dur;
    if (u < 0) return { on: false, s: 1, dx: 0, dy: 0 };
    if (u >= 1) return { on: true, s: 1, dx: 0, dy: 0 };
    const r = H.rng(900 + Math.floor((t - t0) * 24)), k = (1 - u) * (1 - u);
    return { on: true, s: 1 + 0.06 * k, dx: r.range(-1, 1) * amp * k, dy: r.range(-1, 1) * amp * k };
  }
  // Panels slam in on twos: snap a time to the 12 fps grid before computing an entrance.
  const onTwos = (t) => Math.floor(t * 12) / 12;
  // A slanted panel: white fill, clipped content, brush-weight ink border.
  function panel(ctx, P, drawIn, w = 5) {
    ctx.save(); poly(ctx, P); ctx.fillStyle = '#fff'; ctx.fill(); ctx.clip(); drawIn(); ctx.restore();
    ctx.save(); ctx.strokeStyle = INK; ctx.lineWidth = w; ctx.lineJoin = 'miter'; poly(ctx, P); ctx.stroke(); ctx.restore();
  }
  // Rectangular narration box (caption box) with typed lettering.
  function narration(ctx, x, y, w, h, lines, font, lh) {
    ctx.save(); ctx.fillStyle = '#fff'; ctx.strokeStyle = INK; ctx.lineWidth = 3;
    ctx.fillRect(x, y, w, h); ctx.strokeRect(x, y, w, h);
    ctx.fillStyle = INK; ctx.font = font; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    lines.forEach((l, i) => ctx.fillText(l, x + w / 2, y + h / 2 + (i - (lines.length - 1) / 2) * lh));
    ctx.restore();
  }
  // Headline lettering with a white knock-out border (like the SFX), so it reads over tone and focus lines.
  function knockText(ctx, text, x, y, size, rot = 0, font = 'Archivo Black', align = 'center') {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
    ctx.font = `${size}px "${font}"`; ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    ctx.strokeStyle = INK; ctx.lineWidth = size * 0.3; ctx.strokeText(text, 0, 0);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = size * 0.22; ctx.strokeText(text, 0, 0);
    ctx.fillStyle = INK; ctx.fillText(text, 0, 0);
    ctx.restore();
  }
  // Katakana SFX word (only glyphs present in KANA), each letter trembling on twos.
  function sfxWord(ctx, word, x, y, size, rot, t, step = 0.82) {
    const r = H.rng(300 + boil(t));
    [...word].forEach((ch, i) => sfx(ctx, ch, x + i * size * step * Math.cos(rot) + r.range(-2, 2), y + i * size * step * Math.sin(rot) + r.range(-2, 2), size, rot + r.range(-0.04, 0.04)));
  }
  // Bold outlined arrow that draws on along a curve. p in 0..1. White body, ink outline, ink head.
  function inkArrow(ctx, ctrl, w, p) {
    if (p <= 0) return;
    const all = catmull(ctrl, 16), n = Math.max(2, Math.round(all.length * H.clamp(p))), pts = all.slice(0, n);
    const a = pts[n - 2], b = pts[n - 1], ang = Math.atan2(b[1] - a[1], b[0] - a[0]), hl = w * 2.2;
    const head = [[b[0] + Math.cos(ang) * hl * 0.6, b[1] + Math.sin(ang) * hl * 0.6], [b[0] + Math.cos(ang + 2.4) * hl, b[1] + Math.sin(ang + 2.4) * hl], [b[0] + Math.cos(ang - 2.4) * hl, b[1] + Math.sin(ang - 2.4) * hl]];
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const line = () => { ctx.beginPath(); pts.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]))); };
    line(); ctx.strokeStyle = INK; ctx.lineWidth = w + 8; ctx.stroke();
    poly(ctx, head); ctx.lineWidth = 8; ctx.stroke();
    line(); ctx.strokeStyle = '#fff'; ctx.lineWidth = w; ctx.stroke();
    poly(ctx, head); ctx.fillStyle = INK; ctx.fill();
    ctx.restore();
  }
  // Page turn: the old page folds away right-to-left over the new one, with a gradation-tone shadow on the fold.
  // p in 0..1. drawOld/drawNew are () => void that draw a full page (without the finish pass).
  function pageTurn(ctx, W, H_, p, drawOld, drawNew) {
    const e = H.ease.inOut(H.clamp(p)), fx = W * (1.15 - 1.35 * e), slant = 140;
    drawNew();
    ctx.save(); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(fx + slant, 0); ctx.lineTo(fx - slant, H_); ctx.lineTo(0, H_); ctx.closePath(); ctx.clip(); drawOld(); ctx.restore();
    if (e > 0 && e < 1) {
      ctx.save(); ctx.translate(fx, H_ / 2); ctx.rotate(Math.atan2(2 * slant, H_) * -1);
      ctx.drawImage(gradTone(90, Math.round(H_ * 1.3), 0.5, 0.5, 0, 1, 0, 90), 0, -H_ * 0.65);
      ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(0, -H_ * 0.65); ctx.lineTo(0, H_ * 0.65); ctx.stroke();
      ctx.restore();
    }
  }
