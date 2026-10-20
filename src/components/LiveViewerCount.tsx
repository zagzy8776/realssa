import React, { useState, useEffect } from 'react';
import { Users, Eye } from 'lucide-react';
import { apiUrl } from '@/lib/api-base';

interface LiveViewerCountProps {
  articleId?: string;
  category?: string;
  className?: string;
}

export default function LiveViewerCount({ articleId, category = 'general', className }: LiveViewerCountProps) {
  const [count, setCount] = useState({ real: 0, synthetic: 0, display: 0 });
  const [deviceId, setDeviceId] = useState<string>('');

  useEffect(() => {
    // Generate/stable device ID
    let id = localStorage.getItem('realssa_device_uuid');
    if (!id) {
      id = 'dev_' + Math.random().toString(36).slice(2, 15) + Date.now().toString(36).slice(2, 10);
      localStorage.setItem('realssa_device_uuid', id);
    }
    setDeviceId(id);
  }, []);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;

    const fetchCount = async () => {
      try {
        const scopeType = articleId ? 'article' : 'category';
        const scopeId = articleId || category;
        const res = await fetch(`${apiUrl('/api/live-viewer-count/')}${scopeType}/${encodeURIComponent(scopeId)}`);
        if (res.ok) {
          const data = await res.json();
          setCount({ real: data.real || 0, synthetic: data.synthetic || 0, display: data.display || 0 });

          // Track this view as a real viewer
          await fetch(`${apiUrl('/api/live-viewer-track')}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ scopeType, scopeId, deviceId }),
          }).catch(() => {});
        }
      } catch (e) {
        // Silent fail — viewer count is non-critical
      }
    };

    fetchCount();
    timer = setInterval(fetchCount, 30000); // refresh every 30s
    return () => { if (timer) clearInterval(timer); };
  }, [articleId, category, deviceId]);

  return (
    <div className={`flex items-center gap-1 text-xs text-muted-foreground ${className || ''}`}>
      <Eye size={12} className="animate-pulse" />
      <span className="font-semibold">{count.display}</span>
      <span className="text-[10px] opacity-70">watching now</span>
    </div>
  );
}
