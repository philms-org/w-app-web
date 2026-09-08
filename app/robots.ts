import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

// Emitted as /robots.txt at build. The app is auth-gated and social; only the
// marketing surface (/, /welcome) and the privacy disclosure are worth
// indexing. Everything behind sign-in is disallowed so crawlers don't chase
// redirect chains into the app shell.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/main', '/main/', '/admin', '/admin/', '/profile', '/profile/', '/auth'],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
