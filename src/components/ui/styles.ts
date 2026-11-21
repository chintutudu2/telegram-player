/** Shared class recipes so pills, nav items and buttons stay visually in sync. */
export const tone = {
  active:
    "bg-linear-to-r from-accent-soft to-accent-deep text-white shadow-glow border border-accent/30",
  idle: "bg-white/5 text-muted border border-white/5 hover:bg-white/10 hover:text-fg",
} as const;

export const interactive =
  "transition-all duration-300 disabled:pointer-events-none disabled:opacity-50";
