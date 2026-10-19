import React from "react";
import { getRemotionEnvironment } from "remotion";
import { useEpisode } from "../context";

/**
 * Studio-only panel listing unresolved cues and missing assets, so a broken timing never looks fine in preview.
 * Renders are protected separately: `npm run render` refuses to start while `check` has errors.
 */
export const IssuesOverlay: React.FC = () => {
  const { timeline, theme } = useEpisode();
  if (!getRemotionEnvironment().isStudio) return null;
  const errors = timeline.issues.filter((i) => i.level === "error");
  if (!errors.length) return null;
  return (
    <div
      style={{
        position: "absolute",
        left: 24,
        top: 90,
        maxWidth: 900,
        padding: "14px 18px",
        background: "rgba(140,0,0,0.88)",
        color: "#fff",
        fontFamily: theme.fonts.mono,
        fontSize: 20,
        lineHeight: 1.35,
        border: "2px solid #ff6b6b",
        zIndex: 100,
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 6 }}>
        {errors.length} problem{errors.length > 1 ? "s" : ""} (npm run check -- {timeline.slug}) · hidden in renders
      </div>
      {errors.slice(0, 8).map((e, i) => (
        <div key={i}>
          <span style={{ opacity: 0.7 }}>{e.where}:</span> {e.msg}
        </div>
      ))}
      {errors.length > 8 && <div style={{ opacity: 0.7 }}>…and {errors.length - 8} more</div>}
    </div>
  );
};
