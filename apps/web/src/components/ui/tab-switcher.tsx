'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';

interface Tab {
  label: string;
  content: React.ReactNode;
}

interface TabSwitcherProps {
  tabs: Tab[];
}

export function TabSwitcher({ tabs }: TabSwitcherProps) {
  const [active, setActive] = useState(0);

  return (
    <div>
      <div className="flex gap-1 border-b border-border mb-6">
        {tabs.map((tab, i) => (
          <button
            key={tab.label}
            onClick={() => setActive(i)}
            className={`relative px-4 py-2.5 text-sm font-medium transition-colors ${
              active === i ? 'text-accent' : 'text-text-muted hover:text-text-primary'
            }`}
          >
            {tab.label}
            {active === i && (
              <motion.div
                layoutId="tab-underline"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent"
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              />
            )}
          </button>
        ))}
      </div>
      <motion.div
        key={active}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
      >
        {tabs[active].content}
      </motion.div>
    </div>
  );
}
