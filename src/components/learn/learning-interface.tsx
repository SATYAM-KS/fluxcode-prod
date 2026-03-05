"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Circle,
  Menu,
  X,
  PlayCircle,
  Play,
  Pause,
  Volume2,
  Volume1,
  VolumeX,
  Maximize2,
  Minimize2,
  Loader2,
  RotateCcw,
  RotateCw,
  Settings,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/* ─── YouTube IFrame API loader ─────────────────────────────────── */

declare global {
  interface Window {
    YT: {
      Player: new (el: string | HTMLElement, config: object) => any;
      PlayerState: {
        UNSTARTED: number;
        ENDED: number;
        PLAYING: number;
        PAUSED: number;
        BUFFERING: number;
        CUED: number;
      };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

let _apiLoading = false;
const _queue: Array<() => void> = [];

function loadYTApi() {
  if (typeof window === "undefined") return;
  if (window.YT?.Player) return; // already ready
  if (_apiLoading) return;
  _apiLoading = true;

  const prev = window.onYouTubeIframeAPIReady;
  window.onYouTubeIframeAPIReady = () => {
    if (prev) prev();
    // drain the queue
    while (_queue.length) _queue.shift()!();
  };

  const script = document.createElement("script");
  script.src = "https://www.youtube.com/iframe_api";
  document.head.appendChild(script);
}

function whenYTReady(cb: () => void) {
  if (typeof window !== "undefined" && window.YT?.Player) {
    cb();
  } else {
    _queue.push(cb);
  }
}

/* ─── Types ─────────────────────────────────────────────────────── */

type Lesson = {
  id: string;
  section_id: string;
  title: string;
  description: string | null;
  drive_video_url: string | null;
  duration: number | null;
  is_free_preview: boolean;
  order_index: number;
  completed: boolean;
};

type Section = { id: string; title: string; order_index: number; lessons: Lesson[] };
type Course = { id: string; title: string; description: string | null };

interface LearningInterfaceProps {
  course: Course;
  sections: Section[];
  activeLessonId: string | null;
  userId: string;
}

/* ─── Helpers ───────────────────────────────────────────────────── */

function extractYouTubeId(url: string | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url.trim());
    if (u.hostname === "youtu.be") return u.pathname.slice(1).split("/")[0] || null;
    if (u.hostname.includes("youtube.com")) {
      if (u.pathname === "/watch") return u.searchParams.get("v");
      const m = u.pathname.match(/\/embed\/([^/?]+)/);
      if (m) return m[1];
    }
  } catch { }
  return null;
}

function fmtTime(sec: number): string {
  if (!isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function fmtDuration(seconds: number | null): string {
  if (!seconds) return "";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/* ─── Custom YouTube Player ──────────────────────────────────────── */

function YouTubePlayer({
  lesson,
  userId,
  onComplete,
  playerId = "yt-player-iframe-target",
}: {
  lesson: Lesson | null;
  userId: string;
  onComplete: () => void;
  playerId?: string;
}) {
  const playerRef = useRef<any>(null);
  const isReadyRef = useRef(false);   // true only after onReady fires
  const prevStateRef = useRef<number>(-1); // tracks previous YT player state
  const hasShownOverlayRef = useRef(false); // overlay only shows once per lesson
  const wrapperRef = useRef<HTMLDivElement>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);
  const [volume, setVolume] = useState(80);
  const [muted, setMuted] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showFlash, setShowFlash] = useState(false);
  const [flashIcon, setFlashIcon] = useState<"play" | "pause">("play");
  const [isDragging, setIsDragging] = useState(false);
  const [isSeekHover, setIsSeekHover] = useState(false);
  const [showBrandingOverlay, setShowBrandingOverlay] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [quality, setQuality] = useState<string>("default");
  const brandingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savePositionTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const resumePositionRef = useRef<number>(0);

  const videoId = lesson ? extractYouTubeId(lesson.drive_video_url) : null;

  // ── Load the YouTube API script once ──────────────────────────
  useEffect(() => { loadYTApi(); }, []);

  // ── Create or reload player when lesson/videoId changes ───────
  useEffect(() => {
    if (!videoId) return;

    setIsLoading(true);
    setIsPlaying(false);
    setProgress(0);
    setCurrentTime(0);
    setShowBrandingOverlay(true);
    hasShownOverlayRef.current = false;
    if (brandingTimerRef.current) clearTimeout(brandingTimerRef.current);

    // Fetch saved position first, then init player with correct startSeconds
    const supabase = createClient();
    supabase
      .from("watch_history")
      .select("position")
      .eq("user_id", userId)
      .eq("lesson_id", lesson!.id)
      .maybeSingle()
      .then(({ data }) => {
        resumePositionRef.current = data?.position ?? 0;
        whenYTReady(init);
      });

    const init = () => {
      // If position is very large (sentinel for completed), start from beginning
      const pos = resumePositionRef.current;
      const startSeconds = pos > 5 && pos < 90000 ? pos : 0;
      // If player already exists and is ready, just cue the new video (no autoplay)
      if (playerRef.current && isReadyRef.current) {
        try {
          playerRef.current.cueVideoById({ videoId, startSeconds });
          return;
        } catch { /* fall through to full re-init */ }
      }

      // Destroy any stale player first
      if (playerRef.current) {
        try { playerRef.current.destroy(); } catch { }
        playerRef.current = null;
      }
      isReadyRef.current = false;

      playerRef.current = new window.YT.Player(playerId, {
        videoId,
        width: "100%",
        height: "100%",
        playerVars: {
          controls: 0,  // hide native controls
          modestbranding: 1,  // no big YouTube logo
          rel: 0,  // no related videos at end
          iv_load_policy: 3,  // no annotations
          showinfo: 0,  // no title overlay
          autoplay: 0,  // no autoplay
          playsinline: 1,  // inline on iOS
          disablekb: 1,  // disable keyboard shortcuts
          vq: "hd1080",  // request highest quality
          /*  fs:0 is intentionally omitted — we provide our own fullscreen */
          origin: window.location.origin,
        },
        events: {
          onReady: () => {
            isReadyRef.current = true;
            setIsLoading(false);
            // Force highest available quality
            try { playerRef.current?.setPlaybackQuality("hd1080"); } catch { }
            // Seek to saved position if > 5s and not a completed-sentinel value
            const rp = resumePositionRef.current;
            if (rp > 5 && rp < 90000) {
              try { playerRef.current?.seekTo(rp, true); } catch { }
            }
          },
          onStateChange: (e: any) => {
            const S = window.YT.PlayerState;
            if (e.data === S.PLAYING) {
              setIsPlaying(true);
              setIsLoading(false);
              setTotalDuration(playerRef.current?.getDuration?.() || 0);
              // Only show branding overlay once per lesson (first play)
              if (!hasShownOverlayRef.current) {
                hasShownOverlayRef.current = true;
                setShowBrandingOverlay(true);
                if (brandingTimerRef.current) clearTimeout(brandingTimerRef.current);
                brandingTimerRef.current = setTimeout(() => setShowBrandingOverlay(false), 3000);
              }
              prevStateRef.current = e.data;
            } else if (e.data === S.PAUSED) {
              setIsPlaying(false);
              prevStateRef.current = e.data;
              // Save position on pause
              try {
                const pos = playerRef.current?.getCurrentTime?.() ?? 0;
                if (pos > 0 && lesson) saveWatchPosition(pos);
              } catch { }
            } else if (e.data === S.ENDED) {
              setIsPlaying(false);
              setProgress(100);
              prevStateRef.current = e.data;
              // Save full duration so this lesson stays as last-watched (resume picks it up)
              try {
                const dur = playerRef.current?.getDuration?.() ?? 0;
                if (lesson) saveWatchPosition(dur > 0 ? dur : 99999);
              } catch { if (lesson) saveWatchPosition(99999); }
              onComplete();
            } else if (e.data === S.BUFFERING) {
              setIsLoading(true);
              prevStateRef.current = e.data;
            } else {
              setIsLoading(false);
              prevStateRef.current = e.data;
            }
          },
          onError: () => { setIsLoading(false); },
        },
      });
    };

  }, [videoId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Save watch position to DB ────────────────────────────────
  const saveWatchPosition = useCallback((position: number) => {
    if (!lesson) return;
    const supabase = createClient();
    supabase
      .from("watch_history")
      .upsert(
        { user_id: userId, lesson_id: lesson.id, position, updated_at: new Date().toISOString() },
        { onConflict: "user_id,lesson_id" }
      )
      .then(() => { });
  }, [lesson, userId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Save position on tab close / navigation ─────────────────
  useEffect(() => {
    const handleUnload = () => {
      if (!lesson || !playerRef.current || !isReadyRef.current) return;
      try {
        const pos = playerRef.current.getCurrentTime?.() ?? 0;
        if (pos > 0) {
          const supabase = createClient();
          supabase.from("watch_history").upsert(
            { user_id: userId, lesson_id: lesson.id, position: pos, updated_at: new Date().toISOString() },
            { onConflict: "user_id,lesson_id" }
          );
        }
      } catch { }
    };
    window.addEventListener("beforeunload", handleUnload);
    return () => window.removeEventListener("beforeunload", handleUnload);
  }, [lesson, userId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Destroy player on unmount ─────────────────────────────────
  useEffect(() => {
    return () => {
      // Save position on unmount (e.g. lesson switch via Next.js navigation)
      if (lesson && playerRef.current && isReadyRef.current) {
        try {
          const pos = playerRef.current.getCurrentTime?.() ?? 0;
          if (pos > 0) saveWatchPosition(pos);
        } catch { }
      }
      if (playerRef.current) {
        try { playerRef.current.destroy(); } catch { }
        playerRef.current = null;
      }
      isReadyRef.current = false;
      if (savePositionTimerRef.current) clearInterval(savePositionTimerRef.current);
    };
  }, [lesson, userId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Progress polling + periodic position save ─────────────────
  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (savePositionTimerRef.current) clearInterval(savePositionTimerRef.current);
    if (!isPlaying) return;
    pollRef.current = setInterval(() => {
      const p = playerRef.current;
      if (!p || !isReadyRef.current) return;
      try {
        const cur = p.getCurrentTime();
        const dur = p.getDuration();
        setCurrentTime(cur);
        if (dur > 0) {
          setTotalDuration(dur);
          setProgress((cur / dur) * 100);
        }
      } catch { }
    }, 500);
    savePositionTimerRef.current = setInterval(() => {
      const p = playerRef.current;
      if (!p || !isReadyRef.current) return;
      try {
        const pos = p.getCurrentTime();
        if (pos > 0) saveWatchPosition(pos);
      } catch { }
    }, 5000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (savePositionTimerRef.current) clearInterval(savePositionTimerRef.current);
    };
  }, [isPlaying, saveWatchPosition]);

  // ── Fullscreen change ─────────────────────────────────────────
  useEffect(() => {
    const fn = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", fn);
    return () => document.removeEventListener("fullscreenchange", fn);
  }, []);

  // ── Helpers ───────────────────────────────────────────────────
  const safeCall = useCallback((fn: (p: any) => void) => {
    const p = playerRef.current;
    if (!p || !isReadyRef.current) return;
    try { fn(p); } catch { }
  }, []);

  const resetHide = useCallback(() => {
    setShowControls(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setShowControls(false), 3000);
  }, []);

  const togglePlay = useCallback(() => {
    safeCall((p) => {
      if (isPlaying) {
        p.pauseVideo();
        setFlashIcon("pause");
      } else {
        p.playVideo();
        setFlashIcon("play");
      }
    });
    setShowFlash(true);
    setTimeout(() => setShowFlash(false), 600);
    resetHide();
  }, [isPlaying, safeCall, resetHide]);

  const skip = useCallback(
    (seconds: number) => {
      safeCall((p) => {
        const next = Math.max(0, Math.min(p.getCurrentTime() + seconds, totalDuration));
        p.seekTo(next, true);
        setCurrentTime(next);
        setProgress(totalDuration > 0 ? (next / totalDuration) * 100 : 0);
      });
      resetHide();
    },
    [safeCall, totalDuration, resetHide]
  );

  const handleSeekMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      e.preventDefault();
      const bar = e.currentTarget;
      const rect = bar.getBoundingClientRect();

      const seekTo = (clientX: number) => {
        const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        const time = pct * totalDuration;
        safeCall((p) => p.seekTo(time, true));
        setProgress(pct * 100);
        setCurrentTime(time);
      };

      seekTo(e.clientX);
      setIsDragging(true);
      resetHide();

      const onMove = (ev: MouseEvent) => {
        seekTo(ev.clientX);
        resetHide();
      };
      const onUp = () => {
        setIsDragging(false);
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
      };
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [totalDuration, safeCall, resetHide]
  );

  const toggleMute = useCallback(() => {
    safeCall((p) => {
      if (muted) { p.unMute(); p.setVolume(volume); }
      else { p.mute(); }
    });
    setMuted((m) => !m);
    resetHide();
  }, [muted, volume, safeCall, resetHide]);

  const changeVolume = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = Number(e.target.value);
      safeCall((p) => { p.unMute(); p.setVolume(v); });
      setVolume(v);
      setMuted(v === 0);
      resetHide();
    },
    [safeCall, resetHide]
  );

  const changeSpeed = useCallback(
    (speed: number) => {
      safeCall((p) => p.setPlaybackRate(speed));
      setPlaybackSpeed(speed);
      resetHide();
    },
    [safeCall, resetHide]
  );

  const changeQuality = useCallback(
    (q: string) => {
      safeCall((p) => p.setPlaybackQuality(q));
      setQuality(q);
      setShowSettings(false);
      resetHide();
    },
    [safeCall, resetHide]
  );

  const toggleFullscreen = useCallback(() => {
    const el = wrapperRef.current;
    if (!el) return;
    if (!document.fullscreenElement) el.requestFullscreen();
    else document.exitFullscreen();
  }, []);

  /* ── Empty state ── */
  if (!lesson) {
    return (
      <div className="flex h-full items-center justify-center bg-zinc-950">
        <div className="text-center">
          <PlayCircle className="mx-auto mb-4 h-16 w-16 text-zinc-700" />
          <p className="text-lg font-medium text-zinc-400">Select a lesson to start learning</p>
        </div>
      </div>
    );
  }

  /* ── No video URL ── */
  if (!videoId) {
    return (
      <div className="flex h-full flex-col bg-zinc-950">
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <PlayCircle className="mx-auto mb-4 h-16 w-16 text-zinc-700" />
            <p className="text-lg text-zinc-400">No video available for this lesson</p>
          </div>
        </div>
      </div>
    );
  }

  const VolumeIcon = muted || volume === 0 ? VolumeX : volume < 50 ? Volume1 : Volume2;

  return (
    <div className="flex h-full flex-col bg-zinc-950">
      {/* ── Video area ── */}
      <div
        ref={wrapperRef}
        className="relative flex-1 overflow-hidden bg-black"
        onMouseMove={resetHide}
        onMouseLeave={() => { if (isPlaying) setShowControls(false); }}
        style={{ cursor: showControls ? "default" : "none" }}
      >
        {/* YouTube iframe */}
        <div id={playerId} className="absolute inset-0 h-full w-full" />

        {/* Transparent overlay — blocks YouTube's native controls / links from cursor */}
        <div
          className="absolute inset-0 z-10"
          style={{ background: "transparent" }}
          onClick={togglePlay}
          onDoubleClick={toggleFullscreen}
        />

        {/* 5-second black branding overlay — hides YouTube logo/title/copy-link on play start */}
        {showBrandingOverlay && (
          <div className="pointer-events-none absolute inset-0 z-20 bg-black" />
        )}

        {/* Buffering spinner */}
        {isLoading && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/30">
            <Loader2 className="h-10 w-10 animate-spin text-white/60" />
          </div>
        )}

        {/* Big center play button — visible when paused and video is ready */}
        {!isPlaying && !isLoading && !showBrandingOverlay && (
          <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-black/50 backdrop-blur-sm ring-2 ring-white/20">
              <Play className="h-9 w-9 translate-x-0.5 text-white" />
            </div>
          </div>
        )}

        {/* Center play/pause flash */}
        <div
          className={cn(
            "pointer-events-none absolute inset-0 z-20 flex items-center justify-center transition-opacity duration-300",
            showFlash ? "opacity-100" : "opacity-0"
          )}
        >
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-black/60 backdrop-blur-md">
            {flashIcon === "play"
              ? <Play className="h-7 w-7 text-white" />
              : <Pause className="h-7 w-7 text-white" />}
          </div>
        </div>

        {/* Controls overlay */}
        <div
          className={cn(
            "pointer-events-none absolute inset-x-0 bottom-0 z-20 select-none bg-gradient-to-t from-black/90 via-black/50 to-transparent pb-3 pt-14 transition-opacity duration-300",
            showControls ? "opacity-100 pointer-events-auto" : "opacity-0"
          )}
        >
          {/* Seek bar */}
          {(() => {
            const active = isDragging || isSeekHover;
            return (
              <div
                className="mx-4 mb-3 flex cursor-pointer items-center py-2"
                onMouseEnter={() => setIsSeekHover(true)}
                onMouseLeave={() => setIsSeekHover(false)}
                onMouseDown={handleSeekMouseDown}
              >
                <div
                  className="relative w-full rounded-full bg-white/25 transition-all duration-150"
                  style={{ height: active ? "6px" : "3px" }}
                >
                  {/* Filled (played) portion */}
                  <div
                    className="absolute inset-y-0 left-0 rounded-full bg-primary transition-none"
                    style={{ width: `${progress}%` }}
                  />
                  {/* Drag thumb */}
                  <div
                    className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 rounded-full bg-white shadow-lg transition-all duration-150"
                    style={{
                      left: `${progress}%`,
                      width: active ? "14px" : "0px",
                      height: active ? "14px" : "0px",
                      opacity: active ? 1 : 0,
                    }}
                  />
                </div>
              </div>
            );
          })()}

          {/* Bottom row */}
          <div className="mx-2 flex items-center gap-1.5 text-white sm:mx-4 sm:gap-3">
            {/* Play / Pause */}
            <button
              onClick={togglePlay}
              aria-label={isPlaying ? "Pause" : "Play"}
              className="rounded-full p-1 transition-colors hover:text-primary"
            >
              {isPlaying
                ? <Pause className="h-5 w-5" />
                : <Play className="h-5 w-5" />}
            </button>

            {/* Skip back 10s */}
            <button
              onClick={() => skip(-10)}
              aria-label="Rewind 10 seconds"
              className="flex flex-col items-center gap-0.5 rounded-md px-2 py-1 transition-colors hover:text-primary"
            >
              <RotateCcw className="h-4 w-4" />
              <span className="text-[9px] font-semibold leading-none">10s</span>
            </button>

            {/* Skip forward 10s */}
            <button
              onClick={() => skip(10)}
              aria-label="Skip forward 10 seconds"
              className="flex flex-col items-center gap-0.5 rounded-md px-2 py-1 transition-colors hover:text-primary"
            >
              <RotateCw className="h-4 w-4" />
              <span className="text-[9px] font-semibold leading-none">10s</span>
            </button>

            {/* Mute toggle */}
            <button onClick={toggleMute} aria-label="Toggle mute" className="rounded-full p-1 hover:text-primary">
              <VolumeIcon className="h-4 w-4" />
            </button>

            {/* Volume slider — hidden on small screens */}
            <input
              type="range"
              min={0}
              max={100}
              value={muted ? 0 : volume}
              onChange={changeVolume}
              className="hidden h-1 w-20 cursor-pointer appearance-none rounded-full bg-white/30 accent-primary sm:block"
              aria-label="Volume"
            />

            {/* Timestamp */}
            <span className="font-mono text-[10px] text-white/70 tabular-nums sm:text-xs">
              {fmtTime(currentTime)}&nbsp;/&nbsp;{fmtTime(totalDuration)}
            </span>

            <div className="flex-1" />

            {/* Settings */}
            <div className="relative">
              <button
                onClick={() => { setShowSettings((v) => !v); resetHide(); }}
                aria-label="Settings"
                className={cn("rounded-full p-1 hover:text-primary", showSettings && "text-primary")}
              >
                <Settings className="h-4 w-4" />
              </button>

              {showSettings && (
                <div className="absolute bottom-9 right-0 z-30 w-52 rounded-lg border border-zinc-700 bg-zinc-900 p-3 shadow-xl">
                  {/* Speed */}
                  <div className="mb-4">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Speed</p>
                      <span className="rounded bg-white/20 px-1.5 py-0.5 text-xs font-bold text-white">{playbackSpeed.toFixed(2)}x</span>
                    </div>
                    <input
                      type="range"
                      min={0.25}
                      max={2}
                      step={0.05}
                      value={playbackSpeed}
                      onChange={(e) => changeSpeed(Number(e.target.value))}
                      className="w-full cursor-pointer accent-white"
                    />
                    <div className="relative mt-1 h-3 text-[9px] text-zinc-400">
                      <span className="absolute left-0">0.25x</span>
                      <span className="absolute -translate-x-1/2" style={{ left: "42.8%" }}>1x</span>
                      <span className="absolute right-0">2x</span>
                    </div>
                  </div>

                  {/* Quality */}
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Quality</p>
                    <select
                      value={quality}
                      onChange={(e) => changeQuality(e.target.value)}
                      className="rounded bg-zinc-700 px-2 py-0.5 text-xs text-zinc-200 outline-none cursor-pointer"
                    >
                      <option value="auto">Auto</option>
                      <option value="hd1080">1080p</option>
                      <option value="hd720">720p</option>
                      <option value="large">480p</option>
                      <option value="medium">360p</option>
                      <option value="small">240p</option>
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* Fullscreen */}
            <button onClick={toggleFullscreen} aria-label="Toggle fullscreen" className="rounded-full p-1 hover:text-primary">
              {isFullscreen
                ? <Minimize2 className="h-4 w-4" />
                : <Maximize2 className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}

/* ─── Lesson Sidebar ────────────────────────────────────────────── */

function LessonSidebar({
  sections,
  activeLessonId,
  onLessonClick,
  onClose,
}: {
  sections: Section[];
  activeLessonId: string | null;
  onLessonClick: (id: string) => void;
  onClose?: () => void;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set(sections.map((s) => s.id)));

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  return (
    <div className="flex h-full flex-col bg-zinc-900 text-zinc-100">
      {onClose && (
        <div className="flex items-center justify-between border-b border-zinc-800 p-4">
          <h3 className="text-sm font-semibold text-zinc-300">Course Content</h3>
          <button onClick={onClose} className="rounded p-1 hover:bg-zinc-800" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {sections.map((section) => {
          const isExpanded = expanded.has(section.id);
          const completedCount = section.lessons.filter((l) => l.completed).length;

          return (
            <div key={section.id} className="border-b border-zinc-800">
              <button
                onClick={() => toggle(section.id)}
                className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-zinc-800/60"
              >
                <div className="flex-1 min-w-0 pr-2">
                  <p className="truncate text-sm font-medium text-zinc-200">{section.title}</p>
                  <p className="text-[11px] text-zinc-500">
                    {completedCount}/{section.lessons.length} completed
                  </p>
                </div>
                <ChevronRight className={cn("h-4 w-4 shrink-0 text-zinc-500 transition-transform", isExpanded && "rotate-90")} />
              </button>

              {isExpanded && (
                <ul className="bg-zinc-950/40">
                  {section.lessons.map((lesson) => {
                    const isActive = lesson.id === activeLessonId;
                    return (
                      <li key={lesson.id}>
                        <button
                          onClick={() => onLessonClick(lesson.id)}
                          className={cn(
                            "flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors hover:bg-zinc-800/60",
                            isActive && "bg-primary/15 font-medium text-primary"
                          )}
                        >
                          {lesson.completed
                            ? <CheckCircle2 className="h-4 w-4 shrink-0 text-green-400" />
                            : <Circle className="h-4 w-4 shrink-0 text-zinc-600" />}
                          <span className="flex-1 truncate text-zinc-300">{lesson.title}</span>
                          {lesson.duration && (
                            <span className="shrink-0 text-[11px] text-zinc-500">
                              {fmtDuration(lesson.duration)}
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Main Learning Interface ───────────────────────────────────── */

export function LearningInterface({ course, sections, activeLessonId, userId }: LearningInterfaceProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [localSections, setLocalSections] = useState(sections);

  useEffect(() => { setLocalSections(sections); }, [sections]);

  const allLessons = localSections.flatMap((s) => s.lessons);
  const activeLesson = allLessons.find((l) => l.id === activeLessonId) ?? null;
  const activeLessonIndex = allLessons.findIndex((l) => l.id === activeLessonId);

  const gotoLesson = (lessonId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("lesson", lessonId);
    router.push(`/learn/${course.id}?${params.toString()}`);
    setSidebarOpen(false);
  };

  const handleMarkComplete = async () => {
    if (!activeLesson) return;
    const supabase = createClient();
    const { error } = await supabase
      .from("user_progress")
      .insert({ user_id: userId, lesson_id: activeLesson.id })
      .select()
      .single();

    if (error && !error.message.includes("duplicate")) {
      toast.error("Failed to mark lesson as complete");
      return;
    }

    setLocalSections((prev) =>
      prev.map((s) => ({
        ...s,
        lessons: s.lessons.map((l) =>
          l.id === activeLesson.id ? { ...l, completed: true } : l
        ),
      }))
    );
    toast.success("Lesson marked as complete!");

    if (activeLessonIndex < allLessons.length - 1) {
      setTimeout(() => gotoLesson(allLessons[activeLessonIndex + 1].id), 1000);
    }
  };

  const totalLessons = allLessons.length;
  const completedLessons = allLessons.filter((l) => l.completed).length;
  const progressPct = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

  // Draggable divider state (% width of Class panel within the right 2/3)
  const [classPct, setClassPct] = useState(35);
  const isDragging = useRef(false);
  const rightColRef = useRef<HTMLDivElement>(null);

  const onDividerMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    const onMove = (ev: MouseEvent) => {
      if (!isDragging.current || !rightColRef.current) return;
      const rect = rightColRef.current.getBoundingClientRect();
      const pct = Math.min(70, Math.max(20, ((ev.clientX - rect.left) / rect.width) * 100));
      setClassPct(pct);
    };
    const onUp = () => { isDragging.current = false; window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, []);

  // Mobile tab state: "class" | "lessons"
  const [mobileTab, setMobileTab] = useState<"class" | "lessons">("class");

  /* ── Shared lesson info panel content ── */
  const lessonInfoContent = (
    <>
      {activeLesson ? (
        <>
          <h2 className="text-base font-bold leading-snug text-white lg:text-lg">{activeLesson.title}</h2>
          {activeLesson.duration && (
            <p className="mt-1 text-xs text-zinc-400">{fmtDuration(activeLesson.duration)}</p>
          )}
          {activeLesson.completed ? (
            <div className="mt-3 flex items-center gap-2 text-sm font-medium text-green-400">
              <CheckCircle2 className="h-4 w-4" />
              Completed
            </div>
          ) : (
            <button
              onClick={handleMarkComplete}
              className="mt-3 w-full rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors lg:mt-4 lg:w-auto lg:py-1.5"
            >
              Complete Video
            </button>
          )}
          {activeLesson.description && (
            <div className="mt-4 border-t border-zinc-800 pt-4">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Description</p>
              <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">{activeLesson.description}</p>
            </div>
          )}
        </>
      ) : (
        <p className="text-sm text-zinc-500">Select a lesson to begin.</p>
      )}
    </>
  );

  /* ── Shared bottom nav ── */
  const bottomNav = (isMobile: boolean) => (
    <div className={cn(
      "flex shrink-0 items-center justify-center gap-3 px-4",
      isMobile ? "h-14 border-t border-zinc-800 bg-zinc-900" : "h-12"
    )}>
      <button
        onClick={() => activeLessonIndex > 0 && gotoLesson(allLessons[activeLessonIndex - 1].id)}
        disabled={activeLessonIndex <= 0}
        className={cn("flex items-center justify-center rounded-lg border border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-white disabled:opacity-30 transition-colors", isMobile ? "h-9 w-9" : "h-8 w-8")}
      >
        <ChevronLeft className={isMobile ? "h-5 w-5" : "h-4 w-4"} />
      </button>
      <span className="min-w-[100px] rounded-lg border border-zinc-700 px-3 py-1.5 text-center text-sm font-medium text-zinc-300">
        Lesson {activeLessonIndex + 1}/{totalLessons}
      </span>
      <button
        onClick={() => activeLessonIndex < totalLessons - 1 && gotoLesson(allLessons[activeLessonIndex + 1].id)}
        disabled={activeLessonIndex >= totalLessons - 1}
        className={cn("flex items-center justify-center rounded-lg border border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-white disabled:opacity-30 transition-colors", isMobile ? "h-9 w-9" : "h-8 w-8")}
      >
        <ChevronRight className={isMobile ? "h-5 w-5" : "h-4 w-4"} />
      </button>
    </div>
  );

  return (
    <div className="fixed inset-0 flex flex-col bg-zinc-950 text-zinc-100">

      {/* ════════════ MOBILE (< lg) ════════════ */}
      <div className="flex flex-1 flex-col overflow-hidden lg:hidden">

        {/* Top bar */}
        <div className="flex h-11 shrink-0 items-center justify-between border-b border-zinc-800 bg-zinc-900 px-3">
          <button
            onClick={() => router.push(`/courses/${course.id}`)}
            className="flex items-center gap-1 text-sm font-medium text-zinc-300 hover:text-white"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </button>
          <p className="max-w-[180px] truncate text-xs font-semibold text-zinc-200">{activeLesson?.title ?? course.title}</p>
          <div className="w-10" />
        </div>

        {/* Single video player — 16:9 */}
        <div className="w-full shrink-0 bg-black" style={{ aspectRatio: "16/9" }}>
          <YouTubePlayer lesson={activeLesson} userId={userId} onComplete={handleMarkComplete} playerId="yt-player-mobile" />
        </div>

        {/* Progress */}
        <div className="shrink-0 bg-zinc-900 px-4 py-2">
          <div className="mb-1 flex items-center justify-between text-[11px] text-zinc-400">
            <span>{progressPct.toFixed(0)}% Complete</span>
            <span>{completedLessons}/{totalLessons} videos</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-700">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progressPct}%` }} />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex shrink-0 border-b border-zinc-800 bg-zinc-900">
          <button
            onClick={() => setMobileTab("class")}
            className={cn("flex-1 py-2.5 text-sm font-semibold transition-colors", mobileTab === "class" ? "border-b-2 border-primary text-white" : "text-zinc-500 hover:text-zinc-300")}
          >
            Class Info
          </button>
          <button
            onClick={() => setMobileTab("lessons")}
            className={cn("flex-1 py-2.5 text-sm font-semibold transition-colors", mobileTab === "lessons" ? "border-b-2 border-primary text-white" : "text-zinc-500 hover:text-zinc-300")}
          >
            Lessons
          </button>
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto bg-zinc-900">
          {mobileTab === "class" ? (
            <div className="p-4">{lessonInfoContent}</div>
          ) : (
            <LessonSidebar
              sections={localSections}
              activeLessonId={activeLessonId}
              onLessonClick={(id) => { gotoLesson(id); setMobileTab("class"); }}
            />
          )}
        </div>

        {bottomNav(true)}
      </div>

      {/* ════════════ DESKTOP (≥ lg) ════════════ */}
      <div className="hidden lg:flex lg:flex-1 lg:flex-col lg:overflow-hidden">
        <div className="flex flex-1 gap-2 overflow-hidden p-2 pb-0">

          {/* Col 1: Sidebar */}
          <div className="flex w-60 shrink-0 flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
            <div className="flex h-11 shrink-0 items-center border-b border-zinc-800 px-4">
              <button
                onClick={() => router.push(`/courses/${course.id}`)}
                className="flex items-center gap-1.5 text-sm font-medium text-zinc-300 hover:text-white"
              >
                <ChevronLeft className="h-4 w-4" />
                Go Back
              </button>
            </div>
            <div className="shrink-0 border-b border-zinc-800 px-4 py-3">
              <p className="mb-1 text-[11px] font-semibold text-zinc-400">{progressPct.toFixed(1)}% Complete</p>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-700">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progressPct}%` }} />
              </div>
              <div className="mt-2 text-[11px] text-zinc-500">
                Video <span className="font-semibold text-zinc-300">{completedLessons}/{totalLessons}</span>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              <LessonSidebar sections={localSections} activeLessonId={activeLessonId} onLessonClick={(id) => gotoLesson(id)} />
            </div>
          </div>

          {/* Col 2 + divider + Col 3 */}
          <div ref={rightColRef} className="flex flex-1 gap-0 overflow-hidden rounded-xl">

            {/* Col 2: Class info */}
            <div className="flex flex-col overflow-hidden rounded-l-xl border border-zinc-800 bg-zinc-900" style={{ width: `${classPct}%` }}>
              <div className="flex h-11 shrink-0 items-center gap-2 border-b border-zinc-800 px-4">
                <PlayCircle className="h-4 w-4 shrink-0 text-primary" />
                <span className="truncate text-sm font-semibold">Class</span>
              </div>
              <div className="flex-1 overflow-y-auto p-5">{lessonInfoContent}</div>
            </div>

            {/* Draggable divider */}
            <div
              onMouseDown={onDividerMouseDown}
              className="w-1.5 shrink-0 cursor-col-resize bg-zinc-800 transition-colors hover:bg-primary/50 active:bg-primary"
            />

            {/* Col 3: Video */}
            <div className="flex flex-1 flex-col overflow-hidden rounded-r-xl border border-zinc-800 bg-zinc-900">
              <div className="flex h-11 shrink-0 items-center gap-2 border-b border-zinc-800 px-4">
                <PlayCircle className="h-4 w-4 shrink-0 text-primary" />
                <span className="text-sm font-semibold">Video Lecture</span>
              </div>
              <div className="flex-1 overflow-hidden bg-black">
                <YouTubePlayer lesson={activeLesson} userId={userId} onComplete={handleMarkComplete} />
              </div>
            </div>
          </div>
        </div>

        {bottomNav(false)}
      </div>
    </div>
  );
}
