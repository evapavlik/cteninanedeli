-- Fix: Apply missing GRANT UPDATE and SELECT for upsert support
-- Migration 20260301130000 failed because the UPDATE policy already existed,
-- so these GRANTs were never applied.
GRANT UPDATE ON push_subscriptions TO anon;
GRANT SELECT ON push_subscriptions TO anon;
