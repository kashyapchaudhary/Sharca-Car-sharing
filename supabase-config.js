const SUPABASE_URL = 'https://phgtnbbwrbwmcnryilrw.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_nTzs6DRD42MGiFrTdDFsuA_IFE5VI9q';

let supabaseInstance = null;

window.getSupabaseClient = function getSupabaseClient() {
    if (!supabaseInstance) {
        if (typeof window.supabase === 'undefined') {
            console.error("Supabase SDK is not loaded. Ensure <script src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'></script> is included in the HTML.");
            return null;
        }
        
        supabaseInstance = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log("Connected to Live Supabase Backend");
    }
    return supabaseInstance;
};
