
import { NextResponse, type NextRequest } from 'next/server';
import { fetchWeatherByCoords } from '@/services/openweathermap';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const lat = searchParams.get('lat');
  const lon = searchParams.get('lon');

  if (!lat || !lon) {
    return NextResponse.json({ error: 'Latitude and longitude are required' }, { status: 400 });
  }

  try {
    const weatherData = await fetchWeatherByCoords(parseFloat(lat), parseFloat(lon));
    // Transform data slightly to match WeatherWidget's expectations
    const simplifiedData = {
      temperature: Math.round(weatherData.main.temp), // Round to nearest degree
      condition: weatherData.weather[0]?.main || 'Unknown', // e.g., 'Clear', 'Clouds', 'Rain'
      description: weatherData.weather[0]?.description || 'No description',
      locationName: weatherData.name,
      iconCode: weatherData.weather[0]?.icon // e.g., '01d'
    };
    return NextResponse.json(simplifiedData);
  } catch (error) {
    console.error('API Weather Route Error:', error);
    return NextResponse.json({ error: 'Failed to fetch weather data' }, { status: 500 });
  }
}
