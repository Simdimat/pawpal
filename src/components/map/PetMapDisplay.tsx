
"use client";
import { useState }
from 'react';
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MapPin, Search, Filter, AlertTriangle, Loader2 } from "lucide-react";
import Image from "next/image";

// Placeholder for locations. In a real app, this would come from an API.
const placeholderLocations = [
  { id: "1", name: "Dog Beach (Ocean Beach)", type: "Beach", lat: 32.7530, lng: -117.2520, dataAiHint: "beach dogs", address: "Ocean Beach, San Diego, CA" },
  { id: "2", name: "Fiesta Island Park", type: "Park", lat: 32.7760, lng: -117.2200, dataAiHint: "park dogs", address: "Mission Bay, San Diego, CA" },
  { id: "3", name: "Balboa Park (Nate's Point)", type: "Park", lat: 32.7300, lng: -117.1446, dataAiHint: "city park dogs", address: "Balboa Park, San Diego, CA" },
  { id: "4", name: "Coronado Dog Beach", type: "Beach", lat: 32.6800, lng: -117.1820, dataAiHint: "sandy beach dogs", address: "Coronado, CA" },
  { id: "5", name: "VCA Emergency Animal Hospital", type: "Vet", lat: 32.7603, lng: -117.1531, dataAiHint: "veterinary clinic", address: "Hotel Circle, San Diego, CA" },
  { id: "6", name: "The Patio on Lamont", type: "Restaurant", lat: 32.8004, lng: -117.2500, dataAiHint: "pet friendly restaurant", address: "Pacific Beach, San Diego, CA" },
];

const filterOptions = [
  { id: 'parks', label: 'Dog Parks', type: 'Park' },
  { id: 'beaches', label: 'Dog Beaches', type: 'Beach' },
  { id: 'vets', label: 'Vets', type: 'Vet' },
  { id: 'restaurants', label: 'Pet-Friendly Restaurants', type: 'Restaurant' },
];

type PlaceType = 'Park' | 'Beach' | 'Vet' | 'Restaurant' | 'Shelter';

interface Place {
  id: string;
  name: string;
  type: PlaceType;
  latitude?: number;
  longitude?: number;
  address?: string;
  rating?: number;
  dataAiHint: string;
}


export default function PetMapDisplay() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState<Set<PlaceType>>(
    new Set(filterOptions.map(f => f.type as PlaceType))
  );
  const [displayedLocations, setDisplayedLocations] = useState<Place[]>(placeholderLocations);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);


  const handleFilterChange = (type: PlaceType, checked: boolean) => {
    setActiveFilters(prev => {
      const newFilters = new Set(prev);
      if (checked) {
        newFilters.add(type);
      } else {
        newFilters.delete(type);
      }
      // Simulate filtering
      filterAndSearchLocations(searchQuery, newFilters);
      return newFilters;
    });
  };

  const filterAndSearchLocations = (query: string, filters: Set<PlaceType>) => {
    setIsLoading(true);
    setError(null);
    // Simulate API call / filtering delay
    setTimeout(() => {
      let newFilteredPlaces = placeholderLocations.filter(p => filters.has(p.type as PlaceType));
      if (query) {
        newFilteredPlaces = newFilteredPlaces.filter(p =>
          p.name.toLowerCase().includes(query.toLowerCase()) ||
          (p.address && p.address.toLowerCase().includes(query.toLowerCase()))
        );
      }
      setDisplayedLocations(newFilteredPlaces);
      if (newFilteredPlaces.length === 0 && (query || filters.size < filterOptions.length)) {
        setError("No locations match your current filters or search.");
      }
      setIsLoading(false);
    }, 500);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    filterAndSearchLocations(searchQuery, activeFilters);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 min-h-[600px]">
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
                aria-label="Search locations"
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
                  id={`filter-${opt.id}`}
                  checked={activeFilters.has(opt.type as PlaceType)}
                  onCheckedChange={(checked) => handleFilterChange(opt.type as PlaceType, !!checked)}
                  aria-labelledby={`label-filter-${opt.id}`}
                />
                <Label htmlFor={`filter-${opt.id}`} id={`label-filter-${opt.id}`} className="text-sm font-normal">{opt.label}</Label>
              </div>
            ))}
            </div>
          </ScrollArea>
          {isLoading && <div className="mt-4 flex items-center justify-center text-sm text-muted-foreground"><Loader2 className="w-4 h-4 mr-2 animate-spin"/>Loading...</div>}
          {error && <div className="mt-4 text-sm text-red-600 flex items-center"><AlertTriangle className="w-4 h-4 mr-2"/>{error}</div>}
        </CardContent>
      </Card>

      <div className="md:col-span-2 space-y-4">
        <div className="h-[300px] md:h-[400px] bg-muted rounded-lg shadow-inner flex items-center justify-center relative overflow-hidden border">
          <Image
              src="https://placehold.co/800x600.png"
              alt="Placeholder map of San Diego pet-friendly locations"
              layout="fill"
              objectFit="cover"
              data-ai-hint="map san diego"
              priority
            />
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 p-4">
            <MapPin className="h-12 w-12 text-primary mb-3" />
            <p className="text-center text-lg font-semibold text-background">
              Interactive Map Area
            </p>
            <p className="text-center text-sm text-background/80 max-w-md">
              This section will display an interactive map. For now, please use the filters and search to browse locations listed below.
            </p>
          </div>
        </div>

        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="font-headline">Matching Locations</CardTitle>
          </CardHeader>
          <CardContent>
            {displayedLocations.length > 0 ? (
              <ScrollArea className="h-[200px] md:h-[calc(100vh-550px)] min-h-[200px]">
                <div className="space-y-3">
                  {displayedLocations.map(loc => (
                    <div key={loc.id} className="p-3 border rounded-md bg-card hover:shadow-md transition-shadow">
                       <Image
                        src={`https://placehold.co/300x150.png`}
                        alt={loc.name}
                        width={300}
                        height={150}
                        className="w-full h-24 object-cover rounded-md mb-2"
                        data-ai-hint={loc.dataAiHint}
                      />
                      <h4 className="font-semibold text-md text-primary">{loc.name}</h4>
                      <p className="text-sm text-muted-foreground">{loc.type} - {loc.address}</p>
                      <Button variant="outline" size="sm" className="mt-2 w-full text-xs" onClick={() => alert('Future: Show on interactive map')}>
                        Show on Map (Placeholder)
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              !isLoading && <p className="text-muted-foreground">No locations to display. Try adjusting your search or filters.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
