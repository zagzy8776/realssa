import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
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


const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
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
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
