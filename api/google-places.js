const PLACE_TYPES = {
  'Laundromats & Dry Cleaners': ['laundry', 'dry_cleaning'],
  'Car Washes': ['car_wash'],
  'Auto Shops, Dealers & Rental': ['car_dealer', 'car_rental', 'car_repair'],
  'Apartments & Complexes': ['apartment_building', 'real_estate_agency'],
  'Hotels & Motels': ['lodging'],
  'Senior & Community Centers': ['senior_home', 'community_center'],
  'Medical Offices & Urgent Care': ['hospital', 'doctor', 'dentist', 'health'],
  'Pet Hospitals & Vets': ['veterinary_care'],
  'Gyms & Fitness Studios': ['gym'],
  'Sports & Recreation': ['bowling_alley', 'movie_theater', 'casino', 'golf_course'],
  'Salons, Barbers & Spas': ['beauty_salon', 'hair_care', 'spa'],
  'Schools & Daycares': ['school', 'preschool', 'day_care'],
  'Colleges & Universities': ['university', 'college'],
  'Churches & Libraries': ['church', 'library'],
  'Gas Stations & Convenience Stores': ['gas_station', 'convenience_store'],
  'Restaurants': ['restaurant', 'meal_takeaway'],
  'Hardware & Furniture Stores': ['hardware_store', 'furniture_store'],
  'Shopping Malls & Plazas': ['shopping_mall'],
  'Campgrounds & RV Parks': ['campground', 'rv_park'],
  'Pet Stores & Dog Grooming': ['pet_store'],
};

