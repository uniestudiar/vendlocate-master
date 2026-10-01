# VendLocate Pro - Deployment Instructions

## ✅ What's Been Implemented

### Authentication & Security
- ✅ User registration with email verification
- ✅ Email confirmation flow with an explicit login after verification
- ✅ Secure login with Supabase Auth
- ✅ Password reset functionality
- ✅ Change password feature
- ✅ Session management
- ✅ **NEVER stores credit card info** (uses Stripe)

### Post-Purchase Onboarding
- ✅ Step 1: Add phone number
- ✅ Step 2: Customize email template with merge fields
- ✅ Step 3: Review settings before launch
- ✅ Automatic redirect to onboarding after purchase

### Email Template System
- ✅ Default professional template provided
- ✅ Merge fields: `{{YOUR_NAME}}`, `{{YOUR_PHONE}}`, `{{BUSINESS_NAME}}`
- ✅ Live preview while editing
- ✅ Saved to user profile

### User Experience
- ✅ Smooth onboarding flow with progress indicators
- ✅ Clear instructions at each step
- ✅ Professional, non-scammy payment interface
- ✅ Helpful tooltips and explanations

## 🚀 Deployment Steps

### 0. Vercel Web Analytics

The app includes `@vercel/analytics` in the production bundle and renders the
`<Analytics />` component from `src/main.tsx`. To start collecting visits:

1. Import this repository into Vercel and deploy the `main` branch.
2. In the Vercel project, open **Analytics** and click **Enable**.
3. Visit the deployed site once, then allow a few minutes for data to appear.

Analytics data is viewed in the Vercel dashboard; no analytics API key is
required in the application environment. The package is also recorded in both
`package.json` and `package-lock.json` so production installs are reproducible.

### 1. Set Up Supabase Database

Run this SQL in your Supabase SQL Editor:

```sql
-- Update users table to add email template and onboarding fields
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS email_template TEXT,
ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE;
```

### 2. Deploy Edge Functions

```bash
# Navigate to your project
cd /workspaces/default/code

# Deploy the server function
supabase functions deploy make-server-de060722
```

### 3. Set Environment Variables

In Vercel → Project Settings → Environment Variables, add:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_publishable_anon_key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_publishable_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_SECRET_KEY=sk_live_...
GOOGLE_PLACES_API_KEY=your_key_here
ENABLE_TEST_PAYMENTS=false
```

In Supabase Dashboard → Edge Functions → Secrets, add the provider secrets used by the deployed function:

```
GOOGLE_MAPS_API_KEY=your_key_here
HUNTER_API_KEY=your_key_here
SMTP_EMAIL=qcvending01@gmail.com
SMTP_APP_PASSWORD=your_app_password
STRIPE_SECRET_KEY=sk_test_...
```

### 4. Configure Email Sending

For Gmail SMTP:
1. Go to Google Account → Security
2. Enable 2-Factor Authentication
3. Generate App Password
4. Use that as `SMTP_APP_PASSWORD`

### 5. Test the Flow

1. Register new account → Confirm the email, then log in
2. Purchase package → Should redirect to onboarding
3. Complete onboarding → Should save phone and template
4. View dashboard → Should show leads

## 📧 How Emails Work

### Email Template Variables

When emails are sent to businesses, these get replaced:
- `{{YOUR_NAME}}` → User's full name from profile
- `{{YOUR_PHONE}}` → User's phone in (555) 123-4567 format
- `{{BUSINESS_NAME}}` → The business being contacted

### Email Sending Flow

1. User completes purchase & onboarding
2. Python scripts run to discover businesses
3. For each business:
   - Template is populated with user's info
   - Email is sent via SMTP
   - Tracked in database
4. After 48 hours:
   - Automatic follow-up sent to non-responders
   - Status updated in dashboard

## 🔧 Integration with Python Code

The repository **does include** the outreach implementation under
`src/imports/`, including `outreach.py`, `main.py`, `replyScanner.py`, and
Supabase synchronization code. It is not currently executed by Vercel:
Vercel runs the Vite frontend and JavaScript serverless functions, but it does
not run this Windows/Python process as a scheduled worker. The scripts must be
run on a separate Python host, or converted into a deployed TypeScript/Edge
Function worker before outreach can be fully automated after a purchase.

Your Python scripts (`config.py`, `scraper.py`, etc.) need to be triggered after purchase:

### Option 1: Run on Server (Recommended)

Convert Python to Deno TypeScript and run in Edge Functions:
- Pros: Fully automated, no local server needed
- Cons: Requires code conversion

### Option 2: Webhook to Your Server

Set up webhook after purchase completion:
- Supabase Edge Function calls your server
- Your server runs Python scripts
- Results are posted back to Supabase

### Option 3: Manual Trigger

- Admin runs Python scripts locally
- Imports results via CSV to Supabase

## 📊 Using Your CSV Data

### Import Leads

```sql
-- After running Python scripts, import vending_leads.csv:
COPY leads (
  business_name, email, status, last_contact, 
  website, notes, profit_score, place_id
)
FROM '/path/to/vending_leads.csv'
DELIMITER ','
CSV HEADER;
```

### Import Sent Emails

```sql
COPY sent_emails (email_address)
FROM '/path/to/sent_emails.csv'
DELIMITER ','
CSV HEADER;
```

## 🎯 Next Implementation Steps

### High Priority
1. **Stripe Integration** - Replace mock payment with real Stripe
2. **SMTP Email Sending** - Implement actual email delivery
3. **Lead Generation Trigger** - Run Python code after onboarding

### Medium Priority
4. Data visualization dashboard with charts
5. Email open/click tracking
6. Response rate analytics
7. Bulk actions (mark as contacted, etc.)

### Low Priority
8. Email templates library (multiple templates)
9. A/B testing different email versions
10. Automated lead scoring improvements

## 🐛 Known Issues

### "Login does not work"
Confirm that `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are configured for the Vercel deployment, email confirmation is enabled in Supabase Auth, and the deployed URL is listed under Supabase Auth → URL Configuration → Redirect URLs.

