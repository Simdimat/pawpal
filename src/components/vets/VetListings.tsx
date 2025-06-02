'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, AlertCircle, ExternalLink, Star, MapPin, Phone } from 'lucide-react';
import Image from 'next/image';

interface Vet {
  id: string;
  name: string;
  address?: string;
  phone?: string;
  website?: string;
  rating?: number; // Yelp rating for SD, or community rating for TJ
  reviewSnippet?: string; // From Yelp or Reddit
  services?: string[];
  notes?: string; // For TJ vets: warnings, tips
  isTijuanaVet?: boolean;
}

interface VetListingsProps {
  locationType: 'SD' | 'TJ';
}

const mockSdData: Vet[] = [
  { id: 'sd1', name: 'B Street Veterinary Hospital', address: '2024 B St, San Diego, CA 92102', phone: '(619) 237-7297', website: 'https://www.bstreetvet.com/', rating: 4.7, reviewSnippet: 'Great staff, very caring with my dog.' , services: ['General Care', 'Surgery', 'Dental'] },
  { id: 'sd2', name: 'Market Street Veterinary Clinic', address: '1000 Market St, San Diego, CA 92101', phone: '(619) 230-1295', website: 'https://marketstreetvet.com/', rating: 4.5, reviewSnippet: 'Knowledgeable vets, always helpful.', services: ['Vaccinations', 'Wellness Exams'] },
];

const mockTjData: Vet[] = [
  { id: 'tj1', name: 'Veterinaria Revolución', address: 'Av. Revolución 123, Zona Centro, Tijuana', phone: '+52 664 123 4567', rating: 4.2, reviewSnippet: 'Many US visitors, affordable dental work. Cash only.', notes: 'Ensure you have all necessary paperwork for border crossing with pets. Verify medication sourcing.', isTijuanaVet: true, services: ['Dental', 'Low-cost spay/neuter'] },
  { id: 'tj2', name: 'Hospital Veterinario de Playas', address: 'Paseo Ensenada, Playas de Tijuana', rating: 4.0, reviewSnippet: 'Good for emergencies if you are already in TJ. Some staff speak English.', notes: 'Parking can be difficult. Call ahead for English speaking vet availability.', isTijuanaVet: true, services: ['Emergency Care', 'Surgery'] },
];


const VetListings = ({ locationType }: VetListingsProps) => {
  const [vets, setVets] = useState<Vet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchVets = async () => {
      setLoading(true);
      setError(null);
      try {
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1000));
        if (locationType === 'SD') {
          // In real app: const response = await fetch('/api/vets/sd'); const data = await response.json();
          setVets(mockSdData);
        } else {
          // In real app: const response = await fetch('/api/vets/tj-info'); const data = await response.json();
          setVets(mockTjData);
        }
      } catch (e: any) {
        setError(e.message || 'Failed to load vet information.');
      } finally {
        setLoading(false);
      }
    };

    fetchVets();
  }, [locationType]);

  if (loading) {
    return <div className="flex justify-center items-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="ml-2">Loading vet listings...</p></div>;
  }

  if (error) {
    return <div className="text-center py-10 text-red-600"><AlertCircle className="mx-auto h-8 w-8 mb-2" />Error: {error}</div>;
  }

  if (vets.length === 0) {
    return <div className="text-center py-10 text-muted-foreground">No vet listings available for this location.</div>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
      {vets.map((vet) => (
        <Card key={vet.id} className="flex flex-col shadow-md hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle className="font-headline text-xl">{vet.name}</CardTitle>
            {vet.isTijuanaVet && <CardDescription className="text-sm text-accent">Tijuana, Mexico</CardDescription>}
          </CardHeader>
          <CardContent className="flex-grow space-y-2 text-sm">
             <Image 
                src={`https://placehold.co/600x300.png`}
                alt={vet.name}
                width={600}
                height={300}
                className="rounded-md object-cover aspect-video mb-3"
                data-ai-hint="veterinary clinic building"
              />
            {vet.address && <p className="flex items-center gap-2"><MapPin className="w-4 h-4 text-muted-foreground" /> {vet.address}</p>}
            {vet.phone && <p className="flex items-center gap-2"><Phone className="w-4 h-4 text-muted-foreground" /> <a href={`tel:${vet.phone}`} className="text-primary hover:underline">{vet.phone}</a></p>}
            {vet.rating && <p className="flex items-center gap-1"><Star className="w-4 h-4 text-yellow-500 fill-yellow-500" /> {vet.rating}/5 {vet.isTijuanaVet ? '(Community Avg.)' : ''}</p>}
            {vet.reviewSnippet && <p className="italic text-foreground/70">"{vet.reviewSnippet}"</p>}
            {vet.services && vet.services.length > 0 && (
              <div>
                <strong className="text-xs text-muted-foreground">Services:</strong>
                <p className="text-xs">{vet.services.join(', ')}</p>
              </div>
            )}
            {vet.notes && <p className="mt-2 p-2 bg-accent/10 border-l-4 border-accent text-xs text-accent-foreground">{vet.notes}</p>}
          </CardContent>
          <CardFooter>
            {vet.website && (
              <Button asChild variant="outline" size="sm" className="w-full">
                <a href={vet.website} target="_blank" rel="noopener noreferrer">
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

export default VetListings;
