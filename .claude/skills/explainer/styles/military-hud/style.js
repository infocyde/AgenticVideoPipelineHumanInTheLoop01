  // ===================================================================================================
  // MILITARY HUD style helpers. Inlined into each explainer by `npm run explainer -- new`.
  // Built from the Brief Kit video themes `military` and `military-comparisons` (src/kit/themes/), so an explainer
  // cut into those episodes matches them: same palette, fonts, grain, scanlines, vignette, glitch colors and flash.
  // STYLE_VARIANT (injected before this file, from style.json) carries the palette and fonts of the variant.
  // ===================================================================================================
  const TAU = Math.PI * 2;
  const P = STYLE_VARIANT.palette;  // bg, panel, line, text, dim, accent, accentDeep, highlight, onAccent, hostile, land, landEdge, grid, glitch:[a,b], flash, grain, scan
  const F = STYLE_VARIANT.fonts;    // { display: { family, weight }, mono: {...}, body: {...} }
  // font('display', 96) -> '800 96px "Big Shoulders Stencil"'
  const font = (kind, size, weight) => `${weight || F[kind].weight} ${size}px "${F[kind].family}"`;
  const boil = (t, rate = 12) => Math.floor(t * rate);
  const ease = H.ease;
  // progress of a beat event: 0 before t0, eased 0..1 over dur
  const prog = (t, t0, dur, e = ease.out) => e(H.clamp((t - t0) / dur));

  // ---------- surface ----------
  // Base field: flat display black with a faint coordinate grid (cached), like the themes' map graticule.
  let GRID = null;
  function styleBase(ctx, W, H_) {
    if (!GRID) {
      GRID = H.layer(W, H_); const g = GRID.getContext('2d');
      g.fillStyle = P.bg; g.fillRect(0, 0, W, H_);
      const glow = g.createRadialGradient(W / 2, H_ * 0.45, 40, W / 2, H_ * 0.45, W * 0.7);
      glow.addColorStop(0, H.rgba(P.accentDeep, 0.35)); glow.addColorStop(1, H.rgba(P.accentDeep, 0));
      g.fillStyle = glow; g.fillRect(0, 0, W, H_);
      g.strokeStyle = P.grid; g.lineWidth = 1;
      for (let x = 40; x < W; x += 80) { g.beginPath(); g.moveTo(x + 0.5, 0); g.lineTo(x + 0.5, H_); g.stroke(); }
      for (let y = 40; y < H_; y += 80) { g.beginPath(); g.moveTo(0, y + 0.5); g.lineTo(W, y + 0.5); g.stroke(); }
      g.fillStyle = P.grid; // grid crosses at every other intersection
      for (let x = 40; x < W; x += 160) for (let y = 40; y < H_; y += 160) { g.fillRect(x - 5, y, 11, 1.5); g.fillRect(x, y - 5, 1.5, 11); }
    }
    ctx.drawImage(GRID, 0, 0, W, H_);
  }
  // Finishing pass, run last on every frame at full strength: rolling refresh band, scanlines, vignette, grain.
  let SCAN = null;
  function styleFinish(ctx, W, H_, t) {
    ctx.save();
    // slow refresh band rolling down the display
    const by = ((t * 0.22) % 1.3 - 0.15) * H_, band = ctx.createLinearGradient(0, by - 90, 0, by + 90);
    band.addColorStop(0, 'rgba(255,255,255,0)'); band.addColorStop(0.5, 'rgba(255,255,255,0.035)'); band.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = band; ctx.fillRect(0, by - 90, W, 180);
    // scanlines (3 px pitch), at the theme's scanline opacity
    if (!SCAN) { const c = H.layer(4, 3), x = c.getContext('2d'); x.fillStyle = 'rgba(0,0,0,1)'; x.fillRect(0, 0, 4, 1); SCAN = ctx.createPattern(c, 'repeat'); }
    ctx.globalAlpha = P.scan; ctx.fillStyle = SCAN; ctx.fillRect(0, 0, W, H_); ctx.globalAlpha = 1;
    ctx.restore();
    H.vignette(ctx, W, H_, 0.55, P.vignette);
    H.grain(ctx, W, H_, P.grain, 7 + boil(t, 24));
  }

  // ---------- lettering ----------
  // Stencil / display headline, uppercase, with the theme's soft drop shadow. glow=true adds the accent glow.
  function headline(ctx, text, x, y, size, color = P.text, align = 'left', glow = false) {
    ctx.save(); ctx.font = font('display', size); ctx.textAlign = align; ctx.textBaseline = 'alphabetic';
    ctx.shadowColor = glow ? H.rgba(color, 0.45) : 'rgba(0,0,0,0.85)'; ctx.shadowBlur = glow ? size * 0.5 : 24; ctx.shadowOffsetY = glow ? 0 : 6;
    ctx.fillStyle = color; ctx.fillText(text.toUpperCase(), x, y); ctx.restore();
  }
  // Tracked uppercase mono label (kickers, readouts, grid refs). Keep size >= 28.
  function label(ctx, text, x, y, size = 28, color = P.dim, align = 'left', track = 0.18) {
    ctx.save(); ctx.font = font('mono', size); ctx.letterSpacing = `${Math.round(size * track)}px`;
    ctx.textAlign = align; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = color; ctx.fillText(text.toUpperCase(), x, y); ctx.restore();
  }
  // Body text (condensed sans), for short captions and row names.
  function body(ctx, text, x, y, size = 34, color = P.text, align = 'left', weight) {
    ctx.save(); ctx.font = font('body', size, weight); ctx.textAlign = align; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = color; ctx.fillText(text, x, y); ctx.restore();
  }
  // Big readout number in the display face with the accent glow.
  function readout(ctx, text, x, y, size = 160, color = P.accent, align = 'left') { headline(ctx, text, x, y, size, color, align, true); }
  // Typed text: the part of `text` printed by time t (cps characters per second from t0), plus a block cursor on twos.
  function typed(text, t, t0, cps = 30) { const n = Math.max(0, Math.min(text.length, Math.floor((t - t0) * cps))); return { s: text.slice(0, n), done: n >= text.length, n }; }
  function typeLine(ctx, text, x, y, size, t, t0, color = P.highlight, cps = 30) {
    if (t < t0) return;
    const { s, done } = typed(text, t, t0, cps); label(ctx, s, x, y, size, color, 'left', 0.12);
    if (!done || boil(t, 2) % 2 === 0) { ctx.save(); ctx.font = font('mono', size); ctx.letterSpacing = `${Math.round(size * 0.12)}px`; const w = ctx.measureText(s.toUpperCase()).width; ctx.fillStyle = color; ctx.fillRect(x + w + 4, y - size * 0.78, size * 0.55, size * 0.86); ctx.restore(); }
  }
  // Seconds between typed characters, for scoring: k.play('typing', t0, { n, rate }).
  const typeRate = (cps = 30) => 1 / cps;

  // ---------- HUD furniture ----------
  // Corner header: kicker on the left (accent rule + label), a status/grid ref on the right. Labels >= 28 px.
  // Episode b-roll gets zoomed up to 1.18x: pass inset 140 / top 110 to keep it inside the kit's safe area.
  function header(ctx, W, left, right, t, inset = 64, top = 66) {
    ctx.save(); ctx.fillStyle = P.accent; ctx.fillRect(inset, top - 12, 56, 5); ctx.restore();
    label(ctx, left, inset + 72, top, 28, P.accent);
    if (right) label(ctx, right, W - inset, top, 28, P.dim, 'right');
    ctx.save(); ctx.fillStyle = P.line; ctx.fillRect(inset, top + 20, W - inset * 2, 1.5); ctx.restore();
  }
  // Target brackets around a box. p 0..1 snaps them in from 1.6x size (a lock-on).
  function brackets(ctx, x, y, w, h, p = 1, color = P.accent, len = 28, lw = 4) {
    if (p <= 0) return;
    const e = ease.out(H.clamp(p)), k = H.lerp(1.6, 1, e), cx = x + w / 2, cy = y + h / 2, ww = w * k, hh = h * k, x0 = cx - ww / 2, y0 = cy - hh / 2;
    ctx.save(); ctx.globalAlpha = H.clamp(p * 3); ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.lineCap = 'square';
    [[x0, y0, 1, 1], [x0 + ww, y0, -1, 1], [x0, y0 + hh, 1, -1], [x0 + ww, y0 + hh, -1, -1]].forEach(([a, b, sx, sy]) => { ctx.beginPath(); ctx.moveTo(a + sx * len, b); ctx.lineTo(a, b); ctx.lineTo(a, b + sy * len); ctx.stroke(); });
    ctx.restore();
  }
  // Reticle: ring, ticks and a centre gap. spin in radians.
  function reticle(ctx, cx, cy, r, color = P.highlight, spin = 0, lw = 3) {
    ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.translate(cx, cy); ctx.rotate(spin);
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
    for (let i = 0; i < 4; i++) { ctx.rotate(Math.PI / 2); ctx.beginPath(); ctx.moveTo(r * 0.35, 0); ctx.lineTo(r * 1.25, 0); ctx.stroke(); }
    ctx.restore();
  }
  // Range rings + optional radar sweep (angle a). Sweep leaves a fading wedge.
  function rangeRings(ctx, cx, cy, rmax, n = 4, color = P.grid) {
    ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = 1.5;
    for (let i = 1; i <= n; i++) { ctx.beginPath(); ctx.arc(cx, cy, rmax * i / n, 0, TAU); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(cx - rmax, cy); ctx.lineTo(cx + rmax, cy); ctx.moveTo(cx, cy - rmax); ctx.lineTo(cx, cy + rmax); ctx.stroke(); ctx.restore();
  }
  function sweep(ctx, cx, cy, r, a, color = P.highlight) {
    ctx.save(); const g = ctx.createConicGradient(a - 0.9, cx, cy);
    g.addColorStop(0, H.rgba(color, 0)); g.addColorStop(0.14, H.rgba(color, 0.22)); g.addColorStop(0.1433, H.rgba(color, 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill();
    ctx.strokeStyle = color; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); ctx.stroke(); ctx.restore();
  }
  // A track that draws on (flight path, supply line, arrow of cause). p 0..1. Dashed if dash given. Leading dot + arrow head.
  function trace(ctx, pts, p, color = P.accent, lw = 5, dash = null, head = true) {
    if (p <= 0) return;
    const segs = []; let L = 0; for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); segs.push(d); L += d; }
    let left = L * H.clamp(p), end = pts[0], ang = 0;
    ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; if (dash) ctx.setLineDash(dash);
    ctx.shadowColor = H.rgba(color, 0.5); ctx.shadowBlur = 14;
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length && left > 0; i++) {
      const u = Math.min(1, left / segs[i - 1]), a = pts[i - 1], b = pts[i];
      end = [H.lerp(a[0], b[0], u), H.lerp(a[1], b[1], u)]; ang = Math.atan2(b[1] - a[1], b[0] - a[0]); ctx.lineTo(end[0], end[1]); left -= segs[i - 1];
    }
    ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = color;
    if (head && p >= 1) { const s = lw * 3.4; ctx.beginPath(); ctx.moveTo(end[0] + Math.cos(ang) * s, end[1] + Math.sin(ang) * s); ctx.lineTo(end[0] + Math.cos(ang + 2.5) * s, end[1] + Math.sin(ang + 2.5) * s); ctx.lineTo(end[0] + Math.cos(ang - 2.5) * s, end[1] + Math.sin(ang - 2.5) * s); ctx.closePath(); ctx.fill(); }
    else { ctx.beginPath(); ctx.arc(end[0], end[1], lw * 1.3, 0, TAU); ctx.fill(); }
    ctx.restore();
  }
  // Segmented gauge bar filling to p (0..1). The last lit segment flickers on twos while it fills.
  function gauge(ctx, x, y, w, h, p, color = P.highlight, n = 24, t = 0) {
    const gap = 4, sw = (w - gap * (n - 1)) / n, lit = p * n;
    for (let i = 0; i < n; i++) {
      const on = i < Math.floor(lit) || (i < lit && boil(t, 12) % 2 === 0);
      ctx.fillStyle = on ? color : P.panel; ctx.fillRect(x + i * (sw + gap), y, sw, h);
      if (!on) { ctx.strokeStyle = P.line; ctx.lineWidth = 1; ctx.strokeRect(x + i * (sw + gap) + 0.5, y + 0.5, sw - 1, h - 1); }
    }
  }
  // Data panel: translucent card with a hairline and an accent tab, like the kit's stat panels.
  function card(ctx, x, y, w, h, accent = P.accent) {
    ctx.save(); ctx.fillStyle = P.panel; ctx.fillRect(x, y, w, h); ctx.strokeStyle = P.line; ctx.lineWidth = 1.5; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    ctx.fillStyle = accent; ctx.fillRect(x, y, 6, h); ctx.restore();
  }
  // Stamp (CONFIRMED / HOSTILE / CLASSIFIED style): boxed display text that slams from 1.5x on t0.
  function stampBox(ctx, text, cx, cy, size, t, t0, color = P.hostile, rot = -0.06) {
    if (t < t0) return;
    const u = H.clamp((t - t0) / 0.16), k = H.lerp(1.5, 1, ease.out(u));
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot); ctx.scale(k, k); ctx.globalAlpha = H.clamp(u * 2);
    ctx.font = font('display', size); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const w = ctx.measureText(text.toUpperCase()).width + size * 0.6, h = size * 1.15;
    ctx.strokeStyle = color; ctx.lineWidth = Math.max(4, size * 0.07); ctx.strokeRect(-w / 2, -h / 2, w, h);
    ctx.fillStyle = color; ctx.fillText(text.toUpperCase(), 0, size * 0.04); ctx.restore();
  }
  // Eased counter for key numbers. Score its ticks with counterTicks() so sound and picture agree.
  const counter = (v0, v1, t, t0, dur) => H.lerp(v0, v1, ease.out(H.clamp((t - t0) / dur)));
  // Tick times for a counter: at most ~12 per second, spreading out as the eased value settles.
  function counterTicks(t0, dur, maxRate = 12) {
    const out = []; let last = -1;
    for (let s = 0; s <= dur; s += 1 / 120) { const v = ease.out(s / dur); if (s - last >= 1 / maxRate && (last < 0 || v - ease.out(Math.max(0, last) / dur) > 0.02)) { out.push(t0 + s); last = s; } }
    return out;
  }
  // Camera shake for impacts: offset for `dur` seconds after t0, seeded by frame.
  function shake(t, t0, amp = 8, dur = 0.3) {
    const u = (t - t0) / dur; if (u < 0 || u >= 1) return [0, 0];
    const r = H.rng(700 + Math.floor((t - t0) * 30)), k = (1 - u) * (1 - u); return [r.range(-1, 1) * amp * k, r.range(-1, 1) * amp * k];
  }

  // ---------- transitions (this medium's own scene changes) ----------
  // Full-pixel offscreen layers that keep the main canvas transform (so scaled renders stay sharp).
  const LAYERS = [];
  function sceneLayer(ctx, i) {
    const cw = ctx.canvas.width, ch = ctx.canvas.height;
    if (!LAYERS[i] || LAYERS[i].width !== cw || LAYERS[i].height !== ch) LAYERS[i] = H.layer(cw, ch);
    const c = LAYERS[i].getContext('2d'); c.setTransform(ctx.getTransform()); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    return c;
  }
  function blit(ctx, layer, dx = 0, dy = 0, sy = 0, sh = null) {
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    const h = sh == null ? layer.height : sh; ctx.drawImage(layer, 0, sy, layer.width, h, dx, sy + dy, layer.width, h); ctx.restore();
  }
  // Signal glitch cut: sliced horizontal tear + glitch-color offsets around the switch at p = 0.5. Use for "the story moves on".
  // drawFrom/drawTo are (c) => void drawing a full scene into c (without the finish pass). Span ~0.35 s; score with 'glitch'.
  function glitchCut(ctx, W, H_, p, t, drawFrom, drawTo) {
    const a = sceneLayer(ctx, 0); a.clearRect(0, 0, W, H_); (p < 0.5 ? drawFrom : drawTo)(a);
    const amt = 1 - Math.abs(p - 0.5) * 2, L = LAYERS[0], ch = L.height, r = H.rng(50 + boil(t, 30));
    if (amt <= 0.05) { blit(ctx, L); return; }
    blit(ctx, L);
    const sx = L.width / W;
    for (let i = 0; i < 9; i++) { const y = r.int(0, ch - 1), h = Math.round(r.range(6, 60) * sx), dx = r.range(-1, 1) * 80 * amt * sx; blit(ctx, L, dx, 0, y, Math.min(h, ch - y)); }
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < 4; i++) { ctx.fillStyle = P.glitch[i % 2]; ctx.globalAlpha = 0.5 * amt; ctx.fillRect(0, r.range(0, H_), W, r.range(3, 18)); }
    ctx.restore();
  }
  // Scan wipe: a bright scan bar sweeps left to right, revealing the next scene behind it. Use for a continuation
  // that changes location (zoom to a new area, next system). Span ~0.6 s; score with 'swish' + 'blip' on arrival.
  function scanWipe(ctx, W, H_, p, drawFrom, drawTo) {
    const e = ease.inOut(H.clamp(p)), x = H.lerp(-40, W + 40, e);
    drawFrom(ctx);
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, x, H_); ctx.clip(); drawTo(ctx); ctx.restore();
    if (e > 0 && e < 1) { ctx.save(); ctx.shadowColor = P.accent; ctx.shadowBlur = 30; ctx.fillStyle = P.accent; ctx.fillRect(x - 3, 0, 6, H_); ctx.restore(); label(ctx, 'SCANNING', x + 16, H_ - 40, 28, P.accent); }
  }
  // Muzzle-flash style white-out for the key hit (theme flash color). a 0..1; decay it over ~0.25 s.
  function flash(ctx, W, H_, a) { if (a <= 0) return; ctx.save(); ctx.globalAlpha = H.clamp(a); ctx.fillStyle = P.flash; ctx.fillRect(0, 0, W, H_); ctx.restore(); }
