'use client';

// Cloudflare Turnstile widget, wrapping @marsidev/react-turnstile with this
// app's site key. Requires NEXT_PUBLIC_TURNSTILE_SITE_KEY — see .env.example.
// Renders nothing (and callers get no token) if the key isn't set, so local
// dev without a key fails open to "no captcha" rather than a broken widget.

import { forwardRef } from 'react';
import { Turnstile, type TurnstileInstance, type WidgetSize } from '@marsidev/react-turnstile';

interface CaptchaProps {
  onVerify: (token: string) => void;
  onExpire?: () => void;
  size?: WidgetSize;
}

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

// Turnstile only works on domains registered in the Cloudflare dashboard.
// Preview deployments use dynamic Vercel hostnames that can't be pre-registered,
// so CAPTCHA is only active on the production deployment.
const isProduction = process.env.NEXT_PUBLIC_VERCEL_ENV === 'production';

// Callers use this to decide whether a captchaToken is required before
// submitting — false means skip the check entirely (no key, or non-production).
export const captchaEnabled = Boolean(SITE_KEY) && isProduction;

const Captcha = forwardRef<TurnstileInstance | undefined, CaptchaProps>(
  ({ onVerify, onExpire, size = 'normal' }, ref) => {
    if (!SITE_KEY) return null;

    return (
      <Turnstile
        ref={ref}
        siteKey={SITE_KEY}
        options={{ size, theme: 'auto' }}
        onSuccess={onVerify}
        onExpire={onExpire}
      />
    );
  }
);

Captcha.displayName = 'Captcha';

export default Captcha;
