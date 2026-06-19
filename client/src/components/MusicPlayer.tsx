import { useEffect, useRef, useState } from 'react';
import { tracks } from '../data/playlist';

export default function MusicPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // Refs keep event listeners from going stale
  const stateRef = useRef({ index: 0, shuffle: false, playing: false });

  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [shuffle, setShuffle] = useState(false);

  // Keep stateRef in sync so the 'ended' listener sees current values
  useEffect(() => {
    stateRef.current = { index, shuffle, playing };
  }, [index, shuffle, playing]);

  // Create the Audio element once on mount
  useEffect(() => {
    if (tracks.length === 0) return;
    const audio = new Audio();
    audioRef.current = audio;

    audio.addEventListener('ended', () => {
      const { index: cur, shuffle: shuf } = stateRef.current;
      const next = advance(cur, shuf);
      stateRef.current.index = next;
      setIndex(next);
    });

    return () => {
      audio.pause();
      audioRef.current = null;
    };
  }, []);

  // When index changes: swap the src, resume playback if already playing
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || tracks.length === 0) return;
    audio.src = tracks[index].src;
    if (stateRef.current.playing) {
      audio.play().catch(() => { setPlaying(false); stateRef.current.playing = false; });
    }
  }, [index]);

  function advance(cur: number, shuf: boolean): number {
    if (tracks.length <= 1) return 0;
    if (shuf) {
      let next = cur;
      while (next === cur) next = Math.floor(Math.random() * tracks.length);
      return next;
    }
    return (cur + 1) % tracks.length;
  }

  function handlePlayPause() {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      if (!audio.src) audio.src = tracks[index]?.src ?? '';
      audio.play().catch(() => setPlaying(false));
      setPlaying(true);
    }
  }

  function handleNext() {
    setIndex(advance(index, shuffle));
  }

  function handlePrev() {
    setIndex((index - 1 + tracks.length) % tracks.length);
  }

  if (tracks.length === 0) return null;

  const title = tracks[index]?.title ?? '';

  return (
    <div className="ml-auto flex-shrink-0 flex flex-col items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 ring-1 ring-white/10">
      {/* Track title */}
      <span
        className="text-white/50 text-[11px] leading-none max-w-[148px] truncate"
        title={title}
      >
        {title}
      </span>

      {/* Controls row */}
      <div className="flex items-center gap-2">
        {/* Prev */}
        <button
          onClick={handlePrev}
          className="p-1 text-white/50 hover:text-white transition-colors"
          title="Previous"
        >
          <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 fill-current">
            <path d="M.5 3.5A.5.5 0 0 1 1 4v3.248l6.267-3.636c.54-.313 1.233.066 1.233.696v2.94l6.267-3.636c.54-.314 1.233.066 1.233.696v7.384c0 .63-.693 1.01-1.233.696L8.5 8.752v2.94c0 .63-.692 1.01-1.233.696L1 8.752V12a.5.5 0 0 1-1 0V4a.5.5 0 0 1 .5-.5z" />
          </svg>
        </button>

        {/* Play / Pause — circular accent */}
        <button
          onClick={handlePlayPause}
          className="p-1.5 text-white hover:text-yellow-400 transition-colors bg-white/10 rounded-full"
          title={playing ? 'Pause' : 'Play'}
        >
          {playing ? (
            <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 fill-current">
              <path d="M6 3.5a.5.5 0 0 1 .5.5v8a.5.5 0 0 1-1 0V4a.5.5 0 0 1 .5-.5zm4 0a.5.5 0 0 1 .5.5v8a.5.5 0 0 1-1 0V4a.5.5 0 0 1 .5-.5z" />
            </svg>
          ) : (
            <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 fill-current">
              <path d="M10.804 8 5 4.633v6.734L10.804 8zm.792-.696a.802.802 0 0 1 0 1.392l-6.363 3.692C4.713 12.69 4 12.345 4 11.692V4.308c0-.653.713-.998 1.233-.696l6.363 3.692z" />
            </svg>
          )}
        </button>

        {/* Next */}
        <button
          onClick={handleNext}
          className="p-1 text-white/50 hover:text-white transition-colors"
          title="Next"
        >
          <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 fill-current">
            <path d="M15.5 3.5a.5.5 0 0 1 .5.5v8a.5.5 0 0 1-1 0V8.752l-6.267 3.636c-.54.313-1.233-.066-1.233-.696v-2.94l-6.267 3.636C.693 12.703 0 12.324 0 11.692V4.308c0-.63.693-1.01 1.233-.696L7.5 7.248v-2.94c0-.63.692-1.01 1.233-.696L15 7.248V4a.5.5 0 0 1 .5-.5z" />
          </svg>
        </button>

        {/* Shuffle */}
        <button
          onClick={() => setShuffle((s) => !s)}
          className={`p-1 transition-colors ${shuffle ? 'text-yellow-400' : 'text-white/30 hover:text-white/60'}`}
          title={shuffle ? 'Shuffle on' : 'Shuffle off'}
        >
          <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 fill-current">
            <path d="M0 3.5A.5.5 0 0 1 .5 3H1c2.202 0 3.827 1.24 4.874 2.418.49.552.865 1.102 1.126 1.532.26-.43.636-.98 1.126-1.532C9.173 4.24 10.798 3 13 3v1c-1.798 0-3.173 1.01-4.126 2.082A9.624 9.624 0 0 0 7.556 8a9.624 9.624 0 0 0 1.318 1.918C9.827 10.99 11.202 12 13 12v1c-2.202 0-3.827-1.24-4.874-2.418A10.595 10.595 0 0 1 7 9.05c-.26.43-.636.98-1.126 1.532C4.827 11.76 3.202 13 1 13H.5a.5.5 0 0 1 0-1H1c1.798 0 3.173-1.01 4.126-2.082A9.624 9.624 0 0 0 6.444 8a9.624 9.624 0 0 0-1.318-1.918C4.173 5.01 2.798 4 1 4H.5a.5.5 0 0 1-.5-.5z" />
            <path d="M13 5.466V4.063a.5.5 0 0 1 .853-.354l2.664 2.668a.5.5 0 0 1 0 .708l-2.664 2.669a.5.5 0 0 1-.853-.354V8.534a5.77 5.77 0 0 0-1.44.588 7.502 7.502 0 0 0-1.56 1.24 7.08 7.08 0 0 1 .12-.18 10.59 10.59 0 0 1 1.285-1.48A6.77 6.77 0 0 1 13 7.98v-1.51a6.77 6.77 0 0 1-1.595-.747 10.59 10.59 0 0 1-1.286-1.48 7.08 7.08 0 0 1-.12-.18A7.502 7.502 0 0 0 11.56 5.88 5.77 5.77 0 0 0 13 5.466z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
