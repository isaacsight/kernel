import { registerTool } from './index.js'

export function registerWeatherTools(): void {
  registerTool({
    name: 'weather',
    description: 'Fetch the current weather information for a specified location using OpenWeatherMap API. Requires an API key.',
    parameters: {
      location: { type: 'string', description: 'City name or zip code', required: true },
    },
    tier: 'pro',
    async execute(args) {
      const apiKey = process.env.OPENWEATHERMAP_API_KEY
      if (!apiKey) throw new Error('OpenWeatherMap API key is not set.')

      const location = String(args.location)
      const encodedLocation = encodeURIComponent(location)
      const res = await fetch(`https://api.openweathermap.org/data/2.5/weather?q=${encodedLocation}&appid=${apiKey}&units=metric`, {
        headers: { 'User-Agent': 'KBot/2.0 (Weather)' },
        signal: AbortSignal.timeout(8000),
      })
      const data = await res.json()

      if (data.cod !== 200) throw new Error(`Error fetching weather data: ${data.message}`)

      return `Current weather in ${data.name}: ${data.weather[0].description}, Temperature: ${data.main.temp}°C, Humidity: ${data.main.humidity}%`
    },
  })
}