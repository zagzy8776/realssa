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
  'What happened in Nigeria today?',
  'Explain the Naira exchange rate',
  'Latest AFCON news',
  'Who is the CBN governor?',
  'Tinubu economic policy summary',
  'African tech startups 2025',
];

export default function RealSSAChat({ isOpen, onClose, initialQuery = '' }: RealSSAChatProps) {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const sentInitial = useRef(false);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
      document.body.style.overflow = 'hidden';
      if (initialQuery && !sentInitial.current) {
        sentInitial.current = true;
        send(initialQuery);
      }
    } else {
      document.body.style.overflow = '';
      sentInitial.current = false;
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen, initialQuery]);

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
          history: messages.slice(-6).map(m => ({ role: m.role, content: m.content }))
        })
      });
      const data = await res.json();
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.reply || 'Sorry, I could not get a response right now.',
        sources: data.sources
      }]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Connection error. Please try again.' }]);
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
      className="fixed inset-0 z-[999999] bg-black/80 backdrop-blur-xl flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-lg h-[92dvh] sm:h-[85dvh] bg-[#0d1117] border border-amber-500/30 sm:rounded-2xl flex flex-col overflow-hidden shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center shadow-lg shadow-amber-500/30">
              <Sparkles className="w-4 h-4 text-black" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">RealSSA AI</h2>
              <p className="text-[10px] text-amber-400/70">Powered by Cerebras · African context</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {messages.length === 0 && (
            <div className="space-y-4">
              <div className="text-center py-6">
                <div className="w-14 h-14 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-3">
                  <Sparkles className="w-7 h-7 text-amber-500" />
                </div>
                <h3 className="text-white font-bold text-base">Ask RealSSA AI anything</h3>
                <p className="text-white/40 text-xs mt-1">News, politics, sports, economics — African context built in</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {SUGGESTIONS.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => send(s)}
                    className="text-left px-3 py-2.5 rounded-xl bg-white/5 hover:bg-amber-500/10 border border-white/10 hover:border-amber-500/30 text-xs text-white/70 hover:text-amber-400 transition-all"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-amber-500 text-black font-medium rounded-br-sm'
                  : 'bg-white/8 text-white/90 border border-white/10 rounded-bl-sm'
              }`}>
                <p className="whitespace-pre-wrap">{msg.content}</p>
                {msg.sources && msg.sources.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-white/10 space-y-1.5">
                    <p className="text-[10px] text-white/40 uppercase tracking-wider font-semibold">Sources</p>
                    {msg.sources.map((src, si) => (
                      <button
                        key={si}
                        onClick={() => openInBrowser(src.url)}
                        className="flex items-center gap-1.5 text-[11px] text-amber-400 hover:text-amber-300 transition-colors w-full text-left"
                      >
                        <ExternalLink className="w-3 h-3 shrink-0" />
                        <span className="truncate">{src.title}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-white/8 border border-white/10 rounded-2xl rounded-bl-sm px-4 py-3">
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <form onSubmit={handleSubmit} className="px-4 py-3 border-t border-white/10 shrink-0">
          <div className="flex items-center gap-2 bg-white/5 border border-white/15 focus-within:border-amber-500/50 rounded-2xl px-4 py-2.5 transition-all">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Ask anything..."
              className="flex-1 bg-transparent text-white text-sm placeholder:text-white/30 focus:outline-none"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="w-8 h-8 rounded-xl bg-amber-500 disabled:opacity-30 flex items-center justify-center shrink-0 transition-all active:scale-95"
            >
              <Send className="w-3.5 h-3.5 text-black" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
