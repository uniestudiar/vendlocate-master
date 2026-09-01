# VendLocate Pro - Supabase Database Setup

## CRITICAL SECURITY NOTE
**NEVER STORE CREDIT CARD INFORMATION IN THE DATABASE**
- This violates PCI DSS compliance
- Exposes you to massive liability
- Can result in fines up to $500,000
- Use Stripe or similar payment processors only

## Database Tables

Run these SQL commands in your Supabase SQL Editor:

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (extends Supabase Auth)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  phone TEXT,
  outreach_email TEXT,
  smtp_app_password TEXT,
  search_address TEXT,
  search_city TEXT,
  search_state TEXT,
  search_zip TEXT,
  preferred_radius_miles INTEGER,
  email_template TEXT, -- Custom email template for outreach
  onboarding_completed BOOLEAN DEFAULT FALSE,
  -- When true the user has clicked "Run" and their saved search location
  -- is locked. To change it they must purchase an extra location.
  location_locked BOOLEAN DEFAULT FALSE,
  location_locked_at TIMESTAMP WITH TIME ZONE,
  -- Free quota of locations a user may pin before being charged for extras.
  included_location_slots INTEGER DEFAULT 1,
  purchased_extra_locations INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User-saved locations (a user can have multiple rows, one per location they
-- have paid for / unlocked). Locking the location is enforced by giving the
-- user a fixed number of "slots" and charging for any extras.
CREATE TABLE IF NOT EXISTS user_locations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label TEXT,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  zip_code TEXT,
  latitude DECIMAL(10,7),
  longitude DECIMAL(10,7),
  radius_miles INTEGER,
  is_primary BOOLEAN DEFAULT FALSE,
  locked BOOLEAN DEFAULT FALSE,
  locked_at TIMESTAMP WITH TIME ZONE,
  stripe_payment_intent_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Purchases table
CREATE TABLE IF NOT EXISTS purchases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  radius_miles INTEGER NOT NULL,
  business_types JSONB NOT NULL, -- Array of selected business type IDs
  extra_selections INTEGER DEFAULT 0,
  premium_types JSONB DEFAULT '[]'::JSONB, -- Array of premium type IDs
  total_price DECIMAL(10,2) NOT NULL,
  location_address TEXT NOT NULL,
  location_city TEXT NOT NULL,
  location_state TEXT NOT NULL,
  location_zip TEXT NOT NULL,
  location_lat DECIMAL(10,7),
  location_lng DECIMAL(10,7),
  stripe_payment_intent_id TEXT, -- Stripe payment reference
  stripe_customer_id TEXT,
  purchase_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status TEXT DEFAULT 'active', -- active, cancelled, expired
  leads_generated_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Leads table
CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  purchase_id UUID NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- Optional link to the saved user_locations row this lead belongs to.
  -- Used by the dashboard's "filter by location" dropdown.
  user_location_id UUID REFERENCES user_locations(id) ON DELETE SET NULL,
  business_name TEXT NOT NULL,
  business_type TEXT NOT NULL,
  address TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  has_website BOOLEAN DEFAULT TRUE,
  place_id TEXT UNIQUE, -- Google Places ID
  profit_score INTEGER, -- 50-90 ranking
  estimated_foot_traffic TEXT,
  distance_from_client DECIMAL(5,2), -- in miles
  ranking INTEGER, -- 1-100 score
  status TEXT DEFAULT 'new', -- new, contacted_once, responded, follow_up_sent
  email_sent BOOLEAN DEFAULT FALSE,
  email_sent_date TIMESTAMP WITH TIME ZONE,
  responded BOOLEAN DEFAULT FALSE,
  response_date TIMESTAMP WITH TIME ZONE,
  follow_up_sent BOOLEAN DEFAULT FALSE,
  follow_up_date TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Email tracking table
CREATE TABLE IF NOT EXISTS sent_emails (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email_address TEXT NOT NULL,
  email_type TEXT NOT NULL, -- 'initial', 'follow_up'
  subject TEXT,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  opened BOOLEAN DEFAULT FALSE,
  opened_at TIMESTAMP WITH TIME ZONE,
  clicked BOOLEAN DEFAULT FALSE,
  clicked_at TIMESTAMP WITH TIME ZONE
);

