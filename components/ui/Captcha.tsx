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

// Callers use this to decide whether a captchaToken is required before
// submitting — false (no site key configured) means skip the check entirely,
// so the app keeps working before Turnstile is set up.
export const captchaEnabled = Boolean(SITE_KEY);

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
