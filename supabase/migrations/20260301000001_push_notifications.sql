-- Add notification_sentence column to readings_cache
-- Used as a teaser in Monday morning push notifications and potentially as a website lead
ALTER TABLE readings_cache ADD COLUMN IF NOT EXISTS notification_sentence TEXT;

-- Table to store Web Push subscriptions (anonymous users)
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  endpoint TEXT UNIQUE NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Anyone can insert their subscription
CREATE POLICY "Anyone can subscribe" ON push_subscriptions
  FOR INSERT WITH CHECK (true);

-- Anyone can delete their own subscription (by endpoint)
CREATE POLICY "Anyone can unsubscribe" ON push_subscriptions
  FOR DELETE USING (true);

-- Service role manages all subscriptions (for sending notifications)
CREATE POLICY "Service role can read subscriptions" ON push_subscriptions
  FOR SELECT USING (auth.role() = 'service_role');
