
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { MessageCircle, Map, AlertTriangle, Hospital, Dog } from 'lucide-react';
import Image from 'next/image';

import ChatInterface from '@/components/chat/ChatInterface';
import PetMapDisplay from '@/components/map/PetMapDisplay';
import EmergencyFlows from '@/components/emergency/EmergencyFlows';
import VetListings from '@/components/vets/VetListings';
import ShelterListings from '@/components/shelters/ShelterListings';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// features array is no longer used for rendering this section but might be used elsewhere or for reference.
const features = [
  {
    icon: Map,
    title: 'Pet Map SD',
    description: 'Discover dog-friendly parks, beaches, vets, and more on our interactive map.',
    link: '/#map-section',
    color: 'text-orange-500',
    dataAiHint: 'map navigation',
  },
  {
    icon: AlertTriangle,
    title: 'Emergency Guide',
    description: 'Quick access to information for common pet emergencies.',
    link: '/#emergency-section',
    color: 'text-red-500',
    dataAiHint: 'emergency firstaid',
  },
  {
    icon: Hospital,
    title: 'Vet Info Hub',
    description: 'Find local veterinarians and info about TJ vet options.',
    link: '/#vets-section',
    color: 'text-green-500',
    dataAiHint: 'veterinary clinic',
  },
  {
    icon: Dog,
    title: 'Dog Day Out & Volunteer',
    description: 'Connect with shelters for volunteer opportunities and "dog for a day" programs.',
    link: '/#dog-day-out-section',
    color: 'text-purple-500',
    dataAiHint: 'dog walking',
  },
];

export default function HomePage() {
  return (
    <div className="flex flex-col lg:flex-row gap-8">
      {/* Main Content Area */}
      <main className="flex-grow lg:w-2/3 space-y-12">
        <section className="w-full py-12 md:py-20 lg:py-24 bg-gradient-to-br from-primary/10 via-background to-accent/10 rounded-xl shadow-lg">
          <div className="container px-4 md:px-6 text-center">
            <h1 className="text-4xl font-headline font-bold tracking-tight sm:text-5xl md:text-6xl text-foreground">
              Welcome to <span className="text-primary">PawPal SD</span>
            </h1>
            <p className="mt-4 max-w-2xl mx-auto text-lg text-foreground/80 md:text-xl">
              Your AI-powered companion for navigating pet life in San Diego. Find everything you need, from vets and parks to emergency advice, all in one place.
            </p>
            {/* Removed "Ask PawPal Now" button as chat is in sidebar */}
          </div>
        </section>

        <section className="w-full">
          <div className="container px-4 md:px-6">
            <h2 className="text-3xl font-headline font-bold tracking-tight text-center text-foreground mb-12">
              Explore PawPal SD Features
            </h2>
            {/* The grid of feature cards has been removed from here */}
          </div>
        </section>

        {/* Consolidated Sections */}
        <section id="map-section" className="scroll-m-20 py-8">
          <Card className="shadow-lg">
            <CardHeader className="text-center">
              <CardTitle className="text-3xl font-headline text-primary">Pet Map SD</CardTitle>
              <CardDescription className="text-foreground/80">
                Discover dog-friendly parks, beaches, vets, and restaurants in San Diego.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PetMapDisplay />
            </CardContent>
          </Card>
        </section>

        <section id="emergency-section" className="scroll-m-20 py-8">
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
        </section>

        <section id="vets-section" className="scroll-m-20 py-8">
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
        </section>

        <section id="dog-day-out-section" className="scroll-m-20 py-8">
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
        </section>
      </main>

      {/* Chat Sidebar */}
      <aside className="w-full lg:w-[450px] xl:w-1/3 lg:sticky lg:top-20 self-start h-auto lg:h-[calc(100vh-6rem)] mt-12 lg:mt-0">
        <Card className="w-full shadow-xl h-full flex flex-col overflow-hidden">
          <CardHeader className="text-center border-b">
            <div className="flex items-center justify-center gap-2">
              <MessageCircle className="w-8 h-8 text-primary" />
              <CardTitle className="text-2xl font-headline text-primary">Ask PawPal AI</CardTitle>
            </div>
            <CardDescription className="text-foreground/80 text-sm mt-1">
              Your friendly AI assistant for San Diego pet questions.
            </CardDescription>
          </CardHeader>
          <ChatInterface />
        </Card>
      </aside>
    </div>
  );
}
