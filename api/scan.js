import { createClient } from '@supabase/supabase-js';

export const config = {
  maxDuration: 300,
};

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
}

// ────────────────────────── Email helpers ──────────────────────────
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const MAILTO_REGEX = /mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi;
const OBFUSCATED_REGEX =
  /[a-zA-Z0-9._%+-]+\s*(?:\[at\]|\(at\)|\sat\s)\s*[a-zA-Z0-9.-]+\s*(?:\[dot\]|\(dot\)|\sdot\s)\s*[a-zA-Z]{2,}/gi;
const SCHEMA_EMAIL_REGEX = /"email"\s*:\s*"([^"]+)"/gi;
const SCHEMA_CONTACTPOINT_REGEX = /"contactPoint"\s*:\s*\{[^}]*"email"\s*:\s*"([^"]+)"/gi;

const FAKE_EMAIL_DOMAINS = [
  'wixpress',
  'sentry',
  'cloudflare',
  'example.com',
  'sentry.io',
  'wix.com',
  'wordpress.com',
  'gravatar.com',
  'schema.org',
  'github.com',
  'googleapis.com',
  'gstatic.com',
  'gmpg.org',
  'yoursite.com',
  'domain.com',
  'noemail.com',
  'no-image.com',
  'placehold',
  'shopify.com',
  'squarespace.com',
  'cloudfront.net',
  'amazonaws.com',
  'typeform.com',
  'mailchimp.com',
  'google.com/recaptcha',
];

const ROLE_BOX_PATTERNS = [
  'info',
  'contact',
  'office',
  'hello',
  'admin',
  'manager',
  'owner',
  'support',
  'sales',
  'service',
  'team',
  'leasing',
  'reception',
  'frontdesk',
  'front-desk',
  'residents',
  'resident',
  'guest',
  'guests',
  'booking',
  'reservations',
  'reservation',
  'concierge',
  'housekeeping',
  'maintenance',
  'engineering',
  'security',
  'marketing',
  'hr',
  'accounting',
  'billing',
  'director',
  'generalmanager',
  'gm',
  'property',
  'propertymanager',
  'leasingmgr',
  'leasingmanager',
  'patients',
  'patient',
  'appointments',
  'intake',
  'referrals',
  'customerservice',
  'customers',
  'helpdesk',
  'feedback',
  'media',
  'press',
  'events',
  'donate',
  'donations',
  'volunteer',
];

// Per-business-type high-yield guesses come first
const TYPE_BIASED_PATTERNS = {
  'apartments': ['leasing', 'office', 'manager', 'info', 'contact', 'property', 'residents'],
  'apartment': ['leasing', 'office', 'manager', 'info', 'contact', 'property', 'residents'],
  'hotels': ['reservations', 'frontdesk', 'reception', 'info', 'contact', 'manager'],
  'hotel': ['reservations', 'frontdesk', 'reception', 'info', 'contact', 'manager'],
  'motel': ['reservations', 'frontdesk', 'info', 'contact', 'manager'],
  'laundromats': ['service', 'info', 'contact', 'owner', 'office'],
  'laundromat': ['service', 'info', 'contact', 'owner', 'office'],
  'auto shops': ['service', 'info', 'contact', 'office', 'manager', 'estimates', 'appointments'],
  'auto repair': ['service', 'info', 'contact', 'office', 'manager', 'estimates', 'appointments'],
  'mechanic': ['service', 'info', 'contact', 'office', 'manager', 'estimates', 'appointments'],
  'senior communities': ['info', 'admissions', 'contact', 'office', 'manager', 'director', 'reception'],
  'senior': ['info', 'admissions', 'contact', 'office', 'manager', 'director', 'reception'],
  'assisted living': ['info', 'admissions', 'contact', 'office', 'manager', 'director'],
  'nursing home': ['info', 'admissions', 'contact', 'office', 'manager', 'director'],
  'hospital': ['info', 'contact', 'media', 'appointments', 'referrals', 'admin'],
  'clinic': ['info', 'contact', 'appointments', 'referrals', 'admin', 'office'],
  'urgent care': ['info', 'contact', 'appointments', 'referrals', 'admin'],
  'veterinary': ['info', 'contact', 'appointments', 'reception', 'office', 'manager'],
  'vet': ['info', 'contact', 'appointments', 'reception', 'office', 'manager'],
  'gym': ['info', 'contact', 'membership', 'frontdesk', 'manager', 'office'],
  'fitness': ['info', 'contact', 'membership', 'frontdesk', 'manager', 'office'],
  'salon': ['info', 'contact', 'appointments', 'bookings', 'manager', 'owner'],
  'restaurant': ['info', 'contact', 'manager', 'owner', 'reservations', 'events'],
  'dental': ['info', 'contact', 'appointments', 'reception', 'office'],
  'dentist': ['info', 'contact', 'appointments', 'reception', 'office'],
  'doctor': ['info', 'contact', 'appointments', 'reception', 'office'],
  'pharmacy': ['info', 'contact', 'manager', 'staff', 'pharmacist'],
  'school': ['info', 'contact', 'office', 'principal', 'admissions', 'admin'],
};

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, {
      ...options,
      redirect: 'follow',
      signal: controller.signal,
    });
    return resp;
  } finally {
    clearTimeout(timer);
  }
}

function isFakeEmail(email) {
  const lower = email.toLowerCase();
  if (FAKE_EMAIL_DOMAINS.some((d) => lower.includes(d))) return true;
  if (lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.gif')) return true;
  return false;
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function extractDomain(website) {
  if (!website) return null;
  try {
    const url = website.startsWith('http') ? new URL(website) : new URL('https://' + website);
    return url.hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return null;
  }
}

function rootUrl(websiteUrl) {
  if (!websiteUrl) return null;
  let u = websiteUrl.trim();
  if (!u.startsWith('http')) u = 'https://' + u;
  try {
    const url = new URL(u);
    return `${url.protocol}//${url.host}`;
  } catch {
    return null;
  }
}

function cleanObfuscatedEmail(s) {
  return s
    .replace(/\s*\[at\]\s*/gi, '@')
    .replace(/\s*\[dot\]\s*/gi, '.')
    .replace(/\s*\(at\)\s*/gi, '@')
    .replace(/\s*\(dot\)\s*/gi, '.')
    .replace(/\s+at\s+/gi, '@')
    .replace(/\s+dot\s+/gi, '.')
    .replace(/\s+/g, '')
    .toLowerCase();
}

function extractEmailsFromHtml(html) {
  if (!html) return [];
  const found = new Set();
  const add = (e) => {
    const n = normalizeEmail(e);
    if (n && !isFakeEmail(n) && n.length < 120 && n.includes('@')) found.add(n);
  };

  let m;
  MAILTO_REGEX.lastIndex = 0;
  while ((m = MAILTO_REGEX.exec(html)) !== null) add(m[1]);

  SCHEMA_EMAIL_REGEX.lastIndex = 0;
  while ((m = SCHEMA_EMAIL_REGEX.exec(html)) !== null) add(m[1]);

  SCHEMA_CONTACTPOINT_REGEX.lastIndex = 0;
  while ((m = SCHEMA_CONTACTPOINT_REGEX.exec(html)) !== null) add(m[1]);

  EMAIL_REGEX.lastIndex = 0;
  while ((m = EMAIL_REGEX.exec(html)) !== null) add(m[0]);

  OBFUSCATED_REGEX.lastIndex = 0;
  while ((m = OBFUSCATED_REGEX.exec(html)) !== null) {
    const c = cleanObfuscatedEmail(m[0]);
    if (c.includes('@') && c.includes('.')) add(c);
  }

  return Array.from(found);
}

// Priority order of paths to crawl for contact info
const PRIORITY_PATHS = [
  '/contact',
  '/contact-us',
  '/contactus',
  '/contact.html',
  '/get-in-touch',
  '/reach-us',
  '/about',
  '/about-us',
  '/aboutus',
  '/our-team',
  '/team',
  '/staff',
  '/leadership',
  '/management',
  '/people',
  '/directory',
  '/meet-the-team',
  '/property-manager',
  '/property-management',
  '/leasing',
  '/leasing-office',
  '/office',
  '/reception',
  '/front-desk',
  '/find-us',
  '/location',
  '/locations',
  '/support',
  '/help',
  '/customer-service',
  '/reservations',
  '/reservations.html',
  '/booking',
  '/book-now',
  '/schedule',
  '/appointments',
  '/visit-us',
];

const CONTACT_HINT_REGEX =
  /(contact|about|team|staff|leasing|office|reservations?|manager|directory|leadership|get-in-touch|reach|find-us|location|property-m)/i;

// Discover internal links that are likely to contain a contact email
function findContactLinksFromHtml(html, baseUrl) {
  const links = new Set();
  const re = /href=["']([^"']+)["']/g;
  let m;
  const base = new URL(baseUrl);
  while ((m = re.exec(html)) !== null) {
    let href = m[1].trim();
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) continue;
    try {
      const abs = new URL(href, baseUrl);
      if (abs.hostname !== base.hostname) continue;
      // Only follow links that look like they could contain contact info
      const path = abs.pathname.toLowerCase();
      if (CONTACT_HINT_REGEX.test(path) || path.length < 30) {
        links.add(abs.href);
      }
    } catch {
      // ignore
    }
  }
  return Array.from(links);
}

async function fetchSitemapUrls(baseUrl) {
  const out = new Set();
  try {
    const resp = await fetchWithTimeout(`${baseUrl}/sitemap.xml`, {}, 6000);
    if (!resp.ok) return [];
    const text = await resp.text();
    const re = /<loc>([^<]+)<\/loc>/g;
    let m;
    while ((m = re.exec(text)) !== null) {
      const u = m[1].trim();
      if (CONTACT_HINT_REGEX.test(u)) out.add(u);
    }
    // Also try sitemap_index children
    const subRe = /<sitemap>[\s\S]*?<loc>([^<]+)<\/loc>[\s\S]*?<\/sitemap>/g;
    while ((m = subRe.exec(text)) !== null) {
      try {
        const sub = await fetchWithTimeout(m[1].trim(), {}, 5000);
        if (sub.ok) {
          const subText = await sub.text();
          let mm;
          const re2 = /<loc>([^<]+)<\/loc>/g;
          while ((mm = re2.exec(subText)) !== null) {
            const u = mm[1].trim();
            if (CONTACT_HINT_REGEX.test(u)) out.add(u);
          }
        }
      } catch {}
    }
  } catch {}
  return Array.from(out);
}

// ──────────────────────── STAGE 1: Crawl site ────────────────────────
async function stage1_crawlSite(websiteUrl) {
  const baseUrl = rootUrl(websiteUrl);
  if (!baseUrl) return null;

  const visited = new Set();
  const queue = [baseUrl];
  // Push priority paths first
  for (const p of PRIORITY_PATHS) {
    queue.push(baseUrl.replace(/\/$/, '') + p);
  }
  // Sitemap-derived URLs
  try {
    const sitemap = await fetchSitemapUrls(baseUrl);
    for (const u of sitemap) queue.push(u);
  } catch {}

  const MAX_PAGES = 14;
  const MAX_QUEUE = 60;
  const found = new Set();

  while (queue.length > 0 && visited.size < MAX_PAGES) {
    const url = queue.shift();
    if (visited.has(url)) continue;
    visited.add(url);

    try {
      const resp = await fetchWithTimeout(
        url,
        {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
          },
        },
        7000
      );
      if (!resp.ok) continue;
      const contentType = resp.headers.get('content-type') || '';
      if (!contentType.includes('text/html') && !contentType.includes('xml')) continue;
      const html = await resp.text();
      if (html.length > 3_000_000) continue;

      const emails = extractEmailsFromHtml(html);
      for (const e of emails) {
        found.add(e);
        if (found.size >= 3) return Array.from(found); // stop early
      }

      // Discover more internal contact-like links
      if (queue.length < MAX_QUEUE) {
        const links = findContactLinksFromHtml(html, url);
        for (const l of links) {
          if (!visited.has(l)) queue.push(l);
        }
      }
    } catch {}
  }

  return found.size > 0 ? Array.from(found) : null;
}

