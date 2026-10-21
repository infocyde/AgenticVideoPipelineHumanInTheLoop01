  // ===================================================================================================
  // FREEFORM style (creative mode). Inlined into each explainer by `npm run explainer -- new --style freeform`.
  // A blank canvas on purpose: no look, no props, no finish. The piece invents its own medium in the EXPLAINER
  // block (its own surface, lettering, textures, transitions and finishing pass). See styles/freeform/STYLE.md.
  // Pick the piece's fonts with `new --fonts "Family:wght@400;700|Other Family"` (or edit the <link> and FONT_SPECS).
  // ===================================================================================================
  const TAU = Math.PI * 2;
  const ease = H.ease;
  // progress of an event: 0 before t0, eased 0..1 over dur
  const prog = (t, t0, dur, e = ease.out) => e(H.clamp((t - t0) / dur));
  // a frame counter for "on twos" / boiling line work: changes rate times a second
  const boil = (t, rate = 12) => Math.floor(t * rate);

  // Replace or wrap these two in the EXPLAINER block (define your own and call those instead) to give the piece
  // its surface and its finishing pass. By default: a flat field in STYLE_VARIANT.bg, and no finish.
  function styleBase(ctx, W, H_) { ctx.fillStyle = STYLE_VARIANT.bg || '#101114'; ctx.fillRect(0, 0, W, H_); }
  function styleFinish() {}
