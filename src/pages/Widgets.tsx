import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Globe, TrendingUp, TrendingDown, DollarSign } from "lucide-react";

interface Rate {
  currency: string;
  street_buy: string;
  street_sell: string;
}

interface Commodity {
  name: string;
  current_price: string;
  price_change_percent: number;
}

export default function Widgets() {
  const { type } = useParams<{ type: string }>();
  const [rates, setRates] = useState<Rate[]>([]);
  const [commodities, setCommodities] = useState<Commodity[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      setLoading(true);
      const host = window.location.hostname === "localhost" ? "http://localhost:5000" : "";
      
      if (type === "rates") {
        const res = await fetch(`${host}/api/rates`);
        if (!res.ok) throw new Error();
        const data = await res.json();
        setRates(data);
      } else {
        const res = await fetch(`${host}/api/prices`);
        if (!res.ok) throw new Error();
        const data = await res.json();
        setCommodities(data);
      }
    } catch (err) {
      console.warn("Failed to fetch widget data, using mock values");
      if (type === "rates") {
        setRates([
          { currency: "USD", street_buy: "1,640", street_sell: "1,650" },
          { currency: "GBP", street_buy: "2,080", street_sell: "2,100" },
          { currency: "EUR", street_buy: "1,780", street_sell: "1,800" }
        ]);
      } else {
        setCommodities([
          { name: "Cement (Dangote 50kg)", current_price: "8,200", price_change_percent: 1.2 },
          { name: "Premium Petrol (Litre)", current_price: "950", price_change_percent: -0.5 },
          { name: "Rice (Staple Bag)", current_price: "85,000", price_change_percent: 2.1 }
        ]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [type]);

  if (loading) {
    return (
      <div className="p-4 space-y-3 bg-[#0b0813] text-white rounded-2xl border min-h-[280px] flex flex-col justify-center">
        <Skeleton className="h-6 w-1/3 bg-white/10" />
        <Skeleton className="h-12 w-full bg-white/10" />
        <Skeleton className="h-12 w-full bg-white/10" />
      </div>
    );
  }

  return (
    <div className="p-4 bg-[#0b0813] text-white rounded-2xl border border-border/80 min-h-[300px] flex flex-col justify-between max-w-sm mx-auto shadow-xl select-none">
      
      {/* Widget Header */}
      <div className="flex justify-between items-center pb-3 border-b border-white/10">
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <h3 className="font-extrabold text-xs tracking-wider uppercase text-slate-300">
            {type === "rates" ? "Street Exchange Rates" : "Retail Commodities Index"}
          </h3>
        </div>
        <Badge className="bg-amber-500/10 text-amber-500 border border-amber-500/25 text-[9px] font-black uppercase">
          Live NGN
        </Badge>
      </div>

      {/* Widget Content */}
      <div className="py-4 space-y-3 flex-1 flex flex-col justify-center">
        {type === "rates" ? (
          rates.map((r) => (
            <div key={r.currency} className="flex justify-between items-center bg-white/5 p-3 rounded-xl border border-white/5">
              <span className="font-black text-sm flex items-center gap-1">
                <DollarSign className="h-4.5 w-4.5 text-amber-500" /> {r.currency}
              </span>
              <div className="flex gap-4 text-right">
                <div>
                  <span className="text-[8px] font-bold text-muted-foreground block">BUY</span>
                  <span className="text-xs font-black text-emerald-400">₦{r.street_buy}</span>
                </div>
                <div>
                  <span className="text-[8px] font-bold text-muted-foreground block">SELL</span>
                  <span className="text-xs font-black text-red-400">₦{r.street_sell}</span>
                </div>
              </div>
            </div>
          ))
        ) : (
          commodities.map((c) => (
            <div key={c.name} className="flex justify-between items-center bg-white/5 p-3 rounded-xl border border-white/5">
              <span className="font-bold text-xs truncate max-w-[180px] text-slate-200">{c.name}</span>
              <div className="text-right">
                <span className="text-xs font-black block">₦{parseFloat(c.current_price).toLocaleString()}</span>
                <span className={`text-[9px] font-black flex items-center gap-0.5 justify-end ${
                  c.price_change_percent >= 0 ? "text-emerald-400" : "text-red-400"
                }`}>
                  {c.price_change_percent >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {c.price_change_percent >= 0 ? "+" : ""}{c.price_change_percent}%
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Widget Footer & Native Backlink */}
      <div className="pt-3 border-t border-white/10 flex justify-between items-center text-[9px] font-bold text-slate-400">
        <span>Updates hourly</span>
        <a
          href="https://www.realssanews.com.ng"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-0.5 text-amber-500 hover:underline"
        >
          <Globe className="h-3 w-3" /> Powered by RealSSA
        </a>
      </div>

    </div>
  );
}
