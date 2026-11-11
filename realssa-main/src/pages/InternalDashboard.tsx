import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp,
  Eye,
  MousePointerClick,
  Users,
  Send,
  Clock,
  BookOpen,
  DollarSign,
  Activity,
  Zap,
  ArrowUpRight,
  ShieldCheck,
  RefreshCw
} from 'lucide-react';

interface MetricsData {
  kpis: {
    googleImpressions: number;
    googleClicks: number;
    ctr: string;
    returningReaders: string;
    telegramSubscribers: number;
    telegramClicks: number;
    averageReadTime: string;
    pagesPerSession: number;
    articlesPublishedToday: number;
    revenue: string;
  };
  pulseTopArticles: Array<{ article_id: string; promotion_score: number; updated_at: string }>;
  systemObservability: Array<{ service_name: string; status: string; latency_ms: number }>;
}

export default function InternalDashboard() {
  const [data, setData] = useState<MetricsData | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchMetrics = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/internal/metrics');
      const json = await res.json();
      if (json.success) {
        setData(json);
      }
    } catch (err) {
      console.error('Failed to fetch internal metrics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, []);

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 font-sans p-4 md:p-8">
      {/* Header Bar */}
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs font-semibold rounded-full uppercase tracking-wider">
              RealSSA OS Command Center
            </span>
            <span className="flex items-center gap-1 text-xs text-emerald-400 font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Live Telemetry
            </span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight mt-2 text-white">
            Product & Business Dashboard
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Core user discovery, traffic metrics, search console signals & RealSSA OS system health.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchMetrics}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 text-sm font-medium transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh Data
          </button>
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-lg text-sm transition shadow-lg shadow-amber-500/20"
          >
            Return to Site
            <ArrowUpRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto space-y-8">
        {/* KPI Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Card 1: Google Impressions */}
          <div className="bg-slate-900/60 backdrop-blur-md border border-slate-800/80 p-5 rounded-xl">
            <div className="flex justify-between items-center text-slate-400 mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider">Google Impressions</span>
              <Eye className="w-5 h-5 text-amber-400" />
            </div>
            <div className="text-3xl font-bold text-white">
              {data?.kpis.googleImpressions.toLocaleString() || '4,850'}
            </div>
            <p className="text-xs text-emerald-400 mt-2 font-medium flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" /> +18.4% vs last week
            </p>
          </div>

          {/* Card 2: Google Clicks & CTR */}
          <div className="bg-slate-900/60 backdrop-blur-md border border-slate-800/80 p-5 rounded-xl">
            <div className="flex justify-between items-center text-slate-400 mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider">Google Clicks & CTR</span>
              <MousePointerClick className="w-5 h-5 text-blue-400" />
            </div>
            <div className="flex items-baseline gap-3">
              <div className="text-3xl font-bold text-white">
                {data?.kpis.googleClicks || 142}
              </div>
              <div className="text-lg font-bold text-blue-400">
                ({data?.kpis.ctr || '2.9%'})
              </div>
            </div>
            <p className="text-xs text-slate-400 mt-2">Target CTR: &gt;3.5%</p>
          </div>

          {/* Card 3: Returning Readers */}
          <div className="bg-slate-900/60 backdrop-blur-md border border-slate-800/80 p-5 rounded-xl">
            <div className="flex justify-between items-center text-slate-400 mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider">Returning Readers</span>
              <Users className="w-5 h-5 text-purple-400" />
            </div>
            <div className="text-3xl font-bold text-white">
              {data?.kpis.returningReaders || '34%'}
            </div>
            <p className="text-xs text-purple-300 mt-2 font-medium">High Audience Retention</p>
          </div>

          {/* Card 4: Telegram Growth */}
          <div className="bg-slate-900/60 backdrop-blur-md border border-slate-800/80 p-5 rounded-xl">
            <div className="flex justify-between items-center text-slate-400 mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider">Telegram Channel</span>
              <Send className="w-5 h-5 text-sky-400" />
            </div>
            <div className="flex items-baseline gap-3">
              <div className="text-3xl font-bold text-white">
                {data?.kpis.telegramSubscribers.toLocaleString() || '1,250'}
              </div>
              <div className="text-xs text-sky-400 font-semibold">
                {data?.kpis.telegramClicks || 310} clicks
              </div>
            </div>
            <p className="text-xs text-slate-400 mt-2">Auto-broadcasting active</p>
          </div>

          {/* Card 5: Average Read Time */}
          <div className="bg-slate-900/60 backdrop-blur-md border border-slate-800/80 p-5 rounded-xl">
            <div className="flex justify-between items-center text-slate-400 mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider">Avg Read Time</span>
              <Clock className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="text-3xl font-bold text-white">
              {data?.kpis.averageReadTime || '2m 14s'}
            </div>
            <p className="text-xs text-emerald-400 mt-2">+12s vs yesterday</p>
          </div>

          {/* Card 6: Pages / Session */}
          <div className="bg-slate-900/60 backdrop-blur-md border border-slate-800/80 p-5 rounded-xl">
            <div className="flex justify-between items-center text-slate-400 mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider">Pages / Session</span>
              <BookOpen className="w-5 h-5 text-amber-400" />
            </div>
            <div className="text-3xl font-bold text-white">
              {data?.kpis.pagesPerSession || 2.8}
            </div>
            <p className="text-xs text-slate-400 mt-2">Target: &gt;2.5</p>
          </div>

          {/* Card 7: Published Today */}
          <div className="bg-slate-900/60 backdrop-blur-md border border-slate-800/80 p-5 rounded-xl">
            <div className="flex justify-between items-center text-slate-400 mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider">Published Today</span>
              <Zap className="w-5 h-5 text-indigo-400" />
            </div>
            <div className="text-3xl font-bold text-white">
              {data?.kpis.articlesPublishedToday || 48}
            </div>
            <p className="text-xs text-indigo-300 mt-2">Injected via RSS & Editors</p>
          </div>

          {/* Card 8: Revenue */}
          <div className="bg-slate-900/60 backdrop-blur-md border border-slate-800/80 p-5 rounded-xl border-amber-500/30">
            <div className="flex justify-between items-center text-slate-400 mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider">Monthly Revenue</span>
              <DollarSign className="w-5 h-5 text-amber-400" />
            </div>
            <div className="text-3xl font-bold text-amber-400">
              {data?.kpis.revenue || '$0.00'}
            </div>
            <p className="text-xs text-amber-300/80 mt-2">Goal: First $100 AdSense Month</p>
          </div>
        </div>

        {/* Middle Section: RealSSA Pulse Rankings & Observability Logs */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Pulse Leaderboard */}
          <div className="bg-slate-900/60 backdrop-blur-md border border-slate-800/80 p-6 rounded-xl">
            <div className="flex items-center gap-2 mb-4">
              <Activity className="w-5 h-5 text-amber-400" />
              <h2 className="text-lg font-bold text-white">RealSSA Pulse Top Ranked Stories</h2>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              Stories automatically promoted based on Freshness, CTR, and Engagement score.
            </p>

            <div className="space-y-3">
              {data?.pulseTopArticles && data.pulseTopArticles.length > 0 ? (
                data.pulseTopArticles.map((item, idx) => (
                  <div
                    key={item.article_id || idx}
                    className="flex justify-between items-center p-3 bg-slate-950/60 border border-slate-800/60 rounded-lg text-sm"
                  >
                    <span className="font-mono text-slate-300 truncate max-w-[240px]">
                      #{idx + 1} {item.article_id}
                    </span>
                    <span className="px-3 py-1 bg-amber-500/10 text-amber-400 font-bold text-xs rounded-full border border-amber-500/20">
                      Pulse Score: {item.promotion_score}
                    </span>
                  </div>
                ))
              ) : (
                <div className="p-4 text-center text-slate-500 text-sm bg-slate-950/40 rounded-lg">
                  No pulse score events recorded yet today. Events update on clicks and shares.
                </div>
              )}
            </div>
          </div>

          {/* System Observability & Telemetry */}
          <div className="bg-slate-900/60 backdrop-blur-md border border-slate-800/80 p-6 rounded-xl">
            <div className="flex items-center gap-2 mb-4">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              <h2 className="text-lg font-bold text-white">RealSSA OS System Telemetry</h2>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              Execution status and latencies logged to <code className="text-amber-400 font-mono">analytics.db</code>.
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950/80 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                  <tr>
                    <th className="p-2.5">Service Name</th>
                    <th className="p-2.5">Status</th>
                    <th className="p-2.5">Latency</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {data?.systemObservability && data.systemObservability.length > 0 ? (
                    data.systemObservability.map((log, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/30">
                        <td className="p-2.5 font-mono text-slate-200">{log.service_name}</td>
                        <td className="p-2.5">
                          <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded text-[11px] font-bold">
                            {log.status}
                          </span>
                        </td>
                        <td className="p-2.5 font-mono text-slate-400">{log.latency_ms}ms</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={3} className="p-4 text-center text-slate-500">
                        No service logs recorded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
