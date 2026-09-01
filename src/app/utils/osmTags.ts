export const OSM_TAG_MAP = {
  laundromat: [
    { type: 'node', tags: ['amenity=laundry'] },
    { type: 'way', tags: ['amenity=laundry'] },
    { type: 'node', tags: ['shop=laundry'] },
    { type: 'way', tags: ['shop=laundry'] },
  ],
  laundry: [
    { type: 'node', tags: ['amenity=laundry'] },
    { type: 'way', tags: ['amenity=laundry'] },
    { type: 'node', tags: ['shop=laundry'] },
    { type: 'way', tags: ['shop=laundry'] },
  ],
  wash: [
    { type: 'node', tags: ['amenity=laundry'] },
    { type: 'way', tags: ['amenity=laundry'] },
  ],
  dry: [
    { type: 'node', tags: ['amenity=laundry'] },
    { type: 'way', tags: ['amenity=laundry'] },
  ],
  cleaner: [
    { type: 'node', tags: ['amenity=laundry'] },
    { type: 'way', tags: ['amenity=laundry'] },
    { type: 'node', tags: ['shop=laundry', 'shop=dry_cleaning'] },
    { type: 'way', tags: ['shop=laundry', 'shop=dry_cleaning'] },
  ],
  'car wash': [
    { type: 'node', tags: ['amenity=car_wash'] },
    { type: 'way', tags: ['amenity=car_wash'] },
  ],

  auto: [
    { type: 'node', tags: ['shop=car_repair'] },
    { type: 'way', tags: ['shop=car_repair'] },
  ],
  car: [
    { type: 'node', tags: ['shop=car_repair'] },
    { type: 'way', tags: ['shop=car_repair'] },
    { type: 'node', tags: ['shop=car'] },
    { type: 'way', tags: ['shop=car'] },
  ],
  repair: [
    { type: 'node', tags: ['shop=car_repair'] },
    { type: 'way', tags: ['shop=car_repair'] },
  ],
  tire: [
    { type: 'node', tags: ['shop=tyres'] },
    { type: 'way', tags: ['shop=tyres'] },
  ],
  service: [
    { type: 'node', tags: ['shop=car_repair'] },
    { type: 'way', tags: ['shop=car_repair'] },
  ],
  mechanic: [
    { type: 'node', tags: ['shop=car_repair'] },
    { type: 'way', tags: ['shop=car_repair'] },
  ],

  apartment: [
    { type: 'node', tags: ['building=apartments'] },
    { type: 'way', tags: ['building=apartments'] },
    { type: 'relation', tags: ['building=apartments'] },
  ],
  apartments: [
    { type: 'node', tags: ['building=apartments'] },
    { type: 'way', tags: ['building=apartments'] },
    { type: 'relation', tags: ['building=apartments'] },
  ],
  complex: [
    { type: 'node', tags: ['building=apartments'] },
    { type: 'way', tags: ['building=apartments'] },
  ],
  housing: [
    { type: 'node', tags: ['building=apartments'] },
    { type: 'way', tags: ['building=apartments'] },
  ],
  residential: [
    { type: 'node', tags: ['building=apartments'] },
    { type: 'way', tags: ['building=apartments'] },
  ],

  hotel: [
    { type: 'node', tags: ['tourism=hotel'] },
    { type: 'way', tags: ['tourism=hotel'] },
    { type: 'node', tags: ['tourism=motel'] },
    { type: 'way', tags: ['tourism=motel'] },
  ],
  motel: [
    { type: 'node', tags: ['tourism=motel'] },
    { type: 'way', tags: ['tourism=motel'] },
  ],
  inn: [
    { type: 'node', tags: ['tourism=hotel'] },
    { type: 'way', tags: ['tourism=hotel'] },
  ],
  lodge: [
    { type: 'node', tags: ['tourism=guest_house', 'tourism=hotel'] },
    { type: 'way', tags: ['tourism=guest_house', 'tourism=hotel'] },
  ],
  resort: [
    { type: 'node', tags: ['tourism=resort'] },
    { type: 'way', tags: ['tourism=resort'] },
  ],
  guest: [
    { type: 'node', tags: ['tourism=guest_house'] },
    { type: 'way', tags: ['tourism=guest_house'] },
  ],

  senior: [
    { type: 'node', tags: ['amenity=social_facility'] },
    { type: 'way', tags: ['amenity=social_facility'] },
    { type: 'node', tags: ['social_facility=assisted_living'] },
    { type: 'way', tags: ['social_facility=assisted_living'] },
    { type: 'node', tags: ['social_facility=group_home'] },
    { type: 'way', tags: ['social_facility=group_home'] },
  ],
  retirement: [
    { type: 'node', tags: ['amenity=social_facility', 'social_facility=assisted_living'] },
    { type: 'way', tags: ['amenity=social_facility', 'social_facility=assisted_living'] },
  ],
  'assisted living': [
    { type: 'node', tags: ['social_facility=assisted_living'] },
    { type: 'way', tags: ['social_facility=assisted_living'] },
    { type: 'node', tags: ['amenity=social_facility'] },
    { type: 'way', tags: ['amenity=social_facility'] },
  ],
  'nursing home': [
    { type: 'node', tags: ['amenity=nursing_home'] },
    { type: 'way', tags: ['amenity=nursing_home'] },
    { type: 'node', tags: ['healthcare=nursing_home'] },
    { type: 'way', tags: ['healthcare=nursing_home'] },
  ],
  care: [
    { type: 'node', tags: ['amenity=social_facility', 'amenity=nursing_home'] },
    { type: 'way', tags: ['amenity=social_facility', 'amenity=nursing_home'] },
  ],

  hospital: [
    { type: 'node', tags: ['amenity=hospital'] },
    { type: 'way', tags: ['amenity=hospital'] },
    { type: 'node', tags: ['healthcare=hospital'] },
    { type: 'way', tags: ['healthcare=hospital'] },
  ],
  'medical center': [
    { type: 'node', tags: ['amenity=hospital', 'healthcare=hospital'] },
    { type: 'way', tags: ['amenity=hospital', 'healthcare=hospital'] },
  ],
  health: [
    { type: 'node', tags: ['amenity=hospital', 'amenity=clinic'] },
    { type: 'way', tags: ['amenity=hospital', 'amenity=clinic'] },
  ],
  clinic: [
    { type: 'node', tags: ['amenity=clinic'] },
    { type: 'way', tags: ['amenity=clinic'] },
    { type: 'node', tags: ['healthcare=clinic'] },
    { type: 'way', tags: ['healthcare=clinic'] },
  ],

  'urgent care': [
    { type: 'node', tags: ['amenity=clinic', 'healthcare=urgent_care'] },
    { type: 'way', tags: ['amenity=clinic', 'healthcare=urgent_care'] },
  ],
  urgent: [
    { type: 'node', tags: ['amenity=clinic', 'healthcare=urgent_care'] },
    { type: 'way', tags: ['amenity=clinic', 'healthcare=urgent_care'] },
  ],
  'walk-in': [
    { type: 'node', tags: ['amenity=clinic', 'healthcare=urgent_care'] },
    { type: 'way', tags: ['amenity=clinic', 'healthcare=urgent_care'] },
  ],
  'immediate care': [
    { type: 'node', tags: ['amenity=clinic', 'healthcare=urgent_care'] },
    { type: 'way', tags: ['amenity=clinic', 'healthcare=urgent_care'] },
  ],

  veterinary: [
    { type: 'node', tags: ['amenity=veterinary'] },
    { type: 'way', tags: ['amenity=veterinary'] },
    { type: 'node', tags: ['healthcare=veterinary'] },
    { type: 'way', tags: ['healthcare=veterinary'] },
  ],
  vet: [
    { type: 'node', tags: ['amenity=veterinary'] },
    { type: 'way', tags: ['amenity=veterinary'] },
    { type: 'node', tags: ['healthcare=veterinary'] },
    { type: 'way', tags: ['healthcare=veterinary'] },
  ],
  'animal hospital': [
    { type: 'node', tags: ['amenity=veterinary'] },
    { type: 'way', tags: ['amenity=veterinary'] },
    { type: 'node', tags: ['healthcare=veterinary'] },
    { type: 'way', tags: ['healthcare=veterinary'] },
  ],
  'pet clinic': [
    { type: 'node', tags: ['amenity=veterinary'] },
    { type: 'way', tags: ['amenity=veterinary'] },
  ],
  'animal care': [
    { type: 'node', tags: ['amenity=veterinary'] },
    { type: 'way', tags: ['amenity=veterinary'] },
  ],

  gym: [
    { type: 'node', tags: ['leisure=fitness_centre', 'sport=gym', 'amenity=gym'] },
    { type: 'way', tags: ['leisure=fitness_centre', 'sport=gym', 'amenity=gym'] },
  ],
  fitness: [
    { type: 'node', tags: ['leisure=fitness_centre'] },
    { type: 'way', tags: ['leisure=fitness_centre'] },
  ],
  training: [
    { type: 'node', tags: ['leisure=fitness_centre', 'sport=fitness'] },
    { type: 'way', tags: ['leisure=fitness_centre', 'sport=fitness'] },
  ],
  crossfit: [
    { type: 'node', tags: ['leisure=fitness_centre', 'sport=fitness'] },
    { type: 'way', tags: ['leisure=fitness_centre', 'sport=fitness'] },
  ],
  athletics: [
    { type: 'node', tags: ['leisure=sports_centre', 'leisure=fitness_centre'] },
    { type: 'way', tags: ['leisure=sports_centre', 'leisure=fitness_centre'] },
  ],
  performance: [
    { type: 'node', tags: ['leisure=fitness_centre', 'sport=fitness'] },
    { type: 'way', tags: ['leisure=fitness_centre', 'sport=fitness'] },
  ],

  doctor: [
    { type: 'node', tags: ['amenity=doctors', 'healthcare=doctor'] },
    { type: 'way', tags: ['amenity=doctors', 'healthcare=doctor'] },
  ],
  dr: [
    { type: 'node', tags: ['amenity=doctors', 'healthcare=doctor'] },
    { type: 'way', tags: ['amenity=doctors', 'healthcare=doctor'] },
  ],
  md: [
    { type: 'node', tags: ['amenity=doctors', 'healthcare=doctor'] },
    { type: 'way', tags: ['amenity=doctors', 'healthcare=doctor'] },
  ],
  'family medicine': [
    { type: 'node', tags: ['amenity=doctors', 'healthcare=doctor'] },
    { type: 'way', tags: ['amenity=doctors', 'healthcare=doctor'] },
  ],
  'internal medicine': [
    { type: 'node', tags: ['amenity=doctors', 'healthcare=doctor'] },
    { type: 'way', tags: ['amenity=doctors', 'healthcare=doctor'] },
  ],

  restaurant: [
    { type: 'node', tags: ['amenity=restaurant'] },
    { type: 'way', tags: ['amenity=restaurant'] },
  ],
  'fast food': [
    { type: 'node', tags: ['amenity=fast_food'] },
    { type: 'way', tags: ['amenity=fast_food'] },
  ],
  bar: [
    { type: 'node', tags: ['amenity=bar', 'amenity=pub'] },
    { type: 'way', tags: ['amenity=bar', 'amenity=pub'] },
  ],
  salon: [
    { type: 'node', tags: ['shop=hairdresser', 'shop=beauty'] },
    { type: 'way', tags: ['shop=hairdresser', 'shop=beauty'] },
  ],
  'car rental': [
    { type: 'node', tags: ['amenity=car_rental'] },
    { type: 'way', tags: ['amenity=car_rental'] },
  ],
  dentist: [
    { type: 'node', tags: ['amenity=dentist', 'healthcare=dentist'] },
    { type: 'way', tags: ['amenity=dentist', 'healthcare=dentist'] },
  ],
  pharmacy: [
    { type: 'node', tags: ['amenity=pharmacy'] },
    { type: 'way', tags: ['amenity=pharmacy'] },
  ],
  school: [
    { type: 'node', tags: ['amenity=school', 'amenity=college', 'amenity=university'] },
    { type: 'way', tags: ['amenity=school', 'amenity=college', 'amenity=university'] },
  ],
  church: [
    { type: 'node', tags: ['amenity=place_of_worship'] },
    { type: 'way', tags: ['amenity=place_of_worship'] },
  ],
  store: [
    { type: 'node', tags: ['shop=general', 'shop=variety_store'] },
    { type: 'way', tags: ['shop=general', 'shop=variety_store'] },
  ],
  park: [
    { type: 'node', tags: ['leisure=park'] },
    { type: 'way', tags: ['leisure=park'] },
  ],

  // ── Added: high-value vending-machine locations ──
  daycare: [
    { type: 'node', tags: ['amenity=childcare', 'amenity=kindergarten'] },
    { type: 'way', tags: ['amenity=childcare', 'amenity=kindergarten'] },
  ],
  childcare: [
    { type: 'node', tags: ['amenity=childcare'] },
    { type: 'way', tags: ['amenity=childcare'] },
  ],
  'day care': [
    { type: 'node', tags: ['amenity=childcare'] },
    { type: 'way', tags: ['amenity=childcare'] },
  ],
  college: [
    { type: 'node', tags: ['amenity=college', 'amenity=university'] },
    { type: 'way', tags: ['amenity=college', 'amenity=university'] },
  ],
  university: [
    { type: 'node', tags: ['amenity=university'] },
    { type: 'way', tags: ['amenity=university'] },
  ],
  manufacturing: [
    { type: 'node', tags: ['man_made=works', 'industrial=manufacturing'] },
    { type: 'way', tags: ['man_made=works', 'industrial=manufacturing'] },
  ],
  factory: [
    { type: 'node', tags: ['man_made=works'] },
    { type: 'way', tags: ['man_made=works'] },
  ],
  warehouse: [
    { type: 'node', tags: ['building=warehouse'] },
    { type: 'way', tags: ['building=warehouse'] },
  ],
  'self storage': [
    { type: 'node', tags: ['amenity=storage_rental'] },
    { type: 'way', tags: ['amenity=storage_rental'] },
    { type: 'node', tags: ['shop=storage_rental'] },
    { type: 'way', tags: ['shop=storage_rental'] },
  ],
  'storage unit': [
    { type: 'node', tags: ['amenity=storage_rental'] },
    { type: 'way', tags: ['amenity=storage_rental'] },
  ],
  'truck stop': [
    { type: 'node', tags: ['amenity=truck_stop'] },
    { type: 'way', tags: ['amenity=truck_stop'] },
    { type: 'node', tags: ['highway=services'] },
    { type: 'way', tags: ['highway=services'] },
  ],
  'gas station': [
    { type: 'node', tags: ['amenity=fuel'] },
    { type: 'way', tags: ['amenity=fuel'] },
  ],
  'convenience store': [
    { type: 'node', tags: ['shop=convenience'] },
    { type: 'way', tags: ['shop=convenience'] },
  ],
  'mini market': [
    { type: 'node', tags: ['shop=convenience', 'shop=supermarket'] },
    { type: 'way', tags: ['shop=convenience', 'shop=supermarket'] },
  ],
  'office building': [
    { type: 'node', tags: ['building=office'] },
    { type: 'way', tags: ['building=office'] },
    { type: 'node', tags: ['office=company'] },
    { type: 'way', tags: ['office=company'] },
  ],
  'office park': [
    { type: 'node', tags: ['building=office'] },
    { type: 'way', tags: ['building=office'] },
    { type: 'node', tags: ['landuse=commercial'] },
    { type: 'way', tags: ['landuse=commercial'] },
  ],
  'medical office': [
    { type: 'node', tags: ['building=hospital', 'amenity=clinic'] },
    { type: 'way', tags: ['building=hospital', 'amenity=clinic'] },
    { type: 'node', tags: ['amenity=clinic', 'amenity=hospital'] },
    { type: 'way', tags: ['amenity=clinic', 'amenity=hospital'] },
  ],
  chiropractor: [
    { type: 'node', tags: ['healthcare=chiropractor'] },
    { type: 'way', tags: ['healthcare=chiropractor'] },
  ],
  'physical therapy': [
    { type: 'node', tags: ['healthcare=physiotherapist'] },
    { type: 'way', tags: ['healthcare=physiotherapist'] },
  ],
  optometrist: [
    { type: 'node', tags: ['shop=optician', 'healthcare=optometrist'] },
    { type: 'way', tags: ['shop=optician', 'healthcare=optometrist'] },
  ],
  barber: [
    { type: 'node', tags: ['shop=barber'] },
    { type: 'way', tags: ['shop=barber'] },
  ],
  'nail salon': [
    { type: 'node', tags: ['shop=beauty', 'beauty=cosmetics'] },
    { type: 'way', tags: ['shop=beauty', 'beauty=cosmetics'] },
  ],
  spa: [
    { type: 'node', tags: ['shop=beauty', 'leisure=spa'] },
    { type: 'way', tags: ['shop=beauty', 'leisure=spa'] },
  ],
  'bowling alley': [
    { type: 'node', tags: ['leisure=bowling_alley'] },
    { type: 'way', tags: ['leisure=bowling_alley'] },
  ],
  arcade: [
    { type: 'node', tags: ['leisure=amusement_arcade'] },
    { type: 'way', tags: ['leisure=amusement_arcade'] },
  ],
  'movie theater': [
    { type: 'node', tags: ['amenity=cinema'] },
    { type: 'way', tags: ['amenity=cinema'] },
  ],
  'bingo hall': [
    { type: 'node', tags: ['leisure=social_club', 'club=bingo_club'] },
    { type: 'way', tags: ['leisure=social_club', 'club=bingo_club'] },
  ],
  casino: [
    { type: 'node', tags: ['leisure=gambling', 'amenity=casino'] },
    { type: 'way', tags: ['leisure=gambling', 'amenity=casino'] },
  ],
  'golf course': [
    { type: 'node', tags: ['leisure=golf_course'] },
    { type: 'way', tags: ['leisure=golf_course'] },
  ],
  'sports complex': [
    { type: 'node', tags: ['leisure=sports_centre'] },
    { type: 'way', tags: ['leisure=sports_centre'] },
  ],
  'community center': [
    { type: 'node', tags: ['amenity=community_centre'] },
    { type: 'way', tags: ['amenity=community_centre'] },
  ],
  'recreation center': [
    { type: 'node', tags: ['leisure=recreation_ground', 'leisure=sports_centre'] },
    { type: 'way', tags: ['leisure=recreation_ground', 'leisure=sports_centre'] },
  ],
  ymca: [
    { type: 'node', tags: ['leisure=sports_centre', 'amenity=community_centre'] },
    { type: 'way', tags: ['leisure=sports_centre', 'amenity=community_centre'] },
  ],
  'martial arts': [
    { type: 'node', tags: ['leisure=sports_centre', 'sport=martial_arts'] },
    { type: 'way', tags: ['leisure=sports_centre', 'sport=martial_arts'] },
  ],
  'dance studio': [
    { type: 'node', tags: ['leisure=sports_centre', 'sport=dance'] },
    { type: 'way', tags: ['leisure=sports_centre', 'sport=dance'] },
  ],
  'yoga studio': [
    { type: 'node', tags: ['leisure=fitness_centre', 'sport=yoga'] },
    { type: 'way', tags: ['leisure=fitness_centre', 'sport=yoga'] },
  ],
  camping: [
    { type: 'node', tags: ['tourism=camp_site'] },
    { type: 'way', tags: ['tourism=camp_site'] },
  ],
  'rv park': [
    { type: 'node', tags: ['tourism=camp_site', 'tourism=caravan_site'] },
    { type: 'way', tags: ['tourism=camp_site', 'tourism=caravan_site'] },
  ],
  'pet store': [
    { type: 'node', tags: ['shop=pet'] },
    { type: 'way', tags: ['shop=pet'] },
  ],
  'dog grooming': [
    { type: 'node', tags: ['shop=pet_grooming'] },
    { type: 'way', tags: ['shop=pet_grooming'] },
  ],
  dispensary: [
    { type: 'node', tags: ['shop=cannabis'] },
    { type: 'way', tags: ['shop=cannabis'] },
  ],
  'hardware store': [
    { type: 'node', tags: ['shop=hardware', 'shop=doityourself'] },
    { type: 'way', tags: ['shop=hardware', 'shop=doityourself'] },
  ],
  'furniture store': [
    { type: 'node', tags: ['shop=furniture'] },
    { type: 'way', tags: ['shop=furniture'] },
  ],
  'shopping mall': [
    { type: 'node', tags: ['shop=mall'] },
    { type: 'way', tags: ['shop=mall'] },
  ],
  'strip mall': [
    { type: 'node', tags: ['shop=mall', 'landuse=retail'] },
    { type: 'way', tags: ['shop=mall', 'landuse=retail'] },
  ],
  library: [
    { type: 'node', tags: ['amenity=library'] },
    { type: 'way', tags: ['amenity=library'] },
  ],
  'auto dealer': [
    { type: 'node', tags: ['shop=car'] },
    { type: 'way', tags: ['shop=car'] },
  ],
  'tire shop': [
    { type: 'node', tags: ['shop=tyres'] },
    { type: 'way', tags: ['shop=tyres'] },
  ],
};

export function expandBusinessTypeToOsmTags(businessType) {
  if (!businessType) return [];
  const keywords = [
    ...(businessType.requiredKeywords || []),
    ...(businessType.optionalKeywords || []),
  ];
  const deduped = [...new Set(keywords.map((k) => String(k || '').trim().toLowerCase()).filter(Boolean))];

  const tagStrings = new Set();
  for (const kw of deduped) {
    const direct = OSM_TAG_MAP[kw];
    if (direct && direct.length > 0) {
      for (const entry of direct) {
        for (const tag of entry.tags) {
          tagStrings.add(tag);
        }
      }
    } else {
      // Fallback: only match when keyword is a word-boundary within key OR key contains kw as whole word
      const kwRegex = new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      for (const [key, entries] of Object.entries(OSM_TAG_MAP)) {
        if (kwRegex.test(key) || key.split(/[\s-]+/).some(word => word.toLowerCase() === kw.toLowerCase())) {
          for (const entry of entries) {
            for (const tag of entry.tags) {
              tagStrings.add(tag);
            }
          }
        }
      }
    }
  }
  return Array.from(tagStrings);
}
