-- Schema and table initialization for Tidewave Leads Service
CREATE SCHEMA IF NOT EXISTS leads;

CREATE TABLE IF NOT EXISTS leads.leads (
  id VARCHAR(64) PRIMARY KEY,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100),
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(50) NOT NULL,
  city VARCHAR(100) NOT NULL,
  experience_years NUMERIC NOT NULL DEFAULT 0,
  hours_per_week NUMERIC NOT NULL DEFAULT 0,
  source VARCHAR(100),
  consent BOOLEAN NOT NULL DEFAULT true,
  consent_withdrawn BOOLEAN NOT NULL DEFAULT false,
  score INTEGER NOT NULL DEFAULT 0,
  status VARCHAR(50) NOT NULL,
  duplicate_of VARCHAR(64) REFERENCES leads.leads(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS leads.lead_activity (
  id VARCHAR(64) PRIMARY KEY,
  lead_id VARCHAR(64) NOT NULL REFERENCES leads.leads(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  detail JSONB NOT NULL DEFAULT '{}'::jsonb,
  actor VARCHAR(50) NOT NULL DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS leads.event_outbox (
  id VARCHAR(64) PRIMARY KEY,
  event_id VARCHAR(64) NOT NULL,
  event_type VARCHAR(50) NOT NULL,
  payload JSONB NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- QA Reader permissions per CONTRACT Section 3
GRANT USAGE ON SCHEMA leads TO qa_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA leads TO qa_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA leads GRANT SELECT ON TABLES TO qa_reader;
