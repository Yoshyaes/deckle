'use client';

import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { CodeBlock } from '@/components/ui/code-block';

const heroCode = `import DocuForge from 'docuforge';

const pdf = await docuforge.generate({
  html: '<h1>Invoice #1042</h1><p>Total: $69.98</p>',
  options: { format: 'A4' }
});

console.log(pdf.url);
// → https://cdn.getdocuforge.dev/gen_abc123.pdf`;

const heroResponse = `{
  "id": "gen_abc123",
  "status": "completed",
  "url": "https://cdn.getdocuforge.dev/gen_abc123.pdf",
  "pages": 1,
  "generation_time_ms": 287
}`;

export function Hero() {
  return (
    <section className="relative overflow-hidden pt-32 pb-16 sm:pt-40 sm:pb-24">
      {/* Background glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-accent/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left: Copy */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border text-xs text-text-muted mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-green" />
              Now in public beta
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-text-primary tracking-tight leading-[1.1] mb-6">
              HTML in.{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent to-orange-400">
                Pixel-perfect PDFs
              </span>{' '}
              out.
            </h1>

            <p className="text-lg sm:text-xl text-text-muted leading-relaxed mb-8 max-w-lg">
              Generate invoices, reports, and certificates from HTML, React, or
              templates. One API call, milliseconds.
            </p>

            <div className="flex flex-wrap gap-3">
              <Button size="lg" href="https://app.getdocuforge.dev/sign-up">
                Start for Free
              </Button>
              <Button
                variant="secondary"
                size="lg"
                href="https://fred-7da601c6.mintlify.app"
              >
                Read the Docs
              </Button>
            </div>

            <p className="mt-4 text-xs text-text-dim">
              100 PDFs/month free. No credit card required.
            </p>
          </motion.div>

          {/* Right: Code preview */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="relative"
          >
            <div className="space-y-4">
              <CodeBlock code={heroCode} language="typescript" />
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: 0.8 }}
              >
                <CodeBlock code={heroResponse} language="json" />
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
