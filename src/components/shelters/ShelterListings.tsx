'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, AlertCircle, ExternalLink, Home, Users } from 'lucide-react';
import Image from 'next/image';

interface Shelter {
  id: string;
  name: string;
  address?: string;
  website?: string;
  phone?: string;
  programs?: string[]; // e.g., "Dog Day Out", "Volunteer Walking", "Foster Program"
  description?: string;
}

const mockShelterData: Shelter[] = [
  { id: 'sh1', name: 'San Diego Humane Society', address: '5500 Gaines St, San Diego, CA 92110', website: 'https://www.sdhumane.org/support-us/volunteer/dog-walking/', programs: ['Volunteer Dog Walking', 'Foster Program'], description: 'Offers various volunteer roles including dog walking and short-term fostering.' },
  { id: 'sh2', name: 'Helen Woodward Animal Center', address: '6461 El Apajo, Rancho Santa Fe, CA 92067', website: 'https://animalcenter.org/get-involved/volunteer', programs: ['Dog Day Out (Occasional)', 'Volunteer Opportunities'], description: 'Known for its comprehensive animal welfare programs. Check their site for current "Dog Day Out" type events.' },
  { id: 'sh3', name: 'Chula Vista Animal Care Facility', address: '130 Beyer Way, Chula Vista, CA 91911', website: 'https://www.chulavistaca.gov/departments/animal-care/volunteer', programs: ['Volunteer Program'], description: 'Volunteers help with animal socialization and exercise.' },
];

const ShelterListings = () => {
  const [shelters, setShelters] = useState<Shelter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchShelters = async () => {
      setLoading(true);
      setError(null);
      try {
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1000));
        // In real app: const response = await fetch('/api/shelters/dog-day-out'); const data = await response.json();
        setShelters(mockShelterData);
      } catch (e: any) {
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
    return <div className="text-center py-10 text-muted-foreground">No shelter listings available at this time.</div>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
      {shelters.map((shelter) => (
        <Card key={shelter.id} className="flex flex-col shadow-md hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle className="font-headline text-xl flex items-center gap-2"><Home className="w-5 h-5 text-primary"/>{shelter.name}</CardTitle>
            {shelter.address && <CardDescription className="text-xs">{shelter.address}</CardDescription>}
          </CardHeader>
          <CardContent className="flex-grow space-y-3 text-sm">
             <Image 
                src={`https://placehold.co/600x300.png`}
                alt={shelter.name}
                width={600}
                height={300}
                className="rounded-md object-cover aspect-video mb-3"
                data-ai-hint="animal shelter building"
              />
            {shelter.description && <p className="text-foreground/80">{shelter.description}</p>}
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
            {shelter.website && (
              <Button asChild variant="outline" size="sm" className="w-full">
                <a href={shelter.website} target="_blank" rel="noopener noreferrer">
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
