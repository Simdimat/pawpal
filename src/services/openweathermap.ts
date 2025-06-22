
import axios from 'axios';

const OPENWEATHERMAP_API_URL = 'https://api.openweathermap.org/data/2.5/weather';

interface WeatherResponse {
  main: {
    temp: number;
  };
  weather: {
    main: string;
    description: string;
    icon: string;
  }[];
  name: string;
}

export async function fetchWeatherByCoords(lat: number, lon: number): Promise<WeatherResponse> {
  const API_KEY = process.env.OPENWEATHERMAP_API_KEY;

  if (!API_KEY || API_KEY.startsWith('YOUR_')) {
    const errorMsg = 'OpenWeatherMap API key not configured or is a placeholder.';
    console.error(errorMsg);
    throw new Error(errorMsg);
  }

  try {
    const response = await axios.get<WeatherResponse>(OPENWEATHERMAP_API_URL, {
      params: {
        lat,
        lon,
        appid: API_KEY,
        units: 'imperial', // Changed from metric to imperial for Fahrenheit
      },
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching weather data from OpenWeatherMap:', error);
    // Fallback to mock data on API error to prevent crashing the component
    throw new Error('Failed to fetch weather data from OpenWeatherMap.');
  }
}
