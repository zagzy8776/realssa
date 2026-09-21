import { useEffect, lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Capacitor } from "@capacitor/core";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createBrowserRouter, createRoutesFromElements, RouterProvider, Route, ScrollRestoration, Outlet } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import PWAInstallPrompt from "@/components/PWAInstallPrompt";
import MobileBottomNav from "@/components/MobileBottomNav";
import KeepAlive from "@/components/KeepAlive";
import GlobalHooks from "@/components/GlobalHooks";
import OnboardingTopicSelector from "@/components/OnboardingTopicSelector";
import { GlobalAudioProvider } from "@/contexts/GlobalAudioContext";

import Index from "./pages/Index";

const ForYou               = lazy(() => import("./pages/ForYou"));
const CinemaHub            = lazy(() => import("./pages/CinemaHub"));
const VideoNews            = lazy(() => import("./pages/VideoNews"));
const Sports               = lazy(() => import("./pages/Sports"));
const LocationHub         = lazy(() => import("./pages/LocationHub"));
const About               = lazy(() => import("./pages/About"));
const Contact             = lazy(() => import("./pages/Contact"));
const Terms               = lazy(() => import("./pages/Terms"));
const NigerianManual      = lazy(() => import("./pages/NigerianManual"));
const PolicyBrief         = lazy(() => import("./pages/PolicyBrief"));
const NotFound            = lazy(() => import("./pages/NotFound"));
const NewsPost            = lazy(() => import("./pages/NewsPost"));
const Nigeria             = lazy(() => import("./pages/Nigeria"));
const Culture             = lazy(() => import("./pages/Culture"));
const MediaDecode         = lazy(() => import("./pages/library/MediaDecode"));
const SocietalArchitecture = lazy(() => import("./pages/library/SocietalArchitecture"));
const AdminLogin          = lazy(() => import("./pages/AdminLogin"));
const ArticlePage         = lazy(() => import("./pages/ArticlePage"));
const AdminDashboard      = lazy(() => import("./pages/AdminDashboard"));
const InternalDashboard   = lazy(() => import("./pages/InternalDashboard"));
const EditNewsPage        = lazy(() => import("./pages/EditNewsPage"));
const NigerianNews        = lazy(() => import("./pages/NigerianNews"));
const WorldNews           = lazy(() => import("./pages/WorldNews"));
const CryptoNews          = lazy(() => import("./pages/CryptoNews"));
const Ghana               = lazy(() => import("./pages/Ghana"));
const Kenya               = lazy(() => import("./pages/Kenya"));
const SouthAfrica         = lazy(() => import("./pages/SouthAfrica"));
const UK                  = lazy(() => import("./pages/UK"));
const USA                  = lazy(() => import("./pages/USA"));
const Newssection         = lazy(() => import("./pages/Newssection"));
const Jobs                = lazy(() => import("./pages/Jobs"));
const ReaderMode          = lazy(() => import("./pages/ReaderMode"));
const WorldDirectory      = lazy(() => import("./pages/WorldDirectory"));
const CountryNews         = lazy(() => import("./pages/CountryNews"));
const PrivacyPolicy       = lazy(() => import("./pages/PrivacyPolicy"));
const AppDownload         = lazy(() => import("./pages/AppDownload"));
const Reels               = lazy(() => import("./pages/Reels"));
const ReadingList         = lazy(() => import("./pages/ReadingList"));
const Trending            = lazy(() => import("./pages/Trending"));
const Downloads           = lazy(() => import("./pages/Downloads"));
const Profile             = lazy(() => import("./pages/Profile"));
const PublisherHub        = lazy(() => import("./pages/PublisherHub"));
const LeagueHub           = lazy(() => import("./pages/LeagueHub"));
const ReadingHistory      = lazy(() => import("./pages/ReadingHistory"));
const EntityHub           = lazy(() => import("./pages/EntityHub"));
const LocalMarketHub      = lazy(() => import("./pages/LocalMarketHub"));
const EventsCalendar      = lazy(() => import("./pages/EventsCalendar"));
const AdPortal            = lazy(() => import("./pages/AdPortal"));
const LiveWire             = lazy(() => import("./pages/LiveWire"));
const Widgets             = lazy(() => import("./pages/Widgets"));
const Search              = lazy(() => import("./pages/Search"));
const InAppBrowser        = lazy(() => import("./pages/InAppBrowser"));
const VerifyEmail         = lazy(() => import("./pages/VerifyEmail"));

const queryClient = new QueryClient();

const ONESIGNAL_APP_ID = "055b6596-a96c-48e2-8cda-ff4bb6d61009";

const FeedWatermarkWrapper = () => {
  return null;
};

