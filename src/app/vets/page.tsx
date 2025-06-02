import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import VetListings from '@/components/vets/VetListings';

export default function VetsPage() {
  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-headline text-primary">Veterinarian Information Hub</CardTitle>
          <CardDescription className="text-foreground/80">
            Find veterinarians in San Diego and explore community insights about vet services in Tijuana.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="sd_vets" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="sd_vets">San Diego Vets</TabsTrigger>
              <TabsTrigger value="tj_vets">Tijuana Vets Info</TabsTrigger>
            </TabsList>
            <TabsContent value="sd_vets">
              <VetListings locationType="SD" />
            </TabsContent>
            <TabsContent value="tj_vets">
              <VetListings locationType="TJ" />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
