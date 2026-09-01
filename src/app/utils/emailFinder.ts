export interface FindEmailResult {
  email: string | null;
  method: 'crawl' | 'inferred' | null;
  smtpVerified: boolean;
  candidateCount?: number;
}

export async function findEmailForBusiness(place: {
  website?: string | null;
  business_name?: string;
  business_type?: { name?: string; id?: string } | string;
}): Promise<FindEmailResult> {
  if (!place.website) return { email: null, method: null, smtpVerified: false };

  const domain = extractDomain(place.website);
  if (!domain) return { email: null, method: null, smtpVerified: false };
  if (isSocialDomain(domain)) return { email: null, method: null, smtpVerified: false };

  try {
    const resp = await fetch('/api/find-emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        website: place.website,
        businessName: place.business_name || null,
      }),
      signal: AbortSignal.timeout(25000),
    });
    if (resp.ok) {
      const data = await resp.json();
      if (data.emails && data.emails.length > 0) {
        // Return the best email — prefer SMTP-verified, then crawled found
        if (data.verified?.length > 0) {
          const verified = data.verified[0];
          return {
            email: verified.email,
            method: verified.source === 'generated' ? 'inferred' : 'crawl',
            smtpVerified: true,
            candidateCount: data.allResults?.length || 0,
          };
        }
        return {
          email: data.emails[0],
          method: 'crawl',
          smtpVerified: false,
          candidateCount: data.allResults?.length || 0,
        };
      }
    }
  } catch (e) {
    console.warn('find-email API error:', e);
  }

  return { email: null, method: null, smtpVerified: false };
}

function extractDomain(website: string): string | null {
  if (!website) return null;
  try {
    const url = website.startsWith('http') ? new URL(website) : new URL('https://' + website);
    return url.hostname.replace(/^www\./, '').toLowerCase();
  } catch { return null; }
}

function isSocialDomain(domain: string): boolean {
  const bad = ['facebook', 'yelp', 'google', 'instagram', 'twitter',
    'youtube', 'tiktok', 'linkedin', 'nextdoor', 'pinterest',
    'snapchat', 'reddit', 'foursquare', 'tripadvisor',
    'bbb.org', 'yellowpages', 'manta.com'];
  return bad.some(b => domain.includes(b));
}
