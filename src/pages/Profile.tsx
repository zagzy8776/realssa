import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
  Settings,
  Bell,
  Zap,
  Shield,
  Moon,
  Sun,
  Smartphone,
  Layers,
  Heart,
  Star,
  Share2,
  ArrowUpRight,
} from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import UserReferralCard from "@/components/UserReferralCard";
import AccountAuthCard from "@/components/AccountAuthCard";
import { MotionToggle, MotionIconButton, StaggeredList, MotionCard, MotionSwitch } from "@/components/MotionToggle";

export default function Profile() {
  const navigate = useNavigate();
  const { streak, longestStreak } = useStreak();
  const [isCopied, setIsCopied] = useState(false);
  const [shakeEnabled, setShakeEnabled] = useState(
    () => localStorage.getItem("realssa_shake_discover_enabled") !== "false"
  );
  const [showKey, setShowKey] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const deviceId = localStorage.getItem("realssa_device_uuid") || "";

  const toggleShake = (val: boolean) => {
    localStorage.setItem("realssa_shake_discover_enabled", val ? "true" : "false");
    setShakeEnabled(val);
    // Haptic feedback
    if ('vibrate' in navigator) navigator.vibrate(15);
  };

  const isLoggedIn = !!localStorage.getItem("realssa_auth_user");

  const copyKey = () => {
    if (!deviceId) return;
    navigator.clipboard.writeText(deviceId);
    setIsCopied(true);
    toast({ title: "Key copied", description: "Your anonymous profile key is on the clipboard." });
    setTimeout(() => setIsCopied(false), 2000);
    if ('vibrate' in navigator) navigator.vibrate([10, 50, 10]);
  };

  const links = [
    { label: "Bookmarks", path: "/bookmarks", icon: Bookmark, color: "text-amber-500" },
    { label: "Downloads", path: "/downloads", icon: Download, color: "text-blue-500" },
    { label: "Reading history", path: "/reading-history", icon: History, color: "text-violet-500" },
  ];

  const settingsItems = [
    {
      label: "Appearance",
      description: "Light, dark, or system theme",
      icon: <Moon className="w-5 h-5" />,
      action: <DarkModeToggle />,
    },
    {
      label: "Push notifications",
      description: "Breaking news and updates",
      icon: <Bell className="w-5 h-5" />,
      action: <PushNotificationManager iconOnly={false} />,
    },
    {
      label: "Shake to Discover",
      description: "Shake phone for random article",
      icon: <Zap className="w-5 h-5" />,
      action: (
        <MotionSwitch
          checked={shakeEnabled}
          onChange={toggleShake}
          size="md"
          onIcon={<Zap className="w-4 h-4 text-amber-500" />}
          offIcon={<Smartphone className="w-4 h-4 text-muted-foreground" />}
        />
      ),
    },
    {
      label: "Data & Privacy",
      description: "Manage your data preferences",
      icon: <Shield className="w-5 h-5" />,
      action: (
        <MotionIconButton
          onClick={() => navigate("/settings")}
          icon={<ChevronRight className="w-4 h-4" />}
          variant="ghost"
          size="sm"
          label="Open settings"
        />
      ),
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <motion.main
        className="flex-1 container max-w-lg mx-auto px-4 pt-6 pb-28 space-y-6"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        {/* Profile Header */}
        <motion.div
          className="flex items-center gap-4"
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.08 }}
          whileHover={{ scale: 1.01 }}
        >
          <motion.div
            whileHover={{ rotate: 6, scale: 1.05 }}
            whileTap={{ scale: 0.94 }}
            className="w-14 h-14 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shadow-lg shadow-amber-500/10"
            animate={{ boxShadow: [0, 8, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <motion.div
              animate={{ rotate: [0, 360] }}
              transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
            >
              <User className="w-7 h-7 text-amber-500" />
            </motion.div>
          </motion.div>
          <div>
            <h1 className="text-2xl font-display font-bold">Profile</h1>
            <p className="text-sm text-muted-foreground">Your RealSSA identity</p>
          </div>
        </motion.div>

        {/* Stats Cards */}
        <StaggeredList staggerDelay={0.08} delayChildren={0.14} className="grid grid-cols-2 gap-3">
          <MotionCard elevated hoverScale={1.03} className="rounded-2xl border border-border bg-card/40 p-4 text-center shadow-sm">
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
            >
              <Flame className="w-5 h-5 text-amber-500 mx-auto mb-1" />
            </motion.div>
            <div className="text-2xl font-extrabold">{streak}</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Day streak</div>
          </MotionCard>

          <MotionCard elevated hoverScale={1.03} className="rounded-2xl border border-border bg-card/40 p-4 text-center shadow-sm">
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 2, repeat: Infinity, delay: 1 }}
            >
              <span className="text-xl">🏆</span>
            </motion.div>
            <div className="text-2xl font-extrabold">{longestStreak}</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Longest</div>
          </MotionCard>
        </StaggeredList>

        {/* Auth & Referral */}
        <StaggeredList staggerDelay={0.1} delayChildren={0.2} direction="y" className="space-y-4">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.24 }}>
            <AccountAuthCard />
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <UserReferralCard />
          </motion.div>
        </StaggeredList>

        {/* Navigation Links */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.36 }} className="rounded-2xl border border-border divide-y divide-border overflow-hidden">
          <StaggeredList staggerDelay={0.06} delayChildren={0.02} direction="y">
            {links.map(({ label, path, icon: Icon, color }) => (
              <motion.button
                key={path}
                type="button"
                onClick={() => navigate(path)}
                className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-muted/40 transition-colors group relative overflow-hidden"
                whileTap={{ scale: 0.98 }}
              >
                <motion.span className={cn("w-4 h-4 transition-transform duration-300 group-hover:scale-125 group-hover:rotate-6", color)}>
                  <Icon />
                </motion.span>
                <span className="flex-1 text-sm font-medium">{label}</span>
                <motion.div
                  className="w-4 h-4 text-muted-foreground transition-transform duration-300"
                  animate={{ x: 0 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                >
                  <ChevronRight />
                </motion.div>
                {/* Hover indicator */}
                <motion.div
                  className="absolute inset-0 bg-amber-500/5"
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 0 }}
                  whileHover={{ scaleX: 1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                  style={{ transformOrigin: 'left' }}
                />
              </motion.button>
            ))}
          </StaggeredList>
        </motion.div>

        {/* Settings Section */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.42 }} className="rounded-2xl border border-border p-4 space-y-4">
          <motion.div
            className="flex items-center justify-between mb-2"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.05 }}
          >
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Settings className="w-4 h-4 text-amber-500" />
              Settings
            </h2>
          </motion.div>

          <StaggeredList staggerDelay={0.06} delayChildren={0.08} direction="y" className="space-y-3">
            {settingsItems.map((item, index) => (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.02 * index }}
                className="flex items-center justify-between gap-4 py-2"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <motion.div
                    whileHover={{ scale: 1.15, rotate: 5 }}
                    whileTap={{ scale: 0.9 }}
                    className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-500 shrink-0"
                  >
                    {item.icon}
                  </motion.div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{item.label}</p>
                    <p className="text-xs text-muted-foreground truncate">{item.description}</p>
                  </div>
                </div>
                <div className="shrink-0">{item.action}</div>
              </motion.div>
            ))}
          </StaggeredList>
        </motion.div>

        {/* Anonymous Key Section */}
        {!isLoggedIn && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.48 }}
            className="rounded-2xl border border-border p-4 space-y-3"
          >
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Key className="w-4 h-4 text-amber-500" />
              Anonymous key
            </h2>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Save this key to restore your streak and library on another device.
            </p>
            <div className="flex gap-2">
              <motion.input
                readOnly
                type={showKey ? "text" : "password"}
                value={deviceId || "Not generated yet"}
                className="flex-1 px-3 py-2 rounded-lg border bg-muted/30 text-xs font-mono truncate transition-all duration-200 focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                whileFocus={{ scale: 1.01 }}
              />
              <MotionIconButton
                onClick={() => setShowKey(!showKey)}
                icon={showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                label={showKey ? "Hide key" : "Show key"}
                variant="secondary"
                size="sm"
              />
              <MotionIconButton
                onClick={copyKey}
                disabled={!deviceId}
                icon={isCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                label="Copy key"
                variant={deviceId ? "primary" : "secondary"}
                size="sm"
                loading={isCopied}
              />
            </div>
          </motion.div>
        )}

        {/* Version info */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.4 }}
          transition={{ delay: 0.6, duration: 1 }}
          className="text-center text-[10px] text-muted-foreground uppercase tracking-wider"
        >
          RealSSA v0.0.85 · Built with ❤️ for Africa
        </motion.div>
      </motion.main>
    </div>
  );
}

// Missing icons - add them
const Eye = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const EyeOff = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

const Key = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3" />
  </svg>
);