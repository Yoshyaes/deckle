'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

const navLinks = [
  { label: 'Features', href: '/#features' },
  { label: 'Docs', href: 'https://fred-7da601c6.mintlify.app' },
  { label: 'Blog', href: '/blog' },
  { label: 'Pricing', href: '/#pricing' },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-bg/80 backdrop-blur-lg border-b border-border-subtle'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
        {/* Logo */}
        <Link href="/" className="flex items-center">
          <Image
            src="/logo.png"
            alt="DocuForge"
            width={160}
            height={40}
            className="h-8 w-auto"
            priority
          />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="text-sm text-text-muted hover:text-text-primary transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Desktop CTA */}
        <div className="hidden md:flex items-center gap-3">
          <Button variant="ghost" size="sm" href="https://app.getdocuforge.dev/sign-in">
            Sign In
          </Button>
          <Button size="sm" href="https://app.getdocuforge.dev/sign-up">
            Get Started Free
          </Button>
        </div>

        {/* Mobile menu button */}
        <button
          className="md:hidden text-text-muted hover:text-text-primary"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden bg-bg/95 backdrop-blur-lg border-t border-border-subtle">
          <nav className="max-w-6xl mx-auto px-4 py-4 flex flex-col gap-3">
            {navLinks.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="text-sm text-text-muted hover:text-text-primary py-2"
              >
                {link.label}
              </Link>
            ))}
            <div className="pt-3 border-t border-border-subtle flex flex-col gap-2">
              <Button variant="secondary" size="sm" href="https://app.getdocuforge.dev/sign-in">
                Sign In
              </Button>
              <Button size="sm" href="https://app.getdocuforge.dev/sign-up">
                Get Started Free
              </Button>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
