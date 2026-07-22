import { Helmet } from 'react-helmet-async';

interface SEOProps {
  title: string;
  description: string;
  keywords?: string;
  image?: string;
  url?: string;
  type?: 'website' | 'article';
  author?: string;
  publishedTime?: string;
  modifiedTime?: string;
  section?: string;
  tags?: string[];
}

const SITE_URL = 'https://www.realssanews.com.ng';
const SITE_NAME = 'RealSSA News';
const SITE_TAGLINE = 'RealSSA News — The Pulse of Africa';
const DEFAULT_IMAGE = `${SITE_URL}/logo.png`;
const TWITTER_HANDLE = '@realssanews';

const DEFAULT_KEYWORDS =
  'RealSSA News, RealSSA, realssa news, breaking news Africa, Nigerian news today, ' +
  'African news, Nigeria latest news, Lagos news, Abuja news, Nollywood, Afrobeats, ' +
  'African entertainment, South Africa news, Ghana news, Kenya news, ' +
  'African sports news, Premier League Africa, African football, ' +
  'tech news Nigeria, cryptocurrency Africa, Bitcoin Nigeria, ' +
  'politics Nigeria, Nigeria 2027 elections, African business news, ' +
  'best news site Nigeria, top African news site, ' +
  'best news sites, best news sites unbiased, best news sites free, best news sites without paywall, ' +
  'best news site for stock market, best news sites for futures trading, best news sites online, ' +
  'best news sites for business, best news sites 2026, best news sources unbiased, ' +
  'best news sources unbiased 2026, best free unbiased news sites, best news sources reddit, ' +
  'best free news sites reddit, best news websites free, best online news sites free, ' +
  'best financial news sites free, best market news sites free, best international news sites free, ' +
  'best world news sites free, best business news websites free, best news sources without paywall, ' +
  'best news in nigeria, best news in nigeria today, best news site in nigeria, best news app in nigeria, ' +
  'best news channel in nigeria, best news websites in nigeria, top news site in nigeria, ' +
  'best online news in nigeria, best news platform in nigeria, top news in nigeria today, ' +
  'top trending news in nigeria today, top political news in nigeria today, top news headlines in nigeria today, ' +
  'top breaking news in nigeria today, top business news in nigeria today, news12, news 12 nj, ' +
  'news 12 long island, newsday, newsmax, news 12 westchester, news new jersey, news clifton nj, ' +
  'news12nj, news12 long island, news12 westchester, news12li, news12 weather, news12ct, news12 new jersey, ' +
  'news12 bronx, news12 brooklyn, news today new jersey, news today nyc, news today fox, news today nj, ' +
  'news today headlines, news 12 nj breaking news today, news 12 long island weather, newsday long island, ' +
  'newsmax news, newsmax live, clifton news nj today, breaking news clifton nj today, ' +
  'today news in nigeria headlines, today news in nigeria newspapers, today news in nigeria now, ' +
  'today news in nigeria 2026, today news in nigeria headlines 2026, today news in nigeria punch, ' +
  'today news in nigeria video, today news in nigeria headlines politics, latest news in nigeria headlines, ' +
  'latest news in nigeria newspapers, latest news in nigeria punch newspaper, latest news in nigeria vanguard, ' +
  'latest news in nigeria sun newspapers, latest news in nigeria nation, what is the latest news in nigeria today, ' +
  'latest news in nigeria now, current news in nigeria now, today breaking news in nigeria now, ' +
  'latest news in nigeria 2026, current news in nigeria today punch, latest news in nigeria politics, ' +
  'latest breaking news in nigeria politics today';

