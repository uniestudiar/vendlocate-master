import { expandBusinessTypeToOsmTags } from './osmTags';

const OVERPASS_ENDPOINTS = [
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass-api.de/api/interpreter',
];

const OVERPASS_HEADERS = {
  'Content-Type': 'application/x-www-form-urlencoded',
  'Accept': 'application/json',
  'User-Agent': 'Vendlocate/1.0',
};

function haversineMiles(lat1, lng1, lat2, lng2) {
  const R = 3959;
  const dLat = (lat1 - lat2) * Math.PI / 180;
  const dLng = (lng1 - lng2) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
      Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildBboxOverpassQuery(tags, bbox, resultLimit = 2000) {
  const [s, w, n, e] = bbox;
  const bboxFilter = `(${s},${w},${n},${e})`;
  const filterBlocks = tags.map((tag) => {
    const [k, v] = tag.split('=');
    if (v === '*') return `node["${k}"]${bboxFilter};way["${k}"]${bboxFilter};relation["${k}"]${bboxFilter};`;
    return `node["${k}"="${v}"]${bboxFilter};way["${k}"="${v}"]${bboxFilter};relation["${k}"="${v}"]${bboxFilter};`;
  }).join('');
  return `[out:json][timeout:40];(${filterBlocks});out body center tags qt ${resultLimit};`;
}

function buildNameRegexQuery(keywords, bbox, resultLimit = 2000) {
  const [s, w, n, e] = bbox;
  const pattern = keywords
    .map((k) => escapeRegex(String(k).toLowerCase()))
    .filter(Boolean)
    .join('|');
  if (!pattern) return null;
  return `[out:json][timeout:30];(node["name"~"${pattern}",i](${s},${w},${n},${e});way["name"~"${pattern}",i](${s},${w},${n},${e});relation["name"~"${pattern}",i](${s},${w},${n},${e}););out body center tags qt ${resultLimit};`;
}

async function tryOverpassQuery(query, onRetry) {
  const failed = [];

  try {
    const proxyResp = await fetch('/api/overpass', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
      signal: AbortSignal.timeout(60000),
    });
    if (proxyResp.ok) {
      const data = await proxyResp.json();
      if (data && data.elements) return data;
    }
  } catch {
    failed.push('proxy');
  }

  const fetchWithTimeout = (endpoint, retries = 2) =>
    fetch(endpoint, {
      method: 'POST',
      body: `data=${encodeURIComponent(query)}`,
      headers: OVERPASS_HEADERS,
      signal: AbortSignal.timeout(60000),
    }).then(async resp => {
      if (resp.status === 429 && retries > 0) {
        await new Promise(r => setTimeout(r, 2000));
        return fetchWithTimeout(endpoint, retries - 1);
      }
      if (!resp.ok) throw new Error(`Overpass ${endpoint} HTTP ${resp.status}`);
      const data = await resp.json();
      if (!data || !data.elements) throw new Error(`Overpass ${endpoint} empty`);
      return data;
    });

  const attempts = OVERPASS_ENDPOINTS.map(endpoint => fetchWithTimeout(endpoint));
  const results = await Promise.allSettled(attempts);
  for (const r of results) {
    if (r.status === 'fulfilled') return r.value;
  }
  const msgs = [...failed, ...results.map(r => r.status === 'rejected' ? r.reason?.message : 'unknown')].join('; ');
  onRetry?.(`All endpoints failed: ${msgs}`);
  throw new Error(`Overpass query failed: ${msgs}`);
}

const TYPE_EXCLUDE_KEYWORDS = {
  'Laundromats & Dry Cleaners': [
    'car wash', 'auto wash', 'carwash', 'auto spa', 'gas station', 'fuel',
    'truck stop', 'convenience store', 'grocery', 'restaurant',
    'quick lube', 'oil change', 'tire', 'mechanic', 'repair shop', 'detailing',
  ],
};

