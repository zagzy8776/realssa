import { apiUrl } from '@/lib/api-base';
import { useState, useEffect } from "react";
import { ArrowRight, Briefcase } from "lucide-react";
import CategoryBadge from "../components/CategoryBadge";
import SimpleImage from "../components/SimpleImage";
import Header from "../components/Header";
import Footer from "../components/Footer";
import NewsTicker from "@/components/NewsTicker";
import Pagination from "@/components/Pagination";
import NewsCard from "@/components/NewsCard";
import SEO from "@/components/SEO";
import { fetchWithRetry } from '@/lib/fetchWithRetry';

interface JobItem {
  id: string;
  title: string;
  excerpt: string;
  category: string;
  image: string;
  readTime: string;
  author: string;
  date: string;
  externalLink: string;
}

const JOBS_PER_PAGE = 12;

const Jobs = () => {
  const [jobs, setJobs] = useState<JobItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const fetchJobs = async () => {
      setLoading(true);
      try {
        const response = await fetchWithRetry(apiUrl('/api/news/jobs'));
        if (response) {
          const data = await response.json();
          // The API returns rss articles mapped to standard format
          setJobs(Array.isArray(data) ? data : []);
        } else {
          setError("Could not load jobs. Please tap Retry.");
        }
      } catch (err) {
        console.error("Error fetching jobs:", err);
        setError("Network error while fetching jobs");
      } finally {
        setLoading(false);
      }
    };

    fetchJobs();
    const interval = setInterval(fetchJobs, 30 * 60 * 1000); // 30 min refresh
    return () => clearInterval(interval);
  }, []);

  const totalPages = Math.ceil(jobs.length / JOBS_PER_PAGE);
  const paginatedJobs = jobs.slice(
    (currentPage - 1) * JOBS_PER_PAGE,
    currentPage * JOBS_PER_PAGE
  );

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SEO 
        title="Global Jobs & Opportunities | RealSSA News"
        description="Find remote jobs, tech opportunities, scholarships, and careers across Africa and worldwide."
      />
      <Header />
      <NewsTicker />
      <div className="container mx-auto px-4 py-8">
        
        {/* Hero Section */}
        <section className="relative overflow-hidden mb-12 rounded-3xl">
          <div className="absolute inset-0">
            <SimpleImage
              src="https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=1200&q=80"
              alt="Global Careers"
              className="w-full h-full object-cover"
              fallback="https://placehold.co/1200x400/0f172a/ffffff?text=Careers"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-slate-900/90 via-slate-800/80 to-transparent" />
          </div>

          <div className="relative container mx-auto px-6 py-16 md:py-24">
            <div className="max-w-2xl">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-lg text-slate-900">
                  <Briefcase size={24} />
                </div>
                <span className="text-sm text-white/90 font-bold tracking-widest uppercase bg-slate-800/50 px-3 py-1 rounded-full backdrop-blur-sm border border-white/10">
                  Careers & Opportunities
                </span>
              </div>

              <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight mb-6">
                Find Your Next Big Opportunity
              </h1>

              <p className="text-lg md:text-xl text-white/80 mb-8 max-w-xl">
                Browse remote jobs, tech roles, and global scholarships curated daily for the RealSSA community.
              </p>
            </div>
          </div>
        </section>

        {/* Listings */}
        <section id="latest" className="mb-12">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl md:text-3xl font-bold">Latest Openings</h2>
          </div>

          {error && (
            <div className="text-center py-12 bg-red-50 dark:bg-red-900/20 rounded-2xl border border-red-200 dark:border-red-800 mb-6">
              <p className="text-4xl mb-3">📡</p>
              <h3 className="text-lg font-bold text-red-600 dark:text-red-400 mb-1">Could not load jobs</h3>
              <p className="text-sm text-muted-foreground mb-4">Please try again in a moment.</p>
              <button
                onClick={() => window.location.reload()}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-full transition-colors"
              >
                🔄 Retry
              </button>
            </div>
          )}

          {!loading && !error && jobs.length === 0 && (
            <div className="text-center py-12 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
              <div className="w-16 h-16 bg-slate-200 dark:bg-slate-800 text-slate-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <Briefcase size={32} />
              </div>
              <h3 className="text-xl font-bold mb-2">Fetching the latest opportunities...</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                Our automated systems are currently gathering global job listings and scholarships. Check back shortly.
              </p>
            </div>
          )}

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {[...Array(8)].map((_, index) => (
                <div key={index} className="bg-card rounded-lg p-6 shadow-sm border border-border animate-pulse">
                  <div className="h-40 bg-muted rounded-lg mb-4"></div>
                  <div className="h-6 bg-muted rounded mb-2"></div>
                  <div className="h-4 bg-muted rounded mb-4"></div>
                  <div className="h-4 bg-muted rounded w-2/3"></div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {paginatedJobs.map((job, index) => {
                const JOB_IMAGES = [
                  "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=600&auto=format&fit=crop&q=60", // team meeting
                  "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=600&auto=format&fit=crop&q=60", // business office
                  "https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=600&auto=format&fit=crop&q=60", // recruiter handshake
                  "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=600&auto=format&fit=crop&q=60", // desk with laptop
                  "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=600&auto=format&fit=crop&q=60", // collaboration workshop
                  "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=600&auto=format&fit=crop&q=60", // typing on computer
                  "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=600&auto=format&fit=crop&q=60", // creative workspace
                  "https://images.unsplash.com/photo-1573164713714-d95e436ab8d6?w=600&auto=format&fit=crop&q=60"  // professional portrait
                ];
                const fallbackImg = JOB_IMAGES[index % JOB_IMAGES.length];
                const finalImage = job.image && !job.image.includes('placeholder') && job.image !== '' ? job.image : fallbackImg;

                return (
                  <NewsCard
                    key={job.id}
                    title={job.title}
                    excerpt={job.excerpt}
                    category="general"
                    image={finalImage}
                    readTime="Apply Now"
                    date={job.date}
                    href={`/article/${job.id}`}
                    id={job.id}
                    externalLink={job.externalLink}
                  />
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {!loading && jobs.length > 0 && (
            <>
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={handlePageChange}
              />
              <p className="text-center text-sm text-muted-foreground mt-4">
                Page {currentPage} of {totalPages} · {jobs.length} opportunities
              </p>
            </>
          )}
        </section>
      </div>
      <Footer />
    </div>
  );
};

export default Jobs;
