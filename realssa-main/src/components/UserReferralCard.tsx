import { useState, useEffect } from 'react';
import { Copy, Check, Users, ShieldCheck, Award } from 'lucide-react';
import axios from 'axios';

export default function UserReferralCard() {
  const [copied, setCopied] = useState(false);
  const [points, setPoints] = useState<number | null>(null);
  const [deviceId, setDeviceId] = useState('');

  useEffect(() => {
    let id = localStorage.getItem('realssa_device_uuid');
    if (!id) {
      id = 'dev-' + Math.random().toString(36).substring(2, 11);
      localStorage.setItem('realssa_device_uuid', id);
    }
    setDeviceId(id);

    // Fetch live ledger balance
    axios
      .get(`/api/points/balance?deviceId=${id}`)
      .then(res => {
        if (res.data && typeof res.data.total_points === 'number') {
          setPoints(res.data.total_points);
        }
      })
      .catch(() => setPoints(0));
  }, []);

  const referralLink = `https://www.realssanews.com.ng/?ref=${deviceId}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="w-full bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4 text-card-foreground">
      
      {/* Header & Balance */}
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-primary/10 text-primary">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold tracking-tight">RealSSA Points (RP)</h3>
            <p className="text-xs text-muted-foreground">Participation & Growth Balance</p>
          </div>
        </div>

        <div className="text-right">
          <span className="text-xl font-extrabold text-primary">
            {points !== null ? points.toLocaleString() : '---'}
          </span>
          <span className="text-xs text-muted-foreground block font-medium">RP Accumulated</span>
        </div>
      </div>

      {/* Referral Link Copy Area */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5" /> Your Personal Referral Link
        </label>
        
        <div className="flex items-center gap-2 bg-muted/50 p-2 rounded-xl border border-border">
          <input
            type="text"
            readOnly
            value={referralLink}
            className="w-full bg-transparent text-xs font-mono px-2 outline-none text-foreground select-all"
          />
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 active:scale-95 transition-all shrink-0"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied' : 'Copy Link'}
          </button>
        </div>
      </div>

      {/* Outcome-Based Rule Note */}
      <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/30 p-3 rounded-xl border border-border/50">
        <ShieldCheck className="w-4 h-4 text-primary shrink-0 mt-0.5" />
        <p>
          Referral bonus (150 RP) is credited automatically after your referred reader completes at least 5 article reads on RealSSA.
        </p>
      </div>

    </div>
  );
}
