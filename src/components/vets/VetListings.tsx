
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, AlertCircle, ExternalLink, Star, MapPin, Phone } from 'lucide-react';
import Image from 'next/image';
import type { YelpBusiness } from '@/services/yelp'; // Assuming YelpBusiness is exported

// Updated Vet interface to align with YelpBusiness and add custom fields
interface Vet extends Partial<YelpBusiness> {
  // YelpBusiness already has id, name, location (which has address parts), phone, url (for website), rating
  // We might add specific fields or transform some
  customAddress?: string; // Combined display address
  reviewSnippet?: string; // Could be from Yelp or manually added for TJ
  services?: string[]; // Custom field if not directly from Yelp categories
  notes?: string; // For TJ vets: warnings, tips
  isTijuanaVet?: boolean;
}


interface VetListingsProps {
  locationType: 'SD' | 'TJ';
}

const VetListings = ({ locationType }: VetListingsProps) => {
  const [vets, setVets] = useState<Vet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchVets = async () => {
      setLoading(true);
      setError(null);
      const searchTerm = "veterinarians";
      const locationQuery = locationType === 'SD' ? 'San Diego, CA' : 'Tijuana, BC, Mexico';
      const categories = "veterinarians,petservices";

      try {
        const response = await fetch(`/api/yelp-search?term=${encodeURIComponent(searchTerm)}&location=${encodeURIComponent(locationQuery)}&categories=${encodeURIComponent(categories)}&limit=10`);
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `Failed to fetch vets. Status: ${response.status}`);
        }
        const data: YelpBusiness[] = await response.json();
        
        const transformedVets: Vet[] = data.map(biz => ({
          ...biz,
          customAddress: biz.location?.display_address.join(', '),
          isTijuanaVet: locationType === 'TJ',
          // reviewSnippet: biz.review_count > 0 ? `Based on ${biz.review_count} reviews.` : "No reviews snippet available.", // Yelp API doesn't provide snippets directly in business search
          notes: locationType === 'TJ' ? 'Verify services and cross-border pet travel requirements.' : undefined,
        }));
        setVets(transformedVets);

      } catch (e: any) {
        console.error(`Error fetching vets for ${locationType}:`, e);
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
    return <div className="text-center py-10 text-muted-foreground">No vet listings found for this location.</div>;
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
                src={vet.image_url || `https://placehold.co/600x300.png?text=${encodeURIComponent(vet.name || 'Vet')}`}
                alt={vet.name || 'Veterinary Clinic'}
                width={600}
                height={300}
                className="rounded-md object-cover aspect-video mb-3"
                data-ai-hint="veterinary clinic building"
              />
            {vet.customAddress && <p className="flex items-center gap-2"><MapPin className="w-4 h-4 text-muted-foreground" /> {vet.customAddress}</p>}
            {vet.display_phone && <p className="flex items-center gap-2"><Phone className="w-4 h-4 text-muted-foreground" /> <a href={`tel:${vet.phone}`} className="text-primary hover:underline">{vet.display_phone}</a></p>}
            {typeof vet.rating === 'number' && <p className="flex items-center gap-1"><Star className="w-4 h-4 text-yellow-500 fill-yellow-500" /> {vet.rating}/5 ({vet.review_count} reviews)</p>}
            {vet.reviewSnippet && <p className="italic text-foreground/70">"{vet.reviewSnippet}"</p>}
            {vet.categories && vet.categories.length > 0 && (
              <div>
                <strong className="text-xs text-muted-foreground">Categories:</strong>
                <p className="text-xs">{vet.categories.map(c => c.title).join(', ')}</p>
              </div>
            )}
            {vet.notes && <p className="mt-2 p-2 bg-accent/10 border-l-4 border-accent text-xs text-accent-foreground">{vet.notes}</p>}
          </CardContent>
          <CardFooter>
            {vet.url && (
              <Button asChild variant="outline" size="sm" className="w-full">
                <a href={vet.url} target="_blank" rel="noopener noreferrer">
                  View on Yelp <ExternalLink className="ml-2 h-3 w-3" />
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
