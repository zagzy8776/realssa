import { useEffect, useState } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { CalendarRange, MapPin, Clock, Newspaper, Ticket, Search, Calendar, ChevronRight } from "lucide-react";
import { toast } from "sonner";

interface Event {
  id: number;
  title: string;
  description: string;
  category: string;
  event_date: string;
  location: string;
  ticket_link: string;
  linked_articles_count: number;
}

interface Article {
  id: string;
  title: string;
  excerpt: string;
  image: string;
  date: string;
  author: string;
  category: string;
  contentType: string;
  source: string;
}

const FALLBACK_EVENTS: Event[] = [
  {
    id: 991,
    title: 'CAF Champions League: Enyimba vs Al Ahly',
    description: 'Enyimba FC hosts Al Ahly of Egypt in the first leg of the CAF Champions League group stage fixture at the Aba International Stadium.',
    category: 'Sports',
    event_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
    location: 'Enyimba International Stadium, Aba, Abia State',
    ticket_link: 'https://enyimbanews.com/tickets',
    linked_articles_count: 3
  },
  {
    id: 992,
    title: 'Lagos Tech Fest 2026',
    description: 'The largest annual gathering of tech founders, investors, and developers in West Africa. Highlighting fintech, artificial intelligence, and decentralised infrastructure.',
    category: 'Culture',
    event_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days
    location: 'Landmark Event Centre, Victoria Island, Lagos',
    ticket_link: 'https://lagostechfest.com/register',
    linked_articles_count: 2
  },
  {
    id: 993,
    title: 'Nigerian National Tax Reform Summit',
    description: 'President Bola Tinubu hosts state governors, economic council ministers, and tax policy leaders to review the unified tax reform bills.',
    category: 'National',
    event_date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days
    location: 'Aso Villa Conference Hall, Abuja',
    ticket_link: 'https://statehouse.gov.ng/tax-summit',
    linked_articles_count: 5
  },
  {
    id: 994,
    title: 'Lagos Fashion Week 2026',
    description: 'Celebrating contemporary African fashion, bringing together designers, stylists, and buyers from across the continent.',
    category: 'Culture',
    event_date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // Yesterday
    location: 'Federal Palace Hotel, Victoria Island, Lagos',
    ticket_link: 'https://lagosfashionweek.ng',
    linked_articles_count: 1
  }
];

