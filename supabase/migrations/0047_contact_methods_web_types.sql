-- 0047_contact_methods_web_types.sql
-- The contact_methods type CHECK was written for the iOS vocabulary
-- (whatsapp, linkedin, facebook, instagram, phone, link). The web My Links
-- picker also offers email, snapchat, x, telegram, website and custom, so
-- saving any of those failed the constraint and nothing was stored.
-- Widen the list to the union of both clients. Purely additive: every row
-- valid before stays valid.

alter table public.contact_methods
  drop constraint if exists contact_methods_type_check;

alter table public.contact_methods
  add constraint contact_methods_type_check
  check (type = any (array[
    -- iOS
    'whatsapp', 'linkedin', 'facebook', 'instagram', 'phone', 'link',
    -- web
    'email', 'snapchat', 'x', 'telegram', 'website', 'custom'
  ]::text[]));
