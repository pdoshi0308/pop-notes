import { ImageResponse } from 'next/og';
import { BRAND } from '@/lib/brand';

export const alt = `${BRAND.name} — ${BRAND.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: 'linear-gradient(135deg, #E11D48 0%, #F43F5E 100%)',
          color: 'white',
          fontFamily: 'system-ui, sans-serif',
          padding: 80,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div
            style={{
              width: 56,
              height: 56,
              background: 'rgba(255,255,255,0.18)',
              borderRadius: 14,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: 36,
              letterSpacing: -1,
            }}
          >
            P
          </div>
          <div style={{ fontSize: 36, fontWeight: 800, letterSpacing: -1 }}>{BRAND.name}</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div
            style={{
              fontSize: 84,
              fontWeight: 800,
              letterSpacing: -2,
              lineHeight: 1.05,
              maxWidth: 960,
            }}
          >
            Get every client&apos;s details right the first time.
          </div>
          <div style={{ fontSize: 30, opacity: 0.92, maxWidth: 880 }}>
            {BRAND.tagline}
          </div>
        </div>

        <div style={{ fontSize: 24, opacity: 0.85 }}>{BRAND.domain}</div>
      </div>
    ),
    { ...size }
  );
}
