// Validate an episode end to end: schema, cues, visuals, licenses, text lengths, maps, generated files.
// Usage: npm run check -- <slug>          exit code 1 when there are errors
import type { Issue } from "../src/kit/lib/resolve.ts";
import { runCheck } from "./lib/check.ts";
import { bold, green, isMain, red, requireSlug, yellow } from "./lib/util.ts";

export const printIssues = (slug: string, issues: Issue[]) => {
  const errors = issues.filter((i) => i.level === "error");
  const warnings = issues.filter((i) => i.level === "warning");
  if (errors.length) {
    console.log(bold(red(`\n${errors.length} error${errors.length > 1 ? "s" : ""}`)));
    errors.forEach((e) => console.log(`  ${red("✖")} ${e.where}: ${e.msg}`));
  }
  if (warnings.length) {
    console.log(bold(yellow(`\n${warnings.length} warning${warnings.length > 1 ? "s" : ""}`)));
    warnings.forEach((w) => console.log(`  ${yellow("⚠")} ${w.where}: ${w.msg}`));
  }
  console.log(
    errors.length
      ? `\n${red("✖")} ${slug}: ${errors.length} error(s), ${warnings.length} warning(s). Fix the errors before rendering.`
      : `\n${green("✔")} ${slug}: 0 errors, ${warnings.length} warning(s).`,
  );
  return errors.length;
};

if (isMain(import.meta.url)) {
  const slug = requireSlug("npm run check -- <slug>");
  process.exit(printIssues(slug, runCheck(slug)) ? 1 : 0);
}
