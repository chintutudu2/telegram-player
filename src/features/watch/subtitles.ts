import type { SubtitleTrack } from "@/types/media";

/**
 * Subtitles are added to the <video> from script (addTextTrack + VTTCue),
 * not as <track> children: on iPhone/iPad, Safari rejects some videos
 * outright ("Error 4", e.g. our HEVC episodes) as soon as a <track> element
 * is attached, while script-added tracks play fine. The tracks still appear
 * in the browser's own CC / subtitles menu.
 */

export interface ParsedCue {
  start: number;
  end: number;
  text: string;
  /** Cue settings after the timing, e.g. { align: "start", line: "10%" }. */
  settings: Record<string, string>;
}

const TIMING_RE = /^\s*((?:\d+:)?\d{1,2}:\d{2}\.\d{3})\s+-->\s+((?:\d+:)?\d{1,2}:\d{2}\.\d{3})(.*)$/;

/** "01:02:03.500" or "02:03.500" → seconds. */
function toSeconds(timestamp: string): number {
  return timestamp.split(":").reduce((total, part) => total * 60 + Number(part), 0);
}

/** Minimal WebVTT parser: cue timings, settings and text; NOTE/STYLE/REGION blocks are skipped. */
export function parseWebVtt(text: string): ParsedCue[] {
  const cues: ParsedCue[] = [];
  const blocks = text.replace(/^﻿/, "").replace(/\r\n?/g, "\n").split(/\n{2,}/);
  for (const block of blocks) {
    const lines = block.split("\n");
    // The timing line is first, or second after an optional cue identifier.
    const index = lines.findIndex((line) => line.includes("-->"));
    if (index < 0 || index > 1) continue;
    const match = TIMING_RE.exec(lines[index]);
    if (!match) continue;
    const settings = Object.fromEntries(
      match[3]
        .trim()
        .split(/\s+/)
        .filter((setting) => setting.includes(":"))
        .map((setting) => setting.split(":", 2) as [string, string]),
    );
    const start = toSeconds(match[1]);
    const end = toSeconds(match[2]);
    const cueText = lines.slice(index + 1).join("\n").trim();
    if (end > start && cueText) cues.push({ start, end, text: cueText, settings });
  }
  return cues;
}

function toCue({ start, end, text, settings }: ParsedCue): VTTCue {
  const cue = new VTTCue(start, end, text);
  // Best effort: browsers reject values they don't support.
  try {
    if (settings.align) cue.align = settings.align as AlignSetting;
    if (settings.line) {
      cue.line = settings.line.endsWith("%") ? Number.parseFloat(settings.line) : Number(settings.line.split(",")[0]);
      cue.snapToLines = !settings.line.endsWith("%");
    }
    if (settings.position) cue.position = Number.parseFloat(settings.position);
    if (settings.size) cue.size = Number.parseFloat(settings.size);
    if (settings.vertical) cue.vertical = settings.vertical as DirectionSetting;
  } catch {
    // Keep the cue with default placement.
  }
  return cue;
}

/** Videos that already have their subtitle tracks (text tracks can't be removed). */
const withSubtitles = new WeakSet<HTMLVideoElement>();

/**
 * Adds each subtitle as a text track (off until picked in the CC menu) and
 * loads its cues. Safe to call again for the same element: refs re-attach
 * when a hidden page is shown again.
 */
export function attachSubtitles(video: HTMLVideoElement, tracks: SubtitleTrack[] | undefined) {
  if (!tracks?.length || withSubtitles.has(video) || typeof VTTCue === "undefined") return;
  withSubtitles.add(video);

  for (const { src, label, lang } of tracks) {
    // Created up front so the menu order matches the library order.
    const textTrack = video.addTextTrack("subtitles", label, lang ?? "");
    textTrack.mode = "disabled";
    void fetch(src)
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.text();
      })
      .then((vtt) => {
        for (const cue of parseWebVtt(vtt)) textTrack.addCue(toCue(cue));
      })
      .catch((error: unknown) => console.warn(`Subtitles "${label}" couldn't be loaded:`, error));
  }
}
