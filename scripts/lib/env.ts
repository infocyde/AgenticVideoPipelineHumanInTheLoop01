// Read a secret from the environment, or from a .env file in this repo or a parent folder.
// Values are never printed.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { ROOT } from "./util.ts";

const parse = (file: string): Record<string, string> =>
  Object.fromEntries(
    readFileSync(file, "utf8")
      .split(/\r?\n/)
      .map((l) => l.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/))
      .filter((m): m is RegExpMatchArray => !!m)
      .map((m) => [m[1], m[2].replace(/^(['"])(.*)\1$/, "$2")]),
  );

/** process.env first, then .env files from the repo root upwards. Returns the value and where it came from. */
export const getSecret = (name: string): { value: string; source: string } | null => {
  if (process.env[name]) return { value: process.env[name]!, source: "environment" };
  let dir = ROOT;
  for (let i = 0; i < 4; i++) {
    const file = join(dir, ".env");
    if (existsSync(file)) {
      const v = parse(file)[name];
      if (v) return { value: v, source: file };
    }
    const up = dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  return null;
};
