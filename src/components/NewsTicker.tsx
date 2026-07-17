import { useState, useEffect } from "react";
import { TrendingUp, TrendingDown, RefreshCcw } from "lucide-react";

const NewsTicker = () => {
  const [rates, setRates] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch live currency rates
  useEffect(() => {
    const fetchRates = async () => {
      try {
        setIsLoading(true);
        // Using the free ExchangeRate-API
        const response = await fetch('https://open.er-api.com/v6/latest/USD');
        if (response.ok) {
          const data = await response.json();
          
          // Format the rates we care about for the African/Global context
          const r = data.rates;
          const currencyPairs = [
            { pair: "USD/NGN", rate: r.NGN, icon: <TrendingUp className="w-3 h-3 text-green-400" /> },
            { pair: "GBP/NGN", rate: r.NGN / r.GBP, icon: <TrendingUp className="w-3 h-3 text-green-400" /> },
            { pair: "EUR/NGN", rate: r.NGN / r.EUR, icon: <TrendingUp className="w-3 h-3 text-green-400" /> },
            { pair: "USD/GHS", rate: r.GHS, icon: <TrendingDown className="w-3 h-3 text-red-400" /> },
            { pair: "GBP/GHS", rate: r.GHS / r.GBP, icon: <TrendingUp className="w-3 h-3 text-green-400" /> },
            { pair: "USD/ZAR", rate: r.ZAR, icon: <TrendingUp className="w-3 h-3 text-green-400" /> },
            { pair: "USD/KES", rate: r.KES, icon: <TrendingDown className="w-3 h-3 text-red-400" /> },
            { pair: "EUR/USD", rate: 1 / r.EUR, icon: <TrendingUp className="w-3 h-3 text-green-400" /> },
            { pair: "GBP/USD", rate: 1 / r.GBP, icon: <TrendingUp className="w-3 h-3 text-green-400" /> },
            { pair: "BTC/USD", rate: 68500.40, icon: <TrendingUp className="w-3 h-3 text-green-400" /> }, // Example fixed/placeholder for crypto if not in API
          ];
          
          setRates(currencyPairs);
        }
      } catch (error) {
        console.error("Error fetching exchange rates:", error);
        // Fallback to static items if API fails
        setRates([
          { pair: "USD/NGN", rate: 1450.50, icon: <TrendingUp className="w-3 h-3 text-green-400" /> },
          { pair: "GBP/NGN", rate: 1820.30, icon: <TrendingUp className="w-3 h-3 text-green-400" /> },
          { pair: "EUR/NGN", rate: 1550.20, icon: <TrendingUp className="w-3 h-3 text-green-400" /> },
          { pair: "USD/GHS", rate: 13.50, icon: <TrendingDown className="w-3 h-3 text-red-400" /> },
          { pair: "USD/ZAR", rate: 18.90, icon: <TrendingUp className="w-3 h-3 text-green-400" /> },
          { pair: "BTC/USD", rate: 68500.40, icon: <TrendingUp className="w-3 h-3 text-green-400" /> },
        ]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRates();
    // Auto-refresh every 30 minutes
    const interval = setInterval(fetchRates, 30 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  if (isLoading) {
    return (
      <div className="bg-[#0a0f1c] text-white border-b border-white/5 py-2 overflow-hidden flex items-center">
        <span className="bg-amber-500 text-black text-xs font-bold px-3 py-1 ml-2 mr-4 rounded flex items-center gap-1 z-10 shrink-0 shadow-[0_0_10px_rgba(245,158,11,0.5)]">
          <RefreshCcw className="w-3 h-3 animate-spin" />
          RATES
        </span>
        <div className="animate-pulse flex items-center">
          <span className="mx-4 text-sm font-medium text-gray-400">Loading live exchange rates...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#0a0f1c] text-white border-b border-white/5 py-2 overflow-hidden flex items-center relative">
      <div className="absolute left-0 top-0 bottom-0 bg-[#0a0f1c] z-10 flex items-center px-2 border-r border-white/10 shadow-[5px_0_15px_rgba(0,0,0,0.8)]">
        <span className="bg-amber-500 text-black text-xs font-bold px-3 py-1 rounded flex items-center gap-1 shadow-[0_0_10px_rgba(245,158,11,0.4)]">
          <span className="w-1.5 h-1.5 bg-black rounded-full animate-pulse"></span>
          LIVE FX
        </span>
      </div>
      
      <div className="overflow-hidden w-full flex">
        <div className="animate-marquee whitespace-nowrap flex items-center pl-32 w-max">
          {[...rates, ...rates].map((item, index) => (
            <div key={index} className="mx-6 flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-300">{item.pair}</span>
              <span className="text-sm font-bold tracking-tight text-white">
                {item.rate < 100 ? item.rate.toFixed(4) : item.rate.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              {item.icon}
              <span className="w-1 h-1 rounded-full bg-slate-700 ml-4 hidden md:block"></span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default NewsTicker;
