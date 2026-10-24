import type { MetadataRoute } from 'next';
import { site } from '@/modules/marketing';

// Public pages only.
export default function sitemap(): MetadataRoute.Sitemap {
  return ['', '/privacy', '/terms', '/refund-policy', '/contact'].map((path) => ({
    url: `${site.url}${path}`,
  }));
}
