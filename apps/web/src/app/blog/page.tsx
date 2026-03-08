import type { Metadata } from 'next';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { ScrollReveal } from '@/components/ui/scroll-reveal';
import { getAllPosts } from '@/lib/blog';

export const metadata: Metadata = {
  title: 'Blog',
  description: 'Tutorials, guides, and insights on PDF generation for developers.',
};

export default async function BlogIndex() {
  const posts = await getAllPosts();

  return (
    <div className="pt-32 pb-16">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <ScrollReveal>
          <h1 className="text-4xl sm:text-5xl font-bold text-text-primary tracking-tight mb-4">
            Blog
          </h1>
          <p className="text-lg text-text-muted mb-12 max-w-2xl">
            Tutorials, guides, and insights on generating PDFs with DocuForge.
          </p>
        </ScrollReveal>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {posts.map((post, i) => (
            <ScrollReveal key={post.slug} delay={i * 0.03}>
              <Link href={`/blog/${post.slug}`}>
                <Card hover className="p-6 h-full flex flex-col">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs font-mono text-accent">
                      {post.category}
                    </span>
                    <span className="text-xs text-text-dim">&middot;</span>
                    <span className="text-xs text-text-dim">
                      {post.readingTime} min read
                    </span>
                  </div>
                  <h2 className="text-base font-semibold text-text-primary mb-2 leading-snug flex-1">
                    {post.title}
                  </h2>
                  <p className="text-sm text-text-dim leading-relaxed line-clamp-3">
                    {post.description}
                  </p>
                  <div className="mt-4 text-xs text-text-dim">
                    {new Date(post.date).toLocaleDateString('en-US', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </div>
                </Card>
              </Link>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </div>
  );
}