const SEO = ({
  title,
  description,
  keywords = DEFAULT_KEYWORDS,
  image = DEFAULT_IMAGE,
  url = SITE_URL,
  type = 'website',
  author = 'RealSSA News',
  publishedTime,
  modifiedTime,
  section,
  tags = [],
}: SEOProps) => {
  // Always prefix with brand for branded search
  const pageTitle = title.includes('RealSSA') ? title : `${title} | ${SITE_NAME}`;
  const canonicalUrl = url.startsWith('http') ? url : `${SITE_URL}${url}`;
  const absoluteImage = image.startsWith('http') ? image : `${SITE_URL}${image}`;
  const metaDescription = description ? (description.length > 160 ? description.substring(0, 157) + '...' : description) : '';

  // Build JSON-LD schema based on type
  const websiteSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    alternateName: 'RealSSA',
    url: SITE_URL,
    description: 'Your premier source for African news, entertainment, sports and culture.',
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${SITE_URL}/?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
      url: SITE_URL,
      logo: {
        '@type': 'ImageObject',
        url: DEFAULT_IMAGE,
        width: 600,
        height: 60,
      },
      sameAs: [
        'https://x.com/realssanews',
        'https://www.facebook.com/RealSSANews',
        'https://www.instagram.com/realssanews/',
      ],
    },
  };

  const articleSchema =
    type === 'article'
      ? {
          '@context': 'https://schema.org',
          '@type': 'NewsArticle',
          headline: title,
          description: metaDescription,
          image: [absoluteImage],
          datePublished: publishedTime || new Date().toISOString(),
          dateModified: modifiedTime || publishedTime || new Date().toISOString(),
          author: [
            {
              '@type': 'Organization',
              name: author,
              url: SITE_URL,
            },
          ],
          publisher: {
            '@type': 'Organization',
            name: SITE_NAME,
            logo: {
              '@type': 'ImageObject',
              url: DEFAULT_IMAGE,
            },
          },
          mainEntityOfPage: {
            '@type': 'WebPage',
            '@id': canonicalUrl,
          },
          articleSection: section || 'News',
          keywords: tags.length ? tags.join(', ') : keywords,
          url: canonicalUrl,
          isAccessibleForFree: true,
          inLanguage: 'en',
        }
      : null;

  const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'NewsMediaOrganization',
    name: SITE_NAME,
    alternateName: 'RealSSA',
    url: SITE_URL,
    logo: {
      '@type': 'ImageObject',
      url: DEFAULT_IMAGE,
      width: 600,
      height: 60,
    },
    description: 'RealSSA News is Africa\'s leading digital news platform covering Nigeria, Ghana, Kenya, South Africa and the entire continent.',
    foundingDate: '2023',
    areaServed: ['Nigeria', 'Ghana', 'Kenya', 'South Africa', 'Africa'],
    knowsLanguage: 'en',
    ethicsPolicy: `${SITE_URL}/about`,
    correctionsPolicy: `${SITE_URL}/contact`,
    masthead: `${SITE_URL}/about`,
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'editorial',
      url: `${SITE_URL}/contact`,
    },
    sameAs: [
      'https://x.com/realssanews',
      'https://www.facebook.com/RealSSANews',
    ],
  };

  const breadcrumbSchema = section && type !== 'article' ? {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: SITE_URL
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: section,
        item: canonicalUrl
      }
    ]
  } : null;

  return (
    <Helmet>
      {/* ── Primary meta ── */}
      <html lang="en" />
      <title>{pageTitle}</title>
      <meta name="description" content={metaDescription} />
      <meta name="keywords" content={keywords} />
      <meta name="author" content={author} />
      <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
      <link rel="canonical" href={canonicalUrl} />

      {/* ── Google site verification ── */}
      <meta name="google-site-verification" content="d0088a19dd0f4c40" />

      {/* ── Open Graph (Facebook, WhatsApp, LinkedIn) ── */}
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:type" content={type === 'article' ? 'article' : 'website'} />
      <meta property="og:title" content={pageTitle} />
      <meta property="og:description" content={metaDescription} />
      <meta property="og:image" content={absoluteImage} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:image:alt" content={pageTitle} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:locale" content="en_NG" />

      {/* ── Article-specific OG ── */}
      {type === 'article' && publishedTime && (
        <meta property="article:published_time" content={publishedTime} />
      )}
      {type === 'article' && modifiedTime && (
        <meta property="article:modified_time" content={modifiedTime} />
      )}
      {type === 'article' && author && (
        <meta property="article:author" content={author} />
      )}
      {type === 'article' && section && (
        <meta property="article:section" content={section} />
      )}
      {type === 'article' && tags.map((tag) => (
        <meta key={tag} property="article:tag" content={tag} />
      ))}

      {/* ── Twitter / X Card ── */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:site" content={TWITTER_HANDLE} />
      <meta name="twitter:creator" content={TWITTER_HANDLE} />
      <meta name="twitter:title" content={pageTitle} />
      <meta name="twitter:description" content={metaDescription} />
      <meta name="twitter:image" content={absoluteImage} />
      <meta name="twitter:image:alt" content={pageTitle} />

      {/* ── Structured Data JSON-LD ── */}
      <script type="application/ld+json">
        {JSON.stringify(websiteSchema)}
      </script>
      <script type="application/ld+json">
        {JSON.stringify(organizationSchema)}
      </script>
      {articleSchema && (
        <script type="application/ld+json">
          {JSON.stringify(articleSchema)}
        </script>
      )}
      {breadcrumbSchema && (
        <script type="application/ld+json">
          {JSON.stringify(breadcrumbSchema)}
        </script>
      )}
    </Helmet>
  );
};

export default SEO;
