interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
}

export function Card({ children, className = '', hover = false }: CardProps) {
  return (
    <div
      className={`bg-surface border border-border rounded-[14px] ${
        hover ? 'transition-colors hover:border-accent/30' : ''
      } ${className}`}
    >
      {children}
    </div>
  );
}
