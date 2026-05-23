import type { MetadataRoute } from 'next';
import { brandUrl } from '@/lib/brand';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Private surfaces: keep authenticated/admin pages and the per-client
        // registration form out of search indexes.
        disallow: ['/dashboard/', '/register', '/api/'],
      },
    ],
    sitemap: brandUrl('/sitemap.xml'),
    host: brandUrl(''),
  };
}
