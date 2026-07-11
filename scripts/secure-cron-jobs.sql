-- Zabezpečení cron jobů: edge funkce warm-cache a send-monday-notifications
-- nově vyžadují hlavičku x-admin-secret (viz supabase/functions/_shared/auth.ts).
--
-- POSTUP (jednorázově, v Supabase dashboardu → SQL Editor):
--   1. Nastav secret ADMIN_SECRET v Edge Functions → Secrets (stejnou hodnotu
--      použiješ níže).
--   2. V tomto skriptu nahraď VLOZ_ADMIN_SECRET skutečnou hodnotou (2×).
--   3. Spusť celý skript. Odstraní staré cron joby a založí je znovu
--      se správnou hlavičkou.
--
-- Hodnota secretu zůstane uložená jen v cron.job (viditelná pouze s přístupem
-- do databáze) — do gitu nepatří, proto je tu placeholder.

-- 1) Odstranit stávající joby volající tyto funkce (ať se nedublují)
DO $$
DECLARE
  j record;
BEGIN
  FOR j IN
    SELECT jobid FROM cron.job
    WHERE command LIKE '%functions/v1/warm-cache%'
       OR command LIKE '%functions/v1/send-monday-notifications%'
  LOOP
    PERFORM cron.unschedule(j.jobid);
  END LOOP;
END $$;

-- 2) warm-cache — denně ve 4:00 UTC
SELECT cron.schedule(
  'warm-cache-daily',
  '0 4 * * *',
  $cmd$
  SELECT net.http_post(
    url := 'https://uedluysdwvcdrhjiotjc.supabase.co/functions/v1/warm-cache',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-admin-secret', 'VLOZ_ADMIN_SECRET'
    ),
    body := '{}'::jsonb
  );
  $cmd$
);

-- 3) send-monday-notifications — pondělí 6:00 UTC
SELECT cron.schedule(
  'send-monday-notifications',
  '0 6 * * 1',
  $cmd$
  SELECT net.http_post(
    url := 'https://uedluysdwvcdrhjiotjc.supabase.co/functions/v1/send-monday-notifications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-admin-secret', 'VLOZ_ADMIN_SECRET'
    ),
    body := '{}'::jsonb
  );
  $cmd$
);

-- 4) Kontrola: oba joby existují a mají hlavičku x-admin-secret
SELECT jobid, jobname, schedule,
       command LIKE '%x-admin-secret%' AS ma_secret
FROM cron.job
WHERE jobname IN ('warm-cache-daily', 'send-monday-notifications');
