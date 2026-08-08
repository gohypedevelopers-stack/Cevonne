"use client";

import React, { useEffect, useRef, useState } from "react";
import { Pause, Play, Volume2, VolumeX } from "lucide-react";
import { API_BASE } from "@/lib/api";
import type { ProductCollection } from "@/types/product";

const normalizeCollections = (payload: unknown): ProductCollection[] => {
  const items = Array.isArray(payload)
    ? payload
    : (payload as { data?: unknown } | null)?.data;

  return Array.isArray(items) ? (items as ProductCollection[]) : [];
};

const IntroVideo1 = () => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [collection, setCollection] = useState<ProductCollection | null>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    fetch(`${API_BASE}/collections`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Unable to load collection video");
        }

        return normalizeCollections(await response.json());
      })
      .then((collections) => {
        const newArrival = collections.find(
          (item) =>
            item.slug?.toLowerCase() === "new-arrival" ||
            item.name?.trim().toLowerCase() === "new arrival"
        );
        setCollection(newArrival ?? null);
      })
      .catch((error: unknown) => {
        if ((error as { name?: string })?.name !== "AbortError") {
          setCollection(null);
        }
      });

    return () => controller.abort();
  }, []);

  const video = collection?.media?.find((item) => item.kind === "VIDEO");
  const poster = collection?.media?.find((item) => item.kind === "IMAGE")?.url || collection?.imageUrl || undefined;

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);

    (async () => {
      try {
        v.muted = true;
        await v.play();
        setIsPlaying(!v.paused);
      } catch {
        setIsPlaying(false);
      }
    })();

    return () => {
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
    };
  }, [video?.url]);

  if (!collection || !video?.url) {
    return null;
  }

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    v.paused ? v.play() : v.pause();
  };

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setIsMuted(v.muted);
  };

  return (
    // Give the section a reliable height and a black fallback color
    <section className="relative isolate h-[calc(100svh-4rem)] w-full overflow-hidden md:h-[calc(100svh-5rem)]">
      {/* Video absolutely covers the section; 'block' kills inline baseline gap */}
      <video
        ref={videoRef}
        className="absolute inset-0 block h-full w-full object-cover"
        src={video.url}
        poster={poster}
        autoPlay
        loop
        muted={isMuted}
        playsInline
        preload="metadata"
      />

      {/* Overlay gradient */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_80%_at_0%_100%,rgba(0,0,0,0.55)_0%,transparent_60%)]" />

      {/* Controls */}
      <div className="absolute inset-x-0 bottom-4 z-10 flex items-center justify-between px-4 sm:bottom-6 sm:px-6">
        <button
          onClick={togglePlay}
          aria-label={isPlaying ? "Pause video" : "Play video"}
          className="inline-flex size-8 items-center justify-center bg-transparent p-0 text-white transition-opacity hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
        >
          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </button>
        <button
          onClick={toggleMute}
          aria-label={isMuted ? "Unmute video" : "Mute video"}
          className="inline-flex size-8 items-center justify-center bg-transparent p-0 text-white transition-opacity hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
        >
          {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </button>
      </div>
    </section>
  );
};

export default IntroVideo1;
