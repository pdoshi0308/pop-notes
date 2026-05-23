import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: 'linear-gradient(135deg, #E11D48, #F43F5E)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontWeight: 800,
          fontSize: 120,
          fontFamily: 'system-ui, sans-serif',
          letterSpacing: -4,
        }}
      >
        P
      </div>
    ),
    { ...size }
  );
}