const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-[#050505]">
    <span
      style={{
        width: 10,
        height: 10,
        borderRadius: '50%',
        background: '#f59e0b',
        boxShadow: '0 0 18px 4px rgba(251,191,36,0.5)',
        animation: 'pagePulse 1.2s ease-in-out infinite'
      }}
    />
    <style>{`
      @keyframes pagePulse {
        0%, 100% { opacity: 0.25; transform: scale(0.8); }
        50%       { opacity: 1;    transform: scale(1.2); }
      }
    `}</style>
  </div>
);

const AppLayout = () => {
  return (
    <>
      <ScrollRestoration />
      <GlobalHooks />
      <FeedWatermarkWrapper />
      <MobileBottomNav />
      <OnboardingTopicSelector />
      <main className="pb-20 md:pb-0 overflow-x-hidden w-full max-w-[100vw]">
        <Suspense fallback={<PageLoader />}>
          <Outlet />
        </Suspense>
      </main>
    </>
  );
};

const router = createBrowserRouter(
  createRoutesFromElements(
    <Route element={<AppLayout />}>
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
      <Route path="/internal/dashboard" element={<InternalDashboard />} />
      <Route path="/edit-news/:id" element={<EditNewsPage />} />
      <Route path="/post-news" element={<NewsPost />} />
      <Route path="/article/:id" element={<ArticlePage />} />
      <Route path="/nigerian-news" element={<NigerianNews />} />
      <Route path="/world-news" element={<WorldNews />} />
      <Route path="/for-you" element={<ForYou />} />
      <Route path="/crypto" element={<CryptoNews />} />
      <Route path="/videos" element={<VideoNews />} />
      <Route path="/video-news" element={<VideoNews />} />
      <Route path="/cinema" element={<CinemaHub />} />
      <Route path="/sports" element={<Sports />} />
      <Route path="/ghana" element={<Ghana />} />
      <Route path="/kenya" element={<Kenya />} />
      <Route path="/south-africa" element={<SouthAfrica />} />
      <Route path="/uk" element={<UK />} />
      <Route path="/usa" element={<USA />} />
      <Route path="/news" element={<NigerianNews />} />
      <Route path="/news-section" element={<Newssection />} />
      <Route path="/entertainment" element={<Newssection categoryFilter="entertainment" />} />
      <Route path="/jobs" element={<Jobs />} />
      <Route path="/read" element={<ReaderMode />} />
      <Route path="/world-directory" element={<WorldDirectory />} />
      <Route path="/privacy" element={<PrivacyPolicy />} />
      <Route path="/africa" element={<LocationHub />} />
      <Route path="/country/:countryId" element={<LocationHub />} />
      <Route path="/state/:stateId" element={<LocationHub />} />
      <Route path="/city/:cityId" element={<LocationHub />} />
      <Route path="/local-government/:localGovernmentId" element={<LocationHub />} />
      <Route path="/download" element={<AppDownload />} />
      <Route path="/ads" element={<AdPortal />} />
      <Route path="/reels" element={<Reels />} />
      <Route path="/trending" element={<Trending />} />
      <Route path="/bookmarks" element={<ReadingList />} />
      <Route path="/downloads" element={<Downloads />} />
      <Route path="/profile" element={<Profile />} />
      <Route path="/reading-list" element={<ReadingList />} />
      <Route path="/reading-history" element={<ReadingHistory />} />
      <Route path="/publisher/:slug" element={<PublisherHub />} />
      <Route path="/sports/league/:leagueSlug" element={<LeagueHub />} />
      <Route path="/entity/:name" element={<EntityHub />} />
      <Route path="/market" element={<LocalMarketHub />} />
      <Route path="/events" element={<EventsCalendar />} />
      <Route path="/wire" element={<LiveWire />} />
      <Route path="/widget/:type" element={<Widgets />} />
      <Route path="/search" element={<Search />} />
      <Route path="/browser" element={<InAppBrowser />} />
      <Route path="/verify-email" element={<VerifyEmail />} />
      <Route path="*" element={<NotFound />} />
    </Route>
  )
);

const App = () => {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    Promise.all([
      import('@capacitor/splash-screen'),
      import('@capgo/capacitor-updater'),
      import('onesignal-cordova-plugin')
    ]).then(([splash, updater, oneSignal]) => {
      splash.SplashScreen.hide().catch(err => console.warn('Splash screen hide failed:', err));
      oneSignal.default.initialize(ONESIGNAL_APP_ID);
      updater.CapacitorUpdater.notifyAppReady().catch(err => console.warn('Capgo notify failed:', err));
    }).catch(err => console.warn('Native SDK initialization failed:', err));
  }, []);

  return (
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <GlobalAudioProvider>
            <Toaster />
            <Sonner />
            <PWAInstallPrompt />
            <KeepAlive />
            <RouterProvider router={router} />
          </GlobalAudioProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </HelmetProvider>
  );
};

export default App;
