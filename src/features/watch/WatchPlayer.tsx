"use client";

import { ArrowLeft, Layers, Maximize, SkipForward } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/Button";
import type { MediaDetails, MediaEpisode } from "@/types/media";
import { cn } from "@/utils/cn";
import { enterFullscreen, exitFullscreen } from "@/utils/fullscreen";
import { EpisodeDrawer, seasonOf } from "./EpisodeDrawer";
import { MediaPlayer } from "./MediaPlayer";

const IDLE_MS = 3000;

function subscribeFullscreen(onChange: () => void) {
  document.addEventListener("fullscreenchange", onChange);
  return () => document.removeEventListener("fullscreenchange", onChange);
}

/** Server render and hydration assume no fullscreen; the client corrects it. */
function useFullscreen() {
  const active = useSyncExternalStore(
    subscribeFullscreen,
    () => document.fullscreenElement !== null,
    () => false,
  );
  const supported = useSyncExternalStore(
    subscribeFullscreen,
    () => document.fullscreenEnabled,
    () => false,
  );
  return { active, supported };
}

/** True after `delay` ms without pointer or key activity; `wake` resets it. */
function useIdle(delay: number) {
  const [idle, setIdle] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const wake = useCallback(() => {
    setIdle(false);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setIdle(true), delay);
  }, [delay]);

  useEffect(() => {
    timer.current = setTimeout(() => setIdle(true), delay);
    return () => clearTimeout(timer.current);
  }, [delay]);

  return { idle, wake };
}

const episodeLabel = (e: MediaEpisode) =>
  [`S${seasonOf(e)}`, e.episode && `E${e.episode}`].filter(Boolean).join(":");

interface WatchPlayerProps {
  media: MediaDetails;
  /** From `?episode=`; falls back to the first episode. */
  initialEpisodeId?: string;
  /** Where "back" goes when there's no in-app history (e.g. a shared link). */
  backHref: string;
}

/**
 * Full-screen player, Netflix-style: the video fills the frame, with a
 * fading top bar (back, title, next episode, episodes, fullscreen) and a
 * right-hand episode drawer for series.
 *
 * Episodes switch on the client and the URL is updated in place, so there is
 * no server round trip and Back still leaves the player.
 */
export function WatchPlayer({ media, initialEpisodeId, backHref }: WatchPlayerProps) {
  const router = useRouter();
  const episodes = media.episodeList ?? [];
  const [currentId, setCurrentId] = useState(
    () => (episodes.find((e) => e.id === initialEpisodeId) ?? episodes[0])?.id,
  );
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { idle, wake } = useIdle(IDLE_MS);
  const fullscreen = useFullscreen();

  const index = episodes.findIndex((e) => e.id === currentId);
  const current = index >= 0 ? episodes[index] : undefined;
  const next = current ? episodes[index + 1] : undefined;
  const playable: MediaDetails = current
    ? { ...media, streamUrl: current.streamUrl, subtitles: current.subtitles }
    : media;

  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  const selectEpisode = (episode: MediaEpisode) => {
    setCurrentId(episode.id);
    setDrawerOpen(false);
    const url = new URL(window.location.href);
    url.searchParams.set("episode", episode.id);
    window.history.replaceState(null, "", url);
  };

  // Guards against leaving twice (Back exits fullscreen, which fires the
  // fullscreen listener below as well).
  const leavingRef = useRef(false);
  const goBack = useCallback(() => {
    if (leavingRef.current) return;
    leavingRef.current = true;
    exitFullscreen();
    if (window.history.length > 1) router.back();
    else router.push(backHref);
  }, [router, backHref]);

  const drawerOpenRef = useRef(drawerOpen);
  useEffect(() => {
    drawerOpenRef.current = drawerOpen;
  }, [drawerOpen]);

  // Netflix-style exits: leaving fullscreen (Esc, the browser's own UI) leaves
  // the player, and so does Esc when not fullscreen (unless it closes the
  // drawer). Effects re-run when a hidden page is shown again, which resets
  // the state from the last visit.
  useEffect(() => {
    leavingRef.current = false;
    let wasFullscreen = document.fullscreenElement !== null;
    const onFullscreenChange = () => {
      const isFullscreen = document.fullscreenElement !== null;
      if (wasFullscreen && !isFullscreen) goBack();
      wasFullscreen = isFullscreen;
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented || document.fullscreenElement) return;
      if (!drawerOpenRef.current) goBack();
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [goBack]);

  // Pointer moves inside the YouTube iframe never reach this page, so the
  // bar would hide for good over a trailer: only auto-hide over our <video>.
  const showChrome = drawerOpen || !idle || !playable.streamUrl;

  return (
    <div
      onPointerMove={wake}
      onPointerDown={wake}
      onKeyDown={wake}
      className={cn("relative size-full", !showChrome && "cursor-none")}
    >
      <MediaPlayer
        key={`player:${current?.id ?? media.id}`}
        media={playable}
        controlsList={fullscreen.supported ? "nofullscreen" : undefined}
      />

      <div
        className={cn(
          "absolute inset-x-0 top-0 z-10 flex items-start gap-3 bg-linear-to-b from-black/85 via-black/40 to-transparent p-4 pb-16 transition-opacity duration-300 sm:gap-4 sm:p-6 sm:pb-20",
          showChrome ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      >
        <Button variant="glass" size="icon" aria-label="Back" onClick={goBack} className="bg-black/30">
          <ArrowLeft className="size-5" />
        </Button>

        <div className="min-w-0 flex-1 pt-1">
          <h1 className="truncate text-lg font-semibold text-white drop-shadow sm:text-2xl">{media.title}</h1>
          {current && (
            <p className="truncate text-sm text-white/75 sm:text-base">
              <span className="font-medium text-accent">{episodeLabel(current)}</span> {current.title}
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {next && (
            <Button
              variant="glass"
              onClick={() => selectEpisode(next)}
              aria-label={`Next episode: ${episodeLabel(next)} ${next.title}`}
              className="bg-black/30 max-sm:size-11 max-sm:justify-center max-sm:px-0"
            >
              <SkipForward className="size-5" aria-hidden />
              <span className="max-sm:hidden">Next episode</span>
            </Button>
          )}
          {current && (
            <Button
              variant="glass"
              onClick={() => setDrawerOpen(true)}
              aria-label="Episodes"
              aria-expanded={drawerOpen}
              className="bg-black/30 max-sm:size-11 max-sm:justify-center max-sm:px-0"
            >
              <Layers className="size-5" aria-hidden />
              <span className="max-sm:hidden">Episodes</span>
            </Button>
          )}
          {/* Leaving fullscreen leaves the player, so only offer entering it
              (e.g. after opening a watch link directly). */}
          {fullscreen.supported && !fullscreen.active && (
            <Button variant="glass" size="icon" aria-label="Full screen" onClick={enterFullscreen} className="bg-black/30">
              <Maximize className="size-5" />
            </Button>
          )}
        </div>
      </div>

      {current && (
        <EpisodeDrawer
          key={`episodes:${current.id}`}
          open={drawerOpen}
          onClose={closeDrawer}
          episodes={episodes}
          currentId={current.id}
          onSelect={selectEpisode}
        />
      )}
    </div>
  );
}
