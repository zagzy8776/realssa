import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';

type Article = {
  id?: string | number;
  title?: string;
  audioUrl?: string;
  audio_url?: string;
  [key: string]: unknown;
};

type AudioContextValue = {
  currentArticle: Article | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  playArticle: (article: Article) => void;
  togglePlay: () => void;
  pause: () => void;
  stop: () => void;
};

const GlobalAudioContext = createContext<AudioContextValue | undefined>(undefined);

export const GlobalAudioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [currentArticle, setCurrentArticle] = useState<Article | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'metadata';
    audioRef.current = audio;

    const onTimeUpdate = () => setCurrentTime(audio.currentTime || 0);
    const onLoadedMetadata = () => setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnded);

    return () => {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onEnded);
      audioRef.current = null;
    };
  }, []);

  const playArticle = (article: Article) => {
    const audio = audioRef.current;
    if (!audio) return;

    const src = typeof article.audioUrl === 'string' ? article.audioUrl : typeof article.audio_url === 'string' ? article.audio_url : '';
    if (!src) return;

    setCurrentArticle(article);
    setCurrentTime(0);
    setDuration(0);
    audio.pause();
    audio.src = src;
    audio.currentTime = 0;
    void audio.play().catch(() => setIsPlaying(false));
  };

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio || !audio.src) return;
    if (audio.paused) void audio.play().catch(() => setIsPlaying(false));
    else audio.pause();
  };

  const pause = () => audioRef.current?.pause();

  const stop = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
    setCurrentTime(0);
    setIsPlaying(false);
  };

  const value = useMemo(() => ({ currentArticle, isPlaying, currentTime, duration, playArticle, togglePlay, pause, stop }), [currentArticle, isPlaying, currentTime, duration]);

  return <GlobalAudioContext.Provider value={value}>{children}</GlobalAudioContext.Provider>;
};

export const useGlobalAudio = (): AudioContextValue => {
  const context = useContext(GlobalAudioContext);
  if (!context) {
    throw new Error('useGlobalAudio must be used inside GlobalAudioProvider');
  }
  return context;
};

export default GlobalAudioContext;
