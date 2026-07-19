import { useEffect, useState } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, UserCheck, Shield, MapPin, Landmark } from "lucide-react";
import { toast } from "sonner";

interface Politician {
  name: string;
  role: string;
  state: string;
  constituency: string;
  party: string;
  profile_image: string;
  created_at: string;
}

export default function PoliticianHub() {
  const [politicians, setPoliticians] = useState<Politician[]>([]);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  const fetchPoliticians = async () => {
    try {
      setLoading(true);
      const host = window.location.hostname === "localhost" ? "http://localhost:5000" : "";
      const res = await fetch(`${host}/api/politicians`);
      
      if (!res.ok) {
        throw new Error("Failed to load politicians directory");
      }
      
      const data = await res.json();
      setPoliticians(data);
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to load politicians board");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPoliticians();
  }, []);

  const filteredPoliticians = politicians.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) || 
                          p.state.toLowerCase().includes(search.toLowerCase()) ||
                          p.party.toLowerCase().includes(search.toLowerCase());
    
    const matchesRole = roleFilter === "all" || p.role.toLowerCase() === roleFilter.toLowerCase();
    
    return matchesSearch && matchesRole;
  });

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6 md:py-10 space-y-8">
        {/* Banner Cover */}
        <div className="rounded-3xl bg-gradient-to-r from-teal-950 via-slate-900 to-indigo-950 text-white p-6 md:p-10 shadow-xl border border-white/10 relative overflow-hidden">
          <div className="absolute -right-10 -bottom-10 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />
          <div className="space-y-3 relative z-10">
            <Badge variant="secondary" className="bg-white/20 text-white hover:bg-white/30 backdrop-blur">
              Democratic Governance Portal
            </Badge>
            <h1 className="text-3xl md:text-5xl font-black tracking-tight flex items-center gap-2">
              <Shield className="h-8 w-8 md:h-12 md:w-12 text-teal-400" /> Politician Database
            </h1>
            <p className="text-slate-200 text-sm md:text-base max-w-2xl">
              Track profiles, portfolios, state representations, public assets summaries, and legislative voting metrics for Nigeria's governing leaders.
            </p>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-muted/30 p-4 rounded-2xl border">
          <div className="relative w-full md:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search by name, state, or party..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-background border-border/80"
            />
          </div>
          <div className="flex gap-2 w-full md:w-auto">
            {["All", "President", "Vice President", "Senate President", "Governor"].map((role) => (
              <button
                key={role}
                onClick={() => setRoleFilter(role.toLowerCase())}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition border ${
                  roleFilter === role.toLowerCase()
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-muted-foreground hover:text-foreground border-border"
                }`}
              >
                {role}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((n) => (
              <Skeleton key={n} className="h-64 rounded-2xl" />
            ))}
          </div>
        ) : filteredPoliticians.length === 0 ? (
          <div className="text-center py-12 space-y-3">
            <p className="text-muted-foreground italic">No politicians match your current filters.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPoliticians.map((p) => (
              <Link to={`/entity/${encodeURIComponent(p.name)}`} key={p.name}>
                <Card className="border border-border/60 hover:border-primary/50 shadow-sm hover:shadow-md hover:-translate-y-1 transition duration-300 overflow-hidden h-full flex flex-col">
                  <div className="h-40 bg-gradient-to-br from-indigo-950/20 via-background to-teal-950/10 flex items-center justify-center p-6 border-b">
                    <div className="relative">
                      <img
                        src={p.profile_image}
                        alt={p.name}
                        className="w-24 h-24 rounded-full object-cover border-4 border-background shadow-md"
                      />
                      <Badge className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-teal-600 hover:bg-teal-700">
                        {p.party}
                      </Badge>
                    </div>
                  </div>
                  
                  <CardHeader className="p-5 pb-2 text-center">
                    <CardTitle className="text-lg font-black tracking-tight">{p.name}</CardTitle>
                    <CardDescription className="text-xs text-muted-foreground font-semibold flex items-center justify-center gap-1">
                      <Landmark className="h-3 w-3" /> {p.role}
                    </CardDescription>
                  </CardHeader>
                  
                  <CardContent className="p-5 pt-0 space-y-4 text-center flex-1 flex flex-col justify-between">
                    <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5" />
                      <span>{p.state} State</span>
                      {p.constituency && (
                        <>
                          <span className="text-border">•</span>
                          <span className="truncate max-w-[120px]">{p.constituency}</span>
                        </>
                      )}
                    </div>
                    
                    <div className="border-t pt-4 mt-auto">
                      <span className="text-xs font-bold text-primary inline-flex items-center gap-1 justify-center">
                        <UserCheck className="h-4 w-4" /> View Ledger Profile →
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
