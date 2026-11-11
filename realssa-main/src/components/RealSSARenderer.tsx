import React, { useState, useRef, useEffect } from 'react';
import { ExternalLink, Clock, User, Globe, BookOpen, ChevronDown, ChevronUp, Copy, Check } from 'lucide-react';

// ─── Node type definitions ─────────────────────────────────────────────────────
export interface PageMeta {
  title: string;
  description: string;
  image: string;
  siteName: string;
  favicon: string;
  lang: string;
  author: string;
  publishedTime: string;
  readingTime: number;
  url: string;
}

export type PageNode =
  | { type: 'heading'; level: 1 | 2 | 3 | 4 | 5 | 6; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'image'; src: string; alt: string; caption: string }
  | { type: 'list'; ordered: boolean; items: string[] }
  | { type: 'blockquote'; text: string }
  | { type: 'code'; language: string; content: string }
  | { type: 'table'; headers: string[]; rows: string[][] }
  | { type: 'video'; platform: 'youtube' | 'vimeo'; videoId?: string; src?: string }
  | { type: 'divider' };

export interface PageData {
  success: boolean;
  requiresProxy: boolean;
  meta: Partial<PageMeta>;
  nodes: PageNode[];
  url?: string;
  cached?: boolean;
}

interface RealSSARendererProps {
  data: PageData;
  onNavigate: (url: string) => void;
  fontSize?: number; // 14–20px
}

// ─── Individual Node Components ───────────────────────────────────────────────

function RSSAHeading({ level, text }: { level: number; text: string }) {
  const Tag = `h${level}` as keyof JSX.IntrinsicElements;
  const sizeMap: Record<number, string> = {
    1: 'text-2xl sm:text-3xl font-black text-foreground',
    2: 'text-xl sm:text-2xl font-extrabold text-foreground',
    3: 'text-lg sm:text-xl font-bold text-amber-400',
    4: 'text-base sm:text-lg font-bold text-amber-300',
    5: 'text-sm sm:text-base font-semibold text-amber-200',
    6: 'text-sm font-semibold text-muted-foreground',
  };
  return (
    <Tag className={`${sizeMap[level] || sizeMap[3]} leading-tight mt-6 mb-3 scroll-mt-20`}>
      {text}
    </Tag>
  );
}

function RSSAParagraph({ text, fontSize }: { text: string; fontSize: number }) {
  return (
    <p
      className="text-foreground/90 leading-relaxed mb-4"
      style={{ fontSize: `${fontSize}px`, lineHeight: 1.75 }}
    >
      {text}
    </p>
  );
}

function RSSAImage({ src, alt, caption }: { src: string; alt: string; caption: string }) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  if (error) return null;

  return (
    <figure className="my-6 w-full">
      <div className="relative rounded-xl overflow-hidden bg-muted/30 border border-border/40">
        {!loaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted/20 animate-pulse">
            <div className="w-8 h-8 rounded-full border-2 border-amber-500/30 border-t-amber-500 animate-spin" />
          </div>
        )}
        <img
          src={src}
          alt={alt || ''}
          loading="lazy"
          decoding="async"
          className={`w-full h-auto object-cover transition-opacity duration-500 ${loaded ? 'opacity-100' : 'opacity-0'}`}
          onLoad={() => setLoaded(true)}
          onError={() => setError(true)}
          style={{ maxHeight: '480px', objectFit: 'cover' }}
        />
      </div>
      {caption && (
        <figcaption className="text-center text-xs text-muted-foreground mt-2 italic px-2">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}

function RSSAList({ ordered, items, fontSize }: { ordered: boolean; items: string[]; fontSize: number }) {
  const Tag = ordered ? 'ol' : 'ul';
  return (
    <Tag className={`my-4 pl-5 space-y-1.5 ${ordered ? 'list-decimal' : 'list-none'}`}>
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2.5" style={{ fontSize: `${fontSize}px` }}>
          {!ordered && (
            <span className="mt-[6px] w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
          )}
          <span className="text-foreground/85 leading-relaxed">{item}</span>
        </li>
      ))}
    </Tag>
  );
}

function RSSABlockquote({ text, fontSize }: { text: string; fontSize: number }) {
  return (
    <blockquote className="my-5 pl-4 py-1 border-l-4 border-amber-500 bg-amber-500/5 rounded-r-lg">
      <p
        className="text-foreground/80 italic leading-relaxed"
        style={{ fontSize: `${fontSize}px` }}
      >
        "{text}"
      </p>
    </blockquote>
  );
}