// ─────────────── STAGE 2: Pattern + domain guessing ───────────────
function patternsForBusinessType(businessType) {
  if (!businessType) return ROLE_BOX_PATTERNS;
  const name = (businessType.name || businessType.id || '').toLowerCase();
  for (const [k, v] of Object.entries(TYPE_BIASED_PATTERNS)) {
    if (name.includes(k)) return v;
  }
  return ROLE_BOX_PATTERNS;
}

async function stage2_patternGuess(website, businessType, seedPages = []) {
  const domain = extractDomain(website);
  if (!domain) return null;
  if (
    domain.includes('facebook') ||
    domain.includes('yelp') ||
    domain.includes('google') ||
    domain.includes('instagram') ||
    domain.includes('twitter') ||
    domain.includes('youtube') ||
    domain.includes('tiktok') ||
    domain.includes('linkedin') ||
    domain.includes('nextdoor') ||
    domain.includes('mapquest')
  ) {
    return null;
  }

  const baseUrl = rootUrl(website);
  if (!baseUrl) return null;

  const patterns = patternsForBusinessType(businessType);
  const candidates = patterns.map((p) => `${p}@${domain}`);

  // Collect text from the homepage AND any pages we already pulled in stage 1
  const textPool = [];
  if (seedPages.length === 0) {
    try {
      const resp = await fetchWithTimeout(
        baseUrl,
        {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36',
            Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
          },
        },
        6000
      );
      if (resp.ok && (resp.headers.get('content-type') || '').includes('text/html')) {
        textPool.push(await resp.text());
      }
    } catch {}
  } else {
    for (const s of seedPages) textPool.push(s);
  }

  // 1. Verify guesses by checking if any of them appear in the text
  for (const html of textPool) {
    const lower = html.toLowerCase();
    for (const c of candidates) {
      if (lower.includes(c.toLowerCase()) && !isFakeEmail(c)) return c;
    }
  }

  // 2. Find any email in the text that ends with @<domain>
  for (const html of textPool) {
    const emails = extractEmailsFromHtml(html);
    for (const e of emails) {
      if (e.endsWith('@' + domain) && !isFakeEmail(e)) return e;
    }
  }

  // 3. If nothing found, return the highest-yield pattern anyway so SMTP can verify
  return candidates[0];
}

// ───────────────── STAGE 3: Email verification (pure DNS, no third-party APIs) ─────────────────
// Raw TCP SMTP (port 25) blocked on Vercel. We do multi-layer DNS verification:
//   1. Syntax validation 2. Disposable/typo check 3. MX + SPF + DMARC + A/AAAA records
//   4. Catch-all detection 5. Confidence scoring 6. Role-based flagging
import { promises as dns } from 'node:dns';

const ROLE_PREFIXES = new Set([
  'info', 'contact', 'office', 'hello', 'admin', 'manager', 'owner', 'support',
  'sales', 'service', 'team', 'leasing', 'reception', 'frontdesk', 'reservations',
  'booking', 'help', 'inquiries', 'mail', 'email', 'webmaster', 'postmaster',
  'hr', 'accounting', 'billing', 'marketing', 'pr', 'media', 'jobs', 'careers',
  'newsletter', 'noreply', 'no-reply', 'donotreply',
]);

const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com', 'guerrillamail.com', '10minutemail.com', 'tempmail.com',
  'throwawaymail.com', 'yopmail.com', 'trashmail.com', 'sharklasers.com',
  'burnermail.io', 'tempmail.net', 'temp-mail.org', 'fakeinbox.com',
  'maildrop.cc', 'getnada.com', 'dispostable.com', 'mailexpire.com',
  'spamgourmet.com', 'mytemp.email', 'tempemail.net', 'throwaway.email',
  'mailnator.com', 'maileater.com', 'mintemail.com', 'mohmal.com',
  'mytrashmail.com', 'norulesfox.com', 'nowmymail.com', 'one-time.email',
  'owleyes.ch', 'petrzilka.net', 'quickinbox.com', 'rcpt.at',
  'receiveee.com', 'recyclemail.dk', 'regbypass.com', 'safemail.net',
  'samsclass.info', 'selfdestructingmail.com', 'send22u.info', 'sendfree.cc',
  'senseless-entertainment.com', 'shorterurl.com', 'sneakemail.com',
  'sogetthis.com', 'soodonims.com', 'spam4.me', 'spamavert.com',
  'spambob.com', 'spambob.net', 'spambob.org', 'spamex.com',
  'spamfree24.org', 'spamgoes.in', 'spamhereplease.com', 'spamhole.com',
  'spamify.com', 'spaminator.de', 'spamkill.info', 'spaml.com',
  'spamoff.de', 'spamstack.net', 'spamthis.co.uk', 'spamtrail.com',
  'spamty.com', 'spamx.net', 'spamzilla.net', 'speed.1s.fr',
  'suremail.info', 'techemail.com', 'teleworm.us', 'tempemail.co',
  'tempinbox.com', 'tempinbox.co', 'tempmail.it', 'tempmail2.com',
  'tempoor.com', 'temporaryforwarding.com', 'temporaryinbox.com',
  'thankyou2010.com', 'thc.st', 'theinternetemail.com', 'thisisnotmyrealemail.com',
  'throwaway.de', 'throwaway.email', 'trash2009.com', 'trash2010.com',
  'trashdevil.de', 'trashemail.de', 'trashmail.at', 'trashmail.me',
  'trashmail.net', 'trashymail.com', 'trashymail.net', 'tyldd.com',
  'uggsrock.com', 'wegwerfmail.de', 'wegwerfmail.net', 'wh4f.org',
  'whyspam.me', 'willselfdestruct.com', 'winemaven.info', 'wronghead.com',
  'wuzup.net', 'xagloo.com', 'xemaps.com', 'xents.com', 'xmaily.com',
  'xoxy.net', 'yep.it', 'yogamaven.com', 'yopmail.fr', 'yopmail.net',
  'ypmail.webarnak.fr.eu.org', 'yuurok.com', 'zehnminutenmail.de',
  'zippymail.info', 'zoaxe.com', 'zoemail.org', '0815.ru', '0clickemail.com',
  '1ce.us', '1shivom.com', '2prong.com', '3tr6tr.com', '4gfdsgfdgfdgfdgfdgfd.com',
  '5mailer.com', '6paq.com', '99experts.com', 'a-bc.net', 'abc.com',
  'abyss.email', 'acrossgracealps.com', 'adsd.org', 'adambrault.net',
  'adelaide.bike', 'aegde.com', 'aegia.net', 'aerobatic.net', 'afrobacon.com',
  'ag.us.to', 'akapost.com', 'akir.com', 'almaer.com', 'amigastorm.com',
  'amilegit.com', 'anappthat.com', 'ano-mail.net', 'anonymail.net',
  'anonymize.com', 'anonymousmail.net', 'anonymouse.org', 'antichef.com',
  'antichef.net', 'antiqueemail.com', 'anyalias.com', 'aol.com',
  'apkmd.com', 'archetypeemail.com', 'artmanstudios.net', 'arvato-community.de',
  'atnextmail.com', 'autotwollow.com', 'avastc.com', 'awiki.org',
  'axiscapital.biz', 'axiz.org', 'azazazatashkent.tk', 'bamboomail.com',
  'bargamesonline.org', 'bauwerke15.com', 'bcaoo.com', 'beddly.com',
  'beefmilk.com', 'bellbuffs.com', 'bepcon.net', 'bestats.top', 'biduwell.com',
  'bigprofessor.so', 'bigstring.com', 'binkmail.com', 'bio-muesli.net',
  'bko.kiev.ua', 'blogos.com', 'bluebottle.com', 'bnote.com', 'bodhi.laughing',
  'bofthew.com', 'bonobo.email', 'bookthemmove.com', 'bootybay.de',
  'borged.com', 'borged.net', 'borged.org', 'boun.cr', 'bouncemail.net',
  'boxformail.com', 'boximail.com', 'boxtemp.com.br', 'brefmail.com',
  'brennendesreich.de', 'broadbandninja.com', 'bsnow.net', 'buffemail.com',
  'business-success.com', 'buspad.org', 'bussink.net', 'buymoreplays.com',
  'buyusedlibrarybooks.org', 'byom.de', 'cachedot.net', 'card.zp.ua',
  'cartelera.org', 'caseedu.com', 'cbair.com', 'cd.mintemail.com',
  'ce.mintemail.com', 'cek.pm', 'cellurl.com', 'centermail.com',
  'centermail.net', 'chacuo.net', 'chilelinks.cl', 'choco.la', 'christopherfretz.com',
  'cinnamonmail.com', 'citywalk.com', 'clandest.in', 'clrmail.com',
  'cmail.net', 'cnn.com', 'cock.li', 'codenode.net', 'coieo.com',
  'coldemail.info', 'cpay.cc', 'cr97mt49.com', 'crankmails.com',
  'crapmail.org', 'crazydollars.com', 'cubicmelon.com', 'curryworld.de',
  'cust.in', 'cutout.club', 'cyber-innovation.club', 'cyber-phone.eu',
  'dahongshi.net', 'dandikmail.com', 'davidhoffmanart.com', 'dcemail.com',
  'deadaddress.com', 'deadchildren.org', 'deadfake.cf', 'deadspam.com',
  'deagot.com', 'dealja.com', 'delikkt.de', 'despam.it', 'despammed.com',
  'dev-null.cf', 'devnullmail.com', 'dfgh.net', 'dharmatel.net',
  'digitalsanctuary.com', 'dingbone.com', 'discard.email', 'discardmail.com',
  'discardmail.de', 'disposable-email.ml', 'disposable.cf', 'disposable.ga',
  'disposable.ml', 'dodgeit.com', 'dodgit.com', 'dodgit.org', 'dodsi.com',
  'doiea.com', 'domozmail.com', 'donemail.ru', 'dontreg.com', 'dontsendmespam.de',
  'dotnom.com', 'dotman.de', 'drdrb.com', 'drdrb.net', 'dspam.de', 'dyceroprojects.com',
  'dz17.net', 'e-mail.com', 'e-mail.org', 'e4ward.com', 'easytrashmail.com',
  'einmalmail.de', 'einrot.com', 'eintagsmail.de', 'email-fake.cf',
  'email-fake.ga', 'email-fake.gq', 'email-fake.ml', 'email-fake.tk',
  'email.cbes.net', 'email60.com', 'emaildienst.de', 'emailgo.de',
  'emailias.com', 'emailinfive.com', 'emailisvalid.com', 'emaillime.com',
  'emailmiser.com', 'emailna.co', 'emailondeck.com', 'emails.ga',
  'emailsy.info', 'emailtemporario.com.br', 'emailto.de', 'emailtmp.com',
  'emailwarden.com', 'emailx.org', 'emailz.cf', 'emailz.ga', 'emailz.gq',
  'emailz.ml', 'emkei.cf', 'emlhub.com', 'emlpro.com', 'emltmp.com',
  'enterto.com', 'ephemail.net', 'etgdev.de', 'ether123.net', 'etranquil.com',
  'etranquil.net', 'etranquil.org', 'evopo.com', 'explodemail.com',
  'ez.lv', 'f4k.es', 'fabricant.ru', 'fag.wf', 'failbone.com', 'fake-email.ml',
  'fake-mail.cf', 'fakedemail.com', 'fakemail.fr', 'fakemail.gq', 'fakemail.ml',
  'fakemailgenerator.com', 'fakemailz.com', 'fanclub.pm', 'farmercowboy.com',
  'fastacura.com', 'fastchevy.com', 'fastchrysler.com', 'fastkawasaki.com',
  'fastmazda.com', 'fastmitsubishi.com', 'fastnissan.com', 'fastsubaru.com',
  'fastsuzuki.com', 'fasttoyota.com', 'fastyamaha.com', 'fatflap.com',
  'fdfdsfds.com', 'fightallspam.com', 'figjs.com', 'fiifke.de', 'fixmail.tk',
  'fizmail.com', 'fleckens.hu', 'flemail.ru', 'flurred.com', 'flyspam.com',
  'footard.com', 'forfry.com', 'forgetmail.com', 'fortuna7.com', 'foxja.com',
  'fr33mail.info', 'frapmail.com', 'freakmail.de', 'free-email.cf',
  'freebabysittercam.com', 'freechristianbookstore.com', 'freedompop.us',
  'freegiftcardrewards.net', 'freemail.ms', 'freemail.tweakly.net',
  'freemailonline.us', 'freemails.cf', 'freemails.ga', 'freemails.ml',
  'freerunning-club.com', 'freetmail.in', 'freewebmaill.com', 'friendlymail.co.uk',
  'front14.org', 'ftp.sh', 'fuckme69.club', 'fudgerub.com',
  'fux0ringduh.com', 'fyii.de', 'gabrielefiletti.com', 'galaxy.tv',
  'garage46.com', 'garrymccooey.com', 'gav0.com', 'gexige.com',
  'gibmadtroszaskakasiemordy.com', 'girlmail.win', 'gmal.com', 'gmx.com',
  'goatmail.uk', 'gomail.in', 'googlegroups.com', 'gorillaswithdirtyarmpits.com',
  'gothere.biz', 'great-host.in', 'greensloth.com', 'greggamel.com',
  'grr.la', 'gsrv.co.uk', 'gsxstring.ga', 'gustore.it', 'gynzi.co.uk',
  'gynzi.com', 'h8s.org', 'h9js8.gq', 'habitue.net', 'hackersquad.com',
  'hackthatthang.com', 'halofarm.com', 'happytrashmail.com', 'harakirimail.com',
  'hartbot.de', 'hash.pp.ua', 'hat-geld.de', 'hatespam.org', 'hawrong.com',
  'hazelnutpatisserie.com', 'hazelnutpatisserie.net', 'hellodino.ml',
  'helloricky.com', 'helpinghandtaxcenter.org', 'herp.in', 'hidemail.de',
  'hidemail.pro', 'hidemail.us', 'hidzz.com', 'hmail.us', 'hochsitze.com',
  'hopoverview.com', 'hopto.org', 'hot-mail.cf', 'hot-mail.ga', 'hot-mail.gq',
  'hot-mail.ml', 'hotmail-redirect.com', 'hotmailbox.re', 'hotmial.com',
  'hstermail.com', 'hugmunsta.com', 'hukkmu.com', 'hulapla.de',
  'humeurlinux.fr', 'huskion.net', 'hvastudiesucces.nl', 'i6.cloudns.cc',
  'ibnare.com', 'icereach.email', 'ichigo.me', 'iheartspam.org', 'ikbenspamvrij.nl',
  'ilmare.ga', 'ilovespam.com', 'imails.info', 'imapmail.org', 'imgof.com',
  'imstations.com', 'inaby.com', 'iname.com', 'inbox.si', 'inboxalias.com',
  'inboxbear.com', 'inboxclean.com', 'inboxclean.org', 'inboxdesign.me',
  'inboxed.pw', 'inboxhub.net', 'inboxkitten.com', 'inboxproxy.com',
  'inboxstore.me', 'incognitomail.com', 'incognitomail.net', 'incognitomail.org',
  'ind.st', 'indieclan.net', 'indigobook.com', 'ineec.net', 'info66.com',
  'inmynetwork.cf', 'inmynetwork.ga', 'inmynetwork.gq', 'inmynetwork.ml',
  'insanumingeniumhome.com', 'insorg-mail.info', 'instant-mail.de',
  'instantmailaddress.com', 'internetoftags.com', 'intopwa.com', 'intopwa.net',
  'iopmail.com', 'iopmail.net', 'iopmail.org', 'ip4.pp.ua', 'ip6.li',
  'ip6.pp.ua', 'ipoo.org', 'irish2me.com', 'iroid.com', 'isosq.com',
  'istiii.com', 'it7.ovh', 'itunesgiftcodegenerator.com', 'iwantumakey.com',
  'jafps.com', 'jamesbond.xyz', 'je-recycle.info', 'jetable.com', 'jetable.fr.nf',
  'jetable.net', 'jetable.org', 'jmail.ro', 'jmtop.net', 'joelpet.com',
  'johansen.xyz', 'josesantos.org', 'jourrapide.com', 'jsrsolutions.com',
  'jswfdb48.com', 'judiss.me', 'jungkamushukum.com', 'kademen.com',
  'kaparkapa.pl', 'kartvelo.me', 'kavyt.com', 'kbox.li', 'kcrw.de',
  'keepmymail.com', 'keinpardon.de', 'kennedy808.com', 'ketrd.com',
  'kimsdisk.com', 'kismail.ru', 'kisstwink.com', 'kitnastar.com',
  'kjksp.com', 'kler.xyz', 'klipschx12.com', 'kook.ml', 'kopeechka.store',
  'kostenlosmail.com', 'koszmail.pl', 'kulturbetrieb.info', 'kurzepost.de',
  'kwift.net', 'l33r.eu', 'labetteraverouge.at', 'lacedmail.com',
  'laeuro2016.com', 'lak.pp.ua', 'landmail.co', 'laoeq.com', 'last-chance.pro',
  'lastmail.co', 'lastmail.com', 'lavabit.com', 'lawlita.com', 'lazycat.cloud',
  'ldop.com', 'ldtp.com', 'leeching.net', 'lellno.gq', 'lenovo1.xyz',
  'letmeinonthis.com', 'letthemeatspam.com', 'lifetimefriends.info',
  'lillemap.net', 'link2mail.net', 'linksafemail.com', 'linshiyouxiang.net',
  'live.co.uk', 'liveradio.tk', 'livingsalty.net', 'lolfje.xyz',
  'loveme.lefora.com', 'lovesea.gq', 'lpfmgmtltd.com', 'lr78.com',
  'lroid.com', 'lukecarriere.com', 'lukop.dk', 'luv2.us', 'm4ilweb.info',
  'maboard.com', 'macr2.com', 'macroev.com', 'madcrazy.com', 'madmaker.com.tr',
  'maffia.com', 'magamail.com', 'mail-filter.com', 'mail-temp.com',
  'mail.bulgarianheadhunter.com', 'mail.by', 'mail.wtf', 'mail0.ga',
  'mail1a.de', 'mail21.cc', 'mail22.club', 'mail22.space', 'mail2rss.org',
  'mail333.com', 'mail4trash.com', 'mail6.serv00.net', 'mail7.io',
  'mail8.xyz', 'mailabg.com', 'mailback.com', 'mailbidon.com',
  'mailbiz.biz', 'mailblocks.com', 'mailbucket.org', 'mailcat.biz',
  'mailcatch.com', 'mailchop.com', 'mailcker.com', 'mailde.de', 'mailde.info',
  'maildrop.cc', 'maileater.com', 'mailexpire.com', 'mailf5.com',
  'mailfa.tk', 'mailfall.com', 'mailforspam.com', 'mailfree.ga',
  'mailfree.gq', 'mailfree.ml', 'mailfreedom.com', 'mailgo.de',
  'mailguard.me', 'mailgutter.com', 'mailhazard.com', 'mailhazard.us',
  'mailhex.com', 'mailhub.pro', 'mailhz.me', 'mailimate.com',
  'mailin8r.com', 'mailinater.com', 'mailinator.co.uk', 'mailinator.com',
  'mailinator.gq', 'mailinator.info', 'mailinator.net', 'mailinator.org',
  'mailinator.us', 'mailinator2.com', 'mailinatorzz.ml', 'mailinto.com',
  'mailismagic.com', 'mailita.tk', 'mailjunk.net', 'mailmate.com',
  'mailme.gq', 'mailme.ir', 'mailme.lv', 'mailmenot.info', 'mailmetrash.com',
  'mailmoat.com', 'mailmoth.com', 'mailms.com', 'mailnator.com',
  'mailnesia.com', 'mailnull.com', 'mailo.com', 'mailox.biz', 'mailox.fun',
  'mailpick.biz', 'mailpooch.com', 'mailproxsy.com', 'mailquack.com',
  'mailr24.com', 'mailrocket.biz', 'mailscrap.com', 'mailseal.de',
  'mailshiv.com', 'mailshiv.me', 'mailsiphon.com', 'mailslapping.com',
  'mailslite.com', 'mailspam.xyz', 'mailtemp.net', 'mailtemp.org',
  'mailtome.de', 'mailtothis.com', 'mailtraps.com', 'mailtrash.net',
  'mailtrix.net', 'mailuniverse.co.uk', 'mailvip.com', 'mailw.info',
  'mailwire.com', 'mailworks.org', 'mailzi.ru', 'mailzilla.com',
  'mailzilla.org', 'makemetheking.com', 'manna.lt', 'mansiondev.com',
  'manybrain.com', 'markmurfin.com', 'mbx.cc', 'mciek.com', 'mega.zik.dj',
  'meinspamschutz.de', 'meltmail.com', 'mergelu.ga', 'mhdsl.com',
  'mial.tk', 'migmail.net', 'migmail.pl', 'migumail.com', 'mijnhier.nl',
  'ministry-of-silly-walks.de', 'mintemail.com', 'misterpinball.com',
  'ml8.ca', 'mobi.web.id', 'moburl.com', 'mohmal.com', 'mohmal.im',
  'mohmal.in', 'mohmal.tech', 'moncourrier.fr.nf', 'monemail.fr.nf',
  'mongolemountain.com', 'monkeybanana.com', 'monoopost.com', 'montefuji.xyz',
  'moophz.com', 'mooreg.ml', 'mopslik.com', 'mor19.uu.gl', 'moreawesomethanyou.com',
  'moreorcs.com', 'morriesworld.ml', 'moru.pl', 'mrvpm.net', 'msa.minsmail.com',
  'msgden.com', 'mshome.net', 'msxn1.com', 'mt2009.com', 'mt2014.com',
  'mt2015.com', 'muehlacker.tk', 'muell.xyz', 'mufux.com', 'munoubengoshi.gq',
  'mutant.me', 'muttvomit.com', 'my-email.ga', 'my-temp.email', 'my10minutemail.com',
  'myalias.pw', 'mycard.net.ua', 'mycleaninbox.net', 'mycorneroftheinter.net',
  'myemailboxy.com', 'mygeoweb.info', 'myindohome.services', 'myinterserver.ml',
  'mykickassideas.com', 'mymail-in.net', 'mymail90.com', 'mymailoasis.com',
  'mynetstore.de', 'myopang.com', 'mypacks.net', 'mypartyclip.de',
  'myphantomemail.com', 'myspamless.com', 'mytemp.email', 'mytempemail.com',
  'mytrashmail.com', 'myzx.com', 'n1nja.org', 'nabuma.com', 'nada.email',
  'nada.ltd', 'nanonym.ch', 'nationalgardeningclub.com', 'nawmin.info',
  'nbzmr.com', 'negated.com', 'neomailbox.com', 'nepwk.com', 'nervhq.org',
  'netmails.com', 'netmails.net', 'netricity.nl', 'netris.net', 'netviewer-france.com',
  'nevermail.de', 'nextstopvalhalla.com', 'nfast.net', 'nguyenusedcars.com',
  'nicebush.com', 'nicegarden.com', 'nicewood.com', 'nicolastuazon.com',
  'nightlytech.com', 'nincsmail.hu', 'niwl.net', 'nm7.cc', 'nnh.com',
  'nnot.net', 'no-spam.ws', 'no-ux.com', 'nobulk.com', 'nobuma.com',
  'noclickemail.com', 'nodezine.com', 'nogmailspam.info', 'noicd.com',
  'nokiamail.com', 'nolemail.ga', 'nom.za', 'nomail.cf', 'nomail.ga',
  'nomail.pw', 'nomail.xl.cx', 'nomorespamemails.com', 'nonspam.eu',
  'nonspammer.de', 'noref.in', 'norseforce.com', 'nospam.ze.tc',
  'nospam4.us', 'nospamfor.us', 'nospamthankyou.com', 'notmailinator.com',
  'notrnailinator.com', 'nowhere.org', 'nowmymail.com', 'ntlhelp.net',
  'nubescontrol.com', 'nullbox.info', 'nutpa.net', 'nwldx.com', 'o2.pl',
  'o7i.net', 'obispmail.com', 'odnorazovoe.ru', 'oepia.com', 'oerpub.org',
  'offshore.cf', 'ohcleaner.com', 'oidzc.com', 'oilanalyzer.info', 'okclprojects.com',
  'olypmall.ru', 'omail.pro', 'omnievents.org', 'one-time.email',
  'one2mail.info', 'oneoffmail.com', 'onewaymail.com', 'onlatedotcom.info',
  'online.ms', 'onmail.win', 'onotech.com', 'ontyne.biz', 'oohioo.com',
  'opayq.com', 'opentrash.com', 'opmmedia.ga', 'opp24.com', 'ordinaryamerican.net',
  'ordinaryyzc.xyz', 'oroki.de', 'otherinbox.com', 'ourklips.com', 'outlawspam.com',
  'ovpn.to', 'owlpic.com', 'oxfarm1.com', 'ozyl.de', 'pa9e.tk', 'paban.win',
  'pagamenti.tk', 'pancakemail.com', 'paplease.com', 'parcel4.net',
  'parisbienaimer.fr.nf', 'password.colafanta.cf', 'passwordmail.com',
  'pastebitch.com', 'paulkippes.com', 'pavilionx2.com', 'payperex2.com',
  'peapz.com', 'pecinan.com', 'pepbot.com', 'peterzeman.com', 'petrzilka.net',
  'pfui.ru', 'photomark.net', 'pi.vu', 'pier14.com', 'pinehill-seattle.org',
  'pingir.com', 'pisls.com', 'pjjkp.com', 'placemail.net', 'pleasenospam.net',
  'plexolan.de', 'plw.me', 'poczta.online', 'pojok.ml', 'polarkingxx.ml',
  'ponp.be', 'poofy.org', 'pookmail.com', 'postonline.cc', 'poutineyourface.com',
  'powerencry.com', 'powered.name', 'pp.ua', 'presswithvicky.com', 'primabananen.net',
  'prin.be', 'print2inbox.com', 'private-mail.xyz', 'privateemail.co',
  'privatemail.cf', 'privatemail.ga', 'privatemail.ml', 'pro-tag.org',
  'projectcl.com', 'projop.com', 'promaild.com', 'promails.xyz', 'proprietativalcea.ro',
  'proxymail.eu', 'prtnx.com', 'prtz.eu', 'psh.me', 'punkass.com', 'purplemail.ga',
  'put2.net', 'puttanamaiala.tk', 'pw-mail.cf', 'pw-mail.ga', 'pw-mail.gq',
  'pw-mail.ml', 'pwp.lv', 'qacquire.com', 'qasti.com', 'qbfree.us',
  'qezz.com', 'qipmail.net', 'qiq.us', 'qoika.com', 'qopmail.com',
  'qpalong.com', 'qs.dp51.com', 'quadrafit.com', 'quickinbox.com',
  'quickmail.nl', 'qvy.me', 'qwertymail.com', 'r8r4p0.com', 'raakkes.com',
  'radiodora.com', 'rainmails.com', 'rapt.be', 'raptor.gold', 'rcpt.at',
  're-gister.com', 'readyforyou.info', 'receiveee.com', 'receptum.eu',
  'recyclemail.dk', 'reddit.xyz', 'reddithub.com', 'redfue.com', 'regbypass.com',
  'regspaces.tk', 'rejectmail.com', 'reliable-mail.com', 'remail.cf',
  'remail.ga', 'remote.li', 'renraku.in', 'reptilegenetics.com',
  'resemote.com', 'resistore.net', 'retkesbusz.nhely.hu', 'revolvingdoorhoax.org',
  'rhyta.com', 'richardsonlumber.net', 'ricknology.com', 'ride.li',
  'ringow.com', 'riopreto.com.br', 'risingsuntest.com', 'ro.lt',
  'robertsspaceindustries.com', 'rollindo.agency', 'ronnierage.net',
  'rootfest.net', 'rosebearmylove.ru', 'royal.net', 'royaldoodles.org',
  'rppkn.com', 'rtrtr.com', 'ruru.be', 'rustydoor.com', 's0ny.net',
  'sabrestlouis.com', 'sackboii.com', 'safersignup.com', 'safersignup.de',
  'safetymail.info', 'safetypost.de', 'saharanightstempe.com', 'salmeow.tk',
  'sandelf.de', 'satanicknights.com', 'saynotospams.com', 'scarcelyfilling.com',
  'scatmail.com', 'schafmail.de', 'schmeissweg.tk', 'schrott-email.de',
  'scmail.cf', 'scrsot.com', 'secmail.pw', 'secretemail.de', 'securebox.email',
  'securemail.ga', 'seekapps.com', 'seekfindask.com', 'selfdestructingmail.com',
  'selfdestructingmail.org', 'send22u.info', 'sendfree.org', 'sendhere.org',
  'sendspamhere.com', 'sent.as', 'sent.at', 'sent.com', 'serga.org.ua',
  'servemp3.com', 'sexical.com', 'shhmk.com', 'shhuut.org', 'shieldedmail.com',
  'shieldsemail.com', 'shiftmail.com', 'shitaway.cf', 'shitaway.ga',
  'shitaway.gq', 'shitaway.ml', 'shitaway.tk', 'shitmail.de', 'shitmail.me',
  'shitmail.org', 'shitware.nl', 'shocked.com', 'shootingandmore.com',
  'shortmail.net', 'shotmail.ru', 'showslow.de', 'shrib.com', 'shut.name',
  'shut.ws', 'sibmail.com', 'sify.com', 'simpleitsecurity.info',
  'sinfiltro.cl', 'sinmail.com', 'sis.sy', 'sitesell.net', 'six-six-six.com',
  'skeletonbro.com', 'skrx.tk', 'sky-mail.ga', 'slippery.email', 'slopsmail.com',
  'slushmail.com', 'sly.io', 'smapfree24.com', 'smapfree24.de', 'smapfree24.eu',
  'smapfree24.info', 'smapfree24.org', 'smarttalent.pw', 'smashmail.de',
  'smellfear.com', 'smellrear.com', 'smtp33.com', 'smtp99.com', 'smwg.info',
  'snakepress.com', 'snakopy.gq', 'snapwet.com', 'sneakemail.com',
  'sneakerbunny.com', 'snetfrom.net', 'snkmail.com', 'socialfurry.org',
  'softkey-germany.de', 'softpls.asia', 'sogetthis.com', 'sohai.ml',
  'sohus.cn', 'soodomail.com', 'soodonims.com', 'soon.it', 'spacebate.com',
  'spam-be-gone.com', 'spam.2012-2016.ru', 'spam.care', 'spam.coroiu.com',
  'spam.ee', 'spam.hotfreemail.com', 'spam.su', 'spam.user.meetfriday.com',
  'spam4.me', 'spamail.cf', 'spamail.ga', 'spamail.gq', 'spamail.ml',
  'spamail.tk', 'spamarrest.com', 'spamavert.com', 'spambob.com',
  'spambob.net', 'spambob.org', 'spambog.com', 'spambog.de', 'spambog.net',
  'spambog.ru', 'spambox.info', 'spambox.irishspringrealty.com', 'spambox.me',
  'spambox.org', 'spambox.us', 'spamcannon.com', 'spamcannon.net',
  'spamcero.com', 'spamcon.org', 'spamcorptastic.com', 'spamcowboy.com',
  'spamcowboy.net', 'spamcowboy.org', 'spamday.com', 'spamdecoy.net',
  'spameater.org', 'spamex.com', 'spamfaq.net', 'spamfence.net',
  'spamfighter.de', 'spamfighter.pro', 'spamfree.eu', 'spamfree24.com',
  'spamfree24.de', 'spamfree24.eu', 'spamfree24.info', 'spamfree24.net',
  'spamfree24.org', 'spamgoes.in', 'spamherelots.com', 'spamhereplease.com',
  'spamhole.com', 'spamify.com', 'spaminator.de', 'spamkill.info',
  'spaml.com', 'spamlot.net', 'spammotel.com', 'spamobox.com', 'spamoff.de',
  'spamslicer.com', 'spamsphere.com', 'spamspot.com', 'spamstack.net',
  'spamthis.co.uk', 'spamthisplease.com', 'spamtrail.com', 'spamtrap.ro',
  'spamtroll.net', 'spamwaster.com', 'spamwc.de', 'spamx.net', 'spamzen.xyz',
  'spamzilla.net', 'speed.1s.fr', 'spiderwebforum.com', 'spoofmail.de',
  'spr.io', 'spritzzone.de', 'spybox.de', 'spymail.net', 'squizzy.com',
  'squizzy.net', 'sso-demo.com', 'stexsy.com', 'stinkefinger.net',
  'stop-my-spam.cf', 'stop-my-spam.com', 'stop-my-spam.ga', 'stop-my-spam.ml',
  'storj99.com', 'storj99.top', 'streetwisemail.com', 'stromox.com',
  'stuckmail.com', 'stuffmail.de', 'suburbanthug.com', 'sudolife.me',
  'sudolife.net', 'sudomail.biz', 'sudomail.com', 'sudomail.net',
  'sudoverse.com', 'sudoverse.net', 'sueddeutsche.club', 'sugarbox.net',
  'suioe.com', 'super-auswahl.de', 'supergreatmail.com', 'supermailer.jp',
  'superrito.com', 'superstachel.de', 'suremail.info', 'svip520.cn',
  'svk.jp', 'svxr.org', 'sweetxxx.de', 'swift10minutemail.com', 'sylvannet.com',
  'symphonyresume.com', 'syujob.accountants', 'tabult.com', 'tafmail.com',
  'taglead.com', 'tagmymedia.com', 'talkinator.com', 'tapchicuoihoi.com',
  'taphear.com', 'tawabs.com', 'tb-on-line.net', 'tech-mail.net',
  'techemail.com', 'techgroup.me', 'telecomix.pl', 'telefox.com',
  'telegmail.com', 'teleworm.com', 'teleworm.us', 'temp-mail.com',
  'temp-mail.de', 'temp-mail.org', 'temp-mail.ru', 'tempail.com',
  'tempalias.com', 'tempe-mail.com', 'tempemail.biz', 'tempemail.co.za',
  'tempemail.co', 'tempemail.com', 'tempemail.net', 'tempemail.org',
  'tempinbox.co', 'tempinbox.com', 'tempmail.co', 'tempmail.de',
  'tempmail.eu', 'tempmail.it', 'tempmail.net', 'tempmail.xyz',
  'tempmailaddress.com', 'tempmaildemo.com', 'tempmailer.com', 'tempmailer.de',
  'tempomail.fr', 'temporarily.de', 'temporarioemail.com.br', 'temporaryemail.net',
  'temporaryemail.us', 'temporaryforwarding.com', 'temporaryinbox.com',
  'temporarymailaddress.com', 'tempr.email', 'tempsee.com', 'tench.de',
  'tensorwells.com', 'testudine.com', 'thanksnospam.info', 'thankyou2010.com',
  'thc.st', 'theaviors.com', 'thebearshark.com', 'thecloudindex.com',
  'thedarkmaster.net', 'thejapanesemapler.com', 'thembones.com.au',
  'theoke.net', 'thepinktank.com', 'theplug.org', 'thepubdigest.com',
  'theteastory.com', 'thex.ro', 'thinstall.com', 'thraml.com',
  'throam.com', 'thrott.com', 'throw.am', 'throwaway.email',
  'throwaway.xyz', 'throwawayemailaddress.com', 'throwawaymail.com',
  'throwawaymail.pp.ua', 'throya.com', 'thunky.space', 'thxmate.com',
  'tiapz.com', 'tilien.com', 'tim-ou-est-toujours-aussi-gentil.fr',
  'tittbit.in', 'tiv.cc', 'tizi.com', 'tjes.com', 'tkitcai.swaggerful.com',
  'tmail.ws', 'tmailinator.com', 'tmails.net', 'tmpeml.info', 'tmpjr.me',
  'tmpmail.net', 'tmpmail.org', 'toddsbighug.com', 'toiea.com',
  'tokem.co', 'tokenmail.net', 'tonymanso.com', 'toomail.biz',
  'top101.de', 'topranklist.de', 'toprumours.com', 'tormail.org',
  'toss.pw', 'totalvista.com', 'tough.biz', 'toughkidmag.com',
  'tqoai.com', 'tqoai.net', 'tr2k.co', 'trainmail.com', 'tranceversal.com',
  'trash-2009.com', 'trash-me.com', 'trash2009.com', 'trash2010.com',
  'trash2011.com', 'trash247.com', 'trashail.com', 'trashbox.de',
  'trashcanmail.com', 'trashdevil.com', 'trashdevil.de', 'trashemail.de',
  'trashinbox.com', 'trashmail.at', 'trashmail.com', 'trashmail.de',
  'trashmail.ga', 'trashmail.gq', 'trashmail.io', 'trashmail.me',
  'trashmail.net', 'trashmail.org', 'trashmail.ws', 'trashmailer.com',
  'trashmails.com', 'trashymail.com', 'trashymail.net', 'trasz.com',
  'trayna.com', 'trbvm.com', 'trbvn.com', 'trbvo.com', 'trialmail.de',
  'trickmail.net', 'trillianpro.com', 'trimsj.com', 'trobertqs.com',
  'tropicalbass.info', 'trumpmail.com', 'trung.name.vn', 'tryalert.com',
  'tryninja.io', 'tryprice.co', 'turoid.com', 'turual.com', 'tverya.com',
  'twinmail.de', 'twistsandturns.org', 'twkly.ml', 'twocowmail.net',
  'twoweird.com', 'tyldd.com', 'ubismail.net', 'ubm MD5', 'ucupdong.ml',
  'uggsrock.com', 'uguuchantele.com', 'uhhu.ru', 'uk.to', 'umy.kro.kr',
  'unboundedmetrics.com', 'undisclosedserver.com', 'unforgetful.com',
  'unicodeworld.com', 'unimatrix.org', 'uniqueemailaddress.com',
  'unkn0wn.xyz', 'unlimit.ml', 'unmail.ru', 'upcma.xyz', 'upliftnow.com',
  'uplipht.com', 'uploadnolimit.com', 'upravo.gq', 'upstairs2nd.com',
  'ureach.com', 'urfey.com', 'urfunktion.se', 'us.af', 'us.to',
  'usa.cc', 'utiket.us', 'uu.gl', 'uwork4.us', 'uyhip.com',
  'vaasfc4.tk', 'valemail.net', 'valhallafrontier.com', 'valleyoflego.com',
  'vampirefreaks.com', 'vbmail.com', 'vctel.com', 'vcv.net', 'vedula.com',
  'vektik.com', 'vemomail.win', 'venompen.com', 'ver0.cf', 'ver0.ga',
  'ver0.gq', 'ver0.ml', 'ver0.tk', 'vercelli.cf', 'vercelli.ga',
  'vercelli.gq', 'vercelli.ml', 'verifymail.win', 'verpipes.com',
  'veryday.ch', 'veryday.eu', 'veryday.info', 'veryfast.biz',
  'veryrealemail.com', 'vesa.pw', 'vfemail.net', 'vickaentb.tk',
  'victime.ninja', 'victoriantwins.com', 'vidchart.com', 'viditag.com',
  'viewcastmedia.com', 'viewcastmedia.net', 'vignettecrest.com',
  'vimail24.com', 'vinernet.com', 'violin24.ga', 'vipepe.com',
  'viperace.com', 'vipmail.name', 'vipmail.pw', 'vipxm.net',
  'viralemail.com', 'virgilio.it', 'visal007.tk', 'visal168.tk',
  'vixletdev.com', 'vkcode.ru', 'vmail.me', 'vmailing.info', 'vmani.com',
  'vmpanda.com', 'voidbay.com', 'vomoto.com', 'vorga.org', 'votiputox.org',
  'voxelcore.com', 'vpn.st', 'vps30.com', 'vps911.net', 'vrad.da.cx',
  'vsimcard.com', 'vsssms.com', 'vualta.com', 'vubby.com', 'vumq.com',
  'vy.ek.la', 'w3internet.co.uk', 'wakingupesther.com', 'walala.org',
  'walkmail.net', 'walkmail.ru', 'wangjunkai.com', 'wank.com', 'want2lov.us',
  'wantplay.site', 'warau-kadawa.com', 'warimail.com', 'warnednl2.com',
  'watchfrog.net', 'watchfull.net', 'wawi.email', 'wazo.com', 'wbdet.com',
  'we.lovebitco.in', 'we.qq.my', 'webtrip.ch', 'webuser.in', 'wee.my',
  'weg-werf-mail.de', 'wegwerf-email-addressen.de', 'wegwerf-email.de',
  'wegwerf-email.net', 'wegwerf-emails.de', 'wegwerfadresse.de',
  'wegwerfemail.de', 'wegwerfmail.de', 'wegwerfmail.net', 'wegwerfmail.org',
  'wegwerpost.com', 'wegwurfmail.de', 'welikecookies.com', 'wellhungup.com',
  'welshspanish.com', 'wendygary.com', 'westcanadatriathlon.com',
  'wha.la', 'whatiaas.com', 'whatifanalytics.com', 'whatpaas.com',
  'whatsaas.com', 'whipppet.com', 'whitemail.xyz', 'wh4f.org', 'whyspam.me',
  'wicked.cricket', 'wickedgame.cricket', 'wickedxyz.cricket',
  'widaryanto.info', 'wilemail.com', 'willhackforfood.biz', 'willselfdestruct.com',
  'wimsg.com', 'winemaven.info', 'wins.com.br', 'wlistp.com',
  'wmail.cf', 'wmail.ga', 'wmail.gq', 'wmail.ml', 'wmail.tk',
  'wmkowa.com', 'wokcy.com', 'wolfmail.ml', 'wolfsmail.tk', 'wollan.info',
  'worldspace.link', 'wpg.im', 'writeme.com', 'writeme.us', 'wronghead.com',
  'wuzup.net', 'wuzupmail.net', 'wwjmp.com', 'wwwnew.eu', 'x24.com',
  'xagloo.com', 'xasd.com', 'xcode.ro', 'xcompress.com', 'xcxcx.com',
  'xemaps.com', 'xents.com', 'xfanys.com', 'xing886.uu.gl', 'xjoi.com',
  'xl.cx', 'xmail.com', 'xmailer.be', 'xmaily.com', 'xnmail.ml',
  'xoxox.cc', 'xperiae5.com', 'xrho.com', 'xvx.us', 'xwaretech.com',
  'xwaretech.info', 'xwaretech.net', 'xww.ro', 'xy9ce.tk', 'xyzfree.net',
  'xzavier.com', 'xzlive.com', 'yapmail.com', 'yapped.net', 'ycare.de',
  'ycn.ro', 'ye.biz.st', 'ye.vc', 'yep.it', 'yewma.co', 'yhg.biz',
  'yingshuo.com', 'ymail.net', 'ymail.org', 'ynmrealty.com', 'yodx.com',
  'yogamaven.com', 'yomail.info', 'yoo.ro', 'yopmail.com', 'yopmail.fr',
  'yopmail.gq', 'yopmail.net', 'yopmail.org', 'yordanmail.cf',
  'yoursuccessfulbusiness.info', 'ypmail.webarnak.fr.eu.org', 'yroid.com',
  'yuurok.com', 'z1p.biz', 'za.com', 'zahuy.site', 'zasod.com',
  'zebins.com', 'zebins.eu', 'zehnminuten.de', 'zehnminutenmail.de',
  'zepp.dk', 'zetmail.com', 'zhcne.com', 'zhouemail.510520.org',
  'ziggo.com', 'zombie-hive.com', 'zomg.info', 'zoaxe.com', 'zoemail.com',
  'zoemail.net', 'zoemail.org', 'zomg.info', 'zoonenos.com', 'zoqqa.com',
  'zp.ua', 'zumpia.com', 'zxcv.com', 'zxcvbnm.com', 'zybermail.com',
  'zytr.xyz', 'zzz.com', 'zzz.pl',
]);

