'use strict';

/**
 * Supabase client initialisation
 * Powered by PhinTech Solutions, Kenya
 *
 * Uses PKCE flow — no tokens in URL hash, no CSP inline-script violations.
 * PKCE exchanges a code for a session server-side via the Supabase Auth server.
 */
(function () {
  fetch('/api/config')
    .then(function (r) { return r.json(); })
    .then(function (d) {
      if (!d.supabase || !d.supabase.url) {
        console.warn('[Gamics] Supabase not configured — running in offline mode.');
        return;
      }

      window._sb = supabase.createClient(d.supabase.url, d.supabase.anon_key, {
        auth: {
          autoRefreshToken:   true,
          persistSession:     true,
          detectSessionInUrl: true,
          flowType:           'pkce',     // Secure — no hash tokens in URL
        },
      });

      document.dispatchEvent(new Event('supabase-ready'));
    })
    .catch(function (e) {
      console.warn('[Gamics] Could not load Supabase config:', e.message);
    });
})();
