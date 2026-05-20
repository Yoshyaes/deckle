import type { MetadataRoute } from 'next';
import { getAllPosts } from '@/lib/blog';

const SITE = 'https://getdocuforge.dev';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE}/`, lastModified: now, changeFrequency: 'weekly', priority: 1.0 },
    { url: `${SITE}/pricing`, lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${SITE}/blog`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${SITE}/security`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${SITE}/status`, lastModified: now, changeFrequency: 'daily', priority: 0.5 },
    { url: `${SITE}/contact`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${SITE}/terms`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${SITE}/privacy`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
  ];

  let posts: Awaited<ReturnType<typeof getAllPosts>> = [];
  try {
    posts = await getAllPosts();
  } catch {
    // Build can still proceed without blog routes if content dir is missing.
  }

  const blogRoutes: MetadataRoute.Sitemap = posts.map((post) => ({
    url: `${SITE}/blog/${post.slug}`,
    lastModified: post.date ? new Date(post.date) : now,
    changeFrequency: 'monthly',
    priority: 0.6,
  }));

  return [...staticRoutes, ...blogRoutes];
}
