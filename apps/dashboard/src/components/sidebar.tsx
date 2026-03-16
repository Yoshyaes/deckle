'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UserButton } from '@clerk/nextjs';
import {
  LayoutDashboard,
  FileText,
  LayoutTemplate,
  Key,
  Settings,
  Play,
  BarChart3,
  Shield,
  Users,
  BookOpen,
} from 'lucide-react';

const navItems = [
  { href: '/', label: 'Overview', icon: LayoutDashboard },
  { href: '/generations', label: 'Generations', icon: FileText },
  { href: '/templates', label: 'Templates', icon: LayoutTemplate },
  { href: '/playground', label: 'Playground', icon: Play },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/keys', label: 'API Keys', icon: Key },
  { href: '/settings', label: 'Settings', icon: Settings },
];

const adminNavItems = [
  { href: '/admin', label: 'Admin Overview', icon: Shield },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/generations', label: 'All Generations', icon: FileText },
];

interface SidebarProps {
  usageCount?: number;
  usageLimit?: number;
  isAdmin?: boolean;
}

export function Sidebar({ usageCount = 0, usageLimit = 1000, isAdmin = false }: SidebarProps) {
  const pathname = usePathname();
  const pct = usageLimit > 0 ? Math.min(100, (usageCount / usageLimit) * 100) : 0;

  return (
    <aside className="w-[220px] border-r border-border-subtle flex flex-col h-screen sticky top-0">
      {/* Logo */}
      <div className="p-4 flex items-center gap-2">
        <div className="w-7 h-7 rounded-md bg-gradient-to-br from-accent to-orange-600 flex items-center justify-center text-xs font-extrabold text-white">
          D
        </div>
        <span className="text-sm font-bold text-text-primary tracking-tight">
          DocuForge
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-2">
        {navItems.map((item) => {
          const isActive =
            item.href === '/'
              ? pathname === '/'
              : pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium mb-0.5 transition-colors ${
                isActive
                  ? 'bg-surface-hover text-text-primary'
                  : 'text-text-muted hover:text-text-primary hover:bg-surface-hover/50'
              }`}
            >
              <Icon size={16} className="opacity-70" />
              {item.label}
            </Link>
          );
        })}
        <a
          href="https://fred-7da601c6.mintlify.app"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium mb-0.5 transition-colors text-text-muted hover:text-text-primary hover:bg-surface-hover/50"
        >
          <BookOpen size={16} className="opacity-70" />
          Docs
        </a>
      </nav>

      {/* Admin */}
      {isAdmin && (
        <div className="px-3 pb-2">
          <div className="border-t border-border-subtle my-2" />
          <div className="text-[10px] uppercase tracking-wider text-text-dim px-3 mb-1">Admin</div>
          {adminNavItems.map((item) => {
            const isActive =
              item.href === '/admin'
                ? pathname === '/admin'
                : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium mb-0.5 transition-colors ${
                  isActive
                    ? 'bg-surface-hover text-text-primary'
                    : 'text-text-muted hover:text-text-primary hover:bg-surface-hover/50'
                }`}
              >
                <Icon size={16} className="opacity-70" />
                {item.label}
              </Link>
            );
          })}
        </div>
      )}

      {/* Usage */}
      <div className="mx-4 mb-4 border-t border-border-subtle pt-4">
        <div className="text-[11px] text-text-dim mb-1">Usage This Month</div>
        <div className="text-lg font-bold text-text-primary">
          {usageCount.toLocaleString()}
        </div>
        <div className="text-[11px] text-text-dim">
          of {usageLimit.toLocaleString()} PDFs
        </div>
        <div className="mt-2 h-1 rounded-full bg-border overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-accent to-yellow-400"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* User */}
      <div className="p-4 border-t border-border-subtle">
        <DevOrClerkUser />
      </div>
    </aside>
  );
}

function DevOrClerkUser() {
  if ((process.env.NEXT_PUBLIC_DEV_BYPASS === 'true' || process.env.DOCUFORGE_DEV_BYPASS === 'true') && process.env.NODE_ENV !== 'production') {
    return (
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-full bg-accent/20 flex items-center justify-center text-xs font-bold text-accent">
          D
        </div>
        <span className="text-xs text-text-muted">dev@docuforge.local</span>
      </div>
    );
  }

  return <UserButton afterSignOutUrl="/" />;
}
