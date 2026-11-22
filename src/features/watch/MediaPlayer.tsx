"use client";

import { LoaderCircle, RotateCcw, VideoOff } from "lucide-react";
import { type ReactNode, useCallback, useState } from "react";
import { Button } from "@/components/ui/Button";
import type { MediaDetails } from "@/types/media";
import { cn } from "@/utils/cn";
import { afterLeavingScreen } from "@/utils/dom";
import type { ApiResponse } from "@/utils/http";
import { attachSubtitles } from "./subtitles";

interface MediaPlayerProps {
  media: MediaDetails;
  /** Details still loading (stream URL may not be known yet). */
  isLoading?: boolean;
  /** Passed to the `<video>`; e.g. `"nofullscreen"` when the page handles fullscreen. */
  controlsList?: string;
  className?: string;
}

type Status = "loading" | "ready" | "error";

/** Last line of defence: nothing plays on a page the user can't see. */
function pauseIfHidden(video: HTMLVideoElement) {
  if (document.pictureInPictureElement === video) return;
  if (typeof video.checkVisibility === "function" && !video.checkVisibility()) video.pause();
}

const GENERIC_ERROR = "This video couldn’t be played. The file may be unavailable or in a format your browser doesn’t support.";

/** Same-origin stream endpoints return a JSON reason (e.g. 413 too big). */
async function explainFailure(src: string): Promise<string> {
  if (!src.startsWith("/")) return GENERIC_ERROR;
  try {
    const response = await fetch(src, { headers: { Range: "bytes=0-0" } });
    if (response.ok) return GENERIC_ERROR;
    const body = (await response.json()) as ApiResponse<never>;
    return "error" in body ? body.error.message : GENERIC_ERROR;
  } catch {
    return GENERIC_ERROR;
  }
}

function PlayerMessage({ loading, text, children }: { loading?: boolean; text: string; children?: ReactNode }) {
  const Icon = loading ? LoaderCircle : VideoOff;
  return (
    <div role={loading ? "status" : "alert"} className="grid size-full place-items-center bg-black/80 text-muted">
      <div className="flex max-w-md flex-col items-center gap-3 px-6 text-center">
        <Icon className={loading ? "size-8 animate-spin text-accent" : "size-8"} aria-hidden />
        <p>{text}</p>
        {children}
      </div>
    </div>
  );
}

/**
 * HTML5 player for the Telegram stream proxy (or preview clip), with
 * buffering/error states and optional WebVTT subtitle tracks. Falls back to the official trailer when there is
 * no playable stream.
 */
export function MediaPlayer({ media, isLoading, controlsList, className }: MediaPlayerProps) {
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState(GENERIC_ERROR);
  const [attempt, setAttempt] = useState(0);
  const [preferTrailer, setPreferTrailer] = useState(false);

  const src = media.streamUrl;
  // Stable per episode (it comes from the episode list), so the video's ref
  // callback below doesn't re-run on unrelated re-renders.
  const subtitles = media.subtitles;

  const [errorDetail, setErrorDetail] = useState<string | null>(null);

  const fail = useCallback(
    async (mediaError?: MediaError | null) => {
      setStatus("error");
      // The browser's own reason, shown small: tells a decode or format
      // problem (codes 3/4) from a network one (code 2) on devices we can't
      // debug directly.
      setErrorDetail(mediaError ? `Error ${mediaError.code}${mediaError.message ? `: ${mediaError.message}` : ""}` : null);
      if (src) setError(await explainFailure(src));
    },
    [src],
  );

  const syncWithElement = useCallback(
    (video: HTMLVideoElement | null) => {
      if (!video) return;
      // A server-rendered <video> can error or become playable before React
      // hydrates and attaches listeners, so read its state once on mount.
      if (video.error) void fail(video.error);
      else if (video.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) setStatus("ready");

      // Off until picked in the browser's CC / subtitles menu. Script-added,
      // never <track> children: see subtitles.ts (iPhone/iPad "Error 4").
      attachSubtitles(video, subtitles);

      // Autoplay from here, not with the `autoPlay` attribute: a page can
      // finish loading after the user already left (React Activity renders
      // it hidden), and an `autoPlay` video would start playing unseen. This
      // ref only attaches while the page is visible. The player page is only
      // ever shown by pressing Play, so showing it again (a kept-alive page)
      // resumes from where the viewer left off.
      video.play().catch(() => {}); // blocked by autoplay policy: user presses play

      // Navigating away keeps this page mounted but hidden (React Activity),
      // which runs this cleanup: stop the sound, keep the position. A video
      // popped out into picture-in-picture is left playing on purpose.
      return () => {
        afterLeavingScreen(video, () => {
          if (document.pictureInPictureElement !== video) video.pause();
        });
      };
    },
    [fail, subtitles],
  );

  // A hidden iframe can't be paused from outside, so it only gets its real
  // src while visible (this ref doesn't attach on a page rendered hidden)
  // and is blanked again when hidden.
  const trailerSrc = media.trailerKey
    ? `https://www.youtube-nocookie.com/embed/${media.trailerKey}?autoplay=1&rel=0`
    : undefined;
  const silenceWhenHidden = useCallback(
    (iframe: HTMLIFrameElement | null) => {
      if (!iframe || !trailerSrc) return;
      if (iframe.src !== trailerSrc) iframe.src = trailerSrc; // shown again
      return () => {
        iframe.src = "about:blank";
      };
    },
    [trailerSrc],
  );

  if (src && !preferTrailer) {
    const retry = () => {
      setStatus("loading");
      setAttempt((n) => n + 1);
    };

    return (
      <div className={cn("relative size-full overflow-hidden bg-black", className)}>
        {status !== "error" && (
          <video
            key={`${src}#${attempt}`}
            ref={syncWithElement}
            src={src}
            poster={media.backdropUrl ?? undefined}
            controls
            controlsList={controlsList}
            playsInline
            preload="metadata"
            onPlay={(e) => pauseIfHidden(e.currentTarget)}
            onWaiting={() => setStatus("loading")}
            onCanPlay={() => setStatus("ready")}
            onPlaying={() => setStatus("ready")}
            onError={(e) => void fail(e.currentTarget.error)}
            className="size-full"
          />
        )}

        {status === "loading" && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <LoaderCircle className="size-10 animate-spin text-accent drop-shadow" aria-label="Loading video" />
          </div>
        )}

        {status === "error" && (
          <div className="absolute inset-0">
            <PlayerMessage text={error}>
              {errorDetail && <p className="text-xs text-muted/70">{errorDetail}</p>}
              <div className="flex flex-wrap justify-center gap-2">
                <Button size="sm" onClick={retry}>
                  <RotateCcw className="size-4" aria-hidden />
                  Retry
                </Button>
                {media.trailerKey && (
                  <Button size="sm" variant="primary" onClick={() => setPreferTrailer(true)}>
                    Watch trailer
                  </Button>
                )}
              </div>
            </PlayerMessage>
          </div>
        )}
      </div>
    );
  }

  if (trailerSrc) {
    return (
      <iframe
        ref={silenceWhenHidden}
        src="about:blank"
        title={`${media.title} trailer`}
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
        allowFullScreen
        className={cn("size-full border-0 bg-black", className)}
      />
    );
  }

  if (isLoading) return <PlayerMessage loading text="Preparing player…" />;
  return <PlayerMessage text="No stream or trailer is available for this title yet." />;
}
