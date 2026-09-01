function slugify(name) {
  return name
    .toLowerCase()
    .replace(/'/g, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '')
    .replace(/^(the|a|an)/, '')
    .trim();
}

function generateDomains(businessName, city, state) {
  const raw = businessName.toLowerCase().trim();
  const slug = slugify(businessName);
  const citySlug = slugify(city || '');
  const nameWords = raw.split(/\s+/).filter(w => w.length > 1 && !['the','a','an','of','and','&','la','el','los','las','le'].includes(w));
  const firstWord = nameWords[0] || slug;
  const patterns = new Set();

  if (slug) {
    patterns.add(`${slug}.com`);
  }

  if (slug && citySlug) {
    patterns.add(`${slug}${citySlug}.com`);
    patterns.add(`${slug}-${citySlug}.com`);
    patterns.add(`${firstWord}${citySlug}.com`);
  }

  if (firstWord && firstWord !== slug && firstWord.length > 2) {
    patterns.add(`${firstWord}.com`);
  }

  return Array.from(patterns).slice(0, 10);
}

async function fetchPageText(url) {
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 6000);
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        'Accept': 'text/html',
      },
      signal: controller.signal,
      redirect: 'follow',
    });
    clearTimeout(t);
    if (!response.ok) return null;
    const ct = response.headers.get('content-type') || '';
    if (!ct.includes('text/html') && !ct.includes('text/plain')) return null;
    const text = await response.text();
    if (text.length > 500000) return null;
    return text;
  } catch {
    return null;
  }
}

function pageMentionsBusiness(html, businessName) {
  if (!html || !businessName) return false;
  const lower = html.toLowerCase();
  const nameLower = businessName.toLowerCase().trim();
  if (lower.includes(nameLower)) return true;
  const words = nameLower.split(/\s+/).filter(w => w.length > 2);
  const matchCount = words.filter(w => lower.includes(w)).length;
  return matchCount >= Math.max(1, Math.floor(words.length / 2));
}

function isGenericParkedDomain(hostname) {
  const lower = hostname.toLowerCase();
  const bad = [
    'sedo.com', 'afternic.com', 'dan.com', 'godaddy', 'hugedomains',
    'buydomains', 'domainmarket', 'namecheap', 'perfectdomain',
    'grabthisdomain', 'parkingpage', 'mydomain', 'spaceship',
    'wordpress.com', 'wix.com', 'squarespace', 'shopify.com',
    'tumblr.com', 'blogspot.com', 'weebly.com',
    'facebook.com', 'yelp.com', 'instagram.com', 'twitter.com',
    'x.com', 'linkedin.com', 'youtube.com', 'tiktok.com',
    'pinterest.com', 'snapchat.com', 'reddit.com',
    'bbb.org', 'yellowpages.com', 'manta.com', 'mapquest.com',
    'foursquare.com', 'tripadvisor.com',
    'amazon.com', 'wikipedia.org',
  ];
  return bad.some(b => lower.includes(b));
}

async function verifySite(url, businessName) {
  const html = await fetchPageText(url);
  if (!html) return false;
  if (isGenericParkedDomain(new URL(url).hostname)) return false;
  if (!pageMentionsBusiness(html, businessName)) return false;
  // At this point the site seems real, so return the verified URL
  return true;
}

function extractBingUrl(html, businessName, city, state) {
  const nameLower = businessName.toLowerCase();
  const cityLower = (city || '').toLowerCase();
  const slug = slugify(businessName);

  const candidates = [];
  const citeRe = /<cite[^>]*>([\s\S]*?)<\/cite>/gi;
  let m;
  while ((m = citeRe.exec(html)) !== null) {
    let raw = m[1].trim();
    raw = raw.replace(/<[^>]+>/g, '');
    raw = raw.replace(/\s*[>›]\s*.*$/, '');
    raw = raw.replace(/\s+/g, '');
    if (!raw.startsWith('http')) raw = 'https://' + raw;
    try {
      const url = new URL(raw);
      const host = url.hostname.replace(/^www\./, '').toLowerCase();
      if (isGenericParkedDomain(host)) continue;
      candidates.push({ url: raw, host });
    } catch {}
  }

  const scored = candidates.map(c => {
    let score = 0;
    const hostLower = c.host;
    const hostNameOnly = hostLower.replace(/\..*$/, '');
    if (slug && (hostLower.includes(slug) || slug.includes(hostNameOnly))) score += 10;
    else {
      const nameWords = nameLower.split(/\s+/).filter(w => w.length > 2);
      const matchCount = nameWords.filter(w => hostLower.includes(w)).length;
      score += matchCount * 3;
    }
    if (cityLower && hostLower.includes(slugify(cityLower))) score += 2;
    if (nameLower && hostLower.includes(nameLower.replace(/\s+/g, ''))) score += 5;
    return { ...c, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.length > 0 && scored[0].score >= 3 ? scored[0].url : null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { businessName, city, state } = req.body;
  if (!businessName) return res.status(400).json({ error: 'Missing businessName' });

  // Phase 1: Try domain patterns
  const domains = generateDomains(businessName, city, state);
  for (const domain of domains) {
    const url = `https://${domain}`;
    const verified = await verifySite(url, businessName);
    if (verified) {
      return res.status(200).json({ url });
    }
  }

  // Phase 2: Try Bing with strict scoring and verification
  try {
    const q = `${businessName} ${city || ''} ${state || ''}`;
    const bingResp = await fetch(`https://www.bing.com/search?q=${encodeURIComponent(q)}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        'Accept': 'text/html',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      signal: AbortSignal.timeout(8000),
    });
    if (bingResp.ok) {
      const html = await bingResp.text();
      const bingUrl = extractBingUrl(html, businessName, city, state);
      if (bingUrl) {
        // Final verification: check page content
        const verified = await verifySite(bingUrl, businessName);
        if (verified) {
          return res.status(200).json({ url: bingUrl });
        }
      }
    }
  } catch {}

  return res.status(200).json({ url: null });
}