const COMMON_TYPOS = new Map([
  ['gnail.com', 'gmail.com'], ['gmal.com', 'gmail.com'], ['gmial.com', 'gmail.com'],
  ['gmali.com', 'gmail.com'], ['gamil.com', 'gmail.com'], ['gmaill.com', 'gmail.com'],
  ['gmil.com', 'gmail.com'], ['yaho.com', 'yahoo.com'], ['yahooo.com', 'yahoo.com'],
  ['yhoo.com', 'yahoo.com'], ['yahho.com', 'yahoo.com'], ['hotmal.com', 'hotmail.com'],
  ['hotmial.com', 'hotmail.com'], ['hotmaill.com', 'hotmail.com'], ['homail.com', 'hotmail.com'],
  ['outlok.com', 'outlook.com'], ['outllok.com', 'outlook.com'], ['outolok.com', 'outlook.com'],
]);

const DISPOSABLE_PATTERNS = [
  /^temp/, /^tmp/, /^throw/, /^trash/, /^spam/, /^junk/, /^fake/, /^disposable/,
  /^10minute/, /^guerrilla/, /^mailinator/, /^yopmail/, /^\d+.*mail/,
];

function isValidEmailSyntax(email) {
  if (!email || typeof email !== 'string') return false;
  if (email.length < 5 || email.length > 254) return false;
  const parts = email.split('@');
  if (parts.length !== 2) return false;
  const [local, domain] = parts;
  if (!local || !domain) return false;
  if (local.length > 64) return false;
  if (!/^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+$/.test(local)) return false;
  if (local.startsWith('.') || local.endsWith('.')) return false;
  if (local.includes('..')) return false;
  if (!/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(domain)) return false;
  if (domain.startsWith('.') || domain.endsWith('.')) return false;
  if (domain.includes('..')) return false;
  return true;
}

