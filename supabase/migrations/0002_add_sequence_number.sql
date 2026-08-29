-- Add sequence_number column to qr_links table for fixed ordering of QR codes.
-- Run this in the Supabase Dashboard -> SQL Editor.

alter table public.qr_links add column if not exists sequence_number integer default 0;

-- Backfill existing rows with sequential numbers ordered by created_at
update public.qr_links
set sequence_number = sub.new_seq
from (
  select id, row_number() over (order by created_at asc) - 1 as new_seq
  from public.qr_links
) as sub
where public.qr_links.id = sub.id;

-- Ensure unique constraint on sequence_number within the table
alter table public.qr_links add constraint unique_sequence_number unique (sequence_number);