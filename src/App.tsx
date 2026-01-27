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
import AIGallery from "./pages/AIGallery";
import Culture from "./pages/Culture";
import MediaDecode from "./pages/library/MediaDecode";
import SocietalArchitecture from "./pages/library/SocietalArchitecture";
import AdminLogin from "./pages/AdminLogin";
import ArticlePage from "./pages/ArticlePage";
import AdminDashboard from "./pages/AdminDashboard";
import EditNewsPage from "./pages/EditNewsPage";

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
          <Route path="/ai-gallery" element={<AIGallery />} />
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
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
