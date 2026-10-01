const SUPABASE_URL = 'https://cfwsxpdbmefnnxrunoue.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_ByXgX6dPutVaTbluUs2fwg_p1A6Gc8I';

// The publishable key is safe for browser use. Lobby state is synchronized with
// Supabase Realtime Presence/Broadcast, so no database table is required.
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
