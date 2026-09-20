import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowRight, MapPin, Newspaper } from 'lucide-react';
import SEO from '@/components/SEO';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { apiUrl } from '@/lib/api-base';

const COUNTRIES = [
  'Algeria','Angola','Benin','Botswana','Burkina Faso','Burundi','Cabo Verde','Cameroon',
  'Central African Republic','Chad','Comoros','Democratic Republic of the Congo','Republic of the Congo',
  "Côte d'Ivoire",'Djibouti','Egypt','Equatorial Guinea','Eritrea','Eswatini','Ethiopia','Gabon',
  'The Gambia','Ghana','Guinea','Guinea-Bissau','Kenya','Lesotho','Liberia','Libya','Madagascar',
  'Malawi','Mali','Mauritania','Mauritius','Morocco','Mozambique','Namibia','Niger','Nigeria',
  'Rwanda','São Tomé and Príncipe','Senegal','Seychelles','Sierra Leone','Somalia','South Africa',
  'South Sudan','Sudan','Tanzania','Togo','Tunisia','Uganda','Zambia','Zimbabwe'
];

function labelFromSlug(value?: string) {
  if (!value) return '';
  return decodeURIComponent(value)
    .replace(/-/g, ' ')
    .replace(/\b\w/g, m => m.toUpperCase());
}

export default function LocationHub() {
  const params = useParams();
  const type = params.countryId ? 'country' : params.stateId ? 'state' : params.cityId ? 'city' : 'local-government';
  const slug = params.countryId || params.stateId || params.cityId || params.localGovernmentId || '';
  const locationName = useMemo(() => labelFromSlug(slug), [slug]);
  const [articles, setArticles] = useState<any[]>([]);
  const [loading, setLoading] = useState(type !== 'country' || Boolean(locationName));

  useEffect(() => {
    if (!locationName) return;
    let cancelled = false;
    setLoading(true);
    fetch(apiUrl('/api/location-feed?name=' + encodeURIComponent(locationName) + '&limit=24'), {
      headers: { Accept: 'application/json' },
      cache: 'no-store'
    })
      .then(r => r.ok ? r.json() : { articles: [] })
      .then(data => { if (!cancelled) setArticles(Array.isArray(data?.articles) ? data.articles : []); })
      .catch(() => { if (!cancelled) setArticles([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [locationName]);

  const title = locationName ? `News in ${locationName}` : 'Africa News by Location';
  const description = locationName
    ? `Latest news, headlines and stories from ${locationName} on RealSSA News.`
    : 'Explore RealSSA News by country, state, city and local government across Africa.';

  if (!locationName) {
    return (
      <>
        <SEO title="Africa News by Country" description={description} url="/africa" section="Africa" />
        <Header />
        <main className="min-h-screen bg-background px-4 py-8 md:px-8">
          <div className="mx-auto max-w-6xl">
            <div className="mb-8">
              <p className="text-sm font-semibold uppercase tracking-widest text-primary">RealSSA Africa</p>
              <h1 className="mt-2 text-3xl font-black md:text-5xl">News across Africa</h1>
              <p className="mt-3 max-w-2xl text-muted-foreground">Browse country hubs now, with the same URL structure ready for states, cities, local governments and neighborhoods as local coverage is available.</p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {COUNTRIES.map(country => (
                <Link key={country} to={`/country/${country.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`} className="group rounded-2xl border border-border bg-card p-4 transition hover:border-primary/50 hover:shadow-lg">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">{country}</span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-1 group-hover:text-primary" />
                  </div>
                  <span className="mt-2 block text-xs text-muted-foreground">Latest local coverage</span>
                </Link>
              ))}
            </div>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  return (
    <>
      <SEO title={title} description={description} url={`/${type}/${slug}`} section={locationName}
        robots={loading || articles.length > 0 ? 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1' : 'noindex, follow'} />
      <Header />
      <main className="min-h-screen bg-background px-4 py-8 md:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-8 flex items-start gap-3">
            <div className="mt-1 rounded-full bg-primary/15 p-2 text-primary"><MapPin className="h-5 w-5" /></div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-widest text-primary">{type.replace('-', ' ')}</p>
              <h1 className="mt-1 text-3xl font-black md:text-5xl">{title}</h1>
              <p className="mt-3 max-w-3xl text-muted-foreground">{description}</p>
            </div>
          </div>

          {loading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-48 animate-pulse rounded-2xl bg-muted" />)}
            </div>
          ) : articles.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-10 text-center">
              <Newspaper className="mx-auto h-8 w-8 text-muted-foreground" />
              <h2 className="mt-3 text-xl font-bold">No recent stories yet</h2>
              <p className="mt-2 text-sm text-muted-foreground">This location hub is ready for coverage as stories are published.</p>
            </div>
          ) : (
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {articles.map(article => (
                <article key={article.id} className="overflow-hidden rounded-2xl border border-border bg-card">
                  {article.image && <img src={article.image} alt="" className="aspect-video w-full object-cover" loading="lazy" width="640" height="360" />}
                  <div className="p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-primary">{article.category || 'News'}</p>
                    <h2 className="mt-1 line-clamp-3 text-lg font-bold">{article.title}</h2>
                    {article.excerpt && <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{article.excerpt}</p>}
                    <Link className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary" to={`/article/${article.id}`}>
                      Read story <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
