import { Button } from '@/components/ui/button';
import { ScrollReveal } from '@/components/ui/scroll-reveal';

export function FinalCta() {
  return (
    <section className="relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-accent/5 to-transparent pointer-events-none" />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-24 sm:py-32 relative text-center">
        <ScrollReveal>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-text-primary tracking-tight mb-4">
            Ready to build?
          </h2>
          <p className="text-lg text-text-muted mb-8 max-w-lg mx-auto">
            Get your API key and generate your first PDF in under 30 seconds.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
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
        </ScrollReveal>
      </div>
    </section>
  );
}
