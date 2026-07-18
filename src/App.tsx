import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { SplashScreen } from "@capacitor/splash-screen";
import { Capacitor } from "@capacitor/core";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import PWAInstallPrompt from "@/components/PWAInstallPrompt";
import MobileAppFeatures from "@/components/MobileAppFeatures";
import MobileBottomNav from "@/components/MobileBottomNav";
import KeepAlive from "@/components/KeepAlive";
import GlobalHooks from "@/components/GlobalHooks";
import LoadingOverlay from "@/components/LoadingOverlay";
import FeedWatermark from "@/components/FeedWatermark";
import Index from "./pages/Index";
import About from "./pages/About";
import Contact from "./pages/Contact";
import Terms from "./pages/Terms";
import NigerianManual from "./pages/NigerianManual";
import PolicyBrief from "./pages/PolicyBrief";
import NotFound from "./pages/NotFound";
import NewsPost from "./pages/NewsPost";
import Nigeria from "./pages/Nigeria";
import Culture from "./pages/Culture";
import MediaDecode from "./pages/library/MediaDecode";
import SocietalArchitecture from "./pages/library/SocietalArchitecture";
import AdminLogin from "./pages/AdminLogin";
import ArticlePage from "./pages/ArticlePage";
import AdminDashboard from "./pages/AdminDashboard";
import EditNewsPage from "./pages/EditNewsPage";
import NigerianNews from "./pages/NigerianNews";
import WorldNews from "./pages/WorldNews";
import ForYou from "./pages/ForYou";
import CryptoNews from "./pages/CryptoNews";
import VideoNews from "./pages/VideoNews";
import Sports from "./pages/Sports";
import Ghana from "./pages/Ghana";
import Kenya from "./pages/Kenya";
import SouthAfrica from "./pages/SouthAfrica";
import UK from "./pages/UK";
import USA from "./pages/USA";
import Newssection from "./pages/Newssection";
import Jobs from "./pages/Jobs";
import ReaderMode from "./pages/ReaderMode";
import WorldDirectory from "./pages/WorldDirectory";
import CountryNews from "./pages/CountryNews";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import AppDownload from "./pages/AppDownload";
import Reels from "./pages/Reels";
import ReadingList from "./pages/ReadingList";
import PublisherHub from "./pages/PublisherHub";
import LeagueHub from "./pages/LeagueHub";

import { CapacitorUpdater } from '@capgo/capacitor-updater';
import OneSignalNative from 'onesignal-cordova-plugin';

const queryClient = new QueryClient();

const ONESIGNAL_APP_ID = "055b6596-a96c-48e2-8cda-ff4bb6d61009";

const FeedWatermarkWrapper = () => {
  const location = useLocation();
  const isReels = location.pathname === "/reels";
  if (isReels) return null;
  return <FeedWatermark />;
};

// Scroll to top on every route change (fixes pages starting from bottom on navigation)
const ScrollToTop = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [pathname]);
  return null;
};

const App = () => {
  // Hide native splash screen immediately so our custom React loading animation shows
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      SplashScreen.hide().catch(err => console.warn('Splash screen hide failed:', err));
      
      // Initialize OneSignal Native SDK
      OneSignalNative.initialize(ONESIGNAL_APP_ID);
      
      // Notify Capgo OTA updater that the app successfully booted
      CapacitorUpdater.notifyAppReady().catch(err => console.warn('Capgo notify failed:', err));
    }
  }, []);

  return (
    <HelmetProvider>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <PWAInstallPrompt />
        <KeepAlive />
        <BrowserRouter>
          <ScrollToTop />
          <GlobalHooks />
          <FeedWatermarkWrapper />
          <MobileBottomNav />
          <main className="pb-20 md:pb-0">
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/about" element={<About />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/nigeria" element={<Nigeria />} />
              <Route path="/culture" element={<Culture />} />
              <Route path="/library/media-decode" element={<MediaDecode />} />
              <Route path="/library/nigerian-manual" element={<NigerianManual />} />
              <Route path="/library/policy-brief" element={<PolicyBrief />} />
              <Route path="/library/societal-architecture" element={<SocietalArchitecture />} />
              <Route path="/admin-login" element={<AdminLogin />} />
              <Route path="/admin-dashboard" element={<AdminDashboard />} />
              <Route path="/edit-news/:id" element={<EditNewsPage />} />
              <Route path="/post-news" element={<NewsPost />} />
              <Route path="/article/:id" element={<ArticlePage />} />
              <Route path="/nigerian-news" element={<NigerianNews />} />
              <Route path="/world-news" element={<WorldNews />} />
              <Route path="/for-you" element={<ForYou />} />
              <Route path="/crypto" element={<CryptoNews />} />
              <Route path="/videos" element={<VideoNews />} />
              <Route path="/sports" element={<Sports />} />
              <Route path="/ghana" element={<Ghana />} />
              <Route path="/kenya" element={<Kenya />} />
              <Route path="/south-africa" element={<SouthAfrica />} />
              <Route path="/uk" element={<UK />} />
              <Route path="/usa" element={<USA />} />
              <Route path="/news" element={<Newssection />} />
              <Route path="/news-section" element={<Newssection />} />
              <Route path="/entertainment" element={<Newssection categoryFilter="entertainment" />} />
              <Route path="/jobs" element={<Jobs />} />
              <Route path="/read" element={<ReaderMode />} />
              <Route path="/world-directory" element={<WorldDirectory />} />
              <Route path="/privacy" element={<PrivacyPolicy />} />
              <Route path="/country/:countryId" element={<CountryNews />} />
              <Route path="/download" element={<AppDownload />} />
              <Route path="/reels" element={<Reels />} />
              <Route path="/reading-list" element={<ReadingList />} />
              <Route path="/publisher/:slug" element={<PublisherHub />} />
              <Route path="/sports/league/:leagueSlug" element={<LeagueHub />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </main>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </HelmetProvider>
  );
};

export default App;
