'use client';

import { useState, useEffect } from 'react';
import { Sun, Cloud, Zap, Umbrella, Snowflake } from 'lucide-react';
import { Skeleton } from './ui/skeleton';

// Simplified weather conditions for placeholder
type WeatherCondition = 'Sunny' | 'Cloudy' | 'Rainy' | 'Stormy' | 'Snowy';

interface WeatherData {
  temperature: number;
  condition: WeatherCondition;
  location: string;
}

const WeatherIcon = ({ condition, className }: { condition: WeatherCondition; className?: string }) => {
  switch (condition) {
    case 'Sunny':
      return <Sun className={className} />;
    case 'Cloudy':
      return <Cloud className={className} />;
    case 'Rainy':
      return <Umbrella className={className} />;
    case 'Stormy':
      return <Zap className={className} />;
    case 'Snowy':
      return <Snowflake className={className} />;
    default:
      return <Sun className={className} />;
  }
};

const WeatherWidget = () => {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate API call
    const fetchWeather = async () => {
      setLoading(true);
      // In a real app, fetch from '/api/weather'
      await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate delay
      
      // Mock data, OpenWeatherMap API would provide real data
      const conditions: WeatherCondition[] = ['Sunny', 'Cloudy', 'Rainy'];
      const randomCondition = conditions[Math.floor(Math.random() * conditions.length)];
      const randomTemp = Math.floor(Math.random() * 15) + 15; // Temp between 15-30°C

      setWeather({
        temperature: randomTemp,
        condition: randomCondition,
        location: 'San Diego',
      });
      setLoading(false);
    };

    fetchWeather();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center space-x-2">
        <Skeleton className="h-6 w-6 rounded-full" />
        <Skeleton className="h-4 w-16" />
      </div>
    );
  }

  if (!weather) {
    return null;
  }

  return (
    <div className="flex items-center space-x-2 text-sm text-foreground/90">
      <WeatherIcon condition={weather.condition} className="h-5 w-5 text-accent" />
      <span>{weather.temperature}°C</span>
      {/* <span className="hidden sm:inline">- {weather.location}</span> */}
    </div>
  );
};

export default WeatherWidget;