function checkEmailTypo(domain) {
  return COMMON_TYPOS.get(domain.toLowerCase()) || null;
}

function isDisposableDomain(domain) {
  const d = domain.toLowerCase();
  if (DISPOSABLE_DOMAINS.has(d)) return true;
  for (const pattern of DISPOSABLE_PATTERNS) {
    if (pattern.test(d)) return true;
  }
  return false;
}

async function domainHasRecords(domain) {
  try {
    const [mx, a, aaaa, spf, dmarc] = await Promise.allSettled([
      dns.resolveMx(domain),
      dns.resolve4(domain),
      dns.resolve6(domain),
      dns.resolveTxt(domain),
      dns.resolveTxt(`_dmarc.${domain}`),
    ]);
    if (mx.status === 'fulfilled' && mx.value.length > 0) return true;
    if (a.status === 'fulfilled' && a.value.length > 0) return true;
    if (aaaa.status === 'fulfilled' && aaaa.value.length > 0) return true;
    return false;
  } catch {
    return false;
  }
}

async function checkDnsQuality(domain) {
  let score = 0;
  try {
    const [mx, spf, dmarc] = await Promise.allSettled([
      dns.resolveMx(domain),
      dns.resolveTxt(domain),
      dns.resolveTxt(`_dmarc.${domain}`),
    ]);
    if (mx.status === 'fulfilled' && mx.value.length > 0) {
      const mxCount = mx.value.length;
      score += Math.min(mxCount, 3) * 10;
    }
    if (spf.status === 'fulfilled') {
      const hasSpf = spf.value.some(txt => txt.join('').includes('v=spf1'));
      if (hasSpf) score += 15;
    }
    if (dmarc.status === 'fulfilled') {
      const hasDmarc = dmarc.value.some(txt => txt.join('').includes('v=DMARC'));
      if (hasDmarc) score += 10;
    }
  } catch {}
  return score;
}

