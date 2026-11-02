'use client';

import { useState } from 'react';
import { TopNav } from './TopNav';
import { Sidebar } from './Sidebar';
import { usePlannerStore } from '@/lib/store/planner';

export function Shell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { isBackendUnreachable } = usePlannerStore();

  return (
    <div className="min-h-screen bg-[var(--paper)] text-[var(--ink)] flex flex-col">
      {/* Fixed top banner when backend is unreachable */}
      {isBackendUnreachable && (
        <div className="bg-[var(--signal)] text-white text-[12px] font-data py-1.5 px-4 text-center font-bold sticky top-0 z-50 tracking-wide">
          Backend unreachable. Showing saved sample data.
        </div>
      )}

      <TopNav onMenuToggle={() => setSidebarOpen((o) => !o)} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className="flex-1 min-w-0 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
