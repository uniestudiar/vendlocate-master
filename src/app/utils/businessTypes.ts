export interface BusinessTypeDef {
  id: string;
  name: string;
  requiredKeywords: string[];
  optionalKeywords: string[];
  enabled?: boolean;
  isPremium?: boolean;
  premiumPrice?: number;
}

export const ALL_BUSINESS_TYPES: BusinessTypeDef[] = [
  { id: 'laundromat', name: 'Laundromats & Dry Cleaners', requiredKeywords: ['laundry', 'laundromat', 'wash', 'dry', 'clean', 'cleaner'], optionalKeywords: [], isPremium: true, premiumPrice: 49 },
  { id: 'car-wash', name: 'Car Washes', requiredKeywords: ['car wash', 'carwash', 'auto wash'], optionalKeywords: [] },
  { id: 'auto-shops', name: 'Auto Shops, Dealers & Rental', requiredKeywords: ['car', 'auto', 'repair', 'tire', 'tyre', 'service', 'mechanic', 'automotive', 'auto dealer', 'car dealer', 'car sales', 'car rental', 'rent a car'], optionalKeywords: [] },
  { id: 'apartments', name: 'Apartments & Complexes', requiredKeywords: ['apartment', 'apartments', 'complex', 'housing', 'residential'], optionalKeywords: [] },
  { id: 'hotels', name: 'Hotels & Motels', requiredKeywords: ['hotel', 'motel', 'inn', 'lodge', 'resort', 'guest'], optionalKeywords: [] },
  { id: 'senior-communities', name: 'Senior & Community Centers', requiredKeywords: ['senior', 'retirement', 'assisted living', 'nursing home', 'care', 'elderly', 'community center', 'community centre', 'recreation center', 'ymca', 'ywca'], optionalKeywords: [], isPremium: true, premiumPrice: 49 },
  { id: 'medical', name: 'Medical Offices & Urgent Care', requiredKeywords: ['hospital', 'medical center', 'clinic', 'doctor', 'dr', 'md', 'physician', 'dentist', 'dental', 'urgent care', 'walk-in', 'immediate care', 'family medicine', 'internal medicine'], optionalKeywords: [] },
  { id: 'pet-hospitals', name: 'Pet Hospitals & Vets', requiredKeywords: ['veterinary', 'vet', 'animal hospital', 'pet clinic', 'animal care'], optionalKeywords: [] },
  { id: 'fitness', name: 'Gyms & Fitness Studios', requiredKeywords: ['gym', 'fitness', 'training', 'crossfit', 'athletics', 'workout', 'yoga', 'pilates', 'dance', 'dance studio', 'martial arts', 'karate', 'taekwondo', 'judo'], optionalKeywords: [] },
  { id: 'sports-recreation', name: 'Sports & Recreation', requiredKeywords: ['sports complex', 'sports centre', 'athletic club', 'recreation', 'bowling', 'arcade', 'cinema', 'theater', 'theatre', 'bingo', 'casino', 'gambling', 'golf course'], optionalKeywords: [] },
  { id: 'specialty-care', name: 'Specialty Healthcare', requiredKeywords: ['chiropractor', 'chiropractic', 'physical therapy', 'physiotherapist', 'physio', 'optometrist', 'optician', 'eye doctor', 'pharmacy', 'drug store'], optionalKeywords: [] },
  { id: 'salons', name: 'Salons, Barbers & Spas', requiredKeywords: ['salon', 'hairdresser', 'beauty salon', 'barber', 'barbershop', 'nail salon', 'manicure', 'spa'], optionalKeywords: [] },
  { id: 'schools', name: 'Schools & Daycares', requiredKeywords: ['school', 'elementary', 'middle school', 'high school', 'daycare', 'childcare', 'day care', 'kindergarten'], optionalKeywords: [] },
  { id: 'colleges', name: 'Colleges & Universities', requiredKeywords: ['college', 'university', 'campus'], optionalKeywords: [] },
  { id: 'churches', name: 'Churches & Libraries', requiredKeywords: ['church', 'temple', 'worship', 'mosque', 'synagogue', 'library'], optionalKeywords: [] },
  { id: 'warehouses', name: 'Warehouses, Factories & Industrial', requiredKeywords: ['warehouse', 'distribution', 'fulfillment', 'manufacturing', 'factory', 'works', 'industrial', 'self storage', 'storage unit', 'storage rental'], optionalKeywords: [], isPremium: true, premiumPrice: 49 },
  { id: 'truck-stops', name: 'Truck Stops', requiredKeywords: ['truck stop', 'truckstop'], optionalKeywords: [] },
  { id: 'gas-stations', name: 'Gas Stations & Convenience Stores', requiredKeywords: ['gas station', 'fuel', 'gasoline', 'convenience store', 'mini market', 'corner store'], optionalKeywords: [] },
  { id: 'retail-stores', name: 'Retail Stores', requiredKeywords: ['store', 'shop'], optionalKeywords: [] },
  { id: 'specialty-retail', name: 'Hardware & Furniture Stores', requiredKeywords: ['hardware store', 'do it yourself', 'furniture store', 'furniture'], optionalKeywords: [] },
  { id: 'shopping-malls', name: 'Shopping Malls & Plazas', requiredKeywords: ['shopping mall', 'strip mall', 'retail park'], optionalKeywords: [] },
  { id: 'office-buildings', name: 'Office Buildings & Parks', requiredKeywords: ['office building', 'office park', 'commercial building'], optionalKeywords: [] },
  { id: 'campgrounds', name: 'Campgrounds & RV Parks', requiredKeywords: ['camping', 'campground', 'rv park', 'caravan'], optionalKeywords: [] },
  { id: 'pet-stores', name: 'Pet Stores & Dog Grooming', requiredKeywords: ['pet store', 'pet shop', 'dog grooming', 'pet grooming'], optionalKeywords: [] },
  { id: 'dispensaries', name: 'Dispensaries', requiredKeywords: ['dispensary', 'cannabis'], optionalKeywords: [] },
  { id: 'parks', name: 'Parks', requiredKeywords: ['park', 'playground'], optionalKeywords: [] },
];
