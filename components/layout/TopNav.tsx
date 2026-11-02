'use client';

import Link from 'next/link';
import { ThemeToggle } from '@/components/ui/theme-toggle';

interface TopNavProps {
  onMenuToggle: () => void;
}

export function TopNav({ onMenuToggle }: TopNavProps) {
  return (
    <header className="h-14 border-b border-[var(--line)] flex items-center px-4 gap-4 bg-[var(--paper)] z-40 sticky top-0">
      {/* Hamburger – mobile only */}
      <button
        onClick={onMenuToggle}
        aria-label="Toggle navigation menu"
        style={{ minWidth: 44, minHeight: 44 }}
        className="md:hidden flex items-center justify-center text-[var(--ink)]"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <line x1="3" y1="6"  x2="21" y2="6"/>
          <line x1="3" y1="12" x2="21" y2="12"/>
          <line x1="3" y1="18" x2="21" y2="18"/>
        </svg>
      </button>

      {/* Wordmark */}
      <Link href="/"
        className="flex items-center gap-2 no-underline text-[var(--ink)]"
        style={{ fontFamily: 'var(--font-display)', fontWeight: 800,
                 fontSize: 20, letterSpacing: '-0.03em',
                 fontVariationSettings: "'wdth' 100, 'opsz' 20" }}>
        {/* Lightning bolt */}
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path d="M13 2L4.5 13.5H11L10 22L19.5 10.5H13L13 2Z"
            fill="var(--volt)" stroke="var(--ink)" strokeWidth="1.5" strokeLinejoin="round"/>
        </svg>
        PlugIt
      </Link>

      <div className="flex-1" />

      {/* Demo badge */}
      {process.env.NEXT_PUBLIC_DEMO_MODE === 'true' && (
        <span className="font-data text-[12px] bg-[var(--volt)] text-[var(--ink)]
          px-2 py-0.5 rounded-full tracking-wider">
          DEMO
        </span>
      )}

      <ThemeToggle />
    </header>
  );
}
