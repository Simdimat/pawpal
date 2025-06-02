import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import ShelterListings from '@/components/shelters/ShelterListings';

export default function DogDayOutPage() {
  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-headline text-primary">Dog Day Out & Volunteer</CardTitle>
          <CardDescription className="text-foreground/80">
            Find local shelters offering "Dog Day Out" programs or volunteer dog walking opportunities.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ShelterListings />
        </CardContent>
      </Card>
    </div>
  );
}
