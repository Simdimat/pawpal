
import axios from 'axios';

const OPENWEATHERMAP_API_URL = 'https://api.openweathermap.org/data/2.5/weather';
const API_KEY = process.env.OPENWEATHERMAP_API_KEY;

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

export async function fetchWeatherByCoords(lat: number, lon: number) {
  if (!API_KEY) {
    throw new Error('OpenWeatherMap API key is not configured.');
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
    throw new Error('Failed to fetch weather data.');
  }
}

