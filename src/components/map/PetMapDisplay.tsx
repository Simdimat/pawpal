
'use client';

import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Filter, Search, Loader2, AlertTriangle } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { Map } from 'leaflet'; // Import Map type for useMap hook

// Fix for default Leaflet icon issue with Webpack
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface Place {
  id: string;
  name: string;
  type: 'park' | 'beach' | 'vet' | 'shelter' | 'restaurant';
  latitude: number;
  longitude: number;
  address?: string;
  rating?: number;
}

const initialPlaces: Place[] = [
  { id: '1', name: 'Balboa Park Off-Leash Area', type: 'park', latitude: 32.7300, longitude: -117.1446, address: 'Balboa Dr, San Diego, CA 92101', rating: 4.5 },
  { id: '2', name: 'Fiesta Island Off-Leash Dog Park', type: 'beach', latitude: 32.7775, longitude: -117.2199, address: '1590 E Mission Bay Dr, San Diego, CA 92109', rating: 4.8 },
  { id: '3', name: 'VCA Emergency Animal Hospital', type: 'vet', latitude: 32.7603, longitude: -117.1531, address: '2317 Hotel Cir S, San Diego, CA 92108', rating: 4.2 },
  { id: '4', name: 'San Diego Humane Society', type: 'shelter', latitude: 32.7683, longitude: -117.1780, address: '5500 Gaines St, San Diego, CA 92110', rating: 4.7 },
  { id: '5', name: 'Coronado Dog Beach', type: 'beach', latitude: 32.6812, longitude: -117.1800, address: '100 Ocean Blvd, Coronado, CA 92118', rating: 4.9 },
];

const filterOptions = [
  { id: 'parks', label: 'Dog Parks', type: 'park' },
  { id: 'beaches', label: 'Dog Beaches', type: 'beach' },
  { id: 'vets', label: 'Vets', type: 'vet' },
  { id: 'shelters', label: 'Shelters', type: 'shelter' },
  { id: 'restaurants', label: 'Pet-Friendly Restaurants', type: 'restaurant' },
] as const;

// Dynamically import react-leaflet components
const DynamicMapContainer = dynamic(() =>
  import('react-leaflet').then((mod) => mod.MapContainer),
  { ssr: false }
);
const DynamicTileLayer = dynamic(() =>
  import('react-leaflet').then((mod) => mod.TileLayer),
  { ssr: false }
);
const DynamicMarker = dynamic(() =>
  import('react-leaflet').then((mod) => mod.Marker),
  { ssr: false }
);
const DynamicPopup = dynamic(() =>
  import('react-leaflet').then((mod) => mod.Popup),
  { ssr: false }
);
const useMap = dynamic(() =>
  import('react-leaflet').then((mod) => mod.useMap),
  { ssr: false }
);


const RecenterAutomatically = ({lat, lng, zoom} : {lat: number, lng: number, zoom: number}) => {
  const map = useMap ? useMap() : null; // useMap could be null before dynamic import resolves
   useEffect(() => {
     if (map) {
       map.setView([lat, lng], zoom);
     }
   }, [lat, lng, zoom, map]);
   return null;
 }

