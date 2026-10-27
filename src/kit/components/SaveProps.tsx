import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getRemotionEnvironment } from "remotion";
import type { z } from "zod";

// Must match PROPS_PORT in scripts/props-server.ts.
const PROPS_PORT = 3011;

/**
 * Studio-only "Save to episode.json" button, shown once the props panel's episode differs from the file.
 * Studio's own Save can't write these props (Root builds them from episode.json in a loop), so this posts the edit to
 * scripts/props-server.ts (started by `npm run preview`), which writes episode.json; Studio then hot-reloads.
 * Studio lays a click-to-select layer over the canvas, so the button is hit-tested from a window capture listener
 * rather than its own onClick. While there are unsaved edits, Ctrl+S / Cmd+S saves here too (instead of Studio's
 * save, which can't). Hidden in renders.
 */
export const SaveProps: React.FC<{ slug: string; episode: unknown; original: unknown; schema: z.ZodTypeAny }> = ({ slug, episode, original, schema }) => {
  const [state, setState] = useState<{ busy?: boolean; msg?: string; error?: boolean }>({});
  const button = useRef<HTMLDivElement>(null);
  const baseline = useMemo(() => {
    const parsed = schema.safeParse(original);
    return JSON.stringify(parsed.success ? parsed.data : original);
  }, [original, schema]);
  const studio = getRemotionEnvironment().isStudio;
  const dirty = studio && JSON.stringify(episode) !== baseline;

  const save = useCallback(async () => {
    setState({ busy: true });
    try {
      const url = `${window.location.protocol}//${window.location.hostname}:${PROPS_PORT}/save/${encodeURIComponent(slug)}`;
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ episode }) });
      const out = (await res.json()) as { ok: boolean; changed?: boolean; error?: string };
      setState(out.ok ? { msg: out.changed ? "Saved to episode.json" : "No changes to save" } : { msg: out.error, error: true });
    } catch {
      setState({ msg: `Props server not reachable on port ${PROPS_PORT}: start Studio with npm run preview (or run npm run props-server)`, error: true });
    }
  }, [slug, episode]);

  useEffect(() => {
    if (!dirty) return;
    const onPointer = (e: PointerEvent) => {
      const r = button.current?.getBoundingClientRect();
      if (!r || e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      void save();
    };
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "s") return;
      e.preventDefault();
      e.stopImmediatePropagation();
      void save();
    };
    window.addEventListener("pointerdown", onPointer, true);
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("pointerdown", onPointer, true);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [dirty, save]);

  if (!studio || (!dirty && !state.msg)) return null;
  return (
    <div style={{ position: "absolute", right: 24, top: 90, zIndex: 1000, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8, maxWidth: 760 }}>
      {dirty && (
        <div
          ref={button}
          role="button"
          style={{ padding: "14px 22px", fontSize: 26, fontWeight: 700, fontFamily: "sans-serif", background: "#0a7d32", color: "#fff", border: "2px solid #7dffa8", cursor: "pointer" }}
        >
          {state.busy ? "Saving…" : "Save to episode.json (Ctrl+S)"}
        </div>
      )}
      {state.msg && (
        <div style={{ padding: "8px 14px", fontSize: 20, fontFamily: "monospace", color: "#fff", background: state.error ? "rgba(140,0,0,0.9)" : "rgba(0,80,30,0.9)" }}>
          {state.msg}
        </div>
      )}
    </div>
  );
};
