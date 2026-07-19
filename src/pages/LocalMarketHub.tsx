import { useEffect, useState } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Landmark, TrendingUp, TrendingDown, ArrowRightLeft, DollarSign, Activity } from "lucide-react";
import { toast } from "sonner";

interface ExchangeRate {
  currency: string;
  buy_rate: string;
  sell_rate: string;
  source: string;
  created_at: string;
}

interface CommodityPrice {
  item_name: string;
  price: string;
  location: string;
  unit: string;
  created_at: string;
}

interface StockQuote {
  symbol: string;
  company_name: string;
  price: string;
  price_change: string;
  percent_change: string;
  volume: string;
  trading_date: string;
}

export default function LocalMarketHub() {
  const [rates, setRates] = useState<ExchangeRate[]>([]);
  const [prices, setPrices] = useState<CommodityPrice[]>([]);
  const [stocks, setStocks] = useState<StockQuote[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      setLoading(true);
      const host = window.location.hostname === "localhost" ? "http://localhost:5000" : "";
      
      const [ratesRes, pricesRes, stocksRes] = await Promise.all([
        fetch(`${host}/api/rates`),
        fetch(`${host}/api/prices`),
        fetch(`${host}/api/stocks`)
      ]);

      if (!ratesRes.ok || !pricesRes.ok || !stocksRes.ok) {
        throw new Error("Failed to load market feeds");
      }

      const [ratesData, pricesData, stocksData] = await Promise.all([
        ratesRes.json(),
        pricesRes.json(),
        stocksRes.json()
      ]);

      setRates(ratesData);
      setPrices(pricesData);
      setStocks(stocksData);
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to load local market index");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const getCurrencyName = (code: string) => {
    switch (code) {
      case "USD": return "US Dollar (Street Parallel)";
      case "GBP": return "British Pound Sterling";
      case "EUR": return "Euro Zone Common Currency";
      default: return code;
    }
  };

  const getCurrencyFlag = (code: string) => {
    switch (code) {
      case "USD": return "🇺🇸";
      case "GBP": return "🇬🇧";
      case "EUR": return "🇪🇺";
      default: return "🏳️";
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6 md:py-10 space-y-8">
        {/* --- Cover Title Banner --- */}
        <div className="rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 md:p-10 shadow-xl border border-white/10 relative overflow-hidden">
          <div className="absolute -right-10 -bottom-10 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />
          <div className="space-y-3 relative z-10">
            <Badge variant="secondary" className="bg-white/20 text-white hover:bg-white/30 backdrop-blur">
              Daily Utilities & Pricing Index
            </Badge>
            <h1 className="text-3xl md:text-5xl font-black tracking-tight">African Market Hub</h1>
            <p className="text-indigo-200 text-sm md:text-base max-w-2xl">
              Live street exchange index, retail commodity pricing tracker, and closing summaries for the Nigerian Exchange Group (NGX).
            </p>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Skeleton className="h-48 col-span-3 rounded-2xl" />
            <Skeleton className="h-64 col-span-2 rounded-2xl" />
            <Skeleton className="h-64 rounded-2xl" />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left/Middle Columns: Parallel rates & Commodities */}
            <div className="lg:col-span-2 space-y-8">
              
              {/* Currency Parallel Rates */}
              <section className="space-y-4">
                <h2 className="text-2xl font-black tracking-tight flex items-center gap-2">
                  <ArrowRightLeft className="h-6 w-6 text-primary" /> Street Parallel Rates (NGN)
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {rates.map((rate) => (
                    <Card key={rate.currency} className="border border-border/60 shadow-sm hover:shadow-md transition">
                      <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-xl font-bold flex items-center gap-2">
                          <span className="text-2xl">{getCurrencyFlag(rate.currency)}</span>
                          {rate.currency}
                        </CardTitle>
                        <Badge variant="outline" className="text-xs uppercase font-medium bg-muted/50">
                          Parallel
                        </Badge>
                      </CardHeader>
                      <CardContent className="p-4 pt-2 space-y-4">
                        <p className="text-xs text-muted-foreground line-clamp-1">{getCurrencyName(rate.currency)}</p>
                        <div className="grid grid-cols-2 gap-2 border-t pt-3 border-border/80">
                          <div>
                            <span className="text-[10px] text-muted-foreground uppercase font-bold block">We Buy</span>
                            <span className="text-lg font-black text-foreground">₦{Math.round(parseFloat(rate.buy_rate))}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-muted-foreground uppercase font-bold block">We Sell</span>
                            <span className="text-lg font-black text-primary">₦{Math.round(parseFloat(rate.sell_rate))}</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>

              {/* Commodities Tracker */}
              <section className="space-y-4">
                <h2 className="text-2xl font-black tracking-tight flex items-center gap-2">
                  <DollarSign className="h-6 w-6 text-primary" /> Commodity Retail Tracker
                </h2>
                <Card className="border border-border/60 shadow-sm overflow-hidden">
                  <Table>
                    <TableHeader className="bg-muted/40">
                      <TableRow>
                        <TableHead>Item Name</TableHead>
                        <TableHead>Price</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>Unit</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {prices.map((price) => (
                        <TableRow key={price.item_name} className="hover:bg-muted/20">
                          <TableCell className="font-semibold text-foreground">{price.item_name}</TableCell>
                          <TableCell className="font-black text-primary">₦{parseFloat(price.price).toLocaleString()}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">{price.location}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {price.unit}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Card>
              </section>

            </div>

            {/* Right Column: NGX Stocks */}
            <div className="space-y-6">
              <section className="space-y-4">
                <h2 className="text-2xl font-black tracking-tight flex items-center gap-2">
                  <Activity className="h-6 w-6 text-primary" /> NGX Stock Board
                </h2>
                <Card className="border border-border/60 shadow-sm bg-muted/20">
                  <CardHeader className="p-4 border-b">
                    <CardTitle className="text-lg font-black">Daily Closes</CardTitle>
                    <CardDescription className="text-xs">Nigerian Exchange Group (NGX)</CardDescription>
                  </CardHeader>
                  <CardContent className="p-4 space-y-4">
                    {stocks.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">No stock closes available.</p>
                    ) : (
                      <div className="space-y-3">
                        {stocks.map((stock) => {
                          const isUp = parseFloat(stock.price_change) >= 0;
                          return (
                            <div
                              key={stock.symbol}
                              className="flex items-center justify-between p-3 rounded-xl bg-background border hover:border-primary/50 transition group hover:shadow-sm"
                            >
                              <div className="text-left space-y-1">
                                <span className="font-black text-sm group-hover:text-primary transition">{stock.symbol}</span>
                                <span className="text-[10px] text-muted-foreground block line-clamp-1 max-w-[150px]">
                                  {stock.company_name}
                                </span>
                              </div>
                              <div className="text-right space-y-1">
                                <div className="font-bold text-sm">₦{parseFloat(stock.price).toLocaleString()}</div>
                                <div className={`text-xs font-semibold flex items-center gap-0.5 justify-end ${isUp ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                  {isUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                                  {isUp ? '+' : ''}{parseFloat(stock.percent_change).toFixed(2)}%
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </section>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
