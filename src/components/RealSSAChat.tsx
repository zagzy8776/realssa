import { useState, useEffect, useRef } from 'react';
import { X, Send, Sparkles, ExternalLink } from 'lucide-react';
import { API_BASE_URL } from '@/lib/api-base';
import { useNavigate } from 'react-router-dom';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  sources?: { title: string; url: string }[];
}

interface RealSSAChatProps {
  isOpen: boolean;
  onClose: () => void;
  initialQuery?: string;
}

const SUGGESTIONS = [
  { emoji: '🔥', text: "What's trending in Nigeria?" },
  { emoji: '📈', text: 'Naira exchange rate today' },
  { emoji: '⚽', text: 'Latest football news' },
  { emoji: '💡', text: 'Explain anything to me' },
  { emoji: '😂', text: 'Tell me something funny' },
  { emoji: '🌍', text: 'Africa & the world today' },
];

const GREETING =
  "Hey there 👋 I'm RealSSA — your AI companion. Ask me anything: news, life, sports, deep questions, or even just a laugh. What's on your mind?";

export default function RealSSAChat({
  isOpen,
  onClose,
  initialQuery = '',
}: RealSSAChatProps) {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [greeting, setGreeting] = useState('');
  const [greetingDone, setGreetingDone] = useState(false);
  const [visible, setVisible] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const sentInitial = useRef(false);
  const greetingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Modal open/close animation
  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => setVisible(true));
      document.body.style.overflow = 'hidden';
      setTimeout(() => inputRef.current?.focus(), 350);
      if (initialQuery && !sentInitial.current) {
        sentInitial.current = true;
        send(initialQuery);
      }
    } else {
      setVisible(false);
      document.body.style.overflow = '';
      sentInitial.current = false;
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen, initialQuery]);

  // Typewriter greeting (only when no messages yet)
  useEffect(() => {
    if (!isOpen || messages.length > 0) return;
    setGreeting('');
    setGreetingDone(false);
    let i = 0;
    const type = () => {
      if (i < GREETING.length) {
        i++;
        setGreeting(GREETING.slice(0, i));
        greetingTimer.current = setTimeout(type, 20);
      } else {
        setGreetingDone(true);
      }
    };
    const delay = setTimeout(type, 600);
    return () => {
      clearTimeout(delay);
      if (greetingTimer.current) clearTimeout(greetingTimer.current);
    };
  }, [isOpen, messages.length]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || loading) return;
    setInput('');
    const userMsg: Message = { role: 'user', content: q };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: q,
          history: messages.slice(-6).map(m => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await res.json();
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: data.reply || "Hmm, something went quiet on my end. Try again in a moment!",
          sources: data.sources,
        },
      ]);
    } catch {
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: 'Connection dropped. Give it a second and try again 🔄',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    send(input);
  };

  const openInBrowser = (url: string) => {
    navigate(`/browser?url=${encodeURIComponent(url)}`);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[999999] flex items-end sm:items-center justify-center"
      style={{
        background: 'rgba(0,0,0,0.72)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      {/* ── Ambient orbs ────────────────────────────── */}
      <div
        className="absolute pointer-events-none glass-orb"
        style={{
          top: '8%', right: '8%',
          width: 260, height: 260,
          background: 'rgba(245,158,11,0.12)',
        }}
      />
      <div
        className="absolute pointer-events-none glass-orb"
        style={{
          bottom: '12%', left: '4%',
          width: 320, height: 320,
          background: 'rgba(139,92,246,0.09)',
          animationDelay: '-5s',
          animationDuration: '17s',
        }}
      />
      <div
        className="absolute pointer-events-none glass-orb"
        style={{
          top: '38%', left: '38%',
          width: 180, height: 180,
          background: 'rgba(245,158,11,0.05)',
          animationDelay: '-9s',
          animationDuration: '22s',
        }}
      />

      {/* ── Modal panel ─────────────────────────────── */}
      <div
        className="relative w-full sm:max-w-lg flex flex-col overflow-hidden"
        style={{
          height: 'min(92dvh, 700px)',
          background: 'rgba(14, 11, 19, 0.90)',
          backdropFilter: 'blur(40px) saturate(180%)',
          WebkitBackdropFilter: 'blur(40px) saturate(180%)',
          border: '1px solid rgba(255,255,255,0.09)',
          borderRadius: '24px 24px 0 0',
          boxShadow: '0 -12px 60px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.08)',
          transform: visible ? 'translateY(0)' : 'translateY(100%)',
          opacity: visible ? 1 : 0,
          transition: 'transform 0.42s cubic-bezier(0.32,0.72,0,1), opacity 0.3s ease',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Top shine hairline */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: '12%',
            right: '12%',
            height: 1,
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.22), transparent)',
            borderRadius: 9999,
            pointerEvents: 'none',
            zIndex: 1,
          }}
        />

        {/* ── Header ──────────────────────────────── */}
        <div
          className="flex items-center justify-between px-5 py-4 shrink-0 relative z-10"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}
        >
          <div className="flex items-center gap-3">
            {/* Pulsing amber orb */}
            <div className="relative w-10 h-10 shrink-0 flex items-center justify-center">
              <span
                className="absolute inset-0 rounded-full animate-ping"
                style={{ background: 'rgba(245,158,11,0.22)', animationDuration: '2.8s' }}
              />
              <div
                className="relative w-10 h-10 rounded-full flex items-center justify-center"
                style={{
                  background: 'linear-gradient(145deg, #FBBF24 0%, #F59E0B 55%, #D97706 100%)',
                  boxShadow: '0 0 18px rgba(245,158,11,0.55), inset 0 1px 0 rgba(255,255,255,0.32)',
                }}
              >
                <span
                  className="absolute inset-0 rounded-full"
                  style={{
                    background: 'linear-gradient(135deg, rgba(255,255,255,0.28) 0%, transparent 55%)',
                  }}
                />
                <Sparkles className="w-5 h-5 text-black relative z-10" strokeWidth={2.5} />
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h2
                  className="text-sm font-bold text-white"
                  style={{ letterSpacing: '0.03em' }}
                >
                  RealSSA
                </h2>
                {/* Online indicator */}
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
                </span>
              </div>
              <p
                className="text-[10px] font-medium"
                style={{ color: 'rgba(255,255,255,0.32)', letterSpacing: '0.06em' }}
              >
                Ask me anything
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-150 active:scale-90"
            style={{
              background: 'rgba(255,255,255,0.07)',
              border: '1px solid rgba(255,255,255,0.10)',
            }}
          >
            <X className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.55)' }} />
          </button>
        </div>

        {/* ── Messages area ───────────────────────── */}
        <div
          className="flex-1 overflow-y-auto px-4 py-4 space-y-3"
          style={{ scrollbarWidth: 'none' }}
        >
          {/* Welcome state */}
          {messages.length === 0 && (
            <div className="space-y-4">
              {/* Typewriter greeting bubble */}
              <div className="flex justify-start">
                <div
                  className="max-w-[88%] px-4 py-3 text-sm leading-relaxed"
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.09)',
                    borderRadius: '18px 18px 18px 4px',
                    color: 'rgba(255,255,255,0.88)',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
                  }}
                >
                  <span>{greeting}</span>
                  {!greetingDone && (
                    <span
                      className="inline-block w-px ml-0.5 align-middle animate-pulse"
                      style={{ height: '1em', background: '#FBBF24' }}
                    />
                  )}
                </div>
              </div>

              {/* Suggestion chips — appear after greeting finishes */}
              {greetingDone && (
                <div className="flex flex-wrap gap-2">
                  {SUGGESTIONS.map((s, i) => (
                    <SuggestionChip
                      key={i}
                      emoji={s.emoji}
                      text={s.text}
                      delay={i * 55}
                      onClick={() => send(s.text)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Chat messages */}
          {messages.map((msg, i) => (
            <ChatBubble
              key={i}
              msg={msg}
              onSourceClick={openInBrowser}
            />
          ))}

          {/* Waveform typing indicator */}
          {loading && (
            <div className="flex justify-start animate-fade-in">
              <div
                className="flex items-center gap-[3px] px-4 py-3.5"
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.09)',
                  borderRadius: '18px 18px 18px 4px',
                }}
              >
                {[0, 1, 2, 3, 4].map(j => (
                  <span
                    key={j}
                    className="inline-block rounded-full"
                    style={{
                      width: 3,
                      height: 16,
                      background: '#F59E0B',
                      animationName: 'waveform',
                      animationDuration: '1s',
                      animationTimingFunction: 'ease-in-out',
                      animationIterationCount: 'infinite',
                      animationDelay: `${j * 100}ms`,
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        <form
          onSubmit={handleSubmit}
          className="px-4 pb-4 pt-3 shrink-0"
          style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}
        >
          <div
            className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl transition-all duration-300"
            style={{
              background: inputFocused || input.trim() ? 'rgba(255, 255, 255, 0.09)' : 'rgba(255, 255, 255, 0.05)',
              border: `1px solid ${inputFocused ? 'rgba(245, 158, 11, 0.45)' : input.trim() ? 'rgba(255, 255, 255, 0.20)' : 'rgba(255, 255, 255, 0.09)'}`,
              boxShadow: inputFocused ? '0 0 0 3px rgba(245, 158, 11, 0.12)' : 'none',
            }}
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onFocus={() => setInputFocused(true)}
              onBlur={() => setInputFocused(false)}
              placeholder="Ask RealSSA anything..."
              className="flex-1 bg-transparent text-sm focus:outline-none"
              style={{
                color: 'rgba(255, 255, 255, 0.90)',
                fontSize: 15,
              }}
              disabled={loading}
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-all duration-200 disabled:opacity-20"
              style={{
                background: 'linear-gradient(135deg, #FBBF24, #F59E0B)',
                transform: input.trim() && !loading ? 'scale(1)' : 'scale(0.92)',
                boxShadow: input.trim() && !loading
                  ? '0 4px 14px rgba(245, 158, 11, 0.40)'
                  : 'none',
              }}
            >
              <Send className="w-3.5 h-3.5 text-black" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Sub-components ─────────────────────────────────────── */

function SuggestionChip({
  emoji,
  text,
  delay,
  onClick,
}: {
  emoji: string;
  text: string;
  delay: number;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 active:scale-95"
      style={{
        background: hovered ? 'rgba(245,158,11,0.12)' : 'rgba(255,255,255,0.06)',
        border: `1px solid ${hovered ? 'rgba(245,158,11,0.35)' : 'rgba(255,255,255,0.12)'}`,
        color: hovered ? '#FBBF24' : 'rgba(255,255,255,0.72)',
        transform: hovered ? 'scale(1.04)' : 'scale(1)',
        animationName: 'fade-in',
        animationDuration: '0.4s',
        animationDelay: `${delay}ms`,
        animationFillMode: 'both',
      }}
    >
      <span style={{ fontSize: 13 }}>{emoji}</span>
      <span>{text}</span>
    </button>
  );
}

import { Copy, Check } from 'lucide-react';

// Helper to format text with bold, inline code, headers, and lists
function parseInlineContent(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let keyIdx = 0;

  while (remaining.length > 0) {
    const boldIdx = remaining.indexOf('**');
    const codeIdx = remaining.indexOf('`');

    if (boldIdx === -1 && codeIdx === -1) {
      parts.push(<span key={keyIdx++}>{remaining}</span>);
      break;
    }

    if (boldIdx !== -1 && (codeIdx === -1 || boldIdx < codeIdx)) {
      if (boldIdx > 0) {
        parts.push(<span key={keyIdx++}>{remaining.slice(0, boldIdx)}</span>);
      }
      const endBoldIdx = remaining.indexOf('**', boldIdx + 2);
      if (endBoldIdx !== -1) {
        parts.push(
          <strong key={keyIdx++} className="font-bold text-amber-300">
            {remaining.slice(boldIdx + 2, endBoldIdx)}
          </strong>
        );
        remaining = remaining.slice(endBoldIdx + 2);
      } else {
        parts.push(<span key={keyIdx++}>{remaining.slice(boldIdx)}</span>);
        break;
      }
    } else {
      if (codeIdx > 0) {
        parts.push(<span key={keyIdx++}>{remaining.slice(0, codeIdx)}</span>);
      }
      const endCodeIdx = remaining.indexOf('`', codeIdx + 1);
      if (endCodeIdx !== -1) {
        parts.push(
          <code
            key={keyIdx++}
            className="px-1.5 py-0.5 rounded bg-white/10 text-amber-200 font-mono text-[12px] border border-white/5"
          >
            {remaining.slice(codeIdx + 1, endCodeIdx)}
          </code>
        );
        remaining = remaining.slice(endCodeIdx + 1);
      } else {
        parts.push(<span key={keyIdx++}>{remaining.slice(codeIdx)}</span>);
        break;
      }
    }
  }

  return parts;
}

function parseMarkdownToJSX(content: string): React.ReactNode {
  const lines = content.split('\n');
  return (
    <div className="space-y-1.5">
      {lines.map((line, index) => {
        const trimmed = line.trim();

        // Empty lines
        if (!trimmed) {
          return <div key={index} className="h-2" />;
        }

        // Headers
        if (line.startsWith('### ')) {
          return (
            <h4 key={index} className="text-sm font-extrabold text-amber-400 mt-2 mb-1">
              {parseInlineContent(line.slice(4))}
            </h4>
          );
        }
        if (line.startsWith('## ')) {
          return (
            <h3 key={index} className="text-base font-black text-amber-400 mt-3 mb-1.5">
              {parseInlineContent(line.slice(3))}
            </h3>
          );
        }
        if (line.startsWith('# ')) {
          return (
            <h2 key={index} className="text-lg font-black text-amber-400 mt-4 mb-2">
              {parseInlineContent(line.slice(2))}
            </h2>
          );
        }

        // Bullet lists
        if (line.startsWith('- ') || line.startsWith('* ')) {
          return (
            <div key={index} className="flex items-start gap-2 pl-2">
              <span className="text-amber-500 select-none mt-1.5 text-[8px]">•</span>
              <p className="flex-1 text-sm leading-relaxed text-white/90">
                {parseInlineContent(line.slice(2))}
              </p>
            </div>
          );
        }

        // Numbered lists
        const numberedMatch = line.match(/^(\d+)\.\s(.*)/);
        if (numberedMatch) {
          return (
            <div key={index} className="flex items-start gap-2 pl-2">
              <span className="text-amber-400/80 font-mono text-xs select-none mt-0.5">
                {numberedMatch[1]}.
              </span>
              <p className="flex-1 text-sm leading-relaxed text-white/90">
                {parseInlineContent(numberedMatch[2])}
              </p>
            </div>
          );
        }

        // Standard text
        return (
          <p key={index} className="text-sm leading-relaxed text-white/90">
            {parseInlineContent(line)}
          </p>
        );
      })}
    </div>
  );
}

function ChatBubble({
  msg,
  onSourceClick,
}: {
  msg: Message;
  onSourceClick: (url: string) => void;
}) {
  const isUser = msg.role === 'user';
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(msg.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`flex gap-3 items-start ${isUser ? 'justify-end' : 'justify-start'} animate-fade-in w-full`}>
      {/* AI Avatar */}
      {!isUser && (
        <div
          className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center border border-amber-500/20"
          style={{
            background: 'linear-gradient(135deg, rgba(245,158,11,0.15) 0%, rgba(245,158,11,0.05) 100%)',
          }}
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
        </div>
      )}

      <div
        className="max-w-[78%] flex flex-col group relative"
      >
        <div
          className="px-4 py-3 text-sm"
          style={
            isUser
              ? {
                  background: 'linear-gradient(135deg, #FBBF24 0%, #F59E0B 100%)',
                  borderRadius: '18px 4px 18px 18px',
                  color: '#000',
                  fontWeight: 500,
                  boxShadow: '0 4px 16px rgba(245,158,11,0.20)',
                }
              : {
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '4px 18px 18px 18px',
                  color: 'rgba(255,255,255,0.92)',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
                }
          }
        >
          {isUser ? (
            <p className="whitespace-pre-wrap">{msg.content}</p>
          ) : (
            parseMarkdownToJSX(msg.content)
          )}

          {/* Sources */}
          {msg.sources && msg.sources.length > 0 && (
            <div
              className="mt-3 pt-3 space-y-1.5"
              style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}
            >
              <p className="text-[9px] uppercase tracking-wider font-extrabold text-white/30">
                Sources
              </p>
              {msg.sources.map((src, si) => (
                <button
                  key={si}
                  onClick={() => onSourceClick(src.url)}
                  className="flex items-center gap-1.5 text-[11px] w-full text-left transition-colors hover:text-amber-300"
                  style={{ color: '#FBBF24' }}
                >
                  <ExternalLink className="w-3 h-3 shrink-0" />
                  <span className="truncate">{src.title}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Copy/Feedback actions for assistant messages */}
        {!isUser && (
          <div className="flex items-center gap-2 mt-1 px-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 text-[10px] text-white/40 hover:text-white/70 transition-colors"
              title="Copy answer"
            >
              {copied ? (
                <>
                  <Check className="w-3 h-3 text-emerald-400" />
                  <span className="text-emerald-400 font-medium">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* User Avatar */}
      {isUser && (
        <div
          className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center border border-white/10"
          style={{
            background: 'rgba(255,255,255,0.08)',
          }}
        >
          <span className="text-[10px] font-bold text-white/80">ME</span>
        </div>
      )}
    </div>
  );
}

