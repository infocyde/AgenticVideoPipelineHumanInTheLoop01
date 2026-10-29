import { test } from "node:test";
import assert from "node:assert/strict";
import { titleCase } from "./util";

test("titleCase capitalizes words and keeps minor words lowercase", () => {
  assert.equal(titleCase("Poland's military buildup (Short 2)"), "Poland's Military Buildup (Short 2)");
  assert.equal(titleCase("10 military systems set to change the battlefield"), "10 Military Systems Set to Change the Battlefield");
  assert.equal(titleCase("Laser vs microwave: two ways to stop drones"), "Laser vs Microwave: Two Ways to Stop Drones");
});

test("titleCase capitalizes the first word after a colon and the last word", () => {
  assert.equal(titleCase("90 days off the grid: the Pentagon's FORTRESS standard"), "90 Days off the Grid: The Pentagon's FORTRESS Standard");
  assert.equal(titleCase("what it is made of"), "What It Is Made Of");
});

test("titleCase leaves words that already have capitals or start with a digit", () => {
  assert.equal(titleCase("OpenAI shelved GPT-6.1 Astra"), "OpenAI Shelved GPT-6.1 Astra");
  assert.equal(titleCase("ChatGPT raised practice scores 48%"), "ChatGPT Raised Practice Scores 48%");
});

test("titleCase handles hyphenated words", () => {
  assert.equal(titleCase("the ten-ninety power law"), "The Ten-Ninety Power Law");
  assert.equal(titleCase("One hacker, $50 a break-in"), "One Hacker, $50 a Break-In");
});
