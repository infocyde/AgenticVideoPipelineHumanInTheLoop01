import assert from "node:assert/strict";
import { test } from "node:test";
import { SHOT_MOTIONS, shotMotion, type ShotMotion } from "./shotMotion.ts";

const W = 1920;
const H = 1080;
const FOCI: [number, number][] = [[0.5, 0.5], [0, 0], [1, 1], [0.7, 0.3]];
const PROGRESS = [0, 0.1, 0.25, 0.5, 0.75, 1];
const at = (m: ShotMotion, p: number, o = {}) => shotMotion(m, p, { frame: Math.round(p * 90), ...o });

/** Where a corner of the frame lands in the picture's own coordinates; inside [0, W]x[0, H] means no gap shows. */
const frameCornersInPicture = (m: ReturnType<typeof shotMotion>) => {
  const [ox, oy] = [m.origin[0] * W, m.origin[1] * H];
  const r = (-m.rotate * Math.PI) / 180;
  return [[0, 0], [W, 0], [0, H], [W, H]].map(([cx, cy]) => {
    const [dx, dy] = [(cx - m.x - ox) / m.scale, (cy - m.y - oy) / m.scale];
    return [ox + dx * Math.cos(r) - dy * Math.sin(r), oy + dx * Math.sin(r) + dy * Math.cos(r)];
  });
};

test("every move keeps the picture over the whole frame, at any focus and crop", () => {
  for (const move of SHOT_MOTIONS) {
    for (const focus of FOCI) {
      for (const crop of [1, 1.6]) {
        for (const p of PROGRESS) {
          for (const [x, y] of frameCornersInPicture(at(move, p, { focus, crop }))) {
            const where = `${move} focus ${focus} crop ${crop} p ${p}: corner at ${x}, ${y}`;
            assert.ok(x >= -0.01 && x <= W + 0.01 && y >= -0.01 && y <= H + 0.01, where);
          }
        }
      }
    }
  }
});

test("zooms go the way they say", () => {
  assert.ok(at("zoom-in", 1).scale > at("zoom-in", 0).scale);
  assert.ok(at("zoom-out", 1).scale < at("zoom-out", 0).scale);
  assert.ok(at("push-in", 1).scale > at("zoom-in", 1).scale, "a push-in travels further than a zoom-in");
  assert.ok(at("pull-out", 0).scale > at("pull-out", 1).scale);
});

test("a push-in covers most of its travel early", () => {
  const [start, mid, end] = [at("push-in", 0).scale, at("push-in", 0.25).scale, at("push-in", 1).scale];
  assert.ok(mid - start > (end - start) / 2);
});

test("pans and tilts move the view the way they say, so the picture slides the other way", () => {
  assert.ok(at("pan-left", 1).x > at("pan-left", 0).x);
  assert.ok(at("pan-right", 1).x < at("pan-right", 0).x);
  assert.ok(at("tilt-up", 1).y > at("tilt-up", 0).y);
  assert.ok(at("tilt-down", 1).y < at("tilt-down", 0).y);
});

test("a pan moves far enough to read in a 3 s shot", () => {
  assert.ok(Math.abs(at("pan-left", 1).x - at("pan-left", 0).x) > 300);
});

test("a whip does most of its travel in the first quarter, blurred, then settles sharp", () => {
  const [a, b, c] = [at("whip-left", 0), at("whip-left", 0.25), at("whip-left", 1)];
  assert.ok(Math.abs(b.x - a.x) > Math.abs(c.x - a.x) * 0.7);
  assert.ok(a.blur > 0);
  assert.equal(c.blur, 0);
});

test("a rack focus starts soft and ends sharp", () => {
  assert.ok(at("rack-focus", 0).blur > 0);
  assert.equal(at("rack-focus", 0.5).blur, 0);
});

test("a roll turns the picture from one side to the other about the centre", () => {
  assert.ok(at("roll", 0).rotate < 0 && at("roll", 1).rotate > 0);
  assert.deepEqual(at("roll", 0.5, { focus: [0, 0] }).origin, [0.5, 0.5]);
});

test("a shake is the same on every render of a frame and differs between frames", () => {
  const f = (frame: number) => shotMotion("shake", 0.5, { frame });
  assert.deepEqual(f(40), f(40));
  assert.notDeepEqual(f(40), f(41));
});

test("crop tightens the framing, and focus is where a zoom heads", () => {
  assert.ok(at("zoom-in", 0, { crop: 1.6 }).scale >= 1.6);
  assert.ok(at("pan-left", 0.5, { crop: 1.6 }).scale >= 1.6);
  assert.deepEqual(at("zoom-in", 0, { focus: [0.7, 0.3] }).origin, [0.7, 0.3]);
});

test("progress outside the shot is held at its ends", () => {
  assert.deepEqual(at("zoom-in", 2), at("zoom-in", 1));
  assert.deepEqual(shotMotion("zoom-in", -1, { frame: 0 }), shotMotion("zoom-in", 0, { frame: 0 }));
});
