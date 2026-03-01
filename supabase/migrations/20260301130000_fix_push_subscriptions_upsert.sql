-- Fix: upsert (INSERT ON CONFLICT DO UPDATE) requires UPDATE permission + RLS policy
-- The POST request uses ?on_conflict=endpoint with prefer: resolution=merge-duplicates
-- which translates to INSERT ... ON CONFLICT DO UPDATE, needing UPDATE privilege

GRANT UPDATE ON push_subscriptions TO anon;
GRANT SELECT ON push_subscriptions TO anon;

CREATE POLICY "Anyone can update subscription" ON push_subscriptions
  FOR UPDATE USING (true) WITH CHECK (true);
