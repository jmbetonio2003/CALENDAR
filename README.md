# Scheduled notifications (deployment still required)

The browser app does not send scheduled push notifications by itself. Production push requires:
1. A VAPID key pair.
2. A Supabase Edge Function using the Web Push protocol.
3. Secrets stored with `supabase secrets set` (never in browser code).
4. A scheduled invocation (Supabase Cron or an external scheduler).
5. iOS 16.4+ and later: user must install the site to the Home Screen and grant notification permission.

This folder is reserved for the server-side notification function. Do not put private VAPID or Supabase service-role keys in `config.js`.
