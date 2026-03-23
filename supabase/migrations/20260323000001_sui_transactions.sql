-- SUI Payment (PV-Pay) transaction audit log
CREATE TABLE IF NOT EXISTS sui_transactions (
  id serial PRIMARY KEY,
  user_id text,                     -- Supabase user ID (may be null for recurring kicks)
  transaction_id text,              -- PV-Pay TransactionId
  continue_key text,                -- For subscriptions (継続決済キー)
  site_id text NOT NULL,            -- PV-Pay SiteId
  amount integer NOT NULL DEFAULT 0,
  result text NOT NULL,             -- 'OK' | 'NG' | 'CANCEL'
  transaction_type text,            -- 'single_unlock' | 'subscription_initial' | 'subscription_recurring'
  raw_params jsonb,                 -- Full KICK callback params for audit
  created_at timestamptz DEFAULT now()
);

-- Index for duplicate detection and user lookup
CREATE INDEX IF NOT EXISTS idx_sui_transactions_transaction_id ON sui_transactions(transaction_id);
CREATE INDEX IF NOT EXISTS idx_sui_transactions_user_id ON sui_transactions(user_id);
