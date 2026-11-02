'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { usePlannerStore } from '@/lib/store/planner';

const NAV = [
  { href: '/', label: 'Overview', Icon: HomeIcon },
  { href: '/plan', label: 'Campus Map & Route', Icon: RouteIcon },
  { href: '/stations', label: 'Campus Stalls', Icon: ZapIcon },
] as const;

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { isDemoMode, setDemoMode } = usePlannerStore();

  return (
    <>
      {open && (
        <div
          aria-hidden
          className="fixed inset-0 bg-[var(--road)] opacity-60 z-30 md:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={[
          'fixed top-14 left-0 bottom-0 w-56 bg-[var(--paper)] border-r border-[var(--line)]',
          'z-30 flex flex-col transition-transform duration-200',
          'md:static md:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
      >
        <nav className="p-3 flex flex-col gap-1 flex-1" aria-label="Main navigation">
          {NAV.map(({ href, label, Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                onClick={onClose}
                style={{ minHeight: 44 }}
                className={[
                  'flex items-center gap-3 px-3 py-2.5 text-[14px] font-medium',
                  'rounded-[2px] transition-colors',
                  active
                    ? 'bg-[var(--volt)] text-[var(--ink)]'
                    : 'text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--line)]',
                ].join(' ')}
                aria-current={active ? 'page' : undefined}
              >
                <Icon />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Demo mode switch at bottom */}
        <div className="p-3">
          <div className="border border-[var(--line)] rounded-[2px] p-3 flex flex-col gap-2">
            <div className="flex items-center justify-between" suppressHydrationWarning>
              <span className="font-data text-[12px] font-bold text-[var(--ink)]">Demo Mode</span>
              <button
                type="button"
                onClick={() => setDemoMode(!isDemoMode)}
                aria-label="Toggle Demo Mode"
                suppressHydrationWarning
                className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors cursor-pointer ${
                  isDemoMode ? 'bg-[var(--volt)]' : 'bg-[var(--line)]'
                }`}
              >
                <div
                  suppressHydrationWarning
                  className={`bg-[var(--ink)] w-4 h-4 rounded-full shadow-md transform transition-transform ${
                    isDemoMode ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
            <p className="text-[11px] text-[var(--muted)] leading-tight" suppressHydrationWarning>
              {isDemoMode
                ? 'Active: Sends X-PlugIt-Demo: 1 header.'
                : 'Offline fallback available when offline.'}
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}

function HomeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  );
}

function RouteIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="6" cy="19" r="3"/><circle cx="18" cy="5" r="3"/>
      <path d="M6 16V7a2 2 0 0 1 2-2h3"/><path d="M18 8v9a2 2 0 0 1-2 2h-3"/>
    </svg>
  );
}

function ZapIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
    </svg>
  );
}
