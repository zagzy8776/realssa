import { useEffect, useState } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CalendarRange, MapPin, Clock, Newspaper, Ticket, Landmark } from "lucide-react";
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

export default function EventsCalendar() {
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [linkedArticles, setLinkedArticles] = useState<Article[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [loadingArticles, setLoadingArticles] = useState(false);

  const fetchEvents = async () => {
    try {
      setLoadingEvents(true);
      const host = window.location.hostname === "localhost" ? "http://localhost:5000" : "";
      const res = await fetch(`${host}/api/events`);
      
      if (!res.ok) {
        throw new Error("Failed to load events calendar");
      }
      
      const data = await res.json();
      setEvents(data);
      if (data.length > 0) {
        setSelectedEventId(data[0].id);
      }
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to load upcoming events");
    } finally {
      setLoadingEvents(false);
    }
  };

  const fetchEventArticles = async (eventId: number) => {
    try {
      setLoadingArticles(true);
      const host = window.location.hostname === "localhost" ? "http://localhost:5000" : "";
      const res = await fetch(`${host}/api/events/${eventId}/articles`);
      
      if (!res.ok) {
        throw new Error("Failed to load event coverage");
      }
      
      const data = await res.json();
      setLinkedArticles(data);
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to load event coverage articles");
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

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6 md:py-10 space-y-8">
        {/* Banner Cover */}
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

        {loadingEvents ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Skeleton className="h-64 rounded-2xl" />
            <Skeleton className="h-64 col-span-2 rounded-2xl" />
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-12 space-y-3 bg-muted/20 rounded-2xl border border-dashed">
            <p className="text-muted-foreground italic">No upcoming timeline events scheduled.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Timeline Selection List */}
            <div className="space-y-4">
              <h2 className="text-xl font-black tracking-tight flex items-center gap-1.5">
                🗓️ Scheduled Timeline
              </h2>
              <div className="space-y-3">
                {events.map((ev) => (
                  <button
                    key={ev.id}
                    onClick={() => setSelectedEventId(ev.id)}
                    className={`w-full text-left p-4 rounded-2xl border transition duration-300 ${
                      selectedEventId === ev.id
                        ? "bg-primary/5 border-primary/50 shadow-sm"
                        : "bg-card border-border/60 hover:border-border hover:bg-muted/10"
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex justify-between items-center gap-2">
                        <Badge variant="outline" className="text-[10px] uppercase font-bold px-2 py-0.5">
                          {ev.category}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground font-semibold flex items-center gap-1">
                          <Clock className="h-3 w-3" /> {formatDate(ev.event_date)}
                        </span>
                      </div>
                      <h3 className="font-bold text-sm text-foreground line-clamp-2">{ev.title}</h3>
                      {ev.linked_articles_count > 0 && (
                        <div className="text-xs text-primary font-semibold flex items-center gap-1">
                          <Newspaper className="h-3.5 w-3.5" />
                          {ev.linked_articles_count} {ev.linked_articles_count === 1 ? 'Article' : 'Articles'} Linked
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Event Details and Linked Articles Coverage */}
            <div className="lg:col-span-2 space-y-6">
              {activeEvent && (
                <Card className="border border-border/60 shadow-sm">
                  <CardHeader className="p-6 border-b">
                    <div className="space-y-3">
                      <div className="flex justify-between items-start gap-4">
                        <Badge className="bg-primary hover:bg-primary/95 text-xs font-bold uppercase">
                          {activeEvent.category}
                        </Badge>
                        {activeEvent.ticket_link && (
                          <a
                            href={activeEvent.ticket_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-bold text-primary flex items-center gap-1 hover:underline"
                          >
                            <Ticket className="h-4 w-4" /> Official Details/Tickets
                          </a>
                        )}
                      </div>
                      <CardTitle className="text-xl md:text-2xl font-black">{activeEvent.title}</CardTitle>
                      <div className="flex flex-wrap gap-4 text-xs font-semibold text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5 text-primary" />
                          <span>{formatDate(activeEvent.event_date)} at {formatTime(activeEvent.event_date)}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5 text-primary" />
                          <span>{activeEvent.location}</span>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-6 space-y-6">
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold uppercase text-muted-foreground tracking-wide">Event Summary</h4>
                      <p className="text-sm text-foreground/90 leading-relaxed">{activeEvent.description}</p>
                    </div>

                    {/* Linked Articles Section */}
                    <div className="space-y-4 border-t pt-6">
                      <h4 className="text-sm font-black text-foreground flex items-center gap-1.5">
                        <Newspaper className="h-4 w-4 text-primary" /> Press Coverage & updates
                      </h4>

                      {loadingArticles ? (
                        <div className="space-y-3">
                          <Skeleton className="h-20 rounded-xl" />
                          <Skeleton className="h-20 rounded-xl" />
                        </div>
                      ) : linkedArticles.length === 0 ? (
                        <div className="bg-muted/10 p-5 rounded-2xl border border-dashed text-center">
                          <p className="text-xs text-muted-foreground italic">
                            No related press releases or articles have been auto-linked to this event yet.
                          </p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {linkedArticles.map((art) => (
                            <Link to={`/news?id=${art.id}`} key={art.id} className="group">
                              <div className="border border-border/50 hover:border-primary/40 rounded-2xl overflow-hidden hover:shadow-sm transition bg-card h-full flex flex-col">
                                {art.image && (
                                  <img
                                    src={art.image}
                                    alt={art.title}
                                    className="h-32 w-full object-cover group-hover:scale-105 transition duration-300"
                                  />
                                )}
                                <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                                  <h5 className="font-bold text-xs text-foreground line-clamp-2 group-hover:text-primary transition">
                                    {art.title}
                                  </h5>
                                  <div className="flex justify-between items-center text-[10px] text-muted-foreground font-semibold">
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
              )}
            </div>

          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