const BAD_KEYWORDS = [
  'city of', 'town of', 'village of', 'county of',
  'united states', 'state of', 'department of',
  'government', 'public school', 'school district',
  'fire department', 'police department', 'post office',
  'township', 'cemetery', 'national park', 'state park',
  'public library', 'city hall', 'court house', 'courthouse',
  'usps', 'us post', 'consulate', 'embassy',
  'military', 'army', 'navy', 'air force', 'national guard',
  'coast guard', 'marine corps',
  'single family', 'residential lot', 'vacant lot', 'vacant land',
  'under construction', 'future home',
];

function isLikelyBusiness(name, businessType) {
  if (!name) return false;
  const lower = name.toLowerCase();
  if (lower.length < 3) return false;
  if (lower.length > 200) return false;

  if (BAD_KEYWORDS.some((kw) => lower.includes(kw))) return false;

  if (/\b(inc|llc|ltd|corp|co\.|company|corporation)\.?$/i.test(lower)) {
    return true;
  }

  const typeName = typeof businessType === 'string' ? businessType : '';
  const excludeKeywords = TYPE_EXCLUDE_KEYWORDS[typeName];
  if (excludeKeywords && excludeKeywords.some((kw) => lower.includes(kw))) return false;

  // For laundromats: name ending with " Wash" (no other context) is likely a car wash
  if (typeName === 'Laundromats & Dry Cleaners') {
    const hasLaundryWord = /(laundry|laundromat|dry[\s-]?clean|cleaners?|coin|wash[\s&]*(dry|fold|house|world|tub|eteria|n[\s']?go|matic|ateria|land|more))/i.test(lower);
    if (!hasLaundryWord && /\bwash$/i.test(lower)) return false;
  }

  // Reject single-word names that are just a business type placeholder in OSM
  const singleGeneric = ['laundry', 'laundromat', 'laundrette', 'wash', 'washes', 'dryclean', 'drycleaners', 'cleaners', 'cleaner', 'carwash'];
  if (singleGeneric.includes(lower.trim()) && !/\s/.test(lower.trim())) return false;

  return true;
}

function elementToPlace(el, lat, lng, businessTypeName) {
  const tags = el.tags || {};
  const name = tags.name || tags.operator || tags.brand;
  if (!name) return null;

  const elLat = el.type === 'way' || el.type === 'relation' ? el.center?.lat : el.lat;
  const elLng = el.type === 'way' || el.type === 'relation' ? el.center?.lon : el.lon;
  if (typeof elLat !== 'number' || typeof elLng !== 'number') return null;

  const distance = parseFloat(haversineMiles(lat, lng, elLat, elLng).toFixed(2));

  const address = [
    tags['addr:housenumber'],
    tags['addr:street'],
    tags['addr:city'],
    tags['addr:state'],
    tags['addr:postcode'],
  ]
    .filter(Boolean)
    .join(', ');

  return {
    business_name: name,
    business_type: businessTypeName,
    address: address || '',
    city: tags['addr:city'] || '',
    state: tags['addr:state'] || '',
    website: tags.website || tags['contact:website'] || null,
    phone: tags.phone || tags['contact:phone'] || null,
    place_id: `${el.type}/${el.id}`,
    lat: elLat,
    lng: elLng,
    distance,
  };
}

function computeBoundingBox(lat, lng, radiusMeters) {
  const latDelta = radiusMeters / 111320;
  const cosLat = Math.cos((lat * Math.PI) / 180);
  const lngDelta = radiusMeters / (111320 * Math.max(cosLat, 0.01));
  return [lat - latDelta, lng - lngDelta, lat + latDelta, lng + lngDelta];
}

function splitBBoxIntoTiles(bbox, gridSize = 2) {
  const [s, w, n, e] = bbox;
  const tiles = [];
  const latStep = (n - s) / gridSize;
  const lngStep = (e - w) / gridSize;
  for (let i = 0; i < gridSize; i++) {
    for (let j = 0; j < gridSize; j++) {
      const tileS = s + i * latStep;
      const tileN = s + (i + 1) * latStep;
      const tileW = w + j * lngStep;
      const tileE = w + (j + 1) * lngStep;
      tiles.push([tileS, tileW, tileN, tileE]);
    }
  }
  return tiles;
}

function hasBusinessTags(tags) {
  if (!tags) return false;
  // Must have at least one tag that indicates this is a real place of business
  const businessKeys = ['amenity', 'shop', 'tourism', 'leisure', 'office', 'man_made', 'industrial', 'healthcare', 'craft'];
  for (const key of businessKeys) {
    if (tags[key]) return true;
  }
  // A building that's not a house/garage/shed is likely a commercial property
  if (tags.building && !['house', 'garage', 'shed', 'roof', 'static_caravan', 'construction', 'greenhouse'].includes(tags.building)) return true;
  // A named feature with an address is likely a real place
  if (tags['addr:housenumber'] && tags['addr:street']) return true;
  // Has contact info
  if (tags.phone || tags['contact:phone'] || tags.website || tags['contact:website'] || tags.email || tags['contact:email']) return true;
  // Has opening hours (likely a business)
  if (tags.opening_hours) return true;
  return false;
}

function processElements(elements, lat, lng, businessTypeName, places, perTypeLimit, { requireBusinessTags = false } = {}) {
  for (const el of elements) {
    if (places.size >= perTypeLimit) break;
    if (requireBusinessTags && !hasBusinessTags(el.tags)) continue;
    const place = elementToPlace(el, lat, lng, businessTypeName);
    if (!place) continue;
    if (!isLikelyBusiness(place.business_name, businessTypeName)) continue;
    if (places.has(place.place_id)) continue;
    places.set(place.place_id, place);
  }
}

export async function discoverBusinessesByType({
  businessType,
  lat,
  lng,
  radiusMeters,
  centerCity = '',
  centerState = '',
  perTypeLimit = 1500,
  onProgress = null,
}) {
  const osmTags = expandBusinessTypeToOsmTags(businessType);
  const keywords = [
    ...(businessType.requiredKeywords || []),
    ...(businessType.optionalKeywords || []),
  ].map((k) => String(k || '').trim()).filter(Boolean);

  const places = new Map();
  const bbox = computeBoundingBox(lat, lng, radiusMeters);
  const [s, w, n, e] = bbox;
  const area = (n - s) * (e - w);

  // ---- PASS 1: Tag-based query using bbox (fast, reliable) ----
  if (osmTags.length > 0) {
    const useTiles = area > 0.15;
    const tiles = useTiles ? splitBBoxIntoTiles(bbox, 2) : [bbox];

    const queries = tiles.map(tile => buildBboxOverpassQuery(osmTags, tile, 2000));
    const results = await Promise.allSettled(
      queries.map(q =>
        tryOverpassQuery(q, (msg) => onProgress?.({ stage: 'osm_retry', message: msg }))
          .catch(err => { console.warn(`Tile query failed:`, err?.message); return null; })
      )
    );

    for (const r of results) {
      if (r.status === 'fulfilled' && r.value) {
        processElements(r.value.elements || [], lat, lng, businessType.name || 'General', places, perTypeLimit);
      }
    }
    onProgress?.({ stage: 'osm_bbox', found: places.size });
  }

  // ---- PASS 2: Name-regex (catches businesses misspelled or missing standard tags) ----
  // Use longer, more specific keywords to avoid matching street names (e.g. "wash" -> "Washington")
  if (places.size < perTypeLimit && keywords.length > 0) {
    const nameKeywords = keywords.filter(k => k.length >= 5 && !/^(wash|dry|car|auto|hotel|care|store|shop|park|fuel|club)$/i.test(k));
    if (nameKeywords.length > 0) {
      try {
        const query = buildNameRegexQuery(nameKeywords, [s, w, n, e], 2000);
        if (query) {
          const data = await tryOverpassQuery(query, (msg) => onProgress?.({ stage: 'osm_retry', message: msg }));
          processElements(data.elements || [], lat, lng, businessType.name || 'General', places, perTypeLimit, { requireBusinessTags: true });
        }
        onProgress?.({ stage: 'osm_name', found: places.size });
      } catch (err) {
        console.warn(`OSM name-regex query failed for ${businessType.name}:`, err?.message);
      }
    }
  }

  if (centerCity) {
    for (const place of places.values()) {
      if (!place.city && centerCity) place.city = centerCity;
      if (!place.state && centerState) place.state = centerState;
    }
  }

  return Array.from(places.values());
}

async function fetchGoogle(businessType, lat, lng, radiusMeters, onProgress) {
  try {
    const keywords = [
      ...(businessType.requiredKeywords || []),
      ...(businessType.optionalKeywords || []),
    ].filter(Boolean);
    const resp = await fetch('/api/google-places', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        typeName: businessType.name || 'General',
        lat, lng,
        radiusMeters: Math.round(radiusMeters),
        keywords,
      }),
      signal: AbortSignal.timeout(30000),
    });
    if (!resp.ok) {
      if (resp.status === 403 || resp.status === 402) return { quotaExhausted: true };
      return null;
    }
    const data = await resp.json();
    if (data.status === 'OVER_QUERY_LIMIT' || data.status === 'REQUEST_DENIED') {
      return { quotaExhausted: true };
    }
    if (data.count > 0) onProgress?.({ stage: 'google_places', found: data.count });
    return data.places || [];
  } catch { return null; }
}

