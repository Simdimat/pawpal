
"use client";
import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MapPin, Search, Filter, AlertTriangle, Loader2, ExternalLink } from "lucide-react";
import Image from "next/image";
import type { YelpBusiness } from '@/services/yelp';
import type { PetfinderOrganization } from '@/services/petfinder';


type PlaceType = 'Park' | 'Beach' | 'Vet' | 'Restaurant' | 'Shelter';

interface BasePlace {
  id: string;
  name: string;
  type: PlaceType;
  address?: string;
  imageUrl?: string;
  websiteUrl?: string;
  dataAiHint: string;
  latitude?: number;
  longitude?: number;
}

// Combine types for a unified Place interface
interface Place extends BasePlace, Partial<YelpBusiness>, Partial<PetfinderOrganization> {}


const filterOptions: { id: string; label: string; type: PlaceType; yelpCategory?: string; petfinderType?: boolean }[] = [
  { id: 'parks', label: 'Dog Parks', type: 'Park', yelpCategory: 'dogparks' },
  { id: 'beaches', label: 'Dog Beaches', type: 'Beach', yelpCategory: 'beaches' }, // Assuming Yelp might have 'dogbeach' or similar under beaches
  { id: 'vets', label: 'Vets', type: 'Vet', yelpCategory: 'veterinarians' },
  { id: 'restaurants', label: 'Pet-Friendly Restaurants', type: 'Restaurant', yelpCategory: 'restaurants,petfriendly' },
  { id: 'shelters', label: 'Shelters', type: 'Shelter', petfinderType: true },
];


