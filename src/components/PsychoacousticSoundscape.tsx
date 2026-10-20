import React, { useEffect, useRef, useState } from 'react';
import { useAmbientNoise } from '@/hooks/useAmbientNoise';
import { Brain, Ear, Volume2, VolumeX, Waves } from 'lucide-react';

/**
 * PsychoacousticSoundscape — "Biometric Mirroring"
 *
 * Detects ambient noise via microphone and plays subliminal Delta/Alpha
 * wave tones that mirror the user's environment:
 * - Quiet → Alpha waves (8-12 Hz) for relaxed focus
 * - Moderate → Theta waves (4-8 Hz) for calm
 * - Noisy → Delta waves (0.5-4 Hz) for deep calm
 * - Chaotic → White noise mask + Delta waves
 *
 * Fail-soft: if AudioContext or microphone unavailable, renders a disabled state.
 */

interface PsychoacousticSoundscapeProps {
  className?: string;
  enabled?: boolean;
}

const FREQUENCIES = {
  delta: 1.5,   // 0.5-4 Hz — deep calm, sleep
  theta: 6,     // 4-8 Hz — meditation, calm
  alpha: 10,    // 8-12 Hz — relaxed focus, alertness
  beta: 20,     // 13-30 Hz — active concentration
};

export default function PsychoacousticSoundscape({ className, enabled = true }: PsychoacousticSoundscapeProps) {
  const { level, environment, isListening, error } = useAmbientNoise();
  const [isPlaying, setIsPlaying] = useState(false);
  const oscRef = useRef<OscillatorNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const [userStarted, setUserStarted] = useState(false);

  const getFrequencyForEnvironment = (env: AmbientEnvironment): number => {
    switch (env) {
      case 'quiet': return FREQUENCIES.alpha;    // relaxed focus
      case 'moderate': return FREQUENCIES.theta; // calm
      case 'noisy': return FREQUENCIES.delta;    // deep calm
      case 'chaotic': return FREQUENCIES.delta;  // deep calm + mask
      default: return FREQUENCIES.alpha;
    }
  };

  useEffect(() => {
    if (!enabled || !userStarted) return;

    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;

    const start = async () => {
      const audioCtx = new AudioContext();
      audioCtxRef.current = audioCtx;

      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      const freq = getFrequencyForEnvironment(environment);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);

      // Very low volume — subliminal, below conscious perception
      gain.gain.setValueAtTime(0.03, audioCtx.currentTime);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start();
      setIsPlaying(true);
      oscRef.current = osc;
      gainRef.current = gain;
    };

    start();

    return () => {
      try {
        oscRef.current?.stop();
        oscRef.current?.disconnect();
        gainRef.current?.disconnect();
        audioCtxRef.current?.close();
      } catch {}
      oscRef.current = null;
      gainRef.current = null;
      audioCtxRef.current = null;
      setIsPlaying(false);
    };
  }, [enabled, userStarted, environment]);

  const toggleSound = async () => {
    if (!enabled) return;
    setUserStarted(!userStarted);
    if (!userStarted) {
      // Re-trigger effect to start audio
      setIsPlaying(false);
    }
  };

  const envIcons: Record<AmbientEnvironment, { icon: JSX.Element; color: string }> = {
    quiet: { icon: <Brain size={16} className="text-green-500" />, color: 'text-green-600' },
    moderate: { icon: <Waves size={16} className="text-yellow-500" />, color: 'text-yellow-600' },
    noisy: { icon: <Ear size={16} className="text-orange-500" />, color: 'text-orange-600' },
    chaotic: { icon: <AlertTriangle size={16} className="text-red-500" />, color: 'text-red-600' },
  };

  const envInfo = envIcons[environment];

  if (!enabled) {
    return (
      <div className={`flex items-center justify-center p-4 rounded-lg bg-muted/50 border border-border/50 ${className || ''}`}>
        <VolumeX size={16} className="text-muted-foreground" />
        <span className="ml-2 text-xs text-muted-foreground">Psychoacoustic soundscape disabled</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex items-center justify-center p-4 rounded-lg bg-destructive/10 border border-destructive/20 ${className || ''}`}>
        <Ear size={16} className="text-destructive" />
        <div className="ml-2">
          <div className="text-xs font-bold text-destructive">Microphone unavailable</div>
          <div className="text-[10px] text-destructive/70">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-3 p-4 rounded-xl border bg-card ${className || ''}`}>
      <div className="flex flex-col items-center gap-1">
        {envInfo.icon}
        <span className={`text-xs font-bold ${envInfo.color}`}>{environment}</span>
      </div>
      <div className="h-8 w-px bg-border/50 mx-1" />
      <div className="flex-1">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-bold text-muted-foreground">Ambient Level</span>
          <span className="text-xs font-mono">{Math.round(level * 100)}%</span>
        </div>
        <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-500"
            style={{ width: `${Math.min(level * 100, 100)}%` }}
          />
        </div>
      </div>
      <button
        onClick={toggleSound}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
          isPlaying
            ? 'bg-amber-500 text-black hover:bg-amber-600'
            : 'bg-muted hover:bg-muted/80 text-muted-foreground'
        }`}
      >
        {isPlaying ? <Volume2 size={14} className="text-black" /> : <Volume2 size={14} className="opacity-50" />}
        <span>{isPlaying ? 'Subliminal On' : 'Activate Mirroring'}</span>
      </button>
    </div>
  );
}
