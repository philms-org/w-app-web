import { ImageResponse } from 'next/og';

// Branded 1200x630 card used for link unfurls on /, and as the default OG
// image for child routes that don't define their own. Rendered at build with
// next/og's default sans — no external font fetch, so it can't fail the build.
export const runtime = 'nodejs';
export const alt = 'The W App — connect with people at your location';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #0d0d0f 0%, #22262b 100%)',
          color: '#f5f5f7',
          fontFamily: 'sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 180,
            height: 180,
            borderRadius: 40,
            background: '#22c3c9',
            color: '#0d0d0f',
            fontSize: 120,
            fontWeight: 800,
            marginBottom: 44,
          }}
        >
          W
        </div>
        <div style={{ fontSize: 72, fontWeight: 800, letterSpacing: -1 }}>The W App</div>
        <div style={{ fontSize: 34, color: 'rgba(245,245,247,0.7)', marginTop: 16 }}>
          Connect with people at your location
        </div>
      </div>
    ),
    size,
  );
}
