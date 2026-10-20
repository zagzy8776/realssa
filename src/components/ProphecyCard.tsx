import React, { useState, useEffect } from 'react';
import { CrystalBall, Zap, AlertTriangle, Trophy } from 'lucide-react';
import { apiUrl } from '@/lib/api-base';

interface ProphecyCardProps {
  matchId?: string;
  homeTeam?: string;
  awayTeam?: string;
  competition?: string;
  className?: string;
}

export default function ProphecyCard({ matchId, homeTeam, awayTeam, competition, className }: ProphecyCardProps) {
  const [prophecy, setProphecy] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!matchId) return;

    const fetchProphecy = async () => {
      try {
        const res = await fetch(`${apiUrl('/api/prophecy/')}${encodeURIComponent(matchId)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.prophecy) setProphecy(data.prophecy);
        }
      } catch (e) {
        // Silent fail
      }
    };

    fetchProphecy();
  }, [matchId]);

  const generateProphecy = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiUrl('/api/prophecy/generate')}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          match_id: matchId,
          homeTeam: homeTeam || 'Home Team',
          awayTeam: awayTeam || 'Away Team',
          competition: competition || 'Match',
          status: 'live',
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setProphecy(data.prophecy);
      }
    } catch (e) {
      // Silent fail
    } finally {
      setLoading(false);
    }
  };

  if (!prophecy) {
    return (
      <div className={`bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 rounded-xl p-4 ${className || ''}`}>
        <div className="flex items-center gap-3 mb-3">
          <CrystalBall size={20} className="text-amber-500" />
          <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">Prophecy Engine</span>
        </div>
        <button
          onClick={generateProphecy}
          disabled={loading}
          className="w-full py-2 px-4 bg-amber-500 hover:bg-amber-600 text-black font-bold text-sm rounded transition-colors"
        >
          {loading ? 'Generating Prophecy...' : 'Reveal Prophecy'}
        </button>
      </div>
    );
  }

  return (
    <div className={`bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 rounded-xl p-4 ${className || ''}`}>
      <div className="flex items-center gap-3 mb-3">
        <CrystalBall size={20} className="text-amber-500 animate-pulse" />
        <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">Prophecy Engine</span>
      </div>
      <div className="flex items-start gap-2 mb-3">
        <Zap size={16} className="text-orange-500 mt-0.5" />
        <p className="text-sm text-amber-800 font-semibold italic">{prophecy}</p>
      </div>
      <div className="flex items-center justify-between text-[10px] text-amber-600 font-bold uppercase tracking-wider">
        <span>RealSSA AI Prediction</span>
        <span>Absolute Outcome • Not Probability</span>
      </div>
    </div>
  );
}
