import React, { useState, useEffect } from 'react';
import DOMPurify from 'dompurify';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Search as SearchIcon, Sparkles, ChevronDown, ChevronUp, ArrowRight, ExternalLink, Loader2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { newsAPI } from '@/lib/api-correct';

interface WebResult {
  title: string;
  url: string;
  snippet: string;
  source: string;
  date: string;
}

interface AISGEData {
  answer: string;
  sources: Array<{ title: string; url: string }>;
  provider: string;
}

export default function Search() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryParam = searchParams.get('q') || '';
  const navigate = useNavigate();

  const [inputVal, setInputVal] = useState(queryParam);
  const [results, setResults] = useState<WebResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [provider, setProvider] = useState('');
  
  // AI SGE overview state
  const [aiData, setAiData] = useState<AISGEData | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiExpanded, setAiExpanded] = useState(false);

  // People Also Ask (PAA) state
  const [expandedFAQ, setExpandedFAQ] = useState<number | null>(null);
  const [paaAnswers, setPaaAnswers] = useState<Record<number, string>>({});
  const [paaLoading, setPaaLoading] = useState<Record<number, boolean>>({});

  useEffect(() => {
    setInputVal(queryParam);
    if (queryParam.trim()) {
      handleSearch(queryParam, true);
    } else {
      setResults([]);
      setAiData(null);
    }
  }, [queryParam]);

  // Regular search execution
  const handleSearch = async (searchQuery: string, isNewSearch = true) => {
    const query = searchQuery.trim();
    if (!query) return;

    // Direct URL check
    if (isDirectUrl(query)) {
      let destination = query;
      if (!/^https?:\/\//i.test(query)) {
        destination = `https://${query}`;
      }
      console.log(`🔗 Direct URL match: redirecting to ${destination}`);
      navigate(`/read?url=${encodeURIComponent(destination)}`);
      return;
    }

    if (isNewSearch) {
      setLoading(true);
      setOffset(0);
      setResults([]);
      setAiData(null);
      setExpandedFAQ(null);
      setPaaAnswers({});
      fetchAIOverview(query);
    } else {
      setLoadingMore(true);
    }

    try {
      const currentOffset = isNewSearch ? 0 : offset + 10;
      const url = `${newsAPI.baseURL}/api/search/web?q=${encodeURIComponent(query)}&offset=${currentOffset}&limit=10`;
      
      const response = await fetch(url);
      if (!response.ok) throw new Error('Search failed');
      const data = await response.json();

      if (data.success) {
        if (isNewSearch) {
          setResults(data.results);
        } else {
          setResults(prev => [...prev, ...data.results]);
        }
        setHasMore(data.hasMore);
        setOffset(currentOffset);
        setProvider(data.provider);
      }
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  // Fetch AI SGE Overview
  const fetchAIOverview = async (query: string) => {
    setAiLoading(true);
    try {
      const response = await fetch(`${newsAPI.baseURL}/api/search/ai`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      });
      if (!response.ok) throw new Error('AI search failed');
      const data = await response.json();
      if (data.success) {
        if (!data.answer || data.answer.length < 10) {
          setAiData(null);
        } else {
          setAiData({
            answer: data.answer,
            sources: data.sources || [],
            provider: data.provider
          });
        }
      }
    } catch (err) {
      console.error('AI SGE overview error:', err);
    } finally {
      setAiLoading(false);
    }
  };

  // Fetch PAA answers dynamically using backend API
  const fetchPAAAnswer = async (index: number, question: string) => {
    if (paaAnswers[index] || paaLoading[index]) return;
    
    setPaaLoading(prev => ({ ...prev, [index]: true }));
    try {
      const response = await fetch(`${newsAPI.baseURL}/api/search/ai`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: question })
      });
      if (!response.ok) throw new Error('Failed to fetch PAA answer');
      const data = await response.json();
      if (data.success) {
        setPaaAnswers(prev => ({ ...prev, [index]: data.answer }));
      }
    } catch (err) {
      console.error('PAA fetching error:', err);
      setPaaAnswers(prev => ({ 
        ...prev, 
        [index]: `Unable to resolve answer for this query automatically. Please check the direct web results below.` 
      }));
    } finally {
      setPaaLoading(prev => ({ ...prev, [index]: false }));
    }
  };

  const isDirectUrl = (str: string): boolean => {
    // Basic URL pattern matching
    const pattern = new RegExp(
      '^(https?:\\/\\/)?' + // protocol
      '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|' + // domain name
      '((\\d{1,3}\\.){3}\\d{1,3}))' + // OR ip (v4) address
      '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*' + // port and path
      '(\\?[;&a-z\\d%_.~+=-]*)?' + // query string
      '(\\#[-a-z\\d_]*)?$', // fragment locator
      'i'
    );
    // Extra simple check for extensions like www.xxx.com
    return pattern.test(str) || (str.includes('.') && !str.includes(' ') && str.length > 4);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = inputVal.trim();
    if (q) {
      if (isDirectUrl(q)) {
        let destination = q;
        if (!/^https?:\/\//i.test(q)) {
          destination = `https://${q}`;
        }
        navigate(`/read?url=${encodeURIComponent(destination)}`);
      } else {
        setSearchParams({ q });
      }
    }
  };

  const getPAAQuestions = (q: string) => {
    return [
      `What is the official website for ${q}?`,
      `Where can I find the latest updates on ${q}?`,
      `How to access ${q} portal online?`,
      `What are the requirements or guides for ${q}?`
    ];
  };

  // SGE content highlights parsing
  const formatSGEAnswer = (answer: string) => {
    if (!answer) return '';
    
    // Replace markdown bold, headings and bulletin highlights
    let formatted = answer
      .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-foreground">$1</strong>')
      .replace(/📌 KEY TAKEAWAYS/g, '<h4 class="text-amber-500 dark:text-amber-400 font-semibold flex items-center gap-2 mb-2 text-sm uppercase tracking-wider">📌 Key Takeaways</h4>')
      .replace(/DETAILED BREAKDOWN/g, '<h4 class="text-amber-500 dark:text-amber-400 font-semibold flex items-center gap-2 mt-4 mb-2 text-sm uppercase tracking-wider">📝 Detailed Breakdown</h4>')
      .replace(/•\s(.*?)(?=\n|•|$)/g, '<li class="ml-4 list-disc text-muted-foreground my-1">$1</li>');

    // Replace [1], [2], [3] with citation superscript links
    formatted = formatted.replace(/\[([0-9]+)\]/g, (match, num) => {
      const idx = parseInt(num) - 1;
      const source = aiData?.sources?.[idx];
      if (source) {
        return `<a href="${source.url}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center justify-center w-5 h-5 ml-1 text-[10px] font-bold text-amber-500 bg-amber-500/10 hover:bg-amber-500/20 rounded-full cursor-pointer transition-all">${num}</a>`;
      }
      return `<span class="inline-block px-1 text-xs text-muted-foreground">${match}</span>`;
    });

    // Sanitize the formatted HTML with DOMPurify to prevent XSS (allowing target and rel attributes for citations)
    const cleanHtml = DOMPurify.sanitize(formatted, { ADD_ATTR: ['target', 'rel'] });

    return <div dangerouslySetInnerHTML={{ __html: cleanHtml }} className="text-sm leading-relaxed space-y-2" />;
  };

  return (
    <div className="min-h-screen bg-[#fafafa] dark:bg-[#0f1115] text-[#1f2937] dark:text-[#f3f4f6] pb-12 transition-colors duration-200">
      
      {/* Header bar */}
      <header className="sticky top-0 bg-[#ffffff]/90 dark:bg-[#121620]/90 backdrop-blur-md border-b border-[#e5e7eb] dark:border-[#1f293d] px-4 py-3 z-30 shadow-sm">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center gap-4">
          
          {/* Logo */}
          <div className="flex items-center gap-3 w-full md:w-auto">
            <button 
              onClick={() => navigate(-1)} 
              className="p-2 hover:bg-[#f3f4f6] dark:hover:bg-[#1f293d] rounded-full transition-all"
            >
              <ArrowLeft className="w-5 h-5 text-muted-foreground" />
            </button>
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/')}>
              <span className="text-2xl font-bold bg-gradient-to-r from-amber-500 via-orange-600 to-amber-400 bg-clip-text text-transparent tracking-tight">
                RealSSA
              </span>
              <span className="text-xs bg-amber-500/10 text-amber-500 font-semibold px-2 py-0.5 rounded-full border border-amber-500/20">
                Search
              </span>
            </div>
          </div>

          {/* Search form */}
          <form onSubmit={handleSubmit} className="flex-1 w-full max-w-2xl relative">
            <Input
              type="text"
              placeholder="Search news or paste a direct URL..."
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              className="w-full pl-5 pr-12 py-6 rounded-full border border-[#cbd5e1] dark:border-[#273046] bg-white dark:bg-[#1b2234] focus-visible:ring-2 focus-visible:ring-amber-500/50 shadow-sm text-sm"
            />
            <button
              type="submit"
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-full transition-all shadow-md active:scale-95"
            >
              <SearchIcon className="w-4 h-4" />
            </button>
          </form>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-4xl mx-auto px-4 mt-6">
        
        {/* Loading Spinner for full search */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="w-10 h-10 text-amber-500 animate-spin" />
            <p className="text-sm text-muted-foreground animate-pulse">Consulting 5-cluster database...</p>
          </div>
        )}

        {/* Search Results Content */}
        {!loading && queryParam.trim() && (
          <div className="space-y-6">
            
            {/* AI SGE Overview Box */}
            {(aiLoading || aiData) && (
              <div className="p-[1px] rounded-2xl bg-gradient-to-br from-amber-500/40 via-orange-600/30 to-amber-400/20 shadow-md overflow-hidden">
                <div className="bg-white dark:bg-[#131926] p-5 rounded-[15px] space-y-4">
                  
                  {/* SGE Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-amber-500 animate-pulse" />
                      <span className="font-bold text-base bg-gradient-to-r from-amber-500 to-orange-600 bg-clip-text text-transparent">
                        RealSSA AI Overview
                      </span>
                    </div>
                    {aiData && (
                      <span className="text-[10px] text-muted-foreground bg-muted px-2.5 py-1 rounded-full font-mono">
                        {aiData.provider}
                      </span>
                    )}
                  </div>

                  {/* SGE Body */}
                  {aiLoading ? (
                    <div className="space-y-3 py-4">
                      <div className="h-4 bg-muted animate-pulse rounded w-[90%]" />
                      <div className="h-4 bg-muted animate-pulse rounded w-[95%]" />
                      <div className="h-4 bg-muted animate-pulse rounded w-[80%]" />
                    </div>
                  ) : (
                    aiData && (
                      <div className="space-y-4">
                        <div className={`overflow-hidden transition-all duration-300 ${aiExpanded ? 'max-h-none' : 'max-h-[140px] relative'}`}>
                          {formatSGEAnswer(aiData.answer)}
                          {!aiExpanded && (
                            <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-white dark:from-[#131926] to-transparent pointer-events-none" />
                          )}
                        </div>

                        {/* Collapsible toggle */}
                        <div className="flex justify-center border-t border-muted/55 pt-3">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setAiExpanded(!aiExpanded)}
                            className="text-amber-500 hover:text-amber-600 hover:bg-amber-500/5 text-xs font-semibold flex items-center gap-1.5"
                          >
                            {aiExpanded ? (
                              <>Show Less <ChevronUp className="w-4 h-4" /></>
                            ) : (
                              <>Show More <ChevronDown className="w-4 h-4" /></>
                            )}
                          </Button>
                        </div>

                        {/* Citation Carousel */}
                        {aiData.sources && aiData.sources.length > 0 && (
                          <div className="pt-3 border-t border-muted/50">
                            <h5 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Verified Citations</h5>
                            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-muted">
                              {aiData.sources.map((src, i) => (
                                <a
                                  key={i}
                                  href={src.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex-shrink-0 w-[180px] p-2.5 rounded-lg border border-[#e5e7eb] dark:border-[#202737] bg-[#f9fafb] dark:bg-[#161d2d] hover:border-amber-500/40 dark:hover:border-amber-500/40 hover:bg-amber-500/[0.02] transition-all flex flex-col justify-between group"
                                >
                                  <span className="text-xs font-medium line-clamp-2 text-foreground group-hover:text-amber-500 transition-colors">
                                    {src.title}
                                  </span>
                                  <div className="flex items-center justify-between mt-2 text-[10px] text-muted-foreground">
                                    <span className="truncate max-w-[120px]">
                                      {new URL(src.url).hostname.replace('www.', '')}
                                    </span>
                                    <ExternalLink className="w-3 h-3 text-muted-foreground group-hover:text-amber-500" />
                                  </div>
                                </a>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  )}
                </div>
              </div>
            )}

            {/* People Also Ask (PAA) section */}
            <div className="bg-white dark:bg-[#131926] rounded-xl border border-[#e5e7eb] dark:border-[#1d2435] p-5 shadow-sm">
              <h3 className="font-bold text-lg mb-4 text-foreground border-b border-muted/50 pb-2">
                People Also Ask
              </h3>
              <div className="divide-y divide-[#e5e7eb] dark:divide-[#1d2435]">
                {getPAAQuestions(queryParam).map((q, i) => (
                  <div key={i} className="py-3">
                    <button
                      onClick={() => {
                        const nextFAQ = expandedFAQ === i ? null : i;
                        setExpandedFAQ(nextFAQ);
                        if (nextFAQ !== null) {
                          fetchPAAAnswer(i, q);
                        }
                      }}
                      className="w-full flex items-center justify-between text-left font-medium text-sm text-foreground hover:text-amber-500 transition-colors py-1"
                    >
                      <span>{q}</span>
                      {expandedFAQ === i ? (
                        <ChevronUp className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      )}
                    </button>

                    {expandedFAQ === i && (
                      <div className="mt-2.5 pl-2 text-xs leading-relaxed text-muted-foreground border-l-2 border-amber-500/50 bg-[#fafafa] dark:bg-[#161d2d] p-3 rounded-r-md transition-all duration-300">
                        {paaLoading[i] ? (
                          <div className="flex items-center gap-2">
                            <Loader2 className="w-3.5 h-3.5 text-amber-500 animate-spin" />
                            <span>Formulating answer...</span>
                          </div>
                        ) : (
                          <p>{paaAnswers[i]}</p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Organic Results List */}
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-base text-muted-foreground tracking-wide uppercase">
                  Web Search Results
                </h3>
                {provider && (
                  <span className="text-[10px] bg-muted px-2 py-0.5 rounded-full font-mono">
                    Provider: {provider}
                  </span>
                )}
              </div>

              {results.length === 0 ? (
                <div className="text-center py-10 bg-white dark:bg-[#131926] rounded-xl border border-muted/50">
                  <p className="text-sm text-muted-foreground">No search results found.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {results.map((item, idx) => (
                    <article 
                      key={idx} 
                      className="bg-white dark:bg-[#131926] p-5 rounded-xl border border-[#e5e7eb] dark:border-[#1d2435] hover:shadow-md transition-all group"
                    >
                      {/* Breadcrumbs */}
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1.5 truncate">
                        <img 
                          src={`https://www.google.com/s2/favicons?domain=${new URL(item.url).hostname}&sz=16`} 
                          alt="" 
                          className="w-3.5 h-3.5 rounded-sm bg-slate-100"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                        <span className="font-medium text-foreground truncate max-w-[150px]">
                          {item.source}
                        </span>
                        <span>&rsaquo;</span>
                        <span className="truncate max-w-[250px]">{item.url}</span>
                      </div>

                      {/* Header link */}
                      <h4 className="mb-2">
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#1a0dab] dark:text-[#8ab4f8] hover:underline text-xl font-medium line-clamp-1 leading-snug tracking-tight transition-colors"
                        >
                          {item.title}
                        </a>
                      </h4>

                      {/* Snippet */}
                      <p className="text-sm text-[#4d5156] dark:text-[#bdc1c6] line-clamp-3 leading-relaxed mb-3">
                        {item.snippet}
                      </p>

                      {/* Footer date/source */}
                      <div className="text-[11px] text-muted-foreground font-medium flex items-center gap-3">
                        <span>{item.date}</span>
                        <span>•</span>
                        <span className="bg-amber-500/10 text-amber-600 dark:text-amber-500 px-2 py-0.5 rounded">
                          {item.source}
                        </span>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>

            {/* Pagination See More */}
            {hasMore && (
              <div className="flex justify-center pt-4">
                <Button
                  onClick={() => handleSearch(queryParam, false)}
                  disabled={loadingMore}
                  className="px-6 py-5 bg-white dark:bg-[#131926] text-amber-500 border border-amber-500/40 hover:bg-amber-500/5 font-semibold text-sm rounded-full transition-all flex items-center gap-2"
                >
                  {loadingMore ? (
                    <>Loading <Loader2 className="w-4 h-4 animate-spin" /></>
                  ) : (
                    <>See More <ArrowRight className="w-4 h-4" /></>
                  )}
                </Button>
              </div>
            )}

          </div>
        )}

        {/* Initial Search state (Empty search box banner) */}
        {!queryParam.trim() && (
          <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center mb-2 border border-amber-500/20">
              <Sparkles className="w-8 h-8 text-amber-500 animate-pulse" />
            </div>
            <h2 className="text-xl font-bold text-foreground">Discover the Web with RealSSA AI</h2>
            <p className="text-sm text-muted-foreground max-w-md leading-relaxed">
              Query the 5-database cluster or explore the live web using Tavily AI Search. Enter a query or paste a URL above to start.
            </p>
          </div>
        )}

      </main>

    </div>
  );
}
