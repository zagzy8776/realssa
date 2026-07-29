import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import DarkModeToggle from "@/components/DarkModeToggle";
import PushNotificationManager from "@/components/PushNotificationManager";
import { useStreak } from "@/hooks/useStreak";
import { cn } from "@/lib/utils";
import {
  User,
  Flame,
  History,
  Bookmark,
  Download,
  ChevronRight,
  Copy,
  Check,
} from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import UserReferralCard from "@/components/UserReferralCard";

export default function Profile() {
  const navigate = useNavigate();
  const { streak, longestStreak } = useStreak();
  const [isCopied, setIsCopied] = useState(false);
  const [shakeEnabled, setShakeEnabled] = useState(
    () => localStorage.getItem("realssa_shake_discover_enabled") !== "false"
  );

  const deviceId = localStorage.getItem("realssa_device_uuid") || "";

  const toggleShake = (val: boolean) => {
    localStorage.setItem("realssa_shake_discover_enabled", val ? "true" : "false");
    setShakeEnabled(val);
  };

  const copyKey = () => {
    if (!deviceId) return;
    navigator.clipboard.writeText(deviceId);
    setIsCopied(true);
    toast({
      title: "Key copied",
      description: "Your anonymous profile key is on the clipboard.",
    });
    setTimeout(() => setIsCopied(false), 2000);
  };

  const links = [
    { label: "Bookmarks", path: "/bookmarks", icon: Bookmark },
    { label: "Downloads", path: "/downloads", icon: Download },
    { label: "Reading history", path: "/reading-history", icon: History },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 container max-w-lg mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
            <User className="w-7 h-7 text-amber-500" />
          </div>
          <div>
            <h1 className="text-2xl font-display font-bold">Profile</h1>
            <p className="text-sm text-muted-foreground">Your RealSSA identity</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-border bg-card/40 p-4 text-center">
            <Flame className="w-5 h-5 text-amber-500 mx-auto mb-1" />
            <div className="text-2xl font-extrabold">{streak}</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
              Day streak
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-card/40 p-4 text-center">
            <div className="text-2xl font-extrabold">🏆 {longestStreak}</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mt-1">
              Longest
            </div>
          </div>
        </div>

        <UserReferralCard />

        <div className="rounded-2xl border border-border divide-y divide-border overflow-hidden">
          {links.map(({ label, path, icon: Icon }) => (
            <button
              key={path}
              type="button"
              onClick={() => navigate(path)}
              className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-muted/40 transition"
            >
              <Icon className="w-4 h-4 text-amber-500" />
              <span className="flex-1 text-sm font-medium">{label}</span>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>
          ))}
        </div>

        <div className="rounded-2xl border border-border p-4 space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Settings
          </h2>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Appearance</span>
            <DarkModeToggle />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Push notifications</span>
            <PushNotificationManager iconOnly={false} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Shake to Discover</span>
            <button
              type="button"
              onClick={() => toggleShake(!shakeEnabled)}
              className={cn(
                "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors",
                shakeEnabled ? "bg-amber-500" : "bg-muted"
              )}
              aria-label="Toggle shake to discover"
            >
              <span
                className={cn(
                  "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-background shadow transition",
                  shakeEnabled ? "translate-x-5" : "translate-x-0"
                )}
              />
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-border p-4 space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Anonymous key
          </h2>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Save this key to restore your streak and library on another device.
          </p>
          <div className="flex gap-2">
            <input
              readOnly
              value={deviceId || "Not generated yet"}
              className="flex-1 px-3 py-2 rounded-lg border bg-muted/30 text-xs font-mono truncate"
            />
            <button
              type="button"
              onClick={copyKey}
              disabled={!deviceId}
              className="px-3 py-2 rounded-lg bg-amber-500 text-black text-xs font-bold flex items-center gap-1 disabled:opacity-40"
            >
              {isCopied ? <Check size={12} /> : <Copy size={12} />}
              Copy
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
