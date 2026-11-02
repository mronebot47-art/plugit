import Link from 'next/link';
import { RoadDrawHero } from '@/components/motion/RoadDraw';

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-[var(--paper)] text-[var(--ink)] flex flex-col">

      {/* ── Nav ─────────────────────────────────────────────────── */}
      <header className="h-14 border-b border-[var(--line)] flex items-center px-6 md:px-16 gap-4 sticky top-0 bg-[var(--paper)] z-40">
        <span className="flex items-center gap-2"
          style={{ fontFamily: 'var(--font-display)', fontWeight: 800,
                   fontSize: 20, letterSpacing: '-0.03em',
                   fontVariationSettings: "'wdth' 100, 'opsz' 20" }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M13 2L4.5 13.5H11L10 22L19.5 10.5H13L13 2Z"
              fill="var(--volt)" stroke="var(--ink)" strokeWidth="1.5" strokeLinejoin="round"/>
          </svg>
          PlugIt
        </span>
        <div className="flex-1" />
        <Link href="/plan" className="btn-volt text-[14px] py-2 px-5">
          Campus Map
        </Link>
      </header>

      {/* ── Hero ────────────────────────────────────────────────── */}
      <section className="px-6 md:px-16 pt-20 pb-4 max-w-5xl">
        <p className="font-data text-[12px] text-[var(--muted)] mb-6 tracking-widest uppercase">
          In-Campus EV Infrastructure · Smart University & Tech Hub
        </p>
        <h1
          className="font-display font-black text-[44px] md:text-[72px] leading-none tracking-tight mb-6"
          style={{ fontVariationSettings: "'wdth' 100, 'opsz' 48" }}
        >
          {"Campus charging,"}<br />
          {"zero guesswork."}<br />
          <span className="text-[var(--muted)]"
            style={{ fontVariationSettings: "'wdth' 75, 'opsz' 48" }}>
            Real-time stalls for 2W & 4W.
          </span>
        </h1>
        <p className="text-[16px] md:text-[20px] text-[var(--muted)] mb-8 max-w-xl leading-relaxed">
          Navigate between academic blocks, student hostels, research labs, and sports arenas. Check live stall occupancy, reserved bays, and charge your EV on campus.
        </p>
        <Link href="/plan" className="btn-volt text-[16px]">
          Launch Campus Map
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="12" x2="19" y2="12"/>
            <polyline points="12 5 19 12 12 19"/>
          </svg>
        </Link>
      </section>

      {/* ── Signature Moment A: The Road Draws Itself ───────────── */}
      <RoadDrawHero />

      {/* ── Stats ───────────────────────────────────────────────── */}
      <section className="border-t border-[var(--line)] px-6 md:px-16 py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 max-w-4xl">
          <Stat num="8" unit="bays"
            label="Dedicated campus charging hubs across Academic, Hostel, and R&D zones"
            illustrative />
          <Stat num="100" unit="%"
            label="Solar-assisted clean microgrid power supply for student & faculty EVs"
            illustrative />
          <Stat num="120" unit="kW"
            label="Peak DC ultra-fast charging speed at the R&D Innovation Park canopy"
            illustrative />
        </div>
      </section>

      {/* ── How it works ────────────────────────────────────────── */}
      <section className="border-t border-[var(--line)] px-6 md:px-16 py-16">
        <h2 className="font-display font-bold text-[28px] tracking-tight mb-10"
          style={{ fontVariationSettings: "'wdth' 100, 'opsz' 28" }}>
          Why range anxiety happens
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-0 max-w-3xl">
          <Step n="01" title="No one knows if the charger is free."
            body="Real-time availability isn't published by most Indian operators.
                  PlugIt estimates it from time-of-day demand and community reports." />
          <Step n="02" title="The gap between stops is invisible."
            body="Route apps show the road. They don't tell you there's a 140 km
                  stretch with no DC charger. We do, before you leave." />
          <Step n="03" title="Plan B doesn't exist — until now."
            body="When a stop fails mid-trip, the app reroutes instantly to the
                  nearest working alternative. No panic, no manual searching." />
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────────── */}
      <section className="border-t border-[var(--line)] px-6 md:px-16 py-16 flex items-center gap-8 flex-wrap">
        <div>
          <h2 className="font-display font-bold text-[28px] tracking-tight mb-2"
            style={{ fontVariationSettings: "'wdth' 100, 'opsz' 28" }}>
            Ready to stop guessing?
          </h2>
          <p className="text-[var(--muted)] text-[16px]">
            Bengaluru to Chennai. Bengaluru to Hyderabad. Start there.
          </p>
        </div>
        <Link href="/plan" className="btn-volt">
          Plan a trip
        </Link>
      </section>

      {/* ── Footer ──────────────────────────────────────────────── */}
      <footer className="border-t border-[var(--line)] px-6 md:px-16 py-6 flex flex-wrap
        gap-4 items-center justify-between">
        <span className="font-data text-[12px] text-[var(--muted)]">PlugIt &copy; 2026</span>
        <p className="font-data text-[12px] text-[var(--muted)]">
          Data: Open Charge Map &middot; OpenStreetMap contributors &middot;
          Photon &middot; OSRM &middot; Carto &middot; Open-Meteo
        </p>
      </footer>
    </main>
  );
}

function Stat({
  num, unit, label, illustrative,
}: {
  num: string; unit: string; label: string; illustrative?: boolean;
}) {
  return (
    <div>
      <p className="font-data font-bold leading-none tabular-nums"
        style={{ fontSize: '72px' }}>
        {num}
        <span style={{ fontSize: '44px' }}>{unit}</span>
      </p>
      <p className="font-data text-[12px] text-[var(--muted)] mt-3 leading-snug">
        {label}
        {illustrative && (
          <span className="text-[var(--signal)]"> (illustrative)</span>
        )}
      </p>
    </div>
  );
}

function Step({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div className="border-t border-[var(--line)] py-8 pr-8">
      <p className="font-data text-[12px] text-[var(--volt)] bg-[var(--ink)] inline-block
        px-2 py-0.5 rounded-[2px] mb-3">
        {n}
      </p>
      <h3 className="font-display font-bold text-[20px] mb-2 tracking-tight"
        style={{ fontVariationSettings: "'wdth' 100, 'opsz' 20" }}>
        {title}
      </h3>
      <p className="text-[14px] text-[var(--muted)] leading-relaxed">{body}</p>
    </div>
  );
}
