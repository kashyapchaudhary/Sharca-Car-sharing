window.SHARCA_SUPABASE_CONFIG = {
    // Replace these with your Supabase project values.
    url: "https://YOUR-PROJECT-REF.supabase.co",
    anonKey: "YOUR_SUPABASE_ANON_KEY"
};

window.getSupabaseClient = function getSupabaseClient() {
    const hasLibrary = window.supabase && typeof window.supabase.createClient === "function";
    if (!hasLibrary) {
        return null;
    }

    const config = window.SHARCA_SUPABASE_CONFIG || {};
    if (!config.url || !config.anonKey || config.url.includes("YOUR-PROJECT-REF")) {
        return null;
    }

    return window.supabase.createClient(config.url, config.anonKey);
};
