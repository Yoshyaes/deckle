import { Hero } from '@/components/sections/hero';
import { SocialProof } from '@/components/sections/social-proof';
import { HowItWorks } from '@/components/sections/how-it-works';
import { FeaturesGrid } from '@/components/sections/features-grid';
import { CodeShowcase } from '@/components/sections/code-showcase';
import { SdkGrid } from '@/components/sections/sdk-grid';
import { Comparison } from '@/components/sections/comparison';
import { Testimonials } from '@/components/sections/testimonials';
import { BlogPreview } from '@/components/sections/blog-preview';
import { PricingPreview } from '@/components/sections/pricing-preview';
import { FinalCta } from '@/components/sections/final-cta';

export default function Home() {
  return (
    <>
      <Hero />
      <SocialProof />
      <HowItWorks />
      <FeaturesGrid />
      <CodeShowcase />
      <SdkGrid />
      <Comparison />
      <Testimonials />
      <BlogPreview />
      <PricingPreview />
      <FinalCta />
    </>
  );
}