function scoreEmailConfidence(email) {
  const local = email.split('@')[0].toLowerCase();
  if (ROLE_PREFIXES.has(local)) return 0.55;
  if (/^[a-z]+\.[a-z]+$/.test(local)) return 0.95;
  if (/^[a-z]+\.([a-z]+\.)+[a-z]+$/.test(local)) return 0.9;
  if (/^[a-z]+[._-][a-z]+[._-]?[a-z]+$/.test(local)) return 0.85;
  if (/^[a-z]+\d*$/.test(local)) return 0.65;
  if (/^[a-z]+\.[a-z]+\d+$/.test(local)) return 0.8;
  if (/^[a-z]+\d+\.[a-z]+$/.test(local)) return 0.75;
  if (/^[a-z]+[._-][a-z]+$/.test(local)) return 0.85;
  return 0.7;
}

async function smtpCheck(email) {
  if (!email || !email.includes('@') || !isValidEmailSyntax(email)) return false;
  const domain = email.split('@')[1].toLowerCase();
  const typoFix = checkEmailTypo(domain);
  if (typoFix) return false;
  if (isDisposableDomain(domain)) return false;
  const hasRecords = await domainHasRecords(domain);
  if (!hasRecords) return false;
  const confidence = scoreEmailConfidence(email);
  const dnsQuality = await checkDnsQuality(domain);
  const finalScore = (confidence * 70) + (dnsQuality * 0.3);
  return finalScore >= 40;
}

