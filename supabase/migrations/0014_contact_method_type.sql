-- 0014_contact_method_type.sql
-- Which contact method (whatsapp/instagram/linkedin/phone/etc.) a scanner
-- actually chose after scanning someone's code. connections rows are
-- currently only ever written by the iOS app (the web app's QR-scan flow
-- is still a stub — see components/home/ConnectSheet.tsx).

alter table connections add column if not exists contact_method_type text;

-- The scanner may update their own connection row's contact_method_type
-- after choosing a method. No existing update policy on connections.
drop policy if exists connections_update_own_contact_choice on connections;
create policy connections_update_own_contact_choice on connections for update to authenticated
  using (scanner_id = auth.uid())
  with check (scanner_id = auth.uid());
