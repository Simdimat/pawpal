import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { MessageCircle, Map, AlertTriangle, Hospital, Dog, Sun } from 'lucide-react';
import Image from 'next/image';

const features = [
  {
    icon: MessageCircle,
    title: 'Ask PawPal AI',
    description: 'Get instant answers to your San Diego pet questions from our AI assistant.',
    link: '/chat',
    color: 'text-primary',
    dataAiHint: 'chat ai',
  },
  {
    icon: Map,
    title: 'Pet Map SD',
    description: 'Discover dog-friendly parks, beaches, vets, and more on our interactive map.',
    link: '/map',
    color: 'text-orange-500',
    dataAiHint: 'map navigation',
  },
  {
    icon: AlertTriangle,
    title: 'Emergency Guide',
    description: 'Quick access to information for common pet emergencies.',
    link: '/emergency',
    color: 'text-red-500',
    dataAiHint: 'emergency firstaid',
  },
  {
    icon: Hospital,
    title: 'Vet Info Hub',
    description: 'Find local veterinarians in San Diego and information about TJ vet options.',
    link: '/vets',
    color: 'text-green-500',
    dataAiHint: 'veterinary clinic',
  },
  {
    icon: Dog,
    title: 'Dog Day Out',
    description: 'Connect with shelters for volunteer opportunities and "dog for a day" programs.',
    link: '/dog-day-out',
    color: 'text-purple-500',
    dataAiHint: 'dog walking',
  },
];

export default function HomePage() {
  return (
    <div className="flex flex-col items-center">
      <section className="w-full py-12 md:py-20 lg:py-28 bg-gradient-to-br from-primary/10 via-background to-accent/10 rounded-xl shadow-lg">
        <div className="container px-4 md:px-6 text-center">
          <h1 className="text-4xl font-headline font-bold tracking-tight sm:text-5xl md:text-6xl text-foreground">
            Welcome to <span className="text-primary">PawPal SD</span>
          </h1>
          <p className="mt-4 max-w-2xl mx-auto text-lg text-foreground/80 md:text-xl">
            Your AI-powered companion for navigating pet life in San Diego. Find everything you need, from vets and parks to emergency advice.
          </p>
          <div className="mt-8 flex justify-center">
            <Button asChild size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-md hover:shadow-lg transition-shadow">
              <Link href="/chat">Ask PawPal Now</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="w-full py-12 md:py-20">
        <div className="container px-4 md:px-6">
          <h2 className="text-3xl font-headline font-bold tracking-tight text-center text-foreground mb-12">
            Explore PawPal SD Features
          </h2>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <Card key={feature.title} className="hover:shadow-xl transition-shadow duration-300 flex flex-col">
                <CardHeader className="flex flex-row items-center gap-4 pb-2">
                  <feature.icon className={`w-10 h-10 ${feature.color}`} />
                  <CardTitle className="font-headline text-xl text-foreground">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent className="flex-grow">
                  <CardDescription className="text-foreground/70 mb-4">{feature.description}</CardDescription>
                   <Image 
                    src={`https://placehold.co/600x400.png`}
                    alt={feature.title}
                    width={600}
                    height={400}
                    className="rounded-md object-cover aspect-video mb-4"
                    data-ai-hint={feature.dataAiHint}
                  />
                  <Button asChild variant="outline" className="w-full border-primary text-primary hover:bg-primary/10 hover:text-primary">
                    <Link href={feature.link}>Learn More</Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
