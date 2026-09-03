'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import jsQR from 'jsqr';
import { theme } from '@/lib/theme';
import { decodeConnectPayload, connectErrorMessage } from '@/lib/connect';
import { recordQrScan } from '@/lib/data';
import ConnectResult from '@/components/connect/ConnectResult';
import { X } from 'lucide-react';

// Best-effort: resolve to coords if the browser cooperates within 5s, else
// resolve undefined. Never rejects — a denied prompt must not block the scan.
function getScanCoords(): Promise<{ lat: number; lng: number } | undefined> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(undefined);
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(undefined),
      { enableHighAccuracy: false, timeout: 5000, maximumAge: 60_000 },
    );
  });
}

export default function ScanPage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  // The camera sees the same code every frame — guard against re-firing the
  // RPC while the first call is still in flight.
  const busyRef = useRef(false);
  // Last QR string we already acted on: a permanently-failing code (non-W, or
  // an expired/self token) must not re-fire setError/the RPC every frame.
  const lastActedRef = useRef<string | null>(null);
  // Latest connectionId, readable from the visibility handler without adding
  // state to the effect's dep array.
  const connectionIdRef = useRef<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [connectionId, setConnectionId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const stop = () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };

    const tick = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(img.data, img.width, img.height);

      if (code && !busyRef.current) {
        if (code.data === lastActedRef.current) {
          rafRef.current = requestAnimationFrame(tick);
          return;
        }
        lastActedRef.current = code.data;
        const token = decodeConnectPayload(code.data);
        if (!token) {
          setError("That's not a W code.");
        } else {
          busyRef.current = true;
          setError(null);
          getScanCoords()
            .then((coords) => recordQrScan(token, coords?.lat, coords?.lng))
            .then((id) => {
              if (cancelled) return;
              stop();
              connectionIdRef.current = id;
              setConnectionId(id);
            })
            .catch((e) => {
              if (cancelled) return;
              setError(connectErrorMessage(e));
              busyRef.current = false;
              rafRef.current = requestAnimationFrame(tick);
            });
          return;
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    const start = () => {
      navigator.mediaDevices
        .getUserMedia({ video: { facingMode: 'environment' } })
        .then((stream) => {
          if (cancelled) {
            stream.getTracks().forEach((t) => t.stop());
            return;
          }
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            void videoRef.current.play();
          }
          rafRef.current = requestAnimationFrame(tick);
        })
        .catch(() => {
          if (!cancelled) setError('Camera access is off. Allow camera in your browser settings, then reload.');
        });
    };

    start();

    // Without this the camera indicator stays lit when the tab is hidden; and
    // when the tab is shown again the stopped camera must be restarted.
    const onVisibility = () => {
      if (document.hidden) {
        stop();
      } else if (!connectionIdRef.current && !streamRef.current) {
        lastActedRef.current = null;
        busyRef.current = false;
        start();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibility);
      stop();
    };
  }, []);

  return (
    <div style={{ minHeight: '100dvh', backgroundColor: theme.bg, color: theme.text, fontFamily: 'Montserrat, system-ui, sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px' }}>
        <h1 style={{ fontSize: '16px', fontWeight: 700 }}>Scan a code</h1>
        <button
          onClick={() => router.back()}
          aria-label="Close scanner"
          style={{ background: 'none', border: 'none', color: theme.text, cursor: 'pointer', padding: 0 }}
        >
          <X style={{ width: '22px', height: '22px' }} />
        </button>
      </div>

      {connectionId ? (
        <ConnectResult connectionId={connectionId} />
      ) : (
        <>
          <div style={{ position: 'relative', margin: '0 20px', borderRadius: '16px', overflow: 'hidden', backgroundColor: theme.surface2, aspectRatio: '1 / 1' }}>
            <video ref={videoRef} playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            <canvas ref={canvasRef} style={{ display: 'none' }} />
          </div>
          <p style={{ color: theme.muted, fontSize: '13px', textAlign: 'center', padding: '16px 24px' }}>
            Point at the other person&apos;s code.
          </p>
          {error && (
            <p style={{ color: theme.accent2, fontSize: '13px', textAlign: 'center', padding: '0 24px 16px' }}>
              {error}
            </p>
          )}
        </>
      )}
    </div>
  );
}
