import { useState, useEffect } from 'react';
import { Award } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

export default function PointsBadgeHeader() {
  const [points, setPoints] = useState<number | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    let id = localStorage.getItem('realssa_device_uuid');
    if (!id) {
      id = 'dev-' + Math.random().toString(36).substring(2, 11);
      localStorage.setItem('realssa_device_uuid', id);
    }

    axios
      .get(`/api/points/balance?deviceId=${id}`)
      .then(res => {
        if (res.data && typeof res.data.total_points === 'number') {
          setPoints(res.data.total_points);
        }
      })
      .catch(() => setPoints(0));
  }, []);

  return (
    <button
      type="button"
      onClick={() => navigate('/profile')}
      className="flex items-center gap-1 px-2 py-0.5 md:px-2.5 md:py-1 rounded-full bg-primary/10 hover:bg-primary/20 border border-primary/20 text-primary text-[11px] md:text-xs font-bold transition-all active:scale-95 shrink-0"
      title="View RealSSA Points & Referral Link"
    >
      <Award className="w-3 h-3 md:w-3.5 md:h-3.5" />
      <span>{points !== null ? points.toLocaleString() : '0'} RP</span>
    </button>
  );
}
