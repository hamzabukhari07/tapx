-- Creates the qr_links table used by the Dynamic QR admin app.
-- Run this in the Supabase Dashboard -> SQL Editor.

create table if not exists public.qr_links (
  id text primary key,
  destination_url text not null default '',
  business_name text not null default 'Unassigned QR Code',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- RLS enabled with NO public policies: the table is not reachable via the
-- Data API using the anon/publishable key. Server-side code (Vercel
-- functions / local dev server) accesses it exclusively through the
-- service_role key, which bypasses RLS.
alter table public.qr_links enable row level security;

-- Seed existing QR codes (idempotent)
insert into public.qr_links (id, destination_url, business_name, created_at, updated_at) values
  ('qr_de7ffa6fd308', '', 'Unassigned QR Code', '2026-08-24T13:29:32.855Z', '2026-08-24T13:29:32.855Z'),
  ('qr_6863f3a25c20', 'https://hamzabukhari.vercel.app/', 'Unassigned QR Code', '2026-08-24T13:29:39.435Z', '2026-08-24T13:30:01.433Z')
on conflict (id) do nothing;