export default function PetMapDisplay() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState<Set<PlaceType>>(
    new Set(filterOptions.map(f => f.type as PlaceType))
  );
  const [allFetchedLocations, setAllFetchedLocations] = useState<Place[]>([]);
  const [displayedLocations, setDisplayedLocations] = useState<Place[]>([]);
  const [isLoading, setIsLoading] = useState(true); // Start loading initially
  const [error, setError] = useState<string | null>(null);

  const SAN_DIEGO_LOCATION = "San Diego, CA";

  useEffect(() => {
    const fetchInitialData = async () => {
      setIsLoading(true);
      setError(null);
      let combinedLocations: Place[] = [];

      try {
        // Fetch Yelp locations (Parks, Beaches, Vets, Restaurants)
        const yelpCategoriesToFetch = filterOptions
          .filter(f => f.yelpCategory && activeFilters.has(f.type))
          .map(f => ({ type: f.type, category: f.yelpCategory!, term: f.label })); // Using label as a broad term

        for (const { type, category, term } of yelpCategoriesToFetch) {
            const yelpResponse = await fetch(`/api/yelp-search?term=${encodeURIComponent(term)}&location=${encodeURIComponent(SAN_DIEGO_LOCATION)}&categories=${encodeURIComponent(category)}&limit=10`);
            if (yelpResponse.ok) {
                const yelpData: YelpBusiness[] = await yelpResponse.json();
                const yelpPlaces: Place[] = yelpData.map(biz => ({
                    ...biz,
                    id: `yelp-${biz.id}`,
                    type: type,
                    address: biz.location?.display_address.join(', '),
                    imageUrl: biz.image_url,
                    websiteUrl: biz.url,
                    dataAiHint: type.toLowerCase(),
                    latitude: biz.coordinates?.latitude,
                    longitude: biz.coordinates?.longitude,
                }));
                combinedLocations.push(...yelpPlaces);
            } else {
                 console.warn(`Failed to fetch ${type} from Yelp`);
            }
        }
        
        // Fetch Petfinder locations (Shelters)
        if (activeFilters.has('Shelter')) {
            const petfinderResponse = await fetch(`/api/petfinder-organizations?location=${encodeURIComponent(SAN_DIEGO_LOCATION)}&limit=10`);
            if (petfinderResponse.ok) {
                const petfinderData: PetfinderOrganization[] = await petfinderResponse.json();
                const petfinderPlaces: Place[] = petfinderData.map(org => ({
                    ...org,
                    id: `pf-${org.id}`,
                    name: org.name,
                    type: 'Shelter',
                    address: `${org.address?.address1 || ''}, ${org.address?.city || ''}, ${org.address?.state || ''}`.replace(/^,|,$/g, '').trim(),
                    imageUrl: org.photos?.[0]?.medium,
                    websiteUrl: org.website || org.url,
                    dataAiHint: "animal shelter",
                    // Petfinder API might not always have coordinates directly for orgs
                }));
                combinedLocations.push(...petfinderPlaces);
            } else {
                console.warn('Failed to fetch shelters from Petfinder');
            }
        }
        
        // Remove duplicates by ID before setting
        const uniqueLocations = Array.from(new Map(combinedLocations.map(item => [item.id, item])).values());
        setAllFetchedLocations(uniqueLocations);
        setDisplayedLocations(uniqueLocations);

      } catch (e: any) {
        console.error("Error fetching initial map locations:", e);
        setError("Failed to load location data. Please try again later.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchInitialData();
  }, []); // Run once on mount to get all data types

  const applyFiltersAndSearch = () => {
    setIsLoading(true);
    setError(null);
    
    let newFilteredPlaces = allFetchedLocations.filter(p => activeFilters.has(p.type as PlaceType));
    if (searchQuery) {
      newFilteredPlaces = newFilteredPlaces.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.address && p.address.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }
    
    setDisplayedLocations(newFilteredPlaces);
    if (newFilteredPlaces.length === 0 && (searchQuery || activeFilters.size < filterOptions.length || activeFilters.size > 0 )) {
      setError("No locations match your current filters or search.");
    }
    setIsLoading(false);
  };
  
  // Re-filter when activeFilters or searchQuery changes, but debounce/delay search
   useEffect(() => {
    const handler = setTimeout(() => {
        // Only apply if allFetchedLocations has data, otherwise initial load handles it
        if (allFetchedLocations.length > 0 || !isLoading) { 
            applyFiltersAndSearch();
        }
    }, 300); // Debounce search/filter application
    return () => clearTimeout(handler);
  }, [searchQuery, activeFilters, allFetchedLocations, isLoading]);


  const handleFilterChange = (type: PlaceType, checked: boolean) => {
    setActiveFilters(prev => {
      const newFilters = new Set(prev);
      if (checked) {
        newFilters.add(type);
      } else {
        newFilters.delete(type);
      }
      return newFilters; // applyFiltersAndSearch will be triggered by useEffect
    });
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    applyFiltersAndSearch(); // Explicit search trigger
  };


  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 min-h-[600px]">
      <Card className="md:col-span-1 shadow-md flex flex-col">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-headline"><Filter className="w-5 h-5 text-primary"/> Filters & Search</CardTitle>
        </CardHeader>
        <CardContent className="flex-grow flex flex-col">
          <form onSubmit={handleSearchSubmit} className="space-y-4 mb-4">
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
             {isLoading && <div className="flex items-center justify-center text-sm text-muted-foreground py-4"><Loader2 className="w-5 h-5 mr-2 animate-spin"/>Loading locations...</div>}
            {error && <div className="mt-4 text-sm text-red-600 flex items-center"><AlertTriangle className="w-4 h-4 mr-2"/>{error}</div>}
            
            {!isLoading && !error && displayedLocations.length > 0 ? (
              <ScrollArea className="h-[200px] md:h-[calc(100vh-550px)] min-h-[200px]">
                <div className="space-y-3">
                  {displayedLocations.map(loc => (
                    <div key={loc.id} className="p-3 border rounded-md bg-card hover:shadow-md transition-shadow">
                       <Image
                        src={loc.imageUrl || `https://placehold.co/300x150.png?text=${encodeURIComponent(loc.name)}`}
                        alt={loc.name}
                        width={300}
                        height={150}
                        className="w-full h-24 object-cover rounded-md mb-2"
                        data-ai-hint={loc.dataAiHint}
                      />
                      <h4 className="font-semibold text-md text-primary">{loc.name}</h4>
                      <p className="text-sm text-muted-foreground">{loc.type} - {loc.address}</p>
                      {loc.websiteUrl && (
                        <Button asChild variant="link" size="sm" className="mt-1 px-0 text-xs">
                          <a href={loc.websiteUrl} target="_blank" rel="noopener noreferrer">
                            Visit Website <ExternalLink className="ml-1 h-3 w-3" />
                          </a>
                        </Button>
                      )}
                       <Button variant="outline" size="sm" className="mt-2 w-full text-xs" onClick={() => alert(`Future: Show ${loc.name} on interactive map (Lat: ${loc.latitude}, Lng: ${loc.longitude})`)}>
                        Show on Map (Placeholder)
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              !isLoading && !error && <p className="text-muted-foreground text-center py-4">No locations to display. Try adjusting your search or filters.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