const PetMapDisplay = () => {
  const [mapReady, setMapReady] = useState(false);
  const [places, setPlaces] = useState<Place[]>(initialPlaces);
  const [filteredPlaces, setFilteredPlaces] = useState<Place[]>(initialPlaces);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState<Set<Place['type']>>(
    new Set(filterOptions.map(f => f.type))
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mapCenter, setMapCenter] = useState<[number, number]>([32.7157, -117.1611]); // San Diego default
  const [mapZoom, setMapZoom] = useState(11);
  
  useEffect(() => {
    setMapReady(true); 
  }, []);

  const fetchPlaces = async (filters: Set<Place['type']>, query?: string) => {
    setLoading(true);
    setError(null);
    await new Promise(resolve => setTimeout(resolve, 1000));
    try {
      let newFilteredPlaces = initialPlaces.filter(p => filters.has(p.type));
      if (query) {
        newFilteredPlaces = newFilteredPlaces.filter(p => 
          p.name.toLowerCase().includes(query.toLowerCase()) ||
          (p.address && p.address.toLowerCase().includes(query.toLowerCase()))
        );
      }
      setFilteredPlaces(newFilteredPlaces);

      if (newFilteredPlaces.length > 0 && query) { 
        setMapCenter([newFilteredPlaces[0].latitude, newFilteredPlaces[0].longitude]);
        setMapZoom(13);
      } else if (newFilteredPlaces.length === 0 && query) {
        setError("No results found for your search.");
      }

    } catch (e) {
      setError('Failed to load places. Please try again.');
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchPlaces(activeFilters, searchQuery);
  }, [activeFilters, searchQuery]);

  const handleFilterChange = (type: Place['type'], checked: boolean) => {
    setActiveFilters(prev => {
      const newFilters = new Set(prev);
      if (checked) {
        newFilters.add(type);
      } else {
        newFilters.delete(type);
      }
      return newFilters;
    });
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchPlaces(activeFilters, searchQuery);
  };

  if (!mapReady || !useMap) { // Ensure useMap hook is also loaded
    return <div className="flex justify-center items-center h-[600px]"><Loader2 className="h-12 w-12 animate-spin text-primary" /> <p className="ml-2">Loading Map...</p></div>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-[calc(100vh-200px)] min-h-[600px]">
      <Card className="md:col-span-1 shadow-md flex flex-col">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-headline"><Filter className="w-5 h-5 text-primary"/> Filters & Search</CardTitle>
        </CardHeader>
        <CardContent className="flex-grow flex flex-col">
          <form onSubmit={handleSearch} className="space-y-4 mb-4">
            <div className="relative">
              <Input 
                placeholder="Search by name or address..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pr-10"
              />
              <Button type="submit" size="icon" variant="ghost" className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8">
                <Search className="w-4 h-4"/>
              </Button>
            </div>
          </form>
          <Label className="font-semibold mb-2 block">Categories:</Label>
          <ScrollArea className="flex-grow pr-3">
            <div className="space-y-2">
            {filterOptions.map(opt => (
              <div key={opt.id} className="flex items-center space-x-2">
                <Checkbox 
                  id={opt.id} 
                  checked={activeFilters.has(opt.type)}
                  onCheckedChange={(checked) => handleFilterChange(opt.type, !!checked)}
                />
                <Label htmlFor={opt.id} className="text-sm font-normal">{opt.label}</Label>
              </div>
            ))}
            </div>
          </ScrollArea>
          {loading && <div className="mt-4 flex items-center justify-center text-sm text-muted-foreground"><Loader2 className="w-4 h-4 mr-2 animate-spin"/>Loading...</div>}
          {error && <div className="mt-4 text-sm text-red-600 flex items-center"><AlertTriangle className="w-4 h-4 mr-2"/>{error}</div>}
        </CardContent>
      </Card>

      <div className="md:col-span-2 h-full min-h-[400px] rounded-lg overflow-hidden shadow-lg border">
        <DynamicMapContainer 
            center={mapCenter} 
            zoom={mapZoom} 
            scrollWheelZoom={true} 
            style={{ height: '100%', width: '100%' }}
        >
          <RecenterAutomatically lat={mapCenter[0]} lng={mapCenter[1]} zoom={mapZoom} />
          <DynamicTileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {filteredPlaces.map(place => (
            <DynamicMarker key={place.id} position={[place.latitude, place.longitude]}>
              <DynamicPopup>
                <h3 className="font-bold text-md mb-1">{place.name}</h3>
                {place.address && <p className="text-xs mb-1">{place.address}</p>}
                <p className="text-xs capitalize mb-1">Type: {place.type}</p>
                {place.rating && <p className="text-xs">Rating: {place.rating}/5</p>}
              </DynamicPopup>
            </DynamicMarker>
          ))}
        </DynamicMapContainer>
      </div>
    </div>
  );
};

export default PetMapDisplay;
