/**
 * Subtitle helpers: recognising subtitle uploads, reading their language,
 * and converting SubRip (.srt) to the WebVTT format browsers require.
 * Dependency-free so it can be unit tested in isolation.
 */

export const SUBTITLE_FILE_RE = /\.(srt|vtt)$/i;

/** ISO 639-1 code → display name; 639-2 codes (ffmpeg tags) map onto these. */
const LANGUAGES: Record<string, string> = {
  en: "English",
  hi: "Hindi",
  bn: "Bengali",
  ta: "Tamil",
  te: "Telugu",
  ml: "Malayalam",
  kn: "Kannada",
  mr: "Marathi",
  ur: "Urdu",
  es: "Spanish",
  fr: "French",
  de: "German",
  it: "Italian",
  pt: "Portuguese",
  ru: "Russian",
  ar: "Arabic",
  tr: "Turkish",
  id: "Indonesian",
  ja: "Japanese",
  ko: "Korean",
  zh: "Chinese",
};

const ISO_639_2: Record<string, string> = {
  eng: "en",
  hin: "hi",
  ben: "bn",
  tam: "ta",
  tel: "te",
  mal: "ml",
  kan: "kn",
  mar: "mr",
  urd: "ur",
  spa: "es",
  fre: "fr",
  fra: "fr",
  ger: "de",
  deu: "de",
  ita: "it",
  por: "pt",
  rus: "ru",
  ara: "ar",
  tur: "tr",
  ind: "id",
  jpn: "ja",
  kor: "ko",
  chi: "zh",
  zho: "zh",
};

const CODE_BY_NAME = Object.fromEntries(Object.entries(LANGUAGES).map(([code, name]) => [name.toLowerCase(), code]));

export interface SubtitleLanguage {
  /** Shown in the player's subtitle menu. */
  label: string;
  /** ISO 639-1 code, or null when unknown. */
  lang: string | null;
}

/** "en", "eng" or "English" → English/en; null when not recognised. */
export function lookupLanguage(token: string): SubtitleLanguage | null {
  const key = token.trim().toLowerCase();
  const code = LANGUAGES[key] ? key : (ISO_639_2[key] ?? CODE_BY_NAME[key]);
  return code ? { label: LANGUAGES[code], lang: code } : null;
}

/**
 * Language of a subtitle upload: the caption's first line ("English",
 * "en", "English SDH"), else a hint in the file name ("Movie.eng.vtt").
 */
export function parseSubtitleLanguage(caption: string | undefined, fileName: string | undefined): SubtitleLanguage {
  const line = caption?.split(/\r?\n/)[0]?.trim().slice(0, 40);
  if (line) {
    const known = lookupLanguage(line.split(/[\s(]/)[0]);
    return { label: known && line.length <= 3 ? known.label : line, lang: known?.lang ?? null };
  }
  // "Movie.eng.vtt" or "Movie.eng-2.vtt" (prepare-videos.sh numbers duplicates).
  const stem = fileName?.replace(SUBTITLE_FILE_RE, "");
  const hint = stem?.includes(".") ? stem.split(".").pop()!.replace(/-\d+$/, "") : null;
  if (hint) {
    const known = lookupLanguage(hint);
    if (known) return known;
  }
  return { label: "Subtitles", lang: null };
}

/** Subtitle files are usually UTF-8, but older SRTs are often Windows-1252. */
export function decodeSubtitle(bytes: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

const TIMESTAMP_RE = /(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})/g;

/** Returns WebVTT text; SubRip input is converted, WebVTT is passed through. */
export function toWebVtt(text: string): string {
  const body = text.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  if (/^WEBVTT/.test(body)) return body;

  const lines = body.split("\n").map((line) =>
    line.includes("-->")
      ? // VTT needs "hh:mm:ss.mmm" (dot, two-digit hours, three-digit ms).
        line.replace(TIMESTAMP_RE, (_, h: string, m: string, s: string, ms: string) =>
          `${h.padStart(2, "0")}:${m}:${s}.${ms.padEnd(3, "0")}`,
        )
      : // SSA-style position tags ({\an8}) would show up as literal text.
        line.replace(/\{\\[^}]*\}/g, ""),
  );
  return `WEBVTT\n\n${lines.join("\n").trim()}\n`;
}
