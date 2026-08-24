import { createClient } from '@supabase/supabase-js';

let db = null;

function getDb() {
  if (db) return db;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.');
  }
  db = createClient(url, key, { auth: { persistSession: false } });
  return db;
}

function mapRow(row) {
  return {
    id: row.id,
    destinationUrl: row.destination_url,
    businessName: row.business_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export async function listQrLinks() {
  const { data, error } = await getDb()
    .from('qr_links')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data.map(mapRow);
}

export async function getQrLink(id) {
  const { data, error } = await getDb().from('qr_links').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? mapRow(data) : null;
}

export async function insertQrLink({ id, destinationUrl = '', businessName = 'Unassigned QR Code' }) {
  const now = new Date().toISOString();
  const { error } = await getDb().from('qr_links').insert({
    id,
    destination_url: destinationUrl || '',
    business_name: businessName || 'Unassigned QR Code',
    created_at: now,
    updated_at: now
  });
  if (error) throw error;
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
