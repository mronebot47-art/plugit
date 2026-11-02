import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'PlugIt Shared EV Trip Route';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return new ImageResponse(
    (
      <div
        style={{
          background: '#0E0E0B',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '72px 80px',
          color: '#F2EEE6',
          fontFamily: 'sans-serif',
          border: '12px solid #2B2A24',
        }}
      >
        {/* Top Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 9999,
                background: '#C6FF3D',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <div
                style={{
                  width: 0,
                  height: 0,
                  borderLeft: '12px solid transparent',
                  borderRight: '12px solid transparent',
                  borderBottom: '20px solid #14130F',
                }}
              />
            </div>
            <span
              style={{
                fontSize: 36,
                fontWeight: 900,
                letterSpacing: '-0.04em',
                color: '#F2EEE6',
              }}
            >
              PlugIt
            </span>
          </div>

          <div
            style={{
              fontSize: 18,
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              color: '#8A8577',
              fontFamily: 'monospace',
            }}
          >
            TRIP // {id}
          </div>
        </div>

        {/* Center Route Hero */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div
            style={{
              fontSize: 22,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: '#C6FF3D',
              fontFamily: 'monospace',
            }}
          >
            Bengaluru &rarr; Chennai Corridor
          </div>

          <div
            style={{
              fontSize: 68,
              fontWeight: 900,
              lineHeight: 1.05,
              letterSpacing: '-0.03em',
            }}
          >
            345 km &middot; 2 Charging Stops
          </div>

          <div style={{ fontSize: 26, color: '#8A8577' }}>
            Tata Nexon EV LR &middot; 5h 30m total &middot; Reachable & Verified
          </div>
        </div>

        {/* Bottom Metrics Bar */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderTop: '2px solid #2B2A24',
            paddingTop: 32,
          }}
        >
          <div style={{ display: 'flex', gap: 48 }}>
            <div>
              <div style={{ fontSize: 16, color: '#8A8577', fontFamily: 'monospace' }}>
                CALM INDEX
              </div>
              <div style={{ fontSize: 36, fontWeight: 800, color: '#1F8A5B' }}>82 / 100</div>
            </div>
            <div>
              <div style={{ fontSize: 16, color: '#8A8577', fontFamily: 'monospace' }}>
                CHARGING TIME
              </div>
              <div style={{ fontSize: 36, fontWeight: 800 }}>52 min</div>
            </div>
            <div>
              <div style={{ fontSize: 16, color: '#8A8577', fontFamily: 'monospace' }}>
                EST. ENERGY
              </div>
              <div style={{ fontSize: 36, fontWeight: 800 }}>48.3 kWh</div>
            </div>
          </div>

          <div
            style={{
              background: '#C6FF3D',
              color: '#14130F',
              fontSize: 20,
              fontWeight: 800,
              padding: '14px 28px',
              borderRadius: 4,
            }}
          >
            View Trip on PlugIt
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