function RSSACodeBlock({ language, content }: { language: string; content: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <div className="my-5 rounded-xl overflow-hidden border border-border/50 bg-[#0d1117]">
      <div className="flex items-center justify-between px-4 py-2 bg-[#161b22] border-b border-border/30">
        <span className="text-[11px] font-mono text-amber-400/80 uppercase tracking-wider">
          {language || 'code'}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-amber-400 transition-colors"
        >
          {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
      <pre className="overflow-x-auto p-4 text-xs text-green-300 font-mono leading-relaxed whitespace-pre-wrap break-words">
        {content}
      </pre>
    </div>
  );
}

function RSSATable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="my-5 overflow-x-auto rounded-xl border border-border/50">
      <table className="w-full text-sm">
        {headers.length > 0 && (
          <thead>
            <tr className="bg-amber-500/10 border-b border-border/40">
              {headers.map((h, i) => (
                <th key={i} className="px-4 py-3 text-left text-xs font-bold text-amber-400 uppercase tracking-wider whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className={`border-b border-border/20 ${ri % 2 === 0 ? 'bg-background' : 'bg-muted/10'} hover:bg-amber-500/5 transition-colors`}>
              {row.map((cell, ci) => (
                <td key={ci} className="px-4 py-3 text-foreground/80 text-xs">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RSSAVideo({ platform, videoId, src }: { platform: string; videoId?: string; src?: string }) {
  const [showVideo, setShowVideo] = useState(false);

  const embedUrl = platform === 'youtube' && videoId
    ? `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1`
    : src || '';

  const thumbUrl = platform === 'youtube' && videoId
    ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
    : '';

  if (!embedUrl) return null;

  return (
    <div className="my-6 rounded-xl overflow-hidden border border-border/40 bg-black aspect-video relative">
      {!showVideo ? (
        <button
          onClick={() => setShowVideo(true)}
          className="absolute inset-0 w-full h-full group"
        >
          {thumbUrl && (
            <img src={thumbUrl} alt="Video thumbnail" className="w-full h-full object-cover" />
          )}
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center group-hover:bg-black/30 transition-all">
            <div className="w-16 h-16 rounded-full bg-amber-500 flex items-center justify-center shadow-2xl group-hover:scale-110 transition-transform">
              <div className="w-0 h-0 border-t-[10px] border-t-transparent border-l-[18px] border-l-black border-b-[10px] border-b-transparent ml-1" />
            </div>
          </div>
        </button>
      ) : (
        <iframe
          src={embedUrl}
          className="w-full h-full border-none"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          title="Embedded video"
        />
      )}
    </div>
  );
}

function RSSADivider() {
  return (
    <div className="my-6 flex items-center gap-3">
      <div className="flex-1 h-px bg-border/30" />
      <div className="w-1.5 h-1.5 rounded-full bg-amber-500/40" />
      <div className="flex-1 h-px bg-border/30" />
    </div>
  );
}

// ─── Page Header (Meta info) ──────────────────────────────────────────────────
function RSSAPageHeader({ meta }: { meta: Partial<PageMeta> }) {
  return (
    <div className="mb-6 space-y-4">
      {/* Hero image */}
      {meta.image && (
        <div className="w-full aspect-[16/7] rounded-xl overflow-hidden bg-muted/20">
          <img
            src={meta.image}
            alt={meta.title || ''}
            className="w-full h-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        </div>
      )}

      {/* Title */}
      {meta.title && (
        <h1 className="text-2xl sm:text-3xl font-black text-foreground leading-tight">
          {meta.title}
        </h1>
      )}

      {/* Meta row */}
      <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
        {meta.siteName && (
          <span className="flex items-center gap-1 font-semibold text-amber-400">
            {meta.favicon && (
              <img
                src={meta.favicon}
                alt=""
                className="w-3.5 h-3.5 rounded-sm"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            )}
            {meta.siteName}
          </span>
        )}
        {meta.author && (
          <span className="flex items-center gap-1">
            <User className="w-3 h-3" /> {meta.author}
          </span>
        )}
        {meta.readingTime && (
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" /> {meta.readingTime} min read
          </span>
        )}
        {meta.publishedTime && (
          <span>{new Date(meta.publishedTime).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
        )}
      </div>

      {/* Description */}
      {meta.description && (
        <p className="text-sm text-muted-foreground leading-relaxed border-l-2 border-amber-500/40 pl-3 italic">
          {meta.description}
        </p>
      )}

      <div className="h-px bg-border/30" />
    </div>
  );
}

// ─── Main Renderer ────────────────────────────────────────────────────────────
export default function RealSSARenderer({ data, onNavigate, fontSize = 16 }: RealSSARendererProps) {
  const { meta, nodes } = data;
  const containerRef = useRef<HTMLDivElement>(null);

  // Reading progress bar
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const el = containerRef.current?.closest('[data-browser-scroll]');
    if (!el) return;
    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = el as HTMLElement;
      const pct = scrollHeight <= clientHeight ? 100 : Math.round((scrollTop / (scrollHeight - clientHeight)) * 100);
      setProgress(pct);
    };
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div ref={containerRef} className="w-full animate-in fade-in duration-400">
      {/* Reading progress bar */}
      <div className="fixed top-0 left-0 right-0 z-[9999] h-[2px] bg-transparent pointer-events-none">
        <div
          className="h-full bg-gradient-to-r from-amber-500 to-orange-400 transition-all duration-150"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
        {/* Page header with title, author, meta */}
        <RSSAPageHeader meta={meta} />

        {/* Render all nodes */}
        {nodes.map((node, i) => {
          switch (node.type) {
            case 'heading':
              return <RSSAHeading key={i} level={node.level} text={node.text} />;
            case 'paragraph':
              return <RSSAParagraph key={i} text={node.text} fontSize={fontSize} />;
            case 'image':
              return <RSSAImage key={i} src={node.src} alt={node.alt} caption={node.caption} />;
            case 'list':
              return <RSSAList key={i} ordered={node.ordered} items={node.items} fontSize={fontSize} />;
            case 'blockquote':
              return <RSSABlockquote key={i} text={node.text} fontSize={fontSize} />;
            case 'code':
              return <RSSACodeBlock key={i} language={node.language} content={node.content} />;
            case 'table':
              return <RSSATable key={i} headers={node.headers} rows={node.rows} />;
            case 'video':
              return <RSSAVideo key={i} platform={node.platform} videoId={node.videoId} src={node.src} />;
            case 'divider':
              return <RSSADivider key={i} />;
            default:
              return null;
          }
        })}

        {/* Footer */}
        <div className="mt-10 pt-6 border-t border-border/30 flex items-center justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5 text-amber-500/70 font-mono">
            <BookOpen className="w-3 h-3" /> RealSSA Engine
          </span>
          {meta.url && (
            <button
              onClick={() => onNavigate(meta.url!)}
              className="flex items-center gap-1 hover:text-amber-400 transition-colors"
            >
              <Globe className="w-3 h-3" /> View Original
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
