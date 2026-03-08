interface SectionWrapperProps {
  children: React.ReactNode;
  id?: string;
  className?: string;
}

export function SectionWrapper({ children, id, className = '' }: SectionWrapperProps) {
  return (
    <section id={id} className={`max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 ${className}`}>
      {children}
    </section>
  );
}
