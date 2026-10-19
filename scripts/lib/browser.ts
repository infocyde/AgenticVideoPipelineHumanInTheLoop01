// Headless browser for the page-capture scripts (shot, infographic): Remotion's bundled chrome-headless-shell,
// else an installed Chrome, else Edge. Driven by playwright-core (no browser download of its own).
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { type Browser, type BrowserContext, type BrowserContextOptions, chromium } from "playwright-core";
import { fail, ROOT } from "./util.ts";

const remotionChrome = (): string | undefined => {
  const base = join(ROOT, "node_modules", ".remotion", "chrome-headless-shell");
  if (!existsSync(base)) return undefined;
  for (const plat of readdirSync(base, { withFileTypes: true }).filter((d) => d.isDirectory())) {
    for (const sub of readdirSync(join(base, plat.name))) {
      for (const exe of ["chrome-headless-shell.exe", "chrome-headless-shell"]) {
        const f = join(base, plat.name, sub, exe);
        if (existsSync(f)) return f;
      }
    }
  }
  return undefined;
};

export const launchBrowser = async (): Promise<Browser> => {
  const exe = remotionChrome();
  const tries: Array<() => Promise<Browser>> = [
    ...(exe ? [() => chromium.launch({ executablePath: exe })] : []),
    () => chromium.launch({ channel: "chrome" }),
    () => chromium.launch({ channel: "msedge" }),
  ];
  for (const t of tries) {
    try {
      return await t();
    } catch {
      /* next */
    }
  }
  return fail("No browser found. Run `npx remotion browser ensure` (or install Chrome) and try again.");
};

/** A context whose pages can run callbacks compiled by tsx (esbuild's keepNames emits calls to `__name`). */
export const newContext = async (browser: Browser, opts: BrowserContextOptions): Promise<BrowserContext> => {
  const ctx = await browser.newContext(opts);
  await ctx.addInitScript("globalThis.__name = (fn) => fn;");
  return ctx;
};
