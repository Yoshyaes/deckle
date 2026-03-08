import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { MDXRemote } from 'next-mdx-remote/rsc';
import { getAllPosts, getPostBySlug } from '@/lib/blog';
import { mdxComponents } from '@/components/blog/mdx-components';
import { notFound } from 'next/navigation';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const posts = await getAllPosts();
  return posts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) return {};
  return {
    title: post.title,
    description: post.description,
    openGraph: {
      title: post.title,
      description: post.description,
      type: 'article',
      publishedTime: post.date,
    },
  };
}

export default async function BlogPost({ params }: Props) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) notFound();

  return (
    <article className="pt-32 pb-16">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <Link
          href="/blog"
          className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-text-primary transition-colors mb-8"
        >
          <ArrowLeft size={14} />
          Back to blog
        </Link>

        <header className="mb-10">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xs font-mono text-accent">{post.category}</span>
            <span className="text-xs text-text-dim">&middot;</span>
            <span className="text-xs text-text-dim">{post.readingTime} min read</span>
            <span className="text-xs text-text-dim">&middot;</span>
            <span className="text-xs text-text-dim">
              {new Date(post.date).toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-text-primary tracking-tight leading-tight mb-4">
            {post.title}
          </h1>
          <p className="text-lg text-text-muted">{post.description}</p>
        </header>

        <div className="prose-docuforge">
          <MDXRemote source={post.content} components={mdxComponents} />
        </div>
      </div>
    </article>
  );
}
