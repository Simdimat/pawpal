import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import EmergencyFlows from '@/components/emergency/EmergencyFlows';

export default function EmergencyPage() {
  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-headline text-primary">Pet Emergency Guide</CardTitle>
          <CardDescription className="text-foreground/80">
            Quick access to step-by-step guidance for common pet emergencies.
            This information is not a substitute for professional veterinary advice.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EmergencyFlows />
        </CardContent>
      </Card>
    </div>
  );
}
