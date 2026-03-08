import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { SectionWrapper } from '@/components/ui/section-wrapper';
import { Card } from '@/components/ui/card';
import { ScrollReveal } from '@/components/ui/scroll-reveal';
import { getAllPosts } from '@/lib/blog';

export async function BlogPreview() {
  const posts = await getAllPosts();
  const recent = posts.slice(0, 4);

  return (
    <SectionWrapper>
      <ScrollReveal>
        <div className="flex items-center justify-between mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-text-primary tracking-tight">
            From the blog
          </h2>
          <Link
            href="/blog"
            className="hidden sm:flex items-center gap-1 text-sm text-accent hover:text-orange-400 transition-colors"
          >
            View all posts <ArrowRight size={14} />
          </Link>
        </div>
      </ScrollReveal>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {recent.map((post, i) => (
          <ScrollReveal key={post.slug} delay={i * 0.05}>
            <Link href={`/blog/${post.slug}`}>
              <Card hover className="p-5 h-full flex flex-col">
                <div className="text-xs text-accent font-mono mb-2">
                  {post.category}
                </div>
                <h3 className="text-sm font-semibold text-text-primary mb-2 leading-snug flex-1">
                  {post.title}
                </h3>
                <p className="text-xs text-text-dim leading-relaxed mb-3 line-clamp-2">
                  {post.description}
                </p>
                <div className="text-xs text-text-dim">
                  {post.readingTime} min read
                </div>
              </Card>
            </Link>
          </ScrollReveal>
        ))}
      </div>

      <Link
        href="/blog"
        className="sm:hidden flex items-center justify-center gap-1 mt-6 text-sm text-accent"
      >
        View all posts <ArrowRight size={14} />
      </Link>
    </SectionWrapper>
  );
}
