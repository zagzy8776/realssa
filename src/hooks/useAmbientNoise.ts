import { useEffect, useState, useRef } from 'react';

/**
 * useAmbientNoise — Microphone ambient noise detection for psychoacoustic mirroring
 *
 * Requests microphone access, analyzes ambient sound levels via Web Audio API,
 * and returns a normalized noise level (0-1) plus detected environment type.
 *
 * Fail-soft: if microphone permission is denied or API unavailable, returns silence.
 */

export type AmbientEnvironment = 'quiet' | 'moderate' | 'noisy' | 'chaotic';

interface AmbientNoiseState {
  level: number; // 0-1 normalized
  environment: AmbientEnvironment;
  isListening: boolean;
  error: string | null;
}

export function useAmbientNoise() {
  const [state, setState] = useState<AmbientNoiseState>({
    level: 0,
    environment: 'quiet',
    isListening: false,
    error: null,
  });

  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const micRef = useRef<MediaStream | null>(null);
  const animationRef = useRef<number>(0);

  const classifyEnvironment = (level: number): AmbientEnvironment => {
    if (level < 0.15) return 'quiet';
    if (level < 0.4) return 'moderate';
    if (level < 0.7) return 'noisy';
    return 'chaotic';
  };

  useEffect(() => {
    let started = false;

    const startListening = async () => {
      if (started) return;
      started = true;

      try {
        // Check for getUserMedia support
        if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
          setState(prev => ({ ...prev, error: 'Microphone API not available' }));
          return;
        }

        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        micRef.current = stream;

        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContext) {
          setState(prev => ({ ...prev, error: 'Web Audio API not available' }));
          return;
        }

        const audioCtx = new AudioContext();
        audioCtxRef.current = audioCtx;

        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        analyserRef.current = analyser;

        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        const analyze = () => {
          if (!analyserRef.current) return;
          analyserRef.current.getByteFrequencyData(dataArray);

          // Calculate RMS-like average
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const average = sum / dataArray.length;
          const level = Math.min(average / 255, 1);

          const environment = classifyEnvironment(level);

          setState({
            level: Math.round(level * 100) / 100,
            environment,
            isListening: true,
            error: null,
          });

          animationRef.current = requestAnimationFrame(analyze);
        };

        analyze();
      } catch (err: any) {
        setState(prev => ({
          ...prev,
          error: err?.message || 'Microphone access denied',
          isListening: false,
        }));
      }
    };

    startListening();

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (analyserRef.current) {
        try { analyserRef.current.disconnect(); } catch {}
      }
      if (audioCtxRef.current) {
        try { audioCtxRef.current.close(); } catch {}
      }
      if (micRef.current) {
        micRef.current.getTracks().forEach(track => track.stop());
      }
      started = false;
    };
  }, []);

  return state;
}