async function fetchOverture(businessType, lat, lng, radiusMeters, onProgress) {
  try {
    const resp = await fetch('/api/overture-search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ typeName: businessType.name || 'General', lat, lng, radiusMeters: Math.round(radiusMeters) }),
      signal: AbortSignal.timeout(60000),
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    if (data.count > 0) onProgress?.({ stage: 'overture', found: data.count });
    return data.places || [];
  } catch { return null; }
}

export async function discoverBusinessesMultiSource({
  businessType,
  lat,
  lng,
  radiusMeters,
  centerCity = '',
  centerState = '',
  perTypeLimit = 500,
  onProgress = null,
}) {
  const seen = new Map();
  let total = 0;
  let googleQuotaExhausted = false;

  function addPlaces(places) {
    for (const p of places) {
      const key = `${(p.business_name || '').toLowerCase().trim()}|${(p.address || '').toLowerCase().trim()}`;
      if (seen.has(key)) continue;
      seen.set(key, p);
      total++;
    }
  }

  // 1) Overture (most accurate, limited coverage)
  onProgress?.({ stage: 'overture_start', message: `Searching Overture for "${businessType.name}"...` });
  const overturePlaces = await fetchOverture(businessType, lat, lng, radiusMeters, onProgress);
  if (overturePlaces) addPlaces(overturePlaces);

  // 2) OSM (broad coverage, good for filling gaps)
  if (seen.size < perTypeLimit) {
    onProgress?.({ stage: 'osm_start', message: `Searching OSM for "${businessType.name}"...` });
    try {
      const osmPlaces = await discoverBusinessesByType({ businessType, lat, lng, radiusMeters, centerCity, centerState, perTypeLimit, onProgress });
      addPlaces(osmPlaces);
    } catch (err) {
      console.warn(`OSM failed for ${businessType.name}:`, err?.message);
    }
  }

  // 3) Google Places final fallback (fills gaps, must filter by keywords)
  if (seen.size < perTypeLimit && !googleQuotaExhausted) {
    onProgress?.({ stage: 'google_start', message: `Searching Google for "${businessType.name}"...` });
    const googleResult = await fetchGoogle(businessType, lat, lng, radiusMeters, onProgress);
    if (googleResult?.quotaExhausted) {
      googleQuotaExhausted = true;
      onProgress?.({ stage: 'google_quota', message: 'Google API quota exhausted for this scan.' });
    } else if (googleResult) {
      addPlaces(googleResult);
    }
  }

  return Array.from(seen.values());
}