-- Single source of truth for "what emails did this user get".
-- Every email the system considers as sent (verification codes,
-- onboarding emails, run-complete, outreach initial + follow-up) is
-- recorded here exactly once. The unique index on
-- (user_id, recipient, email_type, subject) plus a small app-side
-- check (the latest record for the same recipient + type) is what
-- guarantees a recipient is never contacted twice for the same
-- purpose unless a minimum gap (default 48h) has elapsed.
CREATE TABLE IF NOT EXISTS email_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient TEXT NOT NULL,
  email_type TEXT NOT NULL,
  -- 'verification' | 'welcome' | 'run_started' | 'run_complete'
  -- | 'outreach_initial' | 'outreach_followup' | 'password_reset'
  -- | 'subscription' | 'support' | 'other'
  subject TEXT NOT NULL,
  body_preview TEXT,
  status TEXT NOT NULL DEFAULT 'queued', -- queued | sent | failed
  related_lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  related_purchase_id UUID REFERENCES purchases(id) ON DELETE SET NULL,
  is_followup BOOLEAN DEFAULT FALSE,
  parent_email_id UUID REFERENCES email_history(id) ON DELETE SET NULL,
  scheduled_for TIMESTAMP WITH TIME ZONE,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Email verification codes
CREATE TABLE IF NOT EXISTS email_verification_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_leads_user_id ON leads(user_id);
CREATE INDEX IF NOT EXISTS idx_leads_purchase_id ON leads(purchase_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_place_id ON leads(place_id);
CREATE INDEX IF NOT EXISTS idx_leads_location ON leads(user_id, city, state);
CREATE INDEX IF NOT EXISTS idx_leads_user_location_id ON leads(user_location_id);
CREATE INDEX IF NOT EXISTS idx_purchases_user_id ON purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_sent_emails_lead_id ON sent_emails(lead_id);
CREATE INDEX IF NOT EXISTS idx_sent_emails_user_id ON sent_emails(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sent_emails_user_email_type
  ON sent_emails(user_id, email_address, email_type);
CREATE INDEX IF NOT EXISTS idx_user_locations_user_id ON user_locations(user_id);
CREATE INDEX IF NOT EXISTS idx_email_history_user_id ON email_history(user_id);
CREATE INDEX IF NOT EXISTS idx_email_history_recipient ON email_history(recipient);
CREATE INDEX IF NOT EXISTS idx_email_history_sent_at ON email_history(sent_at DESC);
-- The DB-level safeguard for "don't send the same email twice in a row".
-- A row can only be inserted if (user, recipient, type, subject) is unique.
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_history_dedupe
  ON email_history(user_id, recipient, email_type, subject);

-- Row Level Security (RLS) Policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE sent_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_verification_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_history ENABLE ROW LEVEL SECURITY;

-- Users can only see their own data
CREATE POLICY "Users can view own data" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own data" ON users
  FOR UPDATE USING (auth.uid() = id);

-- Purchases policies
CREATE POLICY "Users can view own purchases" ON purchases
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own purchases" ON purchases
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Leads policies
CREATE POLICY "Users can view own leads" ON leads
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own leads" ON leads
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own leads" ON leads
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Sent emails policies
CREATE POLICY "Users can view own sent emails" ON sent_emails
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sent emails" ON sent_emails
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Email verification codes policies
CREATE POLICY "Users can view own codes" ON email_verification_codes
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own codes" ON email_verification_codes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- User locations policies
CREATE POLICY "Users can view own locations" ON user_locations
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own locations" ON user_locations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own locations" ON user_locations
  FOR UPDATE USING (auth.uid() = user_id);

-- Email history policies
CREATE POLICY "Users can view own email history" ON email_history
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own email history" ON email_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);
```

## Environment Variables Needed

Add these to your Supabase Edge Function secrets:

```bash
# Stripe (for payments)
STRIPE_SECRET_KEY=sk_test_... # Get from https://dashboard.stripe.com/apikeys
STRIPE_PUBLISHABLE_KEY=pk_test_...

# Email service (for sending outreach emails)
SMTP_EMAIL=your-email@gmail.com
SMTP_APP_PASSWORD=your-app-password

# Google Maps API (for finding locations)
GOOGLE_MAPS_API_KEY=your-google-maps-key

# Hunter.io API (for finding business emails)
HUNTER_API_KEY=your-hunter-api-key

# Python CSV sync to Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_USER_ID=the-user-id-for-this-run
SUPABASE_PURCHASE_ID=optional-purchase-id-override
```

## Initial Data Migration

To import your existing CSV data into Supabase:

1. Go to your Supabase project
2. Navigate to Table Editor
3. Select the `leads` table
4. Click "Insert" > "Import data from CSV"
5. Upload `vending_leads.csv`
6. Map columns appropriately

## Next Steps

1. Run the SQL commands above in Supabase SQL Editor
2. Set up Stripe account and get API keys
3. Add environment variables to Supabase Edge Functions
4. Deploy the server code
5. Test authentication and payment flow