const TYPE_MATCH_PATTERNS = {
  'Laundromats & Dry Cleaners': /(laundry|laundromat|dry[\s-]?clean|cleaners?|wash[\s&]*(dry|fold|house|world|tub|eteria|n[\s']?go|matic|ateria|land|more|center|club|plus))/i,
  'Car Washes': /(car[\s-]?wash|auto[\s-]?wash|carwash|wash[\s-]?(and|n|\&)\s*(dry|detail|wax|buff|shine|express|touchless|automatic|self[\s-]?serve|bay|tunnel))/i,
  'Auto Shops, Dealers & Rental': /(auto|car|repair|tire|tyre|service|mechanic|automotive|dealer|rental|rent-a-car|rent\s+a\s+car|car\s+sales|used\s+cars)/i,
  'Apartments & Complexes': /(apartment|complex|housing|residential|village|property\s+management)/i,
  'Hotels & Motels': /(hotel|motel|inn|lodge|resort|guest\s+house|bed\s+and\s+breakfast|b&\s*b)/i,
  'Senior & Community Centers': /(senior|retirement|assisted\s+living|nursing\s+home|elderly|community\s+center|community\s+centre|recreation\s+center|ymca|ywca)/i,
  'Medical Offices & Urgent Care': /(hospital|medical|clinic|doctor|dr\.|physician|dentist|dental|urgent\s+care|walk[\s-]?in|immediate\s+care|family\s+medicine|internal\s+medicine)/i,
  'Pet Hospitals & Vets': /(veterinary|vet|animal\s+hospital|pet\s+clinic|animal\s+care)/i,
  'Gyms & Fitness Studios': /(gym|fitness|training|crossfit|athletic|workout|yoga|pilates|dance\s+studio|martial\s+arts|karate|taekwondo)/i,
  'Sports & Recreation': /(sports\s+complex|sports\s+centre|athletic\s+club|recreation|bowling|arcade|cinema|theater|theatre|bingo|casino|golf\s+course)/i,
  'Specialty Healthcare': /(chiropractor|chiropractic|physical\s+therapy|physiotherapist|physio|optometrist|optician|eye\s+doctor|pharmacy|drug\s+store)/i,
  'Salons, Barbers & Spas': /(salon|hairdresser|beauty\s+salon|barber|barbershop|nail\s+salon|manicure|spa)/i,
  'Schools & Daycares': /(school|elementary|middle\s+school|high\s+school|daycare|childcare|day\s+care|kindergarten|preschool)/i,
  'Colleges & Universities': /(college|university|campus)/i,
  'Churches & Libraries': /(church|temple|worship|mosque|synagogue|library)/i,
  'Warehouses, Factories & Industrial': /(warehouse|distribution|fulfillment|manufacturing|factory|works|industrial|self\s+storage|storage\s+unit|storage\s+rental)/i,
  'Truck Stops': /(truck\s+stop|truckstop)/i,
  'Gas Stations & Convenience Stores': /(gas\s+station|fuel|gasoline|convenience\s+store|mini\s+market|corner\s+store)/i,
  'Retail Stores': /(store|shop)/i,
  'Hardware & Furniture Stores': /(hardware\s+store|do\s+it\s+yourself|furniture\s+store|furniture)/i,
  'Shopping Malls & Plazas': /(shopping\s+mall|strip\s+mall|retail\s+park)/i,
  'Office Buildings & Parks': /(office\s+building|office\s+park|commercial\s+building)/i,
  'Campgrounds & RV Parks': /(camping|campground|rv\s+park|caravan)/i,
  'Pet Stores & Dog Grooming': /(pet\s+store|pet\s+shop|dog\s+grooming|pet\s+grooming)/i,
  'Dispensaries': /(dispensary|cannabis)/i,
  'Parks': /(park|playground)/i,
};

function matchesKeywords(name, typeName) {
  if (!name) return false;
  const pattern = TYPE_MATCH_PATTERNS[typeName];
  if (pattern) return pattern.test(name);
  return name.length >= 3;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { typeName, lat, lng, radiusMeters, keywords } = req.body;
  const apiKey = process.env.GOOGLE_PLACES_API_KEY || '';
  if (!apiKey) return res.status(500).json({ error: 'Google API key not configured (set GOOGLE_PLACES_API_KEY env var)' });
  if (!lat || !lng) return res.status(400).json({ error: 'lat/lng required' });

  const types = PLACE_TYPES[typeName] || [];
  const radius = Math.min(Math.max(Math.round(radiusMeters || 16000), 100), 50000);

  let allResults = [];
  const seen = new Set();

  // Google Places Nearby Search supports only ONE type per request
  for (const placeType of types.length > 0 ? types : [null]) {
    if (allResults.length >= 60) break;

    let pageToken = null;
    let attempts = 0;

    do {
      try {
        let url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radius}&key=${apiKey}`;
        if (placeType) url += `&type=${placeType}`;
        if (pageToken) url += `&pagetoken=${pageToken}`;

        const resp = await fetch(url, { signal: AbortSignal.timeout(10000) });
        if (!resp.ok) break;

        const data = await resp.json();
        if (data.status === 'OVER_QUERY_LIMIT') {
          return res.status(200).json({ places: [], count: 0, status: 'OVER_QUERY_LIMIT' });
        }
        if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') break;

        for (const place of data.results || []) {
          const pid = place.place_id;
          if (seen.has(pid)) continue;
          seen.add(pid);

          // Filter by type-specific patterns to avoid irrelevant results (Target, UNI, etc.)
          if (typeName && !matchesKeywords(place.name, typeName)) continue;

          allResults.push({
            place_id: pid,
            business_name: place.name || '',
            business_type: typeName || 'General',
            address: place.vicinity || '',
            city: '',
            state: '',
            phone: place.photos ? null : null, // filled by Place Details
            website: null,
            rating: place.rating || null,
            user_ratings_total: place.user_ratings_total || 0,
            lat: place.geometry?.location?.lat || null,
            lng: place.geometry?.location?.lng || null,
            open_now: place.opening_hours?.open_now || null,
            types: place.types || [],
            needsDetails: true,
          });
        }

        pageToken = data.next_page_token || null;
        if (pageToken) {
          await new Promise(r => setTimeout(r, 1500));
          attempts++;
        }
      } catch {
        break;
      }
    } while (pageToken && attempts < 3 && allResults.length < 60);
  }

  // Fetch Place Details for phone + website (up to 20 to avoid quota burn)
  const detailBatch = allResults.filter(p => p.needsDetails).slice(0, 20);
  const detailResults = await Promise.allSettled(
    detailBatch.map(p =>
      fetch(`https://maps.googleapis.com/maps/api/place/details/json?place_id=${p.place_id}&fields=name,formatted_phone_number,website,formatted_address,opening_hours&key=${apiKey}`,
        { signal: AbortSignal.timeout(8000) }
      ).then(r => r.json())
    )
  );

  for (let i = 0; i < detailBatch.length; i++) {
    const r = detailResults[i];
    if (r.status === 'fulfilled' && r.value?.result) {
      const d = r.value.result;
      detailBatch[i].phone = d.formatted_phone_number || null;
      detailBatch[i].website = d.website || null;
      if (d.formatted_address) detailBatch[i].address = d.formatted_address;
      if (d.opening_hours?.weekday_text) detailBatch[i].opening_hours = d.opening_hours.weekday_text;
    }
    detailBatch[i].needsDetails = false;
  }

  return res.status(200).json({ places: allResults, count: allResults.length, status: 'OK' });
}
