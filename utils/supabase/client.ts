import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "https://jqbjelohcqopvmifsbyz.supabase.co";
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_tTfUGIDbO0gxhFDH2eRMiQ_7r_h99pi";

export const createClient = () =>
  createBrowserClient(
    supabaseUrl,
    supabaseKey,
  );
