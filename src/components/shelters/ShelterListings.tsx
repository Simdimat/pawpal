
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, AlertCircle, ExternalLink, Home, Users, MapPin, Phone } from 'lucide-react';
import Image from 'next/image';
import type { PetfinderOrganization } from '@/services/petfinder';

// Simplified Shelter interface based on PetfinderOrganization
interface Shelter extends Partial<PetfinderOrganization> {
  customAddress?: string;
  programs?: string[]; // Example: "Dog Day Out", "Volunteer Walking" - Petfinder API doesn't detail this broadly
  description?: string; // Using mission_statement
}


const ShelterListings = () => {
  const [shelters, setShelters] = useState<Shelter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchShelters = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/petfinder-organizations?location=San Diego, CA&limit=12`);
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `Failed to fetch shelters. Status: ${response.status}`);
        }
        const data: PetfinderOrganization[] = await response.json();
        
        const transformedShelters: Shelter[] = data.map(org => ({
          ...org,
          customAddress: `${org.address?.address1 || ''} ${org.address?.city || ''}, ${org.address?.state || ''} ${org.address?.postcode || ''}`.trim().replace(/^,|,$/g, ''),
          description: org.mission_statement || "Dedicated to animal welfare and adoption.",
          // Petfinder orgs don't list specific programs like "Dog Day Out" directly in the main org object.
          // This would require more complex logic or assumptions. For now, list general volunteer info.
          programs: org.website || org.url ? ["Volunteer Opportunities (check website)"] : ["Contact for opportunities"], 
        }));
        setShelters(transformedShelters);

      } catch (e: any) {
        console.error('Error fetching shelters:', e);
        setError(e.message || 'Failed to load shelter information.');
      } finally {
        setLoading(false);
      }
    };

    fetchShelters();
  }, []);

  if (loading) {
    return <div className="flex justify-center items-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="ml-2">Loading shelter listings...</p></div>;
  }

  if (error) {
    return <div className="text-center py-10 text-red-600"><AlertCircle className="mx-auto h-8 w-8 mb-2" />Error: {error}</div>;
  }

  if (shelters.length === 0) {
    return <div className="text-center py-10 text-muted-foreground">No shelter listings found in San Diego.</div>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
      {shelters.map((shelter) => (
        <Card key={shelter.id} className="flex flex-col shadow-md hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle className="font-headline text-xl flex items-center gap-2"><Home className="w-5 h-5 text-primary"/>{shelter.name}</CardTitle>
            {shelter.customAddress && <CardDescription className="text-xs flex items-center gap-1"><MapPin className="w-3 h-3"/>{shelter.customAddress}</CardDescription>}
          </CardHeader>
          <CardContent className="flex-grow space-y-3 text-sm">
             <Image 
                src={shelter.photos?.[0]?.medium || `https://placehold.co/600x300.png?text=${encodeURIComponent(shelter.name || 'Shelter')}`}
                alt={shelter.name || 'Animal Shelter'}
                width={600}
                height={300}
                className="rounded-md object-cover aspect-video mb-3"
                data-ai-hint="animal shelter building"
              />
            {shelter.description && <p className="text-foreground/80 line-clamp-3">{shelter.description}</p>}
            {shelter.phone && <p className="text-xs flex items-center gap-1"><Phone className="w-3 h-3"/> {shelter.phone}</p>}
            {shelter.email && <p className="text-xs truncate">Email: {shelter.email}</p>}
            {shelter.programs && shelter.programs.length > 0 && (
              <div>
                <strong className="text-xs text-muted-foreground flex items-center gap-1"><Users className="w-3 h-3"/> Programs:</strong>
                <ul className="list-disc list-inside text-xs mt-1">
                  {shelter.programs.map(prog => <li key={prog}>{prog}</li>)}
                </ul>
              </div>
            )}
          </CardContent>
          <CardFooter>
            {(shelter.website || shelter.url) && (
              <Button asChild variant="outline" size="sm" className="w-full">
                <a href={shelter.website || shelter.url} target="_blank" rel="noopener noreferrer">
                  Visit Website <ExternalLink className="ml-2 h-3 w-3" />
                </a>
              </Button>
            )}
          </CardFooter>
        </Card>
      ))}
    </div>
  );
};

export default ShelterListings;

