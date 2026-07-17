"use client";

import * as React from "react";
import videojs from "video.js";
import type Player from "video.js/dist/types/player";
import "video.js/dist/video-js.css";

type VideoPlayerProps = {
  src: string;
  type?: string;
  poster?: string;
};

/**
 * Video.js player with HLS-ready source config.
 * Parent must gate this behind VIP permission.
 */
export function VideoPlayer({ src, type = "video/mp4", poster }: VideoPlayerProps) {
  const videoRef = React.useRef<HTMLDivElement>(null);
  const playerRef = React.useRef<Player | null>(null);

  React.useEffect(() => {
    if (!videoRef.current) return;

    if (!playerRef.current) {
      const videoElement = document.createElement("video-js");
      videoElement.classList.add("vjs-big-play-centered", "vjs-theme-mediavault");
      videoRef.current.appendChild(videoElement);

      playerRef.current = videojs(videoElement, {
        controls: true,
        responsive: true,
        fluid: true,
        preload: "auto",
        poster,
        sources: [{ src, type: src.includes(".m3u8") ? "application/x-mpegURL" : type }],
      });
    } else {
      const player = playerRef.current;
      player.src({ src, type: src.includes(".m3u8") ? "application/x-mpegURL" : type });
    }
  }, [src, type, poster]);

  React.useEffect(() => {
    return () => {
      if (playerRef.current && !playerRef.current.isDisposed()) {
        playerRef.current.dispose();
        playerRef.current = null;
      }
    };
  }, []);

  return (
    <div data-vjs-player className="overflow-hidden rounded-xl bg-black shadow-2xl shadow-black/40">
      <div ref={videoRef} />
    </div>
  );
}
