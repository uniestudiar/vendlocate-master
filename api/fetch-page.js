const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const MAILTO_REGEX = /mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi;
const OBFUSCATED_REGEX = /[a-zA-Z0-9._%+-]+\s*(?:\[at\]|\(at\)|\sat\s)\s*[a-zA-Z0-9.-]+\s*(?:\[dot\]|\(dot\)|\sdot\s)\s*[a-zA-Z]{2,}/gi;
const SCHEMA_EMAIL_REGEX = /"email"\s*:\s*"([^"]+)"/gi;

const FAKE_DOMAINS = [
  'wixpress', 'sentry', 'cloudflare', 'example.com', 'sentry.io',
  'wix.com', 'wordpress.com', 'gravatar.com', 'schema.org',
  'github.com', 'googleapis.com', 'gstatic.com', 'gmpg.org',
  'yoursite.com', 'domain.com', 'noemail.com', 'no-image.com',
  'placehold', 'shopify.com', 'squarespace.com', 'cloudfront.net',
  'amazonaws.com', 'typeform.com', 'mailchimp.com',
  'google.com/recaptcha',
];

function isFakeEmail(email) {
  const lower = email.toLowerCase();
  if (FAKE_DOMAINS.some(d => lower.includes(d))) return true;
  if (/\.(png|jpg|gif|svg)$/i.test(lower)) return true;
  return false;
}

function extractEmails(html) {
  if (!html) return [];
  const found = new Set();
  const add = (e) => {
    const n = String(e || '').trim().toLowerCase();
    if (n && !isFakeEmail(n) && n.length < 120 && n.includes('@')) found.add(n);
  };

  let m;
  MAILTO_REGEX.lastIndex = 0;
  while ((m = MAILTO_REGEX.exec(html)) !== null) add(m[1]);
  SCHEMA_EMAIL_REGEX.lastIndex = 0;
  while ((m = SCHEMA_EMAIL_REGEX.exec(html)) !== null) add(m[1]);
  EMAIL_REGEX.lastIndex = 0;
  while ((m = EMAIL_REGEX.exec(html)) !== null) add(m[0]);
  OBFUSCATED_REGEX.lastIndex = 0;
  while ((m = OBFUSCATED_REGEX.exec(html)) !== null) {
    const cleaned = m[0]
      .replace(/\s*\[at\]\s*/gi, '@')
      .replace(/\s*\(at\)\s*/gi, '@')
      .replace(/\s*at\s*/gi, '@')
      .replace(/\s*\[dot\]\s*/gi, '.')
      .replace(/\s*\(dot\)\s*/gi, '.')
      .replace(/\s*dot\s*/gi, '.');
    add(cleaned);
  }
  return Array.from(found);
}

const PRIORITY_PATHS = [
  '/contact', '/contact-us', '/contactus',
  '/about', '/about-us', '/aboutus',
  '/our-team', '/team', '/staff',
  '/find-us', '/location', '/locations',
  '/email', '/email-us',
  '/office', '/reception',
  '/support',
];

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { url, businessName } = req.body;
  if (!url) return res.status(400).json({ error: 'Missing url' });

  const domain = url.replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, '').toLowerCase();
  const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
  const allEmails = new Set();

  const pagesToVisit = new Set();
  pagesToVisit.add(url.replace(/\/$/, ''));
  for (const p of PRIORITY_PATHS) {
    pagesToVisit.add(url.replace(/\/$/, '') + p);
  }

  let count = 0;
  const nameVerified = !businessName;

  for (const pageUrl of pagesToVisit) {
    if (count >= 8) break;
    count++;
    try {
      const resp = await fetch(pageUrl, {
        headers: {
          'User-Agent': userAgent,
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'en-US,en;q=0.5',
        },
        signal: AbortSignal.timeout(8000),
        redirect: 'follow',
      });
      if (!resp.ok) continue;
      const ct = resp.headers.get('content-type') || '';
      if (!ct.includes('text/html') && !ct.includes('xml') && !ct.includes('json') && !ct.includes('text/plain')) continue;

      const text = await resp.text();
      if (text.length > 3_000_000) continue;

      // If businessName provided, verify page mentions it
      if (businessName && !nameVerified) {
        const lower = text.toLowerCase();
        const nameLower = businessName.toLowerCase().trim();
        if (!lower.includes(nameLower)) {
          const words = nameLower.split(/\s+/).filter(w => w.length > 2);
          const matchCount = words.filter(w => lower.includes(w)).length;
          if (matchCount < Math.max(1, Math.floor(words.length / 2))) {
            continue; // Skip this page, doesn't mention the business
          }
        }
      }

      const emails = extractEmails(text);
      for (const e of emails) {
        if (e.endsWith(`@${domain}`)) {
          allEmails.add(e);
        }
      }
    } catch {}
  }

  const sorted = Array.from(allEmails).sort((a, b) => {
    const prefer = ['info@', 'contact@', 'office@', 'hello@', 'service@', 'support@', 'manager@'];
    const aScore = prefer.some(p => a.startsWith(p)) ? 1 : 0;
    const bScore = prefer.some(p => b.startsWith(p)) ? 1 : 0;
    return bScore - aScore;
  });

  return res.status(200).json({ emails: sorted, count: sorted.length });
}
