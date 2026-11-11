/**
 * KeepAlive — pings the Render backend every 14 minutes
 * so the free tier never spins down between user visits.
 * Renders nothing visible.
 */
import { useEffect } from "react";
import { API_BASE_URL } from "@/lib/api-base";

const PING_INTERVAL_MS = 14 * 60 * 1000; // 14 minutes

const KeepAlive = () => {
  useEffect(() => {
    const ping = () => {
      fetch(`${API_BASE_URL}/api/health`, { method: "GET" }).catch(() => {
        // Silently ignore errors — this is just a wake-up call
      });
    };

    // Ping immediately on first load
    ping();

    // Then ping every 14 minutes
    const interval = setInterval(ping, PING_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  return null;
};

export default KeepAlive;
