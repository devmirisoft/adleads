import type { MetadataRoute } from 'next';
import { site } from '@/modules/marketing';

// Staff pages also send noindex; this just keeps crawlers out. Keep in step with the Sidebar nav.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/login',
        '/api/',
        '/dashboard',
        '/leads',
        '/inbox',
        '/batches',
        '/enrollments',
        '/payments',
        '/script',
        '/settings',
        '/dev',
      ],
    },
    sitemap: `${site.url}/sitemap.xml`,
  };
}
