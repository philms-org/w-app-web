// Standalone assertions — this repo has no test runner.
// Run: node scripts/verify-contact-links.mjs
import { CONTACT_TYPES, contactTypeMeta, contactLink, DEFAULT_SLOTS } from '../lib/contact-methods.ts';

const fail = (m) => { console.error('FAIL:', m); process.exitCode = 1; };
const eq = (a, b, m) => { if (a !== b) fail(`${m}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); };

eq(CONTACT_TYPES.length, 10, 'CONTACT_TYPES length');
eq(CONTACT_TYPES[0].type, 'phone', 'first type is phone');
eq(DEFAULT_SLOTS.length, 6, 'DEFAULT_SLOTS length');

// known link templates
eq(contactLink('phone', ' +1 555 111 '), 'tel:+1555111', 'phone -> tel: (spaces stripped)');
eq(contactLink('email', ' a@b.com '), 'mailto:a@b.com', 'email -> mailto:');
eq(contactLink('instagram', '@handle'), 'https://instagram.com/handle', 'instagram strips @');
eq(contactLink('instagram', 'handle'), 'https://instagram.com/handle', 'instagram bare handle');
eq(contactLink('whatsapp', '+1 555 111'), 'https://wa.me/1555111', 'whatsapp digits only, no +');
eq(contactLink('linkedin', 'in/jane'), 'https://linkedin.com/in/jane', 'linkedin path');
eq(contactLink('x', '@jane'), 'https://x.com/jane', 'x strips @');
eq(contactLink('telegram', 'jane'), 'https://t.me/jane', 'telegram');
eq(contactLink('website', 'example.com'), 'https://example.com', 'website adds https://');
eq(contactLink('website', 'https://example.com'), 'https://example.com', 'website keeps existing scheme');

// empty / custom / unknown
eq(contactLink('phone', ''), null, 'empty value -> null');
eq(contactLink('phone', '   '), null, 'whitespace value -> null');
eq(contactLink('custom', 'anything'), null, 'custom -> no link');
eq(contactLink('mastodon', 'x'), null, 'unknown type -> no link');
eq(contactTypeMeta('mastodon').label, 'mastodon', 'unknown type label falls back to type');

if (!process.exitCode) console.log('OK: contact link helpers verified');