For registration emails, configure all of the following in Supabase:

1. **Authentication → Providers → Email**: enable Email provider and enable **Confirm email**.
2. **Authentication → URL Configuration**: set **Site URL** to the deployed Vercel URL, for example `https://vendlocate-master.vercel.app`.
3. Add the deployed URL with `/verify-email` to **Redirect URLs**, for example `https://vendlocate-master.vercel.app/verify-email`.
4. In Vercel, set `VITE_SITE_URL` to that same deployed URL (without a trailing slash), then redeploy. This makes both signup and resend links use the intended production origin instead of whichever host opened the form.
5. For reliable production delivery, configure **Authentication → SMTP Settings** with a transactional email provider. Supabase's default email service is rate-limited and may not deliver reliably for production use.
6. Check **Authentication → Logs** after a signup or resend. A successful signup response only means Supabase accepted the request; the Auth logs and SMTP provider determine whether the message was actually sent.

## 🔐 Security Checklist

- [x] Passwords are hashed (Supabase Auth handles this)
- [x] NEVER store credit card info
- [x] Row Level Security enabled
- [x] JWT tokens for authentication
- [x] SQL injection prevented (parameterized queries)
- [ ] CORS restricted to the deployed application origin
- [x] Authorization checks on payment and database-backed endpoints
- [ ] Rate limiting (TODO: add to Edge Functions)
- [ ] Input validation (TODO: add more comprehensive checks)

## 📱 User Journey

1. **Sign Up** → Enter name, email, password
2. **Verify Email** → Click the Supabase confirmation link → **Log in**
3. **Purchase** → Select radius, business types, pay
4. **Onboarding** → Add phone → Customize email → Review
5. **Generation** → System finds locations automatically
6. **Dashboard** → View leads, track responses, export data

## 💡 Tips for Users

Add these to help documentation:

- **Best time to send emails**: Tuesday-Thursday, 10 AM - 2 PM
- **Follow-up timing**: Automated 48-hour follow-ups work best
- **Email length**: Keep under 150 words for best response rates
- **Phone formatting**: System auto-formats as (XXX) XXX-XXXX
- **Template testing**: Preview shows exactly what businesses see

## 🆘 Support Info

Users should contact: **qcvending01@gmail.com**

Common questions:
- "When will I get leads?" → 24-48 hours after purchase
- "Can I change my email?" → Yes, in dashboard settings
- "How do I track responses?" → Dashboard shows all activity
- "Can I add more areas?" → Purchase additional packages

---

**Last Updated**: June 1, 2026
**Version**: 1.0.0
