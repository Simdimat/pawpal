
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

// Mock data to be returned when the API key is not configured
const mockWeatherData = {
  main: {
    temp: 72,
  },
  weather: [
    {
      main: 'Clear',
      description: 'clear sky',
      icon: '01d',
    },
  ],
  name: 'San Diego',
};


export async function fetchWeatherByCoords(lat: number, lon: number) {
  const API_KEY = process.env.OPENWEATHERMAP_API_KEY;

  if (!API_KEY || API_KEY.startsWith('YOUR_')) {
    console.warn('OpenWeatherMap API key not configured. Returning mock weather data.');
    return mockWeatherData;
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
    console.warn('Falling back to mock weather data due to API error.');
    return { ...mockWeatherData, name: `API Error` };
  }
}
