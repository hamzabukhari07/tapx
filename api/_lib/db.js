import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

let db = null;

function getDb() {
  if (db) return db;
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables in your deployment.');
  }
  db = createClient(url, key, { auth: { persistSession: false } });
  return db;
}

function mapRow(row, fallbackIndex) {
  const seq = (row.sequence_number !== null && row.sequence_number !== undefined)
    ? row.sequence_number
    : (fallbackIndex !== undefined ? fallbackIndex : 0);
  return {
    id: row.id,
    destinationUrl: row.destination_url || '',
    businessName: row.business_name || '',
    sequenceNumber: Number(seq),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export async function listQrLinks() {
  const { data, error } = await getDb()
    .from('qr_links')
    .select('*')
    .order('sequence_number', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true });
  if (error) {
    const { data: fallbackData, error: fallbackError } = await getDb()
      .from('qr_links')
      .select('*')
      .order('created_at', { ascending: true });
    if (fallbackError) throw fallbackError;
    return fallbackData.map((row, idx) => mapRow(row, idx));
  }
  return data.map((row, idx) => mapRow(row, idx));
}

export async function getNextSequenceNumber() {
  const { data, error } = await getDb()
    .from('qr_links')
    .select('sequence_number')
    .not('sequence_number', 'is', null)
    .order('sequence_number', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data || data.sequence_number === null || data.sequence_number === undefined) return 0;
  return Number(data.sequence_number) + 1;
}

export async function getQrLink(id) {
  const { data, error } = await getDb().from('qr_links').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? mapRow(data) : null;
}

export async function insertQrLink({ id, destinationUrl = '', businessName = 'Unassigned QR Code', sequenceNumber = undefined }) {
  const seq = sequenceNumber !== undefined ? sequenceNumber : await getNextSequenceNumber();
  const now = new Date().toISOString();
  const { error } = await getDb().from('qr_links').insert({
    id,
    destination_url: destinationUrl || '',
    business_name: businessName || 'Unassigned QR Code',
    sequence_number: seq,
    created_at: now,
    updated_at: now
  });
  if (error) throw error;
  return seq;
}

export async function bulkInsertQrLinks(count) {
  const now = new Date().toISOString();
  const rows = [];
  const baseSeq = await getNextSequenceNumber();
  for (let i = 0; i < count; i++) {
    const id = 'qr_' + crypto.randomBytes(6).toString('hex');
    rows.push({
      id,
      destination_url: '',
      business_name: 'Unassigned QR Code',
      sequence_number: baseSeq + i,
      created_at: now,
      updated_at: now
    });
  }
  const { error } = await getDb().from('qr_links').insert(rows);
  if (error) throw error;
  return rows.map((r, i) => mapRow(r, baseSeq + i));
}

export async function updateQrLink(id, { destinationUrl, businessName }) {
  const patch = { updated_at: new Date().toISOString() };
  if (destinationUrl !== undefined) patch.destination_url = destinationUrl;
  if (businessName !== undefined) patch.business_name = businessName;
  const { error } = await getDb().from('qr_links').update(patch).eq('id', id);
  if (error) throw error;
}

export async function upsertQrLink(id, { destinationUrl, businessName }) {
  const existing = await getQrLink(id);
  if (existing) {
    await updateQrLink(id, { destinationUrl, businessName });
  } else {
    await insertQrLink({ id, destinationUrl, businessName });
  }
}

export async function deleteQrLink(id) {
  const { error } = await getDb().from('qr_links').delete().eq('id', id);
  if (error) throw error;
}