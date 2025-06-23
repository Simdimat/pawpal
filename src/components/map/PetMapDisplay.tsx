// @refresh reset
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import maplibregl from 'maplibre-gl';
// Explicitly import types from the /maplibre path
import type { MapRef as MapLibreMapRef, ViewStateChangeEvent as MapLibreViewStateChangeEvent } from 'react-map-gl/maplibre';


import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Filter, Search, AlertTriangle, Loader2, ExternalLink, Eye, ChevronDown, Pin } from "lucide-react";
import Image from "next/image";
import type { YelpBusiness } from '@/services/yelp';
import type { PetfinderOrganization } from '@/services/petfinder';

// --- Dynamic Imports for react-map-gl components from MAPLIBRE path ---
const MapGL = dynamic(() => import('react-map-gl/maplibre').then(mod => mod.Map), { ssr: false, loading: () => <MapLoader message="Loading map library..." /> });
const MarkerGL = dynamic(() => import('react-map-gl/maplibre').then(mod => mod.Marker), { ssr: false });
const PopupGL = dynamic(() => import('react-map-gl/maplibre').then(mod => mod.Popup), { ssr: false });

// Use the aliased types throughout the component for clarity
type MapRef = MapLibreMapRef;
type ViewStateChangeEvent = MapLibreViewStateChangeEvent;


// --- Type Definitions and Constants ---
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

const SAN_DIEGO_INITIAL_VIEW_STATE = {
  longitude: -117.1611,
  latitude: 32.7157,
  zoom: 10.5,
  pitch: 0,
  bearing: 0,
};

const MAP_STYLE = "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json";

// --- Helper Component for Loading State ---
const MapLoader = ({ message, details }: { message: string, details?: string }) => (
    <div className="flex flex-col items-center justify-center text-center p-4 h-full">
      <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
      <p className="text-lg font-semibold text-foreground">{message}</p>
      {details && <p className="text-sm text-muted-foreground mt-1">{details}</p>}
    </div>
);

export default function PetMapDisplay() {
  const [allFetchedLocations, setAllFetchedLocations] = useState<Place[]>([]);
  const [displayedLocations, setDisplayedLocations] = useState<Place[]>([]);
  const [activeFilters, setActiveFilters] = useState<Set<PlaceType>>(new Set(filterOptions.map(f => f.type as PlaceType)));
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [viewState, setViewState] = useState(SAN_DIEGO_INITIAL_VIEW_STATE);
  const [selectedLocationPopup, setSelectedLocationPopup] = useState<Place | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [clientMounted, setClientMounted] = useState(false);
  const [mapKey, setMapKey] = useState(() => `map-${Date.now()}-${Math.random()}`); 

  const mapRef = useRef<MapRef | null>(null);

  useEffect(() => {
    setClientMounted(true);
    return () => {
      if (mapRef.current && typeof (mapRef.current as any).getMap === 'function') {
        const maplibreMap = (mapRef.current as any).getMap();
        if (maplibreMap && typeof maplibreMap.remove === 'function') {
          console.log("PetMapDisplay is unmounting. Cleaning up MapLibre GL map instance.");
          maplibreMap.remove();
        }
      }
      mapRef.current = null; 
    };
  }, []); 

  
  // Effect for fetching initial location data
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
                    address: `${org.address?.address1 || ''}, ${org.address?.city || ''}, ${org.address?.state || ''} ${org.address?.postcode || ''}`.replace(/^,|,$/g, '').trim(),
                    imageUrl: org.photos?.[0]?.medium,
                    websiteUrl: org.website || org.url,
                    dataAiHint: "animal shelter building",
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

  // Effect for filtering locations based on UI state
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
        setError("No locations match your current filters or search.");
    } else if (!isLoading && newFilteredPlaces.length > 0) {
        setError(null); 
    } else if (!isLoading && allFetchedLocations.length === 0 && activeFilters.size === filterOptions.length && !searchQuery){
        setError(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, activeFilters, allFetchedLocations, isLoading]);

  const handleFilterChange = (type: PlaceType, checked: boolean) => {
    setActiveFilters(prev => {
      const newFilters = new Set(prev);
      if (checked) newFilters.add(type);
      else newFilters.delete(type);
      return newFilters;
    });
  };

  const handleSearchSubmit = (e: React.FormEvent) => e.preventDefault();

  const flyToLocation = useCallback((lat?: number, lon?: number, zoomLevel: number = 14) => {
    if (mapRef.current && typeof lat === 'number' && typeof lon === 'number') {
      mapRef.current.flyTo({ center: [lon, lat] as maplibregl.LngLatLike, zoom: zoomLevel, duration: 1500 });
    }
  }, []);

  const handleMarkerClick = (loc: Place) => {
    setSelectedLocationPopup(loc);
    if (loc.latitude && loc.longitude) {
        flyToLocation(loc.latitude, loc.longitude, viewState.zoom < 13 ? 13 : viewState.zoom);
    }
  };

  const handleMapLoad = useCallback(() => {
    setMapReady(true);
    console.log("MapLibre map loaded via react-map-gl.");
  }, []);

  const onMapMove = useCallback((evt: ViewStateChangeEvent) => {
    setViewState(evt.viewState);
  }, []);

  const showScrollIndicator = !isLoading && !error && displayedLocations.length > 2;

  if (!clientMounted) {
    return <MapLoader message="Initializing map components..." />;
  }

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
           key={mapKey} 
           className="h-[400px] md:h-[400px] bg-muted rounded-lg shadow-inner flex items-center justify-center relative overflow-hidden border"
        >
          {clientMounted ? ( 
            <MapGL
              ref={mapRef}
              mapLib={maplibregl} 
              initialViewState={SAN_DIEGO_INITIAL_VIEW_STATE}
              style={{width: '100%', height: '100%', borderRadius: '0.5rem'}}
              mapStyle={MAP_STYLE}
              onLoad={handleMapLoad}
              onMove={onMapMove}
            >
              {mapReady && displayedLocations.map(loc => {
                if (typeof loc.latitude === 'number' && typeof loc.longitude === 'number') {
                  return (
                    <MarkerGL
                      key={loc.id}
                      longitude={loc.longitude}
                      latitude={loc.latitude}
                      onClick={(e) => {
                        e.originalEvent?.stopPropagation(); 
                        handleMarkerClick(loc);
                      }}
                    >
                      <Pin className="w-6 h-6 text-destructive fill-destructive/70 cursor-pointer" />
                    </MarkerGL>
                  );
                }
                return null;
              })}

              {selectedLocationPopup && typeof selectedLocationPopup.latitude === 'number' && typeof selectedLocationPopup.longitude === 'number' && (
                <PopupGL
                  longitude={selectedLocationPopup.longitude}
                  latitude={selectedLocationPopup.latitude}
                  onClose={() => setSelectedLocationPopup(null)}
                  closeButton={true}
                  closeOnClick={false}
                  anchor="bottom"
                  offset={25} 
                >
                  <div className="text-sm w-48 p-1">
                    <h3 className="font-semibold text-md mb-1 truncate" title={selectedLocationPopup.name}>{selectedLocationPopup.name}</h3>
                    {selectedLocationPopup.address && <p className="text-xs text-muted-foreground mb-1 truncate" title={selectedLocationPopup.address}>{selectedLocationPopup.address}</p>}
                    {selectedLocationPopup.websiteUrl && (
                      <a
                        href={selectedLocationPopup.websiteUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline text-xs flex items-center truncate"
                      >
                        Visit Website <ExternalLink className="ml-1 h-3 w-3 flex-shrink-0" />
                      </a>
                    )}
                  </div>
                </PopupGL>
              )}
            </MapGL>
          ) : (
            <MapLoader message="Initializing map components..." />
          )}
        </div>

        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="font-headline">Matching Locations</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading && <div className="flex items-center justify-center text-sm text-muted-foreground py-4"><Loader2 className="w-5 h-5 mr-2 animate-spin"/>Loading locations...</div>}
            {error && <div className="mt-4 text-sm text-red-600 flex items-center"><AlertTriangle className="w-4 h-4 mr-2"/>{error}</div>}
            
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
                              setTimeout(() => setSelectedLocationPopup(loc), 50);
                            }
                          }}
                          disabled={!(typeof loc.latitude === 'number' && typeof loc.longitude === 'number') || !mapReady}
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
              !isLoading && !error && <p className="text-muted-foreground text-center py-4">No locations to display. Try adjusting your search or filters.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}