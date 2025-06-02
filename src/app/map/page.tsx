import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import PetMapDisplay from '@/components/map/PetMapDisplay';

export default function MapPage() {
  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-headline text-primary">Pet Map SD</CardTitle>
          <CardDescription className="text-foreground/80">
            Discover dog-friendly parks, beaches, vets, and restaurants in San Diego.
            Use the filters and search to find what you need!
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PetMapDisplay />
        </CardContent>
      </Card>
    </div>
  );
}
