-- Fix: Grant table-level permissions to anon role for push_subscriptions
-- RLS policies alone are not sufficient; explicit GRANT is required in Supabase
-- Error 42501 (insufficient_privilege) was returned despite correct RLS policies

GRANT INSERT ON push_subscriptions TO anon;
GRANT DELETE ON push_subscriptions TO anon;
