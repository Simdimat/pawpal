
'use client';

import { useState, useEffect } from 'react';
import { Sun, Cloud, Zap, Umbrella, Snowflake, CloudSun, CloudRain, CloudSnow, CloudLightning, ThermometerSun, Waves } from 'lucide-react';
import { Skeleton } from './ui/skeleton';

// Expanded weather conditions based on OpenWeatherMap main conditions
type WeatherCondition = 
  | 'Thunderstorm' 
  | 'Drizzle' 
  | 'Rain' 
  | 'Snow' 
  | 'Mist'
  | 'Smoke'
  | 'Haze'
  | 'Dust'
  | 'Fog'
  | 'Sand'
  | 'Ash'
  | 'Squall'
  | 'Tornado'
  | 'Clear' 
  | 'Clouds'
  | 'Unknown';

interface WeatherData {
  temperature: number;
  condition: WeatherCondition;
  locationName: string;
  description: string;
  iconCode?: string; // e.g. "01d" for clear sky day
}

const WeatherIcon = ({ condition, iconCode, className }: { condition: WeatherCondition; iconCode?: string, className?: string }) => {
  // Prioritize iconCode if available for more specific icons
  if (iconCode) {
    if (iconCode.startsWith('01')) return <Sun className={className} />; // clear sky
    if (iconCode.startsWith('02')) return <CloudSun className={className} />; // few clouds
    if (iconCode.startsWith('03')) return <Cloud className={className} />; // scattered clouds
    if (iconCode.startsWith('04')) return <Cloud className={className} />; // broken clouds, overcast
    if (iconCode.startsWith('09')) return <CloudRain className={className} />; // shower rain
    if (iconCode.startsWith('10')) return <Umbrella className={className} />; // rain
    if (iconCode.startsWith('11')) return <CloudLightning className={className} />; // thunderstorm
    if (iconCode.startsWith('13')) return <CloudSnow className={className} />; // snow
    if (iconCode.startsWith('50')) return <Waves className={className} />; // mist (using waves as a proxy for atmospheric obstruction)
  }

  // Fallback to general condition
  switch (condition) {
    case 'Clear': return <Sun className={className} />;
    case 'Clouds': return <Cloud className={className} />;
    case 'Rain': case 'Drizzle': return <Umbrella className={className} />;
    case 'Thunderstorm': return <Zap className={className} />;
    case 'Snow': return <Snowflake className={className} />;
    case 'Mist': case 'Fog': case 'Haze': case 'Smoke': case 'Dust': case 'Sand': case 'Ash': return <Waves className={className} />; // Using Waves as a general icon for atmospheric conditions
    case 'Squall': case 'Tornado': return <CloudLightning className={className} />; // Using Zap for severe weather
    default: return <ThermometerSun className={className} />; // Generic weather icon
  }
};

const WeatherWidget = () => {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Default San Diego coordinates
  const SAN_DIEGO_LAT = 32.7157;
  const SAN_DIEGO_LON = -117.1611;

  useEffect(() => {
    const fetchWeatherData = async () => {
      setLoading(true);
      setError(null);
      try {
        // Using default San Diego coordinates for now.
        // Could implement navigator.geolocation.getCurrentPosition for user's location in future.
        const response = await fetch(`/api/weather?lat=${SAN_DIEGO_LAT}&lon=${SAN_DIEGO_LON}`);
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `Weather API request failed with status ${response.status}`);
        }
        const data: WeatherData = await response.json();
        setWeather(data);
      } catch (e: any) {
        console.error("Failed to fetch weather:", e);
        setError(e.message || "Could not load weather.");
      } finally {
        setLoading(false);
      }
    };

    fetchWeatherData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center space-x-2">
        <Skeleton className="h-6 w-6 rounded-full" />
        <Skeleton className="h-4 w-16" />
      </div>
    );
  }

  if (error) {
    return <div className="text-xs text-destructive" title={error}><CloudLightning className="h-5 w-5 inline-block mr-1"/> Weather N/A</div>;
  }

  if (!weather) {
    return null;
  }

  return (
    <div className="flex items-center space-x-2 text-sm text-foreground/90" title={`${weather.description} in ${weather.locationName}`}>
      <WeatherIcon condition={weather.condition} iconCode={weather.iconCode} className="h-5 w-5 text-accent" />
      <span>{weather.temperature}°C</span>
      {/* <span className="hidden sm:inline">- {weather.locationName}</span> */}
    </div>
  );
};

export default WeatherWidget;
