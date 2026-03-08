import Link from 'next/link';
import Image from 'next/image';

const columns = [
  {
    title: 'Product',
    links: [
      { label: 'Features', href: '/#features' },
      { label: 'Pricing', href: '/#pricing' },
      { label: 'Documentation', href: 'https://docs.docuforge.dev' },
      { label: 'API Reference', href: 'https://docs.docuforge.dev/api-reference/generate' },
      { label: 'Changelog', href: '/blog' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { label: 'Blog', href: '/blog' },
      { label: 'Guides', href: 'https://docs.docuforge.dev/guides/nextjs' },
      { label: 'Templates', href: 'https://app.docuforge.dev/templates/gallery' },
      { label: 'Status', href: '#' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'GitHub', href: 'https://github.com/docuforge' },
      { label: 'Twitter', href: 'https://twitter.com/docuforge' },
      { label: 'Discord', href: '#' },
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-border-subtle">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="col-span-2 sm:col-span-1">
            <div className="mb-4">
              <Image
                src="/logo.png"
                alt="DocuForge"
                width={140}
                height={35}
                className="h-7 w-auto"
              />
            </div>
            <p className="text-sm text-text-dim leading-relaxed">
              Pixel-perfect PDF generation for developers.
            </p>
          </div>

          {/* Link columns */}
          {columns.map((col) => (
            <div key={col.title}>
              <h3 className="text-sm font-semibold text-text-primary mb-3">{col.title}</h3>
              <ul className="space-y-2">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-text-dim hover:text-text-primary transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 pt-8 border-t border-border-subtle text-xs text-text-dim">
          &copy; {new Date().getFullYear()} DocuForge. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