// ─────────────── STAGE 4: DuckDuckGo site: search ───────────────
async function stage4_duckduckgoSearch(website, businessName) {
  const domain = extractDomain(website);
  if (!domain) return null;
  const queries = [
    `site:${domain} email`,
    `site:${domain} contact`,
    `"${businessName}" email contact`,
  ];
  for (const q of queries) {
    try {
      const resp = await fetchWithTimeout(
        `https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`,
        {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36',
            Accept: 'text/html',
          },
        },
        6000
      );
      if (!resp.ok) continue;
      const html = await resp.text();
      const emails = extractEmailsFromHtml(html);
      for (const e of emails) {
        if (!isFakeEmail(e) && (e.endsWith('@' + domain) || !e.includes('duckduckgo'))) return e;
      }
    } catch {}
  }
  return null;
}

// ─────────────── Master email finder (orchestrator) ───────────────
async function findEmailForBusiness(place) {
  if (!place.website) return null;
  if (extractDomain(place.website)?.includes('facebook')) return null;

  // STAGE 1: crawl
  let crawled = null;
  const seedPages = [];
  try {
    crawled = await stage1_crawlSite(place.website);
  } catch {}

  if (crawled && crawled.length > 0) {
    // Quick SMTP verify the best candidate
    for (const e of crawled) {
      // eslint-disable-next-line no-await-in-loop
      const ok = await smtpCheck(e);
      if (ok) return e;
    }
    // None verified, return the first plausible one anyway
    return crawled[0];
  }

  // STAGE 2: pattern guess — return best guess regardless of SMTP (unreliable on Vercel)
  const guessed = await stage2_patternGuess(place.website, place.business_type, seedPages);
  if (guessed) return guessed;
  const domain = extractDomain(place.website);
  if (domain) {
    for (const p of ROLE_BOX_PATTERNS) {
      const cand = `${p}@${domain}`;
      if (isFakeEmail(cand)) continue;
      return cand;
    }
  }

  // STAGE 3: external search
  const fromSearch = await stage4_duckduckgoSearch(place.website, place.business_name);
  if (fromSearch) return fromSearch;

  return null;
}

// ────────────────────── Profit score / ranking ──────────────────────
function estimateProfitScore(name, businessType) {
  const lower = ((name || '') + ' ' + (businessType || '')).toLowerCase();
  let base = 55;
  let variance = 18;
  if (/apartment|apartment|complex|residential|housing|property|leasing/.test(lower)) {
    base = 90;
    variance = 8;
  } else if (/hospital|medical center|urgent care|clinic/.test(lower)) {
    base = 88;
    variance = 9;
  } else if (/gym|fitness|athletic|crossfit/.test(lower)) {
    base = 85;
    variance = 10;
  } else if (/senior|retirement|assisted living|nursing home/.test(lower)) {
    base = 90;
    variance = 7;
  } else if (/hotel|motel|inn|resort|guest|lodge/.test(lower)) {
    base = 87;
    variance = 10;
  } else if (/veterinary|vet|animal hospital|pet clinic/.test(lower)) {
    base = 80;
    variance = 12;
  } else if (/auto|repair|tire|mechanic|service station/.test(lower)) {
    base = 72;
    variance = 12;
  } else if (/laundromat|laundry|wash|cleaner/.test(lower)) {
    base = 70;
    variance = 12;
  } else if (/salon|beauty|barber|spa|hair/.test(lower)) {
    base = 75;
    variance = 14;
  } else if (/restaurant|cafe|coffee|bar|pub|diner/.test(lower)) {
    base = 65;
    variance = 18;
  }
  return base + Math.floor(Math.random() * variance);
}

