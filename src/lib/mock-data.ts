import type { YelpBusiness } from '@/services/yelp';
import type { PetfinderOrganization } from '@/services/petfinder';

export const mockYelpVets: YelpBusiness[] = [
  {
    id: 'mock-vet-1',
    alias: 'community-veterinary-clinic-san-diego',
    name: 'Community Veterinary Clinic (Mock)',
    image_url: 'https://placehold.co/600x400.png',
    is_closed: false,
    url: '#',
    review_count: 150,
    categories: [{ alias: 'veterinarians', title: 'Veterinarians' }],
    rating: 4.5,
    coordinates: { latitude: 32.7538, longitude: -117.146 },
    transactions: [],
    location: { address1: '123 Pet Street', city: 'San Diego', state: 'CA', zip_code: '92101', country: 'US', display_address: ['123 Pet Street', 'San Diego, CA 92101'], address2: '', address3: '' },
    phone: '+18001234567',
    display_phone: '(800) 123-4567',
  },
  {
    id: 'mock-vet-2',
    alias: 'b-street-veterinary-hospital-san-diego',
    name: 'B Street Veterinary Hospital (Mock)',
    image_url: 'https://placehold.co/600x400.png',
    is_closed: false,
    url: '#',
    review_count: 200,
    categories: [{ alias: 'veterinarians', title: 'Veterinarians' }, { alias: 'petgroomers', title: 'Pet Groomers' }],
    rating: 5,
    coordinates: { latitude: 32.717, longitude: -117.155 },
    transactions: [],
    location: { address1: '456 Doggo Ave', city: 'San Diego', state: 'CA', zip_code: '92102', country: 'US', display_address: ['456 Doggo Ave', 'San Diego, CA 92102'], address2: '', address3: '' },
    phone: '+18007654321',
    display_phone: '(800) 765-4321',
  },
];

export const mockYelpParks: YelpBusiness[] = [
    {
      id: 'mock-park-1',
      name: 'Balboa Park Dog Park (Mock)',
      image_url: 'https://placehold.co/600x400.png',
      is_closed: false,
      url: '#',
      review_count: 300,
      categories: [{ alias: 'dogparks', title: 'Dog Parks' }],
      rating: 4.5,
      coordinates: { latitude: 32.730, longitude: -117.145 },
      transactions: [],
      location: { display_address: ['Balboa Park', 'San Diego, CA 92101'], address1: 'Balboa Park', city: 'San Diego', state: 'CA', zip_code: '92101', country: 'US', address2: '', address3: '' },
      phone: '',
      display_phone: '',
      alias: 'balboa-park-dog-park-san-diego'
    },
];

export const mockYelpBeaches: YelpBusiness[] = [
    {
      id: 'mock-beach-1',
      name: 'Coronado Dog Beach (Mock)',
      image_url: 'https://placehold.co/600x400.png',
      is_closed: false,
      url: '#',
      review_count: 500,
      categories: [{ alias: 'beaches', title: 'Beaches' }, { alias: 'dogparks', title: 'Dog Parks' }],
      rating: 5,
      coordinates: { latitude: 32.684, longitude: -117.183 },
      transactions: [],
      location: { display_address: ['Ocean Blvd', 'Coronado, CA 92118'], address1: 'Ocean Blvd', city: 'Coronado', state: 'CA', zip_code: '92118', country: 'US', address2: '', address3: '' },
      phone: '',
      display_phone: '',
      alias: 'coronado-dog-beach-coronado'
    }
];

export const mockYelpRestaurants: YelpBusiness[] = [
    {
      id: 'mock-resto-1',
      name: 'The Patio on Lamont (Mock)',
      image_url: 'https://placehold.co/600x400.png',
      is_closed: false,
      url: '#',
      review_count: 1200,
      categories: [{ alias: 'newamerican', title: 'American (New)' }, { alias: 'petfriendly', title: 'Pet Friendly' }],
      rating: 4,
      coordinates: { latitude: 32.798, longitude: -117.231 },
      transactions: ['delivery'],
      location: { display_address: ['4445 Lamont St', 'San Diego, CA 92109'], address1: '4445 Lamont St', city: 'San Diego', state: 'CA', zip_code: '92109', country: 'US', address2: '', address3: '' },
      phone: '+18584124648',
      display_phone: '(858) 412-4648',
      alias: 'the-patio-on-lamont-san-diego'
    }
];

export const mockPetfinderOrgs: PetfinderOrganization[] = [
  {
    id: 'mock-pf-1',
    name: 'San Diego Humane Society (Mock)',
    email: 'info@mockhumanesociety.org',
    phone: '(619) 299-7012',
    address: { address1: '5500 Gaines St', city: 'San Diego', state: 'CA', postcode: '92110', country: 'US', address2: null },
    hours: {},
    url: '#',
    website: '#',
    mission_statement: 'To inspire compassion for all animals, and to be a resource for our community.',
    photos: [{ medium: 'https://placehold.co/600x400.png', small: '', large: '', full: '' }],
  },
  {
    id: 'mock-pf-2',
    name: 'The Animal Pad (Mock)',
    email: 'info@theanimalpad.org',
    phone: '(619) 555-1234',
    address: { address1: 'P.O. Box 1234', city: 'La Mesa', state: 'CA', postcode: '91941', country: 'US', address2: null },
    hours: {},
    url: '#',
    website: '#',
    mission_statement: 'A non-profit, all-breed dog rescue that focuses on saving dogs from high-kill shelters and the streets of Mexico.',
    photos: [{ medium: 'https://placehold.co/600x400.png', small: '', large: '', full: '' }],
  },
];