export default function EventsCalendar() {
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [linkedArticles, setLinkedArticles] = useState<Article[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [loadingArticles, setLoadingArticles] = useState(false);
  
  // Filtering & Search
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");

  const fetchEvents = async () => {
    try {
      setLoadingEvents(true);
      const host = window.location.hostname === "localhost" ? "http://localhost:5000" : "";
      const res = await fetch(`${host}/api/events`);
      
      if (!res.ok) throw new Error("Database offline");
      const data = await res.json();
      
      if (Array.isArray(data) && data.length > 0) {
        setEvents(data);
        setSelectedEventId(data[0].id);
      } else {
        // Use fallback seeded array
        setEvents(FALLBACK_EVENTS);
        setSelectedEventId(FALLBACK_EVENTS[0].id);
      }
    } catch (err: any) {
      console.warn("Using offline fallback events:", err.message);
      setEvents(FALLBACK_EVENTS);
      setSelectedEventId(FALLBACK_EVENTS[0].id);
    } finally {
      setLoadingEvents(false);
    }
  };

  const fetchEventArticles = async (eventId: number) => {
    try {
      setLoadingArticles(true);
      const host = window.location.hostname === "localhost" ? "http://localhost:5000" : "";
      const res = await fetch(`${host}/api/events/${eventId}/articles`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setLinkedArticles(data);
    } catch {
      // Fallback dummy articles for offline demo
      setLinkedArticles([
        {
          id: 'rss-dummy-1',
          title: `Special report on event: ${events.find(e => e.id === eventId)?.title}`,
          excerpt: 'Analysis and review of the key stakeholders, national implications, and public reactions.',
          image: 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&q=80&w=600',
          date: new Date().toISOString(),
          author: 'RealSSA News Wire',
          category: 'national',
          contentType: 'article',
          source: 'rss'
        }
      ]);
    } finally {
      setLoadingArticles(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  useEffect(() => {
    if (selectedEventId !== null) {
      fetchEventArticles(selectedEventId);
    } else {
      setLinkedArticles([]);
    }
  }, [selectedEventId]);

  const activeEvent = events.find(e => e.id === selectedEventId);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-NG", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric"
    });
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString("en-NG", {
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  // Calculates the countdown tag dynamically
  const getEventBadge = (dateStr: string) => {
    const eventTime = new Date(dateStr).getTime();
    const now = Date.now();
    const diffTime = eventTime - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffTime < 0) {
      if (Math.abs(diffTime) < 8 * 60 * 60 * 1000) {
        return (
          <Badge className="bg-red-500 hover:bg-red-600 text-white animate-pulse">
            🔴 Live Now
          </Badge>
        );
      }
      return <Badge variant="secondary" className="text-muted-foreground">✓ Past Event</Badge>;
    }

    if (diffDays === 0 || (diffTime > 0 && diffTime < 18 * 60 * 60 * 1000)) {
      return (
        <Badge className="bg-orange-500 hover:bg-orange-600 text-white animate-pulse">
          ⚡ Happening Today
        </Badge>
      );
    }

    if (diffDays === 1) {
      return <Badge className="bg-blue-600 hover:bg-blue-700 text-white">🕒 Tomorrow</Badge>;
    }

    return (
      <Badge variant="outline" className="border-primary/40 text-primary font-bold">
        🕒 Starts in {diffDays} days
      </Badge>
    );
  };

  const filteredEvents = events.filter((ev) => {
    const matchesSearch = ev.title.toLowerCase().includes(search.toLowerCase()) || 
                          ev.description.toLowerCase().includes(search.toLowerCase()) ||
                          ev.location.toLowerCase().includes(search.toLowerCase());
    
    // Normalize category mapping
    let cat = ev.category.toLowerCase();
    if (cat.includes('match') || cat.includes('sport')) cat = 'sports';
    else if (cat.includes('reform') || cat.includes('national') || cat.includes('court') || cat.includes('election')) cat = 'national';
    else cat = 'culture';

    const matchesCategory = activeCategory === "all" || cat === activeCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6 md:py-10 space-y-8">
        {/* Banner Cover with vibrant fuchsia-violet gradient */}
        <div className="rounded-3xl bg-gradient-to-r from-violet-950 via-slate-900 to-fuchsia-950 text-white p-6 md:p-10 shadow-xl border border-white/10 relative overflow-hidden">
          <div className="absolute -right-10 -bottom-10 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />
          <div className="space-y-3 relative z-10">
            <Badge variant="secondary" className="bg-white/20 text-white hover:bg-white/30 backdrop-blur">
              Hyperlocal Live Timeline
            </Badge>
            <h1 className="text-3xl md:text-5xl font-black tracking-tight flex items-center gap-2">
              <CalendarRange className="h-8 w-8 md:h-12 md:w-12 text-fuchsia-400" /> Events Calendar
            </h1>
            <p className="text-slate-200 text-sm md:text-base max-w-2xl">
              Track national summits, court timelines, sports fixtures, and cultural festivals. Automatically linked with the latest covering press releases and articles.
            </p>
          </div>
        </div>

        {/* Filters and Search Bar */}
        <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-muted/20 p-4 rounded-2xl border">
          <div className="relative w-full md:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search events by title, summary, or venue..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-background border-border/80"
            />
          </div>
          <div className="flex gap-1.5 overflow-x-auto w-full md:w-auto scrollbar-none py-1">
            {[
              { id: "all", label: "All Events" },
              { id: "national", label: "National & Governance" },
              { id: "sports", label: "Sports Events" },
              { id: "culture", label: "Culture & Tech" }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveCategory(tab.id)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition border whitespace-nowrap ${
                  activeCategory === tab.id
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-muted-foreground hover:text-foreground border-border"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {loadingEvents ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <Skeleton className="h-80 rounded-2xl" />
            <Skeleton className="h-80 lg:col-span-2 rounded-2xl" />
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="text-center py-16 space-y-3 bg-muted/10 rounded-3xl border-2 border-dashed border-border/60">
            <Calendar className="h-10 w-10 text-muted-foreground/60 mx-auto" />
            <p className="text-muted-foreground italic font-semibold">No scheduled events match your current search/filters.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Timeline Left: Card-based event selector */}
            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2 scrollbar-thin">
              <h2 className="text-lg font-black tracking-tight flex items-center gap-1.5 text-foreground">
                📅 Scheduled Timeline ({filteredEvents.length})
              </h2>
              <div className="space-y-3">
                {filteredEvents.map((ev) => (
                  <button
                    key={ev.id}
                    onClick={() => setSelectedEventId(ev.id)}
                    className={`w-full text-left p-4 rounded-2xl border transition duration-300 group relative overflow-hidden ${
                      selectedEventId === ev.id
                        ? "bg-primary/5 border-primary/50 shadow-sm"
                        : "bg-card border-border/60 hover:border-border hover:bg-muted/10"
                    }`}
                  >
                    <div className="space-y-2.5">
                      <div className="flex justify-between items-center gap-2">
                        <Badge variant="outline" className="text-[9px] uppercase font-black px-2 py-0.5 tracking-wider bg-background/55">
                          {ev.category}
                        </Badge>
                        {getEventBadge(ev.event_date)}
                      </div>
                      <h3 className="font-extrabold text-sm text-foreground leading-snug group-hover:text-primary transition line-clamp-2">
                        {ev.title}
                      </h3>
                      
                      <div className="flex justify-between items-center text-[10px] text-muted-foreground font-semibold pt-1 border-t border-border/20">
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3 text-primary/70" /> {ev.location.split(',')[0]}
                        </span>
                        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-1 transition" />
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Event Details Right: Premium Showcase Card */}
            <div className="lg:col-span-2 space-y-6">
              {activeEvent ? (
                <Card className="border border-border/60 shadow-sm overflow-hidden rounded-2xl bg-card">
                  {/* Decorative Banner Header */}
                  <div className="h-3 bg-gradient-to-r from-violet-600 via-primary to-fuchsia-600" />
                  
                  <CardHeader className="p-6 md:p-8 border-b">
                    <div className="space-y-4">
                      <div className="flex flex-wrap justify-between items-center gap-4">
                        <Badge className="bg-primary/10 text-primary border border-primary/20 text-xs font-black uppercase tracking-wider px-3 py-1">
                          {activeEvent.category}
                        </Badge>
                        {activeEvent.ticket_link && (
                          <a
                            href={activeEvent.ticket_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black bg-primary text-primary-foreground hover:bg-primary/95 transition shadow-sm"
                          >
                            <Ticket className="h-3.5 w-3.5" /> Details & Tickets
                          </a>
                        )}
                      </div>
                      <CardTitle className="text-xl md:text-3xl font-black tracking-tight leading-tight">
                        {activeEvent.title}
                      </CardTitle>
                      
                      <div className="flex flex-wrap gap-4 text-xs font-bold text-muted-foreground pt-1">
                        <div className="flex items-center gap-1.5 bg-muted/60 px-3 py-1.5 rounded-xl border border-border/40">
                          <Clock className="h-4 w-4 text-primary" />
                          <span>{formatDate(activeEvent.event_date)} at {formatTime(activeEvent.event_date)}</span>
                        </div>
                        <div className="flex items-center gap-1.5 bg-muted/60 px-3 py-1.5 rounded-xl border border-border/40">
                          <MapPin className="h-4 w-4 text-primary" />
                          <span>{activeEvent.location}</span>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-6 md:p-8 space-y-8">
                    <div className="space-y-3">
                      <h4 className="text-xs font-black uppercase text-muted-foreground tracking-widest">Event Narrative</h4>
                      <p className="text-sm md:text-base text-foreground/90 leading-relaxed font-medium">
                        {activeEvent.description}
                      </p>
                    </div>

                    {/* Linked Articles Section */}
                    <div className="space-y-5 border-t border-border/60 pt-6">
                      <div className="flex justify-between items-center">
                        <h4 className="text-sm font-black text-foreground flex items-center gap-1.5">
                          <Newspaper className="h-4.5 w-4.5 text-primary" /> Dynamic Coverage News Wire
                        </h4>
                        <Badge variant="outline" className="text-xs font-bold text-primary bg-primary/5">
                          {linkedArticles.length} coverage updates
                        </Badge>
                      </div>

                      {loadingArticles ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <Skeleton className="h-44 rounded-2xl" />
                          <Skeleton className="h-44 rounded-2xl" />
                        </div>
                      ) : linkedArticles.length === 0 ? (
                        <div className="bg-muted/10 p-6 rounded-2xl border border-dashed text-center">
                          <p className="text-xs text-muted-foreground italic font-medium">
                            No related press releases or articles have been auto-linked to this event yet.
                          </p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {linkedArticles.map((art) => (
                            <Link to={`/news?id=${art.id}`} key={art.id} className="group">
                              <div className="border border-border/50 hover:border-primary/40 rounded-2xl overflow-hidden hover:shadow-md transition duration-300 bg-card h-full flex flex-col">
                                {art.image && (
                                  <div className="h-32 w-full overflow-hidden relative">
                                    <img
                                      src={art.image}
                                      alt={art.title}
                                      className="h-full w-full object-cover group-hover:scale-105 transition duration-300"
                                      onError={e => { (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&q=80&w=600'; }}
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                                  </div>
                                )}
                                <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                                  <h5 className="font-extrabold text-xs text-foreground line-clamp-2 group-hover:text-primary transition leading-snug">
                                    {art.title}
                                  </h5>
                                  <div className="flex justify-between items-center text-[9px] text-muted-foreground font-black uppercase tracking-wider pt-2 border-t border-border/10">
                                    <span>{art.author}</span>
                                    <span>{new Date(art.date).toLocaleDateString()}</span>
                                  </div>
                                </div>
                              </div>
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="text-center py-16 bg-muted/10 rounded-2xl border border-dashed">
                  <p className="text-muted-foreground italic font-semibold">Select an event from the timeline to view details.</p>
                </div>
              )}
            </div>

          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
