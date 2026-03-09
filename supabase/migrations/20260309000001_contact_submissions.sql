-- Contact form submissions table
CREATE TABLE IF NOT EXISTS contact_submissions (
  id BIGSERIAL PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('removal', 'feature-request', 'general')),
  name TEXT,
  email TEXT,
  metadata JSONB DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'in_progress', 'resolved', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

-- RLS: only service_role can insert/read (API route uses service_role)
ALTER TABLE contact_submissions ENABLE ROW LEVEL SECURITY;

-- No public policies = only service_role can access
COMMENT ON TABLE contact_submissions IS 'Contact form submissions from /contact pages';