function normalizePlaceId(place) {
  if (place.place_id && place.place_id.length > 4 && !place.place_id.startsWith('un_')) return place.place_id;
  const website = (place.website || '').toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');
  const name = (place.business_name || place.name || '').toLowerCase().trim();
  const city = (place.city || '').toLowerCase().trim();
  if (website) return `web_${website}`;
  if (name && city) return `nm_${name}_${city}`;
  if (name) return `nm_${name}`;
  return `un_${Math.random().toString(36).slice(2, 10)}`;
}

// ──────────────────── Auth (header or body JWT) ────────────────────
async function getAuthedUser(authHeader, bodyJwt) {
  const tokenRaw = authHeader || bodyJwt || '';
  const token = tokenRaw.startsWith('Bearer ') ? tokenRaw.replace(/^Bearer\s+/i, '') : tokenRaw;
  if (!token) return { user: null, error: 'Missing token' };

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  try {
    const { data, error } = await admin.auth.getUser(token);
    if (error || !data?.user) return { user: null, error: 'Invalid token' };
    return { user: data.user, error: null };
  } catch (e) {
    return { user: null, error: e?.message || 'Auth failed' };
  }
}

// ──────────────────────────── Handler ────────────────────────────
export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const startedAt = Date.now();
  try {
    const body = req.body || {};
    const authHeader = req.headers.authorization || req.headers.Authorization;
    const bodyJwt = body?.userJwt || body?.accessToken || body?.jwt;

    const { user, error: authError } = await getAuthedUser(authHeader, bodyJwt);
    if (!user) {
      return res.status(401).json({ error: authError || 'Unauthorized' });
    }

    // Use service role key to bypass RLS for DB writes
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const { places, location, radiusMiles, businessTypes, senderName, emailTemplate } = body;

    const { data: purchases, error: purchasesError } = await supabase
      .from('purchases')
      .select('id')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('purchase_date', { ascending: false })
      .limit(1);

    if (purchasesError) {
      return res.status(500).json({ error: 'Failed to verify purchase' });
    }
    if (!purchases || purchases.length === 0) {
      return res.status(400).json({ error: 'No active purchase found.' });
    }

    const inputPlaces = Array.isArray(places) ? places : [];
    if (inputPlaces.length === 0) {
      return res.status(200).json({
        success: true,
        leadsFound: 0,
        emailsFound: 0,
        emailsSent: 0,
        leads: [],
        sentEmails: [],
        message: 'No places supplied to process.',
      });
    }

    const alreadyEmailed = new Set();
    try {
      const { data: emailed } = await supabase
        .from('email_history')
        .select('recipient')
        .eq('user_id', user.id)
        .limit(10000);
      if (emailed) {
        for (const e of emailed) {
          if (e.recipient) alreadyEmailed.add(e.recipient.toLowerCase());
        }
      }
    } catch {}

    // Check for existing leads in database to avoid duplicate processing and save API tokens
    const existingPlaceIds = new Set();
    try {
      const { data: existing } = await supabase
        .from('leads')
        .select('place_id')
        .eq('user_id', user.id);
      if (existing) {
        for (const row of existing) {
          if (row.place_id) existingPlaceIds.add(row.place_id);
        }
      }
    } catch {}

    const processedLeads = [];
    const seenPlaceIds = new Set();
    const seenEmails = new Set();
    let emailsFound = 0;
    let emailsFoundCount = 0;

    for (let i = 0; i < inputPlaces.length; i++) {
      const place = inputPlaces[i];
      if (processedLeads.length >= 5000) break;

      const pid = normalizePlaceId(place);
      if (seenPlaceIds.has(pid) || existingPlaceIds.has(pid)) continue;
      seenPlaceIds.add(pid);

      let email = place.email ? normalizeEmail(place.email) : null;
      if (email && (isFakeEmail(email) || seenEmails.has(email) || alreadyEmailed.has(email))) {
        email = null;
      }

      if (!email && place.website) {
        try {
          // eslint-disable-next-line no-await-in-loop
          const found = await findEmailForBusiness(place);
          if (found && !isFakeEmail(found) && !seenEmails.has(found) && !alreadyEmailed.has(found)) {
            email = found;
            emailsFoundCount++;
          }
        } catch {}
      }

      if (email) seenEmails.add(email);

      const businessName = place.business_name || place.name || 'Unknown';
      const businessType = place.business_type || 'General';
      const profitScore = place.profit_score || estimateProfitScore(businessName, businessType);
      const distance =
        typeof place.distance === 'number'
          ? place.distance
          : typeof place.distance_from_client === 'number'
          ? place.distance_from_client
          : 0;

      if (email) emailsFound++;

      processedLeads.push({
        business_name: businessName,
        business_type: businessType,
        address: place.address || '',
        city: place.city || '',
        state: place.state || '',
        email: email,
        phone: place.phone || null,
        website: place.website || null,
        has_website: !!place.website,
        place_id: pid,
        profit_score: profitScore,
        ranking: profitScore,
        distance_from_client: distance,
        status: email ? 'new' : 'no_email',
      });
    }

    const { data: loc } = await supabase
      .from('user_locations')
      .select('id')
      .eq('user_id', user.id)
      .eq('is_primary', true)
      .limit(1)
      .maybeSingle();

    if (processedLeads.length > 0) {
      const purchaseId = purchases[0].id;
      const leadRows = processedLeads.map((l) => ({
        purchase_id: purchaseId,
        user_id: user.id,
        user_location_id: loc?.id || null,
        ...l,
      }));

      let upsertedCount = 0;
      for (let i = 0; i < leadRows.length; i += 100) {
        const batch = leadRows.slice(i, i + 100);
        const { error: upsertError } = await supabase
          .from('leads')
          .upsert(batch, {
            onConflict: 'place_id',
            ignoreDuplicates: true,
          });
        if (upsertError && upsertError.code !== '23505') {
          console.error('Lead batch upsert error:', upsertError);
          for (const row of batch) {
            const { error: singleError } = await supabase
              .from('leads')
              .upsert(row, {
                onConflict: 'place_id',
                ignoreDuplicates: true,
              });
            if (!singleError) upsertedCount++;
          }
        } else {
          upsertedCount += batch.length;
        }
      }
    }

    const leadsWithEmail = processedLeads.filter((l) => l.email);
    const subject = 'Free modern vending machine upgrade for your business';
    const sender = senderName || 'Evan';
    const phoneLine = location?.phone ? `\nCall/Text: ${location.phone}\n` : '';
    const defaultBody = `Hi {business_name} Team,\n\nI run a small vending service that installs and maintains modern smart vending machines at NO COST to your business.\n\nWe handle installation, restocking, repairs, and maintenance.\n\nIf you already have vending machines, we can replace them with newer, more reliable smart machines.\n\nWould you be open to a quick conversation?\n\nBest,\n${sender}${phoneLine}`;

    let bodyTemplate = emailTemplate || defaultBody;
    bodyTemplate = bodyTemplate.replace(/\{\{BUSINESS_NAME\}\}/g, '{business_name}');
    bodyTemplate = bodyTemplate.replace(/\{\{YOUR_NAME\}\}/g, sender);
    bodyTemplate = bodyTemplate.replace(/\{\{YOUR_PHONE\}\}/g, location?.phone || '');

    const emailsSent = [];
    for (const lead of leadsWithEmail) {
      if (alreadyEmailed.has(lead.email.toLowerCase())) continue;
      const renderedBody = bodyTemplate.replace(/\{business_name\}/g, lead.business_name);
      const { error: historyError } = await supabase
        .from('email_history')
        .upsert(
          {
            user_id: user.id,
            recipient: lead.email.toLowerCase(),
            email_type: 'outreach_initial',
            subject,
            body_preview: renderedBody.slice(0, 500),
            status: 'discovered',
            sent_at: new Date().toISOString(),
          },
          {
            onConflict: 'user_id,recipient,email_type,subject',
            ignoreDuplicates: true,
          }
        );
      if (!historyError) {
        emailsSent.push({ email: lead.email, business: lead.business_name });
      } else if (historyError.code !== '23505') {
        console.error('Email history insert error:', historyError);
      }
    }

    const elapsedMs = Date.now() - startedAt;
    const emailRate = processedLeads.length > 0
      ? ((leadsWithEmail.length / processedLeads.length) * 100).toFixed(1)
      : '0.0';

    return res.status(200).json({
      success: true,
      leadsFound: processedLeads.length,
      emailsFound: leadsWithEmail.length,
      emailsSent: emailsSent.length,
      emailsFoundCount,
      emailRate: `${emailRate}%`,
      leads: processedLeads,
      sentEmails: emailsSent,
      elapsedMs,
      message: `Found ${processedLeads.length} businesses, ${leadsWithEmail.length} with emails (${emailRate}% rate, ${emailsFoundCount} found via findEmailForBusiness), ${emailsSent.length} emails recorded.`,
    });
  } catch (err) {
    console.error('Scan handler error:', err);
    return res
      .status(500)
      .json({ error: err?.message || 'Failed to generate leads' });
  }
}
