
// @refresh reset
"use client";
import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import type LType from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { configureLeafletDefaultIcon } from '@/lib/leaflet-default-icon';

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Filter, Search, AlertTriangle, Loader2, ExternalLink, Eye, ChevronDown } from "lucide-react";
import Image from "next/image";
import type { YelpBusiness } from '@/services/yelp';
import type { PetfinderOrganization } from '@/services/petfinder';

const DynamicMapContainer = dynamic(() => import('react-leaflet').then(mod => mod.MapContainer), { ssr: false });
const DynamicTileLayer = dynamic(() => import('react-leaflet').then(mod => mod.TileLayer), { ssr: false });
const DynamicMarker = dynamic(() => import('react-leaflet').then(mod => mod.Marker), { ssr: false });
const DynamicPopup = dynamic(() => import('react-leaflet').then(mod => mod.Popup), { ssr: false });

type PlaceType = 'Park' | 'Beach' | 'Vet' | 'Restaurant' | 'Shelter';

interface Place extends Partial<YelpBusiness>, Partial<PetfinderOrganization> {
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

const filterOptions: { id: string; label: string; type: PlaceType; yelpCategory?: string; petfinderType?: boolean }[] = [
  { id: 'parks', label: 'Dog Parks', type: 'Park', yelpCategory: 'dogparks' },
  { id: 'beaches', label: 'Dog Beaches', type: 'Beach', yelpCategory: 'beaches,dog_friendly' },
  { id: 'vets', label: 'Vets', type: 'Vet', yelpCategory: 'veterinarians' },
  { id: 'restaurants', label: 'Pet-Friendly Restaurants', type: 'Restaurant', yelpCategory: 'restaurants,petfriendly' },
  { id: 'shelters', label: 'Shelters', type: 'Shelter', petfinderType: true },
];

const SAN_DIEGO_COORDS: [number, number] = [32.7157, -117.1611];
const DEFAULT_ZOOM = 11;

const MapLoader = ({ message, details }: { message: string, details?: string }) => (
  <div className="flex flex-col items-center justify-center text-center p-4 h-full">
    <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
    <p className="text-lg font-semibold text-foreground">{message}</p>
    {details && <p className="text-sm text-muted-foreground mt-1">{details}</p>}
  </div>
);

export default function PetMapDisplay() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState<Set<PlaceType>>(
    new Set(filterOptions.map(f => f.type as PlaceType))
  );
  const [allFetchedLocations, setAllFetchedLocations] = useState<Place[]>([]);
  const [displayedLocations, setDisplayedLocations] = useState<Place[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [clientMounted, setClientMounted] = useState(false);
  const [mapLibraryLoaded, setMapLibraryLoaded] = useState(false);
  const [mapKey, setMapKey] = useState(() => `map-${Date.now()}-${Math.random()}`);

  const mapRef = useRef<LType.Map | null>(null);
  const markerRefs = useRef(new Map<string, LType.Marker>());

  // Effect for map cleanup on component unmount
  useEffect(() => {
    return () => {
      if (mapRef.current) {
        console.log("[PetMapDisplay] Unmounting. Cleaning up Leaflet map instance:", mapRef.current);
        const mapInstance = mapRef.current;
        mapRef.current = null; // Clear ref immediately
        mapInstance.off();
        mapInstance.remove();
        const container = mapInstance.getContainer();
        if (container && (container as any)._leaflet_id) {
          delete (container as any)._leaflet_id;
          console.log("[PetMapDisplay] Cleared _leaflet_id from container.");
        }
      }
    };
  }, []); // Empty dependency array ensures this runs only on unmount

  // Effect for client-side detection and Leaflet library loading
  useEffect(() => {
    setClientMounted(true);
    if (typeof window !== 'undefined') {
      import('leaflet').then(L_instance => {
        configureLeafletDefaultIcon(L_instance);
        setMapLibraryLoaded(true);
        console.log("[PetMapDisplay] Leaflet library loaded and icons configured.");
      }).catch(err => {
        console.error("[PetMapDisplay] Failed to load Leaflet library:", err);
        setError("Map components failed to load. Map functionality will be disabled.");
        setMapLibraryLoaded(false);
      });
    }
  }, []);

  useEffect(() => {
    const fetchInitialData = async () => {
      setIsLoading(true);
      setError(null);
      let combinedLocations: Place[] = [];
      const SAN_DIEGO_LOCATION = "San Diego, CA";

      try {
        const yelpCategoriesToFetch = filterOptions
          .filter(f => f.yelpCategory)
          .map(f => ({ type: f.type as PlaceType, category: f.yelpCategory!, term: f.label }));

        for (const { type, category, term } of yelpCategoriesToFetch) {
            const yelpResponse = await fetch(`/api/yelp-search?term=${encodeURIComponent(term)}&location=${encodeURIComponent(SAN_DIEGO_LOCATION)}&categories=${encodeURIComponent(category)}&limit=10`);
            if (yelpResponse.ok) {
                const yelpData: YelpBusiness[] = await yelpResponse.json();
                const yelpPlaces: Place[] = yelpData.map(biz => ({
                    ...biz,
                    id: `yelp-${biz.id}`,
                    type: type,
                    name: biz.name,
                    address: biz.location?.display_address.join(', '),
                    imageUrl: biz.image_url,
                    websiteUrl: biz.url,
                    dataAiHint: type.toLowerCase(),
                    latitude: biz.coordinates?.latitude,
                    longitude: biz.coordinates?.longitude,
                }));
                combinedLocations.push(...yelpPlaces);
            } else {
                 console.warn(`[PetMapDisplay] Failed to fetch ${type} from Yelp: ${yelpResponse.statusText}`);
            }
        }

        if (filterOptions.some(f => f.petfinderType)) {
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
                    latitude: undefined,
                    longitude: undefined,
                }));
                combinedLocations.push(...petfinderPlaces);
            } else {
                console.warn(`[PetMapDisplay] Failed to fetch shelters from Petfinder: ${petfinderResponse.statusText}`);
            }
        }
        
        const uniqueLocations = Array.from(new Map(combinedLocations.map(item => [item.id, item])).values())
                                  .filter(loc => typeof loc.latitude === 'number' && typeof loc.longitude === 'number'); 
        setAllFetchedLocations(uniqueLocations);
      } catch (e: any) {
        console.error("[PetMapDisplay] Error fetching initial map locations:", e);
        setError("Failed to load location data. Please try again later.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchInitialData();
  }, []);

  useEffect(() => {
    let newFilteredPlaces = allFetchedLocations.filter(p => activeFilters.has(p.type as PlaceType));
    if (searchQuery) {
      newFilteredPlaces = newFilteredPlaces.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.address && p.address.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }
    setDisplayedLocations(newFilteredPlaces);

    if (!isLoading && newFilteredPlaces.length === 0 && (searchQuery || activeFilters.size < filterOptions.length || (activeFilters.size > 0 && allFetchedLocations.length > 0) )) {
      if (!error?.includes("Map components failed to load")) {
        setError("No locations match your current filters or search.");
      }
    } else if (!isLoading && newFilteredPlaces.length > 0) {
      if (!error?.includes("Map components failed to load")) {
        setError(null); 
      }
    } else if (!isLoading && allFetchedLocations.length === 0 && activeFilters.size === filterOptions.length && !searchQuery){
      if (!error?.includes("Map components failed to load")) {
        setError(null);
      }
    }
  }, [searchQuery, activeFilters, allFetchedLocations, isLoading, error]); // Removed mapKey from dependencies here

  const handleFilterChange = (type: PlaceType, checked: boolean) => {
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

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Search is applied reactively by the useEffect above
  };

  const flyToLocation = (lat?: number, lon?: number, zoomLevel: number = 15) => {
    if (mapRef.current && typeof lat === 'number' && typeof lon === 'number') {
      mapRef.current.flyTo([lat, lon], zoomLevel);
    }
  };

  const openPopupForLocation = (locationId: string) => {
    const marker = markerRefs.current.get(locationId);
    if (marker && mapRef.current) { // Ensure map instance exists for popup
      marker.openPopup();
    }
  };

  const canRenderMap = clientMounted && mapLibraryLoaded;
  const showScrollIndicator = !isLoading && !error && displayedLocations.length > 2;

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
        <div
          key={mapKey} // CRITICAL FIX: Unique key for the map container div
          className="h-[300px] md:h-[400px] bg-muted rounded-lg shadow-inner flex items-center justify-center relative overflow-hidden border"
        >
          {!canRenderMap ? (
            <MapLoader
              message={clientMounted ? "Loading map library..." : "Initializing client components..."}
              details={error ? error : undefined}
            />
          ) : (
            <DynamicMapContainer
              id={`map-instance-${mapKey}`} // Use mapKey to ensure unique DOM ID for Leaflet
              center={SAN_DIEGO_COORDS}
              zoom={DEFAULT_ZOOM}
              style={{ height: '100%', width: '100%', borderRadius: '0.5rem', zIndex: 0 }}
              whenCreated={(mapInstance) => {
                if (mapRef.current && mapRef.current !== mapInstance) {
                  // If ref already points to a different map, clean up old one first (defensive)
                  console.warn("[PetMapDisplay] whenCreated: mapRef already existed. Cleaning up old instance.");
                  mapRef.current.off();
                  mapRef.current.remove();
                }
                mapRef.current = mapInstance;
                console.log("[PetMapDisplay] Map instance created and ref set:", mapInstance);
              }}
              scrollWheelZoom={true}
            >
              <DynamicTileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              />
              {displayedLocations.map(loc => {
                if (typeof loc.latitude === 'number' && typeof loc.longitude === 'number') {
                  return (
                    <DynamicMarker
                      key={loc.id}
                      position={[loc.latitude, loc.longitude]}
                      ref={(el) => { if (el) markerRefs.current.set(loc.id, el); }}
                    >
                      <DynamicPopup>
                        <div className="text-sm w-48">
                          <h3 className="font-semibold text-md mb-1 truncate" title={loc.name}>{loc.name}</h3>
                          {loc.address && <p className="text-xs text-muted-foreground mb-1 truncate" title={loc.address}>{loc.address}</p>}
                          {loc.websiteUrl && (
                            <a
                              href={loc.websiteUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline text-xs flex items-center truncate"
                            >
                              Visit Website <ExternalLink className="ml-1 h-3 w-3 flex-shrink-0" />
                            </a>
                          )}
                        </div>
                      </DynamicPopup>
                    </DynamicMarker>
                  );
                }
                return null;
              })}
            </DynamicMapContainer>
          )}
        </div>

        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="font-headline">Matching Locations</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading && <div className="flex items-center justify-center text-sm text-muted-foreground py-4"><Loader2 className="w-5 h-5 mr-2 animate-spin"/>Loading locations...</div>}
            {error && !error.includes("Map components failed to load") && <div className="mt-4 text-sm text-red-600 flex items-center"><AlertTriangle className="w-4 h-4 mr-2"/>{error}</div>}
            {error && error.includes("Map components failed to load") && <div className="mt-4 text-sm text-orange-600 flex items-center"><AlertTriangle className="w-4 h-4 mr-2"/>{error}</div>}

            {!isLoading && !error && displayedLocations.length > 0 ? (
              <>
                <ScrollArea className="h-[200px] md:h-[calc(100vh-650px)] min-h-[200px]"> 
                  <div className="space-y-3 pr-3">
                    {displayedLocations.map(loc => (
                      <div key={loc.id} className="p-3 border rounded-md bg-card hover:shadow-md transition-shadow">
                        <Image
                          src={loc.imageUrl || `https://placehold.co/300x150.png?text=${encodeURIComponent(loc.name)}`}
                          alt={loc.name}
                          width={300}
                          height={150}
                          className="w-full h-24 object-cover rounded-md mb-2"
                          data-ai-hint={loc.dataAiHint || loc.type.toLowerCase()}
                          unoptimized={loc.imageUrl?.includes('cloudfront.net') || loc.imageUrl?.includes('yelpcdn.com')}
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
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="mt-2 w-full text-xs"
                          onClick={() => {
                            if (typeof loc.latitude === 'number' && typeof loc.longitude === 'number') {
                              flyToLocation(loc.latitude, loc.longitude);
                              setTimeout(() => openPopupForLocation(loc.id), 500); 
                            }
                          }}
                          disabled={!(typeof loc.latitude === 'number' && typeof loc.longitude === 'number') || !canRenderMap}
                        >
                          <Eye className="mr-2 h-3 w-3" /> View on Map
                        </Button>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
                {showScrollIndicator && (
                  <div className="text-center text-xs text-muted-foreground pt-2">
                    <ChevronDown className="h-4 w-4 inline-block animate-bounce" />
                    <span className="ml-1">Scroll for more</span>
                  </div>
                )}
              </>
            ) : (
              !isLoading && (!error || error.includes("Map components failed to load")) && <p className="text-muted-foreground text-center py-4">No locations to display. Try adjusting your search or filters.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
