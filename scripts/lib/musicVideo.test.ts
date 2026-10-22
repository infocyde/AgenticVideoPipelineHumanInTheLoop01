import assert from "node:assert/strict";
import { test } from "node:test";
import { songFileName, titleFromFile } from "./musicVideo.ts";

test("songFileName gives song.<ext> whatever the source is called", () => {
  assert.equal(songFileName("C:/x/PTRA - Empires (Plata o Plomo Power Mix).WAV"), "song.wav");
  assert.equal(songFileName("a.mp3"), "song.mp3");
});

test("titleFromFile takes the part after the artist and moves the mix name to the subtitle", () => {
  assert.deepEqual(titleFromFile("PTRA - Empires (Plata o Plomo Power Mix).wav"), { title: "Empires", subtitle: "Plata o Plomo Power Mix" });
  assert.deepEqual(titleFromFile("C:\\in\\Song.wav"), { title: "Song" });
});
