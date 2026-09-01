import { createRequire } from 'module';
const _require = createRequire(import.meta.url);

let duckdb;
try {
  duckdb = _require('duckdb');
} catch(e) {
  console.error('DuckDB native addon unavailable:', e?.message);
}

import https from 'https';

const OVERTURE_BUCKET = 'overturemaps-us-west-2.s3.us-west-2.amazonaws.com';
const RELEASE_PATH = 'release/2026-04-15.0/theme=places/type=place/';

const CATEGORY_MAP = {
  'Laundromats & Dry Cleaners': ['laundry_and_dry_cleaning', 'dry_cleaning'],
  'Car Washes': ['car_wash'],
  'Auto Shops, Dealers & Rental': ['car_dealer', 'car_rental', 'car_repair', 'auto_repair'],
  'Apartments & Complexes': ['apartment_or_condo_complex'],
  'Hotels & Motels': ['hotel', 'motel'],
  'Senior & Community Centers': ['senior_home', 'community_center'],
  'Medical Offices & Urgent Care': ['hospital', 'doctor', 'dentist', 'urgent_care'],
  'Pet Hospitals & Vets': ['veterinary'],
  'Gyms & Fitness Studios': ['gym', 'fitness_center'],
  'Sports & Recreation': ['bowling', 'movie_theater', 'casino', 'golf_course'],
  'Salons, Barbers & Spas': ['beauty_salon', 'barber', 'spa', 'hair_salon'],
  'Schools & Daycares': ['school', 'preschool', 'daycare'],
  'Colleges & Universities': ['college', 'university'],
  'Churches & Libraries': ['church', 'library', 'place_of_worship'],
  'Gas Stations & Convenience Stores': ['gas_station', 'convenience_store'],
  'Restaurants': ['restaurant', 'fast_food'],
  'Hardware & Furniture Stores': ['hardware_store', 'home_improvement', 'furniture_store'],
  'Shopping Malls & Plazas': ['shopping_mall', 'shopping_center'],
  'Campgrounds & RV Parks': ['campground', 'rv_park'],
  'Pet Stores & Dog Grooming': ['pet_store', 'pet_groomer'],
};

let cachedFiles = null;
let dbInstance = null;
let dbReady = false;

function listS3Objects(prefix) {
  return new Promise((resolve, reject) => {
    const url = `https://${OVERTURE_BUCKET}/?list-type=2&prefix=${encodeURIComponent(RELEASE_PATH)}`;
    https.get(url, { headers: { 'Accept': 'application/xml' }, timeout: 10000 }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function parseFileList(xml) {
  const files = [];
  const regex = /<Key>([^<]+\.zstd\.parquet)<\/Key>/g;
  let match;
  while ((match = regex.exec(xml)) !== null) files.push(match[1]);
  return files;
}

async function getFiles() {
  if (cachedFiles) return cachedFiles;
  const xml = await listS3Objects(RELEASE_PATH);
  cachedFiles = parseFileList(xml);
  return cachedFiles;
}

function getDB() {
  if (!dbInstance) {
    dbInstance = new duckdb.Database(':memory:');
  }
  return dbInstance;
}

function query(sql) {
  return new Promise((resolve, reject) => {
    getDB().all(sql, (err, res) => {
      if (err) reject(err);
      else resolve(res);
    });
  });
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { typeName, lat, lng, radiusMeters } = req.body;
    if (!typeName || !lat || !lng) {
      return res.status(400).json({ error: 'typeName, lat, lng required' });
    }

    const categories = CATEGORY_MAP[typeName];
    if (!categories || categories.length === 0) {
      return res.status(400).json({ error: `Unknown type: ${typeName}` });
    }

    // Convert radius to bbox (approx)
    const R = 6371000;
    const dLat = (radiusMeters || 16000) / R * 180 / Math.PI;
    const dLng = (radiusMeters || 16000) / (R * Math.cos(lat * Math.PI / 180)) * 180 / Math.PI;
    const minx = lng - dLng;
    const maxx = lng + dLng;
    const miny = lat - dLat;
    const maxy = lat + dLat;

    const catList = categories.map(c => `'${c.replace(/'/g, "''")}'`).join(', ');
    const catFilter = `(categories['primary'] IN (${catList}) OR list_has_any(categories['alternate'], ARRAY[${catList}]))`;

    // DuckDB not available? Return empty so pipeline falls through to OSM
    if (!duckdb) {
      return res.status(200).json({ places: [], count: 0, source: 'overture', note: 'DuckDB unavailable' });
    }

    // Initialize DuckDB (lazy, once per warm invocation)
    if (!dbReady) {
      try {
        // Try httpfs directly first (bundled in DuckDB 1.x)
        await query("LOAD httpfs;");
        dbReady = true;
      } catch (_) {
        // Not bundled — try to install it
        try {
          await query("SET home_directory='/tmp'; SET extension_directory='/tmp/.duckdb_extensions';");
          await query("INSTALL httpfs; LOAD httpfs;");
          dbReady = true;
        } catch (_2) {
          // httpfs truly unavailable — return empty; pipeline falls to OSM
          return res.status(200).json({ places: [], count: 0, source: 'overture', note: 'httpfs extension unavailable' });
        }
      }
    }

    // List files if not cached
    const files = await getFiles();
    const fullPaths = files.map(f => `'https://overturemaps-us-west-2.s3.us-west-2.amazonaws.com/${f}'`).join(', ');

    const sql = `
      SELECT 
        id,
        names['primary'] AS name,
        phones[1] AS phone,
        websites[1] AS website,
        emails[1] AS email,
        categories['primary'] AS category,
        addresses[1]['freeform'] AS full_address,
        addresses[1]['locality'] AS city,
        addresses[1]['region'] AS state,
        addresses[1]['postcode'] AS zip,
        bbox.xmin + (bbox.xmax - bbox.xmin)/2 AS lon,
        bbox.ymin + (bbox.ymax - bbox.ymin)/2 AS lat
      FROM read_parquet(ARRAY[${fullPaths}])
      WHERE bbox.xmax >= ${minx} AND bbox.xmin <= ${maxx}
        AND bbox.ymax >= ${miny} AND bbox.ymin <= ${maxy}
        AND ${catFilter}
      LIMIT 100
    `;

    const rows = await query(sql);
    const places = rows.map(r => ({
      place_id: r.id,
      business_name: r.name || '',
      business_type: typeName,
      address: r.full_address || '',
      city: r.city || '',
      state: r.state || '',
      phone: r.phone || null,
      website: r.website || null,
      email: r.email || null,
      lat: r.lat,
      lng: r.lon,
    }));

    return res.status(200).json({ places, count: places.length });
  } catch(err) {
    // Any unexpected error — return empty gracefully
    return res.status(200).json({ places: [], count: 0, source: 'overture', note: err?.message || 'Unknown error' });
  }
}
