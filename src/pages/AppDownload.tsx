import { Helmet } from 'react-helmet-async';
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Download, ExternalLink, Smartphone } from "lucide-react";
import { apiUrl } from '@/lib/api-base';

const AppDownload = () => {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "RealSSA News",
    "operatingSystem": "ANDROID",
    "applicationCategory": "NewsApplication",
    "downloadUrl": "https://realssanews.com.ng/RealSSANews.apk",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "USD"
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      <Helmet>
        <title>Download RealSSA News App | Breaking African News</title>
        <meta name="description" content="Download the official RealSSA News app for Android. Get breaking news, sports, and entertainment from across Sub-Saharan Africa instantly." />
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      </Helmet>

      <Header />

      <main className="flex-grow container mx-auto px-4 py-16 flex flex-col items-center justify-center">
        <div className="bg-white p-8 md:p-12 rounded-2xl shadow-xl max-w-2xl w-full text-center border border-gray-100">
          <div className="w-24 h-24 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <Smartphone size={48} />
          </div>
          
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Get the RealSSA News App
          </h1>
          <p className="text-lg text-gray-600 mb-10">
            Experience Africa's premier digital news platform directly on your device. Fast, reliable, and tailored for you.
          </p>

          <div className="flex flex-col gap-4 justify-center items-stretch mt-6">
            {/* Primary Funnel: Direct 1-Tap APK Download */}
            <a 
              href="/realssa-v2.apk"
              download="realssa-v2.apk"
              className="w-full bg-gradient-gold hover:opacity-90 text-black font-bold py-5 px-6 rounded-2xl transition-all duration-200 flex items-center justify-center gap-4 shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]"
            >
              <Download size={28} className="animate-bounce" />
              <div className="text-left">
                <div className="text-sm font-semibold opacity-80 uppercase tracking-wider">Direct 1-Tap Download</div>
                <div className="text-xl leading-tight">Install V2 App (APK)</div>
              </div>
            </a>

            {/* Secondary Funnel: Amazon Appstore */}
            <a 
              href="https://www.amazon.com/dp/B0DTRF4JZT" 
              target="_blank"
              rel="noopener noreferrer"
              className="w-full bg-transparent hover:bg-gray-100 text-gray-700 font-medium py-3 px-6 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 border border-gray-200"
            >
              <ExternalLink size={18} />
              <span>Or get it on the Amazon Appstore</span>
            </a>
          </div>
          <p className="mt-8 text-sm text-gray-500">
            Requires Android 8.0 or later.
          </p>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default AppDownload;
