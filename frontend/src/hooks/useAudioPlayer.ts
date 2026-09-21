import { useState, useRef, useCallback, useEffect } from 'react';

export const useAudioPlayer = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  // Sequential audio queue for streaming sentence-by-sentence playback
  const audioQueueRef = useRef<string[]>([]);
  const queueActiveRef = useRef(false);
  const queueRunningRef = useRef(false);

  // Initialize audio and Web Audio context for visualizer
  const ensureAudioContext = useCallback(() => {
    try {
      if (!audioContextRef.current) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          audioContextRef.current = new AudioCtx();
          const analyser = audioContextRef.current.createAnalyser();
          analyser.fftSize = 64;
          analyser.smoothingTimeConstant = 0.8;
          analyserRef.current = analyser;
        }
      }

      if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume().catch(() => {});
      }

      if (!audioRef.current) {
        const audio = new Audio();
        audio.preload = 'auto';
        audioRef.current = audio;

        audio.onplay = () => setIsPlaying(true);
        // While the streaming queue is active, it owns the isPlaying state —
        // otherwise the gap between sentences would flicker 'speaking' off
        audio.onended = () => { if (!queueActiveRef.current) setIsPlaying(false); };
        audio.onpause = () => { if (!queueActiveRef.current) setIsPlaying(false); };
        audio.onerror = (e) => {
          console.error('Audio playback error', e);
          setIsPlaying(false);
        };

        try {
          if (!sourceNodeRef.current && audioContextRef.current && analyserRef.current) {
            const source = audioContextRef.current.createMediaElementSource(audio);
            source.connect(analyserRef.current);
            analyserRef.current.connect(audioContextRef.current.destination);
            sourceNodeRef.current = source;
          }
        } catch (err) {
          console.warn('Web Audio node connection warning:', err);
        }
      }
    } catch (err) {
      console.warn('ensureAudioContext error:', err);
    }
  }, []);

  // Global user interaction listener to proactively unlock AudioContext
  useEffect(() => {
    const unlock = () => {
      if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume().catch(() => {});
      }
    };
    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('keydown', unlock, { passive: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  const playBase64Audio = useCallback(async (base64Audio: string): Promise<void> => {
    if (isMuted || !base64Audio) return;

    ensureAudioContext();

    if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
      try {
        await audioContextRef.current.resume();
      } catch (err) {
        console.warn('Could not resume audioContext:', err);
      }
    }

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current.muted = false;
      audioRef.current.volume = 1.0;
      audioRef.current.src = `data:audio/mp3;base64,${base64Audio}`;

      try {
        await audioRef.current.play();
      } catch (err) {
        console.warn('Primary audio play failed or was prevented:', err);
        // Fallback: Direct standalone HTML5 Audio to bypass suspended Web Audio node
        try {
          const directAudio = new Audio(`data:audio/mp3;base64,${base64Audio}`);
          directAudio.onplay = () => setIsPlaying(true);
          directAudio.onended = () => setIsPlaying(false);
          directAudio.onpause = () => setIsPlaying(false);
          await directAudio.play();
        } catch (fallbackErr) {
          console.error('Direct audio fallback also failed:', fallbackErr);
          setIsPlaying(false);
        }
      }
    }
  }, [ensureAudioContext, isMuted]);

  // Enqueue a base64 audio chunk; chunks play one after another as they arrive
  const enqueueAudio = useCallback((base64Audio: string): void => {
    if (!base64Audio) return;
    ensureAudioContext();
    audioQueueRef.current.push(base64Audio);
    if (!queueRunningRef.current) {
      void processQueue();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ensureAudioContext]);

  const processQueue = useCallback(async (): Promise<void> => {
    if (queueRunningRef.current) return;
    queueRunningRef.current = true;
    queueActiveRef.current = true;
    setIsPlaying(true);

    while (audioQueueRef.current.length > 0) {
      const nextAudio = audioQueueRef.current.shift();
      const audio = audioRef.current;
      if (!nextAudio || !audio) break;

      audio.muted = false;
      audio.volume = 1.0;
      audio.src = `data:audio/mp3;base64,${nextAudio}`;

      try {
        await new Promise<void>((resolve) => {
          const cleanup = () => {
            audio.removeEventListener('ended', onDone);
            audio.removeEventListener('error', onDone);
            audio.removeEventListener('pause', onPause);
          };
          const onDone = () => { cleanup(); resolve(); };
          // A manual pause (barge-in) also ends the current chunk
          const onPause = () => { if (!audio.ended) { cleanup(); resolve(); } };
          audio.addEventListener('ended', onDone, { once: true });
          audio.addEventListener('error', onDone, { once: true });
          audio.addEventListener('pause', onPause);
          audio.play().catch(() => { cleanup(); resolve(); });
        });
      } catch {
        // keep draining the queue
      }
    }

    queueRunningRef.current = false;
    queueActiveRef.current = false;
    setIsPlaying(false);
  }, []);

  const stopPlayback = useCallback(() => {
    // Drop everything queued; the running queue loop exits after the current
    // chunk's pause event resolves and it sees the empty queue
    audioQueueRef.current = [];
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
    }
  }, []);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      if (audioRef.current) {
        audioRef.current.muted = next;
      }
      return next;
    });
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
      }
    };
  }, []);

  return {
    isPlaying,
    isMuted,
    playBase64Audio,
    enqueueAudio,
    stopPlayback,
    toggleMute,
    ensureAudioContext,
    analyserRef,
  };
};
