// kbot Lab Earth & Environmental Sciences Tools
// Provides earthquake data, climate analysis, satellite imagery search,
// geological queries, ocean data, air quality, soil properties, volcano
// monitoring, water resources, and biodiversity indices.
// All API calls use public, freely accessible endpoints — no API keys required.

import { registerTool } from './index.js'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const UA = 'KBot/3.0 (Lab Tools)'

async function labFetch(url: string): Promise<Response> {
  return fetch(url, {
    headers: { 'User-Agent': UA },
    signal: AbortSignal.timeout(10000),
  })
}

function fmt(n: number, d = 4): string {
  if (!isFinite(n)) return String(n)
  return n.toFixed(d)
}

function isoDate(epoch: number): string {
  return new Date(epoch).toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' UTC')
}

function today(): string {
  return new Date().toISOString().split('T')[0]
}

function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().split('T')[0]
}

// ─── Major Active Volcanoes (fallback data) ──────────────────────────────────

interface VolcanoEntry {
  name: string
  country: string
  region: string
  lat: number
  lon: number
  elevation_m: number
  type: string
  last_eruption: string
  status: string
}

const MAJOR_VOLCANOES: VolcanoEntry[] = [
  { name: 'Kilauea', country: 'United States', region: 'Hawaii', lat: 19.421, lon: -155.287, elevation_m: 1222, type: 'Shield', last_eruption: '2023', status: 'Active' },
  { name: 'Mauna Loa', country: 'United States', region: 'Hawaii', lat: 19.475, lon: -155.608, elevation_m: 4169, type: 'Shield', last_eruption: '2022', status: 'Active' },
  { name: 'Mount Etna', country: 'Italy', region: 'Sicily', lat: 37.748, lon: 15.002, elevation_m: 3357, type: 'Stratovolcano', last_eruption: '2024', status: 'Active' },
  { name: 'Stromboli', country: 'Italy', region: 'Aeolian Islands', lat: 38.789, lon: 15.213, elevation_m: 924, type: 'Stratovolcano', last_eruption: '2024', status: 'Active' },
  { name: 'Mount Vesuvius', country: 'Italy', region: 'Campania', lat: 40.821, lon: 14.426, elevation_m: 1281, type: 'Stratovolcano', last_eruption: '1944', status: 'Dormant' },
  { name: 'Piton de la Fournaise', country: 'France', region: 'Reunion', lat: -21.244, lon: 55.714, elevation_m: 2632, type: 'Shield', last_eruption: '2024', status: 'Active' },
  { name: 'Eyjafjallajokull', country: 'Iceland', region: 'South Iceland', lat: 63.633, lon: -19.633, elevation_m: 1651, type: 'Stratovolcano', last_eruption: '2010', status: 'Active' },
  { name: 'Fagradalsfjall', country: 'Iceland', region: 'Reykjanes', lat: 63.903, lon: -22.267, elevation_m: 385, type: 'Tuya', last_eruption: '2024', status: 'Active' },
  { name: 'Hekla', country: 'Iceland', region: 'South Iceland', lat: 63.983, lon: -19.700, elevation_m: 1491, type: 'Stratovolcano', last_eruption: '2000', status: 'Active' },
  { name: 'Mount Fuji', country: 'Japan', region: 'Honshu', lat: 35.361, lon: 138.727, elevation_m: 3776, type: 'Stratovolcano', last_eruption: '1707', status: 'Active' },
  { name: 'Sakurajima', country: 'Japan', region: 'Kyushu', lat: 31.593, lon: 130.657, elevation_m: 1117, type: 'Stratovolcano', last_eruption: '2024', status: 'Active' },
  { name: 'Mount Aso', country: 'Japan', region: 'Kyushu', lat: 32.884, lon: 131.104, elevation_m: 1592, type: 'Caldera', last_eruption: '2021', status: 'Active' },
  { name: 'Suwanosejima', country: 'Japan', region: 'Ryukyu Islands', lat: 29.638, lon: 129.714, elevation_m: 796, type: 'Stratovolcano', last_eruption: '2024', status: 'Active' },
  { name: 'Mount Merapi', country: 'Indonesia', region: 'Java', lat: -7.540, lon: 110.446, elevation_m: 2930, type: 'Stratovolcano', last_eruption: '2023', status: 'Active' },
  { name: 'Mount Semeru', country: 'Indonesia', region: 'Java', lat: -8.108, lon: 112.922, elevation_m: 3676, type: 'Stratovolcano', last_eruption: '2024', status: 'Active' },
  { name: 'Mount Sinabung', country: 'Indonesia', region: 'Sumatra', lat: 3.170, lon: 98.392, elevation_m: 2460, type: 'Stratovolcano', last_eruption: '2021', status: 'Active' },
  { name: 'Krakatoa (Anak Krakatau)', country: 'Indonesia', region: 'Sunda Strait', lat: -6.102, lon: 105.423, elevation_m: 155, type: 'Caldera', last_eruption: '2023', status: 'Active' },
  { name: 'Dukono', country: 'Indonesia', region: 'Halmahera', lat: 1.693, lon: 127.894, elevation_m: 1229, type: 'Complex', last_eruption: '2024', status: 'Active' },
  { name: 'Mount Ruapehu', country: 'New Zealand', region: 'North Island', lat: -39.281, lon: 175.564, elevation_m: 2797, type: 'Stratovolcano', last_eruption: '2007', status: 'Active' },
  { name: 'White Island (Whakaari)', country: 'New Zealand', region: 'Bay of Plenty', lat: -37.520, lon: 177.183, elevation_m: 321, type: 'Stratovolcano', last_eruption: '2019', status: 'Active' },
  { name: 'Taal', country: 'Philippines', region: 'Luzon', lat: 14.002, lon: 120.993, elevation_m: 311, type: 'Caldera', last_eruption: '2022', status: 'Active' },
  { name: 'Mayon', country: 'Philippines', region: 'Luzon', lat: 13.257, lon: 123.685, elevation_m: 2462, type: 'Stratovolcano', last_eruption: '2024', status: 'Active' },
  { name: 'Mount Pinatubo', country: 'Philippines', region: 'Luzon', lat: 15.130, lon: 120.350, elevation_m: 1486, type: 'Stratovolcano', last_eruption: '1991', status: 'Active' },
  { name: 'Popocatepetl', country: 'Mexico', region: 'Trans-Mexican', lat: 19.023, lon: -98.622, elevation_m: 5426, type: 'Stratovolcano', last_eruption: '2024', status: 'Active' },
  { name: 'Colima', country: 'Mexico', region: 'Jalisco', lat: 19.514, lon: -103.617, elevation_m: 3850, type: 'Stratovolcano', last_eruption: '2019', status: 'Active' },
  { name: 'Fuego', country: 'Guatemala', region: 'Central Highlands', lat: 14.473, lon: -90.880, elevation_m: 3763, type: 'Stratovolcano', last_eruption: '2024', status: 'Active' },
  { name: 'Pacaya', country: 'Guatemala', region: 'Central Highlands', lat: 14.381, lon: -90.601, elevation_m: 2552, type: 'Complex', last_eruption: '2024', status: 'Active' },
  { name: 'Arenal', country: 'Costa Rica', region: 'Guanacaste', lat: 10.463, lon: -84.703, elevation_m: 1670, type: 'Stratovolcano', last_eruption: '2010', status: 'Dormant' },
  { name: 'Cotopaxi', country: 'Ecuador', region: 'Andes', lat: -0.677, lon: -78.436, elevation_m: 5897, type: 'Stratovolcano', last_eruption: '2023', status: 'Active' },
  { name: 'Sangay', country: 'Ecuador', region: 'Andes', lat: -2.002, lon: -78.341, elevation_m: 5230, type: 'Stratovolcano', last_eruption: '2024', status: 'Active' },
  { name: 'Villarrica', country: 'Chile', region: 'Araucania', lat: -39.420, lon: -71.939, elevation_m: 2847, type: 'Stratovolcano', last_eruption: '2024', status: 'Active' },
  { name: 'Calbuco', country: 'Chile', region: 'Los Lagos', lat: -41.326, lon: -72.614, elevation_m: 2003, type: 'Stratovolcano', last_eruption: '2015', status: 'Active' },
  { name: 'Mount Erebus', country: 'Antarctica', region: 'Ross Island', lat: -77.530, lon: 167.170, elevation_m: 3794, type: 'Stratovolcano', last_eruption: '2024', status: 'Active' },
  { name: 'Mount St. Helens', country: 'United States', region: 'Cascades', lat: 46.200, lon: -122.180, elevation_m: 2549, type: 'Stratovolcano', last_eruption: '2008', status: 'Active' },
  { name: 'Mount Rainier', country: 'United States', region: 'Cascades', lat: 46.853, lon: -121.760, elevation_m: 4392, type: 'Stratovolcano', last_eruption: '1894', status: 'Active' },
  { name: 'Mount Shasta', country: 'United States', region: 'Cascades', lat: 41.409, lon: -122.194, elevation_m: 4322, type: 'Stratovolcano', last_eruption: '~1250', status: 'Dormant' },
  { name: 'Mount Hood', country: 'United States', region: 'Cascades', lat: 45.374, lon: -121.696, elevation_m: 3429, type: 'Stratovolcano', last_eruption: '~1866', status: 'Dormant' },
  { name: 'Erta Ale', country: 'Ethiopia', region: 'Afar', lat: 13.600, lon: 40.670, elevation_m: 613, type: 'Shield', last_eruption: '2024', status: 'Active' },
  { name: 'Nyiragongo', country: 'DR Congo', region: 'Virunga', lat: -1.520, lon: 29.250, elevation_m: 3470, type: 'Stratovolcano', last_eruption: '2021', status: 'Active' },
  { name: 'Ol Doinyo Lengai', country: 'Tanzania', region: 'East African Rift', lat: -2.764, lon: 35.914, elevation_m: 2962, type: 'Stratovolcano', last_eruption: '2024', status: 'Active' },
  { name: 'Mount Cameroon', country: 'Cameroon', region: 'West Africa', lat: 4.203, lon: 9.170, elevation_m: 4095, type: 'Stratovolcano', last_eruption: '2012', status: 'Active' },
  { name: 'Klyuchevskoy', country: 'Russia', region: 'Kamchatka', lat: 56.056, lon: 160.638, elevation_m: 4835, type: 'Stratovolcano', last_eruption: '2024', status: 'Active' },
  { name: 'Shiveluch', country: 'Russia', region: 'Kamchatka', lat: 56.653, lon: 161.360, elevation_m: 3283, type: 'Stratovolcano', last_eruption: '2024', status: 'Active' },
  { name: 'Bezymianny', country: 'Russia', region: 'Kamchatka', lat: 55.978, lon: 160.587, elevation_m: 2882, type: 'Stratovolcano', last_eruption: '2024', status: 'Active' },
  { name: 'Karymsky', country: 'Russia', region: 'Kamchatka', lat: 54.049, lon: 159.443, elevation_m: 1536, type: 'Stratovolcano', last_eruption: '2024', status: 'Active' },
  { name: 'Ebeko', country: 'Russia', region: 'Kuril Islands', lat: 50.686, lon: 156.014, elevation_m: 1156, type: 'Stratovolcano', last_eruption: '2023', status: 'Active' },
  { name: 'Mount Nyamuragira', country: 'DR Congo', region: 'Virunga', lat: -1.408, lon: 29.200, elevation_m: 3058, type: 'Shield', last_eruption: '2024', status: 'Active' },
  { name: 'Piton des Neiges', country: 'France', region: 'Reunion', lat: -21.100, lon: 55.483, elevation_m: 3069, type: 'Shield', last_eruption: 'Pleistocene', status: 'Extinct' },
  { name: 'Tambora', country: 'Indonesia', region: 'Sumbawa', lat: -8.250, lon: 118.000, elevation_m: 2850, type: 'Stratovolcano', last_eruption: '1967', status: 'Active' },
  { name: 'Nevado del Ruiz', country: 'Colombia', region: 'Andes', lat: 4.892, lon: -75.322, elevation_m: 5321, type: 'Stratovolcano', last_eruption: '2024', status: 'Active' },
]

// ─── Registration ────────────────────────────────────────────────────────────

export function registerLabEarthTools(): void {

  // ── 1. Earthquake Query ─────────────────────────────────────────────────

  registerTool({
    name: 'earthquake_query',
    description: 'Query USGS earthquake data: recent events, historical quakes, filter by magnitude, location, and time range. Returns magnitude, location, depth, time, tsunami alert, and USGS detail URL.',
    parameters: {
      min_magnitude: { type: 'number', description: 'Minimum magnitude (default: 4)' },
      start_date: { type: 'string', description: 'Start date YYYY-MM-DD (default: 30 days ago)' },
      end_date: { type: 'string', description: 'End date YYYY-MM-DD (default: today)' },
      latitude: { type: 'number', description: 'Latitude for geographic filter' },
      longitude: { type: 'number', description: 'Longitude for geographic filter' },
      max_radius_km: { type: 'number', description: 'Max radius in km from lat/lon (default: 500)' },
      limit: { type: 'number', description: 'Max results (default: 10, max: 50)' },
    },
    tier: 'free',
    async execute(args) {
      const minMag = typeof args.min_magnitude === 'number' ? args.min_magnitude : 4
      const startDate = typeof args.start_date === 'string' ? args.start_date : daysAgo(30)
      const endDate = typeof args.end_date === 'string' ? args.end_date : today()
      const limit = typeof args.limit === 'number' ? Math.min(args.limit, 50) : 10

      let url = `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&minmagnitude=${minMag}&starttime=${startDate}&endtime=${endDate}&limit=${limit}&orderby=time`

      if (typeof args.latitude === 'number' && typeof args.longitude === 'number') {
        const lat = args.latitude as number
        const lon = args.longitude as number
        const radius = typeof args.max_radius_km === 'number' ? args.max_radius_km : 500
        url += `&latitude=${lat}&longitude=${lon}&maxradiuskm=${radius}`
      }

      try {
        const res = await labFetch(url)
        if (!res.ok) return `**Error**: USGS API returned ${res.status} ${res.statusText}`
        const data = await res.json() as {
          metadata: { generated: number; count: number; title: string }
          features: Array<{
            properties: {
              mag: number | null
              place: string | null
              time: number
              url: string | null
              type: string | null
              tsunami: number
              felt: number | null
              alert: string | null
              sig: number | null
              status: string | null
            }
            geometry: { coordinates: [number, number, number] }
          }>
        }

        if (!data.features || data.features.length === 0) {
          return `**No earthquakes found** matching M >= ${minMag} from ${startDate} to ${endDate}.`
        }

        const lines: string[] = [
          `# Earthquake Query Results`,
          `**Source**: USGS Earthquake Hazards Program`,
          `**Filter**: M >= ${minMag} | ${startDate} to ${endDate} | ${data.metadata.count} event(s)\n`,
          `| Mag | Location | Depth (km) | Time (UTC) | Tsunami | Link |`,
          `|-----|----------|------------|------------|---------|------|`,
        ]

        for (const f of data.features) {
          const p = f.properties
          const [lon, lat, depth] = f.geometry.coordinates
          const mag = p.mag !== null ? p.mag.toFixed(1) : '?'
          const place = p.place || 'Unknown location'
          const time = isoDate(p.time)
          const tsunami = p.tsunami ? 'Yes' : 'No'
          const link = p.url ? `[Details](${p.url})` : '-'
          lines.push(`| ${mag} | ${place} | ${depth.toFixed(1)} | ${time} | ${tsunami} | ${link} |`)
        }

        lines.push('')

        // Summary statistics
        const mags = data.features.map(f => f.properties.mag).filter((m): m is number => m !== null)
        if (mags.length > 0) {
          const maxMag = Math.max(...mags)
          const avgMag = mags.reduce((s, m) => s + m, 0) / mags.length
          const depths = data.features.map(f => f.geometry.coordinates[2])
          const avgDepth = depths.reduce((s, d) => s + d, 0) / depths.length
          const tsunamiCount = data.features.filter(f => f.properties.tsunami).length

          lines.push(
            `### Summary`,
            `- **Events shown**: ${data.features.length} of ${data.metadata.count} total`,
            `- **Max magnitude**: ${maxMag.toFixed(1)}`,
            `- **Avg magnitude**: ${avgMag.toFixed(1)}`,
            `- **Avg depth**: ${avgDepth.toFixed(1)} km`,
            tsunamiCount > 0 ? `- **Tsunami alerts**: ${tsunamiCount}` : '',
          )
        }

        return lines.filter(l => l !== '').join('\n')
      } catch (err) {
        return `**Error**: Failed to query USGS earthquake API — ${err instanceof Error ? err.message : String(err)}`
      }
    },
  })

  // ── 2. Climate Data ─────────────────────────────────────────────────────

  registerTool({
    name: 'climate_data',
    description: 'Retrieve historical climate data: global temperature anomalies (NASA GISS), atmospheric CO2 concentrations (NOAA Mauna Loa), or sea level data. Filter by year range.',
    parameters: {
      variable: { type: 'string', description: 'Climate variable: temperature, co2, or sea_level', required: true },
      year_from: { type: 'number', description: 'Start year (optional)' },
      year_to: { type: 'number', description: 'End year (optional)' },
    },
    tier: 'free',
    async execute(args) {
      const variable = String(args.variable).toLowerCase().trim()
      const yearFrom = typeof args.year_from === 'number' ? args.year_from : undefined
      const yearTo = typeof args.year_to === 'number' ? args.year_to : undefined

      if (variable === 'temperature') {
        try {
          const url = 'https://data.giss.nasa.gov/gistemp/tabledata_v4/GLB.Ts+dSST.csv'
          const res = await labFetch(url)
          if (!res.ok) return `**Error**: NASA GISS returned ${res.status}`
          const text = await res.text()

          // Parse the CSV: first valid line has "Year" header, data lines have year as first field
          const rawLines = text.split('\n')
          // Find the header line
          let headerIdx = -1
          for (let i = 0; i < rawLines.length; i++) {
            if (rawLines[i].startsWith('Year')) { headerIdx = i; break }
          }
          if (headerIdx === -1) return '**Error**: Could not parse NASA GISS temperature data — header not found.'

          const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
          const lines: string[] = [
            '# Global Temperature Anomalies',
            '**Source**: NASA GISS Surface Temperature Analysis (GISTEMP v4)',
            '**Baseline**: 1951-1980 average\n',
            '| Year | Jan | Feb | Mar | Apr | May | Jun | Jul | Aug | Sep | Oct | Nov | Dec | Annual |',
            '|------|-----|-----|-----|-----|-----|-----|-----|-----|-----|-----|-----|-----|--------|',
          ]

          const years: number[] = []
          const annualValues: number[] = []

          for (let i = headerIdx + 1; i < rawLines.length; i++) {
            const row = rawLines[i].split(',')
            if (row.length < 2) continue
            const year = parseInt(row[0], 10)
            if (isNaN(year)) continue
            if (yearFrom !== undefined && year < yearFrom) continue
            if (yearTo !== undefined && year > yearTo) continue

            // Columns: Year, Jan, Feb, ..., Dec, J-D, D-N, DJF, MAM, JJA, SON
            const monthVals = row.slice(1, 13).map(v => {
              const n = parseFloat(v)
              return isNaN(n) ? '***' : n.toFixed(2)
            })
            // J-D (annual mean) is typically column 14 (index 13)
            const annual = row[13] ? parseFloat(row[13]) : NaN
            const annualStr = isNaN(annual) ? '***' : annual.toFixed(2)

            if (!isNaN(annual)) {
              years.push(year)
              annualValues.push(annual)
            }

            lines.push(`| ${year} | ${monthVals.join(' | ')} | ${annualStr} |`)
          }

          if (annualValues.length > 0) {
            const maxAnomaly = Math.max(...annualValues)
            const minAnomaly = Math.min(...annualValues)
            const maxYear = years[annualValues.indexOf(maxAnomaly)]
            const minYear = years[annualValues.indexOf(minAnomaly)]
            const latest = annualValues[annualValues.length - 1]
            const latestYear = years[years.length - 1]

            lines.push(
              '',
              '### Summary',
              `- **Range**: ${years[0]} to ${years[years.length - 1]} (${years.length} years)`,
              `- **Warmest year**: ${maxYear} (+${maxAnomaly.toFixed(2)} C)`,
              `- **Coolest year**: ${minYear} (${minAnomaly.toFixed(2)} C)`,
              `- **Latest**: ${latestYear} (${latest >= 0 ? '+' : ''}${latest.toFixed(2)} C)`,
            )

            // Trend via linear regression
            if (years.length >= 3) {
              const n = years.length
              const sumX = years.reduce((s, y) => s + y, 0)
              const sumY = annualValues.reduce((s, v) => s + v, 0)
              const sumXY = years.reduce((s, y, i) => s + y * annualValues[i], 0)
              const sumX2 = years.reduce((s, y) => s + y * y, 0)
              const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)
              lines.push(`- **Trend**: ${slope >= 0 ? '+' : ''}${(slope * 10).toFixed(3)} C/decade`)
            }
          }

          return lines.join('\n')
        } catch (err) {
          return `**Error**: Failed to fetch NASA GISS temperature data — ${err instanceof Error ? err.message : String(err)}`
        }
      }

      if (variable === 'co2') {
        try {
          const url = 'https://gml.noaa.gov/webdata/ccgg/trends/co2/co2_mm_mlo.txt'
          const res = await labFetch(url)
          if (!res.ok) return `**Error**: NOAA GML returned ${res.status}`
          const text = await res.text()

          // Parse: skip comment lines (#), space-separated: year month decimal_date average interpolated trend days
          const dataLines = text.split('\n').filter(l => l.trim() && !l.startsWith('#'))

          const lines: string[] = [
            '# Atmospheric CO2 Concentrations',
            '**Source**: NOAA Global Monitoring Laboratory, Mauna Loa Observatory',
            '**Units**: parts per million (ppm)\n',
          ]

          interface CO2Row { year: number; month: number; avg: number; trend: number }
          const rows: CO2Row[] = []

          for (const line of dataLines) {
            const parts = line.trim().split(/\s+/)
            if (parts.length < 5) continue
            const year = parseInt(parts[0], 10)
            const month = parseInt(parts[1], 10)
            const avg = parseFloat(parts[3])
            const trend = parseFloat(parts[5])
            if (isNaN(year) || isNaN(month) || isNaN(avg)) continue
            if (yearFrom !== undefined && year < yearFrom) continue
            if (yearTo !== undefined && year > yearTo) continue
            rows.push({ year, month, avg, trend: isNaN(trend) ? avg : trend })
          }

          if (rows.length === 0) return '**No CO2 data found** for the specified year range.'

          // If many rows, show annual averages; otherwise monthly
          const yearGroups = new Map<number, number[]>()
          for (const r of rows) {
            if (!yearGroups.has(r.year)) yearGroups.set(r.year, [])
            yearGroups.get(r.year)!.push(r.avg)
          }

          if (yearGroups.size > 20) {
            // Annual summary
            lines.push(
              '| Year | Mean CO2 (ppm) | Min (ppm) | Max (ppm) |',
              '|------|---------------|-----------|-----------|',
            )
            for (const [year, vals] of yearGroups) {
              const mean = vals.reduce((s, v) => s + v, 0) / vals.length
              lines.push(`| ${year} | ${mean.toFixed(2)} | ${Math.min(...vals).toFixed(2)} | ${Math.max(...vals).toFixed(2)} |`)
            }
          } else {
            // Monthly detail
            lines.push(
              '| Year | Month | CO2 (ppm) | Trend (ppm) |',
              '|------|-------|-----------|-------------|',
            )
            for (const r of rows) {
              lines.push(`| ${r.year} | ${String(r.month).padStart(2, '0')} | ${r.avg.toFixed(2)} | ${r.trend.toFixed(2)} |`)
            }
          }

          // Summary
          const allAvg = rows.map(r => r.avg)
          const latest = rows[rows.length - 1]
          const earliest = rows[0]
          lines.push(
            '',
            '### Summary',
            `- **Range**: ${earliest.year}/${String(earliest.month).padStart(2, '0')} to ${latest.year}/${String(latest.month).padStart(2, '0')}`,
            `- **Latest reading**: ${latest.avg.toFixed(2)} ppm (${latest.year}/${String(latest.month).padStart(2, '0')})`,
            `- **Maximum**: ${Math.max(...allAvg).toFixed(2)} ppm`,
            `- **Minimum**: ${Math.min(...allAvg).toFixed(2)} ppm`,
          )

          // Rate of change
          if (rows.length >= 24) {
            const recentYear = rows.slice(-12).reduce((s, r) => s + r.avg, 0) / 12
            const priorYear = rows.slice(-24, -12).reduce((s, r) => s + r.avg, 0) / 12
            lines.push(`- **Year-over-year change**: +${(recentYear - priorYear).toFixed(2)} ppm`)
          }

          return lines.join('\n')
        } catch (err) {
          return `**Error**: Failed to fetch NOAA CO2 data — ${err instanceof Error ? err.message : String(err)}`
        }
      }

      if (variable === 'sea_level') {
        try {
          // CSIRO/NOAA reconstructed sea level
          const url = 'https://www.star.nesdis.noaa.gov/socd/lsa/SeaLevelRise/slr/slr_sla_gbl_free_txj1j2_90.csv'
          const res = await labFetch(url)
          if (!res.ok) return `**Error**: NOAA sea level API returned ${res.status}`
          const text = await res.text()

          const rawLines = text.split('\n')
          // Find header
          let headerIdx = -1
          for (let i = 0; i < rawLines.length; i++) {
            if (rawLines[i].toLowerCase().includes('year') || /^\d{4}/.test(rawLines[i].trim())) {
              headerIdx = i
              break
            }
          }

          const lines: string[] = [
            '# Global Mean Sea Level',
            '**Source**: NOAA Laboratory for Satellite Altimetry',
            '**Reference**: Satellite altimetry (TOPEX/Jason)\n',
          ]

          // Parse what we can from the CSV
          const dataRows: Array<{ year: number; level: number }> = []
          const startIdx = headerIdx >= 0 ? headerIdx : 0
          for (let i = startIdx; i < rawLines.length; i++) {
            const parts = rawLines[i].split(',').map(s => s.trim())
            if (parts.length < 2) continue
            const year = parseFloat(parts[0])
            // Try second column as sea level
            const level = parseFloat(parts[1])
            if (isNaN(year) || isNaN(level)) continue
            const roundYear = Math.floor(year)
            if (yearFrom !== undefined && roundYear < yearFrom) continue
            if (yearTo !== undefined && roundYear > yearTo) continue
            dataRows.push({ year, level })
          }

          if (dataRows.length === 0) {
            return '**No sea level data** could be parsed for the requested range. The NOAA sea level CSV format may have changed. Try the `climate_data` tool with `variable: temperature` or `variable: co2` instead.'
          }

          // Group by integer year for summary
          const yearMap = new Map<number, number[]>()
          for (const r of dataRows) {
            const y = Math.floor(r.year)
            if (!yearMap.has(y)) yearMap.set(y, [])
            yearMap.get(y)!.push(r.level)
          }

          lines.push(
            '| Year | Mean Sea Level (mm) |',
            '|------|-------------------|',
          )

          for (const [year, vals] of yearMap) {
            const mean = vals.reduce((s, v) => s + v, 0) / vals.length
            lines.push(`| ${year} | ${mean.toFixed(1)} |`)
          }

          const allLevels = dataRows.map(r => r.level)
          const firstLevel = allLevels[0]
          const lastLevel = allLevels[allLevels.length - 1]
          const firstYear = dataRows[0].year
          const lastYear = dataRows[dataRows.length - 1].year

          lines.push(
            '',
            '### Summary',
            `- **Period**: ${firstYear.toFixed(1)} to ${lastYear.toFixed(1)}`,
            `- **Total change**: ${(lastLevel - firstLevel).toFixed(1)} mm`,
            `- **Rate**: ~${((lastLevel - firstLevel) / (lastYear - firstYear)).toFixed(2)} mm/year`,
          )

          return lines.join('\n')
        } catch (err) {
          return `**Error**: Failed to fetch sea level data — ${err instanceof Error ? err.message : String(err)}`
        }
      }

      return `**Error**: Unknown variable "${variable}". Supported: temperature, co2, sea_level.`
    },
  })

  // ── 3. Satellite Imagery ────────────────────────────────────────────────

  registerTool({
    name: 'satellite_imagery',
    description: 'Search NASA EOSDIS Common Metadata Repository (CMR) for satellite imagery metadata. Returns granule IDs, temporal coverage, browse image URLs, and download links for Landsat, Sentinel, MODIS, and other datasets.',
    parameters: {
      dataset: { type: 'string', description: 'Dataset: landsat, sentinel, modis (or a specific CMR short_name)', required: true },
      latitude: { type: 'number', description: 'Latitude of the point of interest', required: true },
      longitude: { type: 'number', description: 'Longitude of the point of interest', required: true },
      date: { type: 'string', description: 'Target date YYYY-MM-DD or date range YYYY-MM-DD,YYYY-MM-DD (default: last 30 days)' },
    },
    tier: 'free',
    async execute(args) {
      const datasetInput = String(args.dataset).toLowerCase().trim()
      const lat = args.latitude as number
      const lon = args.longitude as number
      const dateArg = typeof args.date === 'string' ? args.date : undefined

      // Map friendly names to CMR short_names
      const datasetMap: Record<string, string> = {
        landsat: 'LANDSAT_8_OLI_TIRS_C2_L2',
        sentinel: 'HLSS30',
        modis: 'MOD09GA',
        'landsat-8': 'LANDSAT_8_OLI_TIRS_C2_L2',
        'landsat-9': 'LANDSAT_9_OLI_TIRS_C2_L2',
        'sentinel-2': 'HLSS30',
        'modis-terra': 'MOD09GA',
        'modis-aqua': 'MYD09GA',
      }
      const shortName = datasetMap[datasetInput] || datasetInput

      let temporalParam = ''
      if (dateArg) {
        if (dateArg.includes(',')) {
          const [start, end] = dateArg.split(',')
          temporalParam = `&temporal[]=${start}T00:00:00Z,${end}T23:59:59Z`
        } else {
          // Search +/- 7 days around the target date
          const d = new Date(dateArg)
          const start = new Date(d.getTime() - 7 * 86400000).toISOString().split('T')[0]
          const end = new Date(d.getTime() + 7 * 86400000).toISOString().split('T')[0]
          temporalParam = `&temporal[]=${start}T00:00:00Z,${end}T23:59:59Z`
        }
      } else {
        temporalParam = `&temporal[]=${daysAgo(30)}T00:00:00Z,${today()}T23:59:59Z`
      }

      const url = `https://cmr.earthdata.nasa.gov/search/granules.json?short_name=${encodeURIComponent(shortName)}&point=${lon},${lat}&page_size=5${temporalParam}&sort_key=-start_date`

      try {
        const res = await labFetch(url)
        if (!res.ok) return `**Error**: NASA CMR returned ${res.status} ${res.statusText}`
        const data = await res.json() as {
          feed: {
            entry: Array<{
              id: string
              title: string
              time_start: string
              time_end: string
              updated: string
              dataset_id: string
              collection_concept_id: string
              links: Array<{ rel: string; href: string; type?: string }>
              granule_size?: string
              day_night_flag?: string
              cloud_cover?: string
            }>
          }
        }

        const entries = data.feed?.entry || []
        if (entries.length === 0) {
          return `**No satellite imagery found** for ${shortName} at (${lat}, ${lon}). Try broadening the date range or using a different dataset.`
        }

        const lines: string[] = [
          `# Satellite Imagery Search`,
          `**Dataset**: ${shortName}`,
          `**Location**: (${lat}, ${lon})`,
          `**Results**: ${entries.length} granule(s)\n`,
        ]

        for (const e of entries) {
          const browseLinks = e.links?.filter(l => l.rel && (l.rel.includes('browse') || l.rel === 'http://esipfed.org/ns/fedsearch/1.1/browse#')) || []
          const dataLinks = e.links?.filter(l => l.rel && (l.rel.includes('data') || l.rel === 'http://esipfed.org/ns/fedsearch/1.1/data#')) || []

          lines.push(
            `## ${e.title || e.id}`,
            `- **Time**: ${e.time_start || '?'} to ${e.time_end || '?'}`,
          )
          if (e.cloud_cover) lines.push(`- **Cloud cover**: ${e.cloud_cover}%`)
          if (e.day_night_flag) lines.push(`- **Day/Night**: ${e.day_night_flag}`)
          if (e.granule_size) lines.push(`- **Size**: ${e.granule_size} MB`)
          if (browseLinks.length > 0) lines.push(`- **Browse**: ${browseLinks[0].href}`)
          if (dataLinks.length > 0) lines.push(`- **Download**: ${dataLinks[0].href}`)
          lines.push(`- **Granule ID**: ${e.id}`, '')
        }

        return lines.join('\n')
      } catch (err) {
        return `**Error**: Failed to query NASA CMR — ${err instanceof Error ? err.message : String(err)}`
      }
    },
  })

  // ── 4. Geological Query ─────────────────────────────────────────────────

  registerTool({
    name: 'geological_query',
    description: 'Query Macrostrat for geological data: rock units, formations, lithology, and geological ages by location or formation name. Returns unit names, rock types, ages, thicknesses, and stratigraphic context.',
    parameters: {
      query: { type: 'string', description: 'Search term for formation or lithology name' },
      latitude: { type: 'number', description: 'Latitude for location-based search' },
      longitude: { type: 'number', description: 'Longitude for location-based search' },
      search_type: { type: 'string', description: 'Search type: location, formation, or lithology', required: true },
    },
    tier: 'free',
    async execute(args) {
      const searchType = String(args.search_type).toLowerCase().trim()
      const query = typeof args.query === 'string' ? args.query : ''
      const lat = typeof args.latitude === 'number' ? args.latitude : undefined
      const lon = typeof args.longitude === 'number' ? args.longitude : undefined

      let url: string

      if (searchType === 'location') {
        if (lat === undefined || lon === undefined) {
          return '**Error**: Location search requires both latitude and longitude parameters.'
        }
        url = `https://macrostrat.org/api/v2/units?lat=${lat}&lng=${lon}&response=long`
      } else if (searchType === 'formation') {
        if (!query) return '**Error**: Formation search requires a query parameter.'
        url = `https://macrostrat.org/api/v2/units?strat_name=${encodeURIComponent(query)}&response=long`
      } else if (searchType === 'lithology') {
        if (!query) return '**Error**: Lithology search requires a query parameter.'
        url = `https://macrostrat.org/api/v2/units?lith=${encodeURIComponent(query)}&response=long`
      } else {
        return `**Error**: Unknown search_type "${searchType}". Use: location, formation, or lithology.`
      }

      try {
        const res = await labFetch(url)
        if (!res.ok) return `**Error**: Macrostrat API returned ${res.status}`
        const data = await res.json() as {
          success: { data: Array<Record<string, unknown>> }
        }

        const units = data.success?.data || []
        if (units.length === 0) {
          return `**No geological units found** for ${searchType} query${query ? ` "${query}"` : ''}.`
        }

        const lines: string[] = [
          `# Geological Query Results`,
          `**Source**: Macrostrat`,
          `**Search**: ${searchType}${query ? ` — "${query}"` : ''}${lat !== undefined ? ` at (${lat}, ${lon})` : ''}`,
          `**Units found**: ${units.length}\n`,
        ]

        // Show up to 20 units
        const shown = units.slice(0, 20)
        for (const u of shown) {
          const name = u.unit_name || u.strat_name_long || 'Unnamed unit'
          lines.push(`## ${name}`)

          if (u.Mbr) lines.push(`- **Member**: ${u.Mbr}`)
          if (u.Fm) lines.push(`- **Formation**: ${u.Fm}`)
          if (u.Gp) lines.push(`- **Group**: ${u.Gp}`)
          if (u.SGp) lines.push(`- **Supergroup**: ${u.SGp}`)

          if (u.lith) lines.push(`- **Lithology**: ${u.lith}`)
          if (u.descrip) lines.push(`- **Description**: ${u.descrip}`)
          if (u.environ) lines.push(`- **Environment**: ${u.environ}`)

          const t_age = u.t_age as number | undefined
          const b_age = u.b_age as number | undefined
          if (t_age !== undefined && b_age !== undefined) {
            lines.push(`- **Age**: ${b_age} — ${t_age} Ma`)
          }
          if (u.t_int_name) lines.push(`- **Top interval**: ${u.t_int_name}`)
          if (u.b_int_name) lines.push(`- **Base interval**: ${u.b_int_name}`)

          const minThick = u.min_thick as number | undefined
          const maxThick = u.max_thick as number | undefined
          if (minThick !== undefined && maxThick !== undefined) {
            lines.push(`- **Thickness**: ${minThick} — ${maxThick} m`)
          }

          if (u.pbdb_collections) lines.push(`- **Fossil collections**: ${u.pbdb_collections}`)
          if (u.clat && u.clng) lines.push(`- **Centroid**: (${u.clat}, ${u.clng})`)

          lines.push('')
        }

        if (units.length > 20) {
          lines.push(`*...and ${units.length - 20} more units.*`)
        }

        return lines.join('\n')
      } catch (err) {
        return `**Error**: Failed to query Macrostrat — ${err instanceof Error ? err.message : String(err)}`
      }
    },
  })

  // ── 5. Ocean Data ───────────────────────────────────────────────────────

  registerTool({
    name: 'ocean_data',
    description: 'Retrieve oceanographic data: sea surface temperature (SST), salinity, or chlorophyll concentrations from NOAA ERDDAP. Returns gridded data nearest to the specified coordinates.',
    parameters: {
      variable: { type: 'string', description: 'Variable: sst, salinity, or chlorophyll', required: true },
      latitude: { type: 'number', description: 'Latitude', required: true },
      longitude: { type: 'number', description: 'Longitude', required: true },
      date: { type: 'string', description: 'Target date YYYY-MM-DD (default: most recent available)' },
    },
    tier: 'free',
    async execute(args) {
      const variable = String(args.variable).toLowerCase().trim()
      const lat = args.latitude as number
      const lon = args.longitude as number
      const dateStr = typeof args.date === 'string' ? args.date : 'last'

      // ERDDAP dataset IDs and variable names
      const datasets: Record<string, { id: string; varName: string; unit: string; fullName: string }> = {
        sst: { id: 'jplMURSST41', varName: 'analysed_sst', unit: 'K', fullName: 'Sea Surface Temperature' },
        salinity: { id: 'hawaii_soest_a29a_6358_f498', varName: 'salt', unit: 'PSU', fullName: 'Sea Surface Salinity' },
        chlorophyll: { id: 'erdMH1chla8day', varName: 'chlorophyll', unit: 'mg/m^3', fullName: 'Chlorophyll-a Concentration' },
      }

      const ds = datasets[variable]
      if (!ds) return `**Error**: Unknown variable "${variable}". Supported: sst, salinity, chlorophyll.`

      // ERDDAP griddap query — use nearest point and last time step
      const timeConstraint = dateStr === 'last' ? 'last' : `(${dateStr}T12:00:00Z)`
      const baseUrl = 'https://coastwatch.pfeg.noaa.gov/erddap/griddap'
      const url = `${baseUrl}/${ds.id}.json?${ds.varName}[${timeConstraint}][(${lat})][(${lon})]`

      try {
        const res = await labFetch(url)
        if (!res.ok) {
          // Try with longitude shifted for datasets expecting 0-360
          const lon360 = lon < 0 ? lon + 360 : lon
          const altUrl = `${baseUrl}/${ds.id}.json?${ds.varName}[${timeConstraint}][(${lat})][(${lon360})]`
          const altRes = await labFetch(altUrl)
          if (!altRes.ok) {
            return `**Error**: ERDDAP returned ${res.status} for ${ds.fullName}. The dataset may not cover location (${lat}, ${lon}) or the requested date. Try a different date or location.`
          }
          const altData = await altRes.json() as { table: { columnNames: string[]; rows: unknown[][] } }
          return formatErddapResult(altData, ds, lat, lon)
        }

        const data = await res.json() as { table: { columnNames: string[]; rows: unknown[][] } }
        return formatErddapResult(data, ds, lat, lon)
      } catch (err) {
        return `**Error**: Failed to query ERDDAP ocean data — ${err instanceof Error ? err.message : String(err)}`
      }
    },
  })

  function formatErddapResult(
    data: { table: { columnNames: string[]; rows: unknown[][] } },
    ds: { id: string; varName: string; unit: string; fullName: string },
    lat: number,
    lon: number,
  ): string {
    const table = data.table
    if (!table || !table.rows || table.rows.length === 0) {
      return `**No data** available for ${ds.fullName} at (${lat}, ${lon}).`
    }

    const colNames = table.columnNames || []
    const lines: string[] = [
      `# ${ds.fullName}`,
      `**Source**: NOAA ERDDAP (${ds.id})`,
      `**Location**: (${lat}, ${lon})\n`,
    ]

    // Build a readable table
    lines.push(`| ${colNames.join(' | ')} |`)
    lines.push(`|${colNames.map(() => '---').join('|')}|`)

    for (const row of table.rows) {
      const cells = row.map((v, i) => {
        if (typeof v === 'number') {
          // Convert SST from Kelvin to Celsius for readability
          if (ds.varName === 'analysed_sst' && colNames[i] === ds.varName) {
            return `${(v - 273.15).toFixed(2)} C (${v.toFixed(2)} K)`
          }
          return typeof v === 'number' && !Number.isInteger(v) ? v.toFixed(4) : String(v)
        }
        return String(v)
      })
      lines.push(`| ${cells.join(' | ')} |`)
    }

    return lines.join('\n')
  }

  // ── 6. Air Quality ──────────────────────────────────────────────────────

  registerTool({
    name: 'air_quality',
    description: 'Get current air quality data: PM2.5, PM10, ozone (O3), nitrogen dioxide (NO2), sulfur dioxide (SO2), and carbon monoxide (CO). Uses OpenAQ network of monitoring stations worldwide.',
    parameters: {
      latitude: { type: 'number', description: 'Latitude for geographic search' },
      longitude: { type: 'number', description: 'Longitude for geographic search' },
      city: { type: 'string', description: 'City name (alternative to lat/lon)' },
    },
    tier: 'free',
    async execute(args) {
      const lat = typeof args.latitude === 'number' ? args.latitude : undefined
      const lon = typeof args.longitude === 'number' ? args.longitude : undefined
      const city = typeof args.city === 'string' ? args.city : undefined

      let url: string
      if (lat !== undefined && lon !== undefined) {
        url = `https://api.openaq.org/v2/latest?coordinates=${lat},${lon}&radius=25000&limit=5`
      } else if (city) {
        url = `https://api.openaq.org/v2/latest?city=${encodeURIComponent(city)}&limit=5`
      } else {
        return '**Error**: Provide either latitude/longitude or a city name.'
      }

      try {
        const res = await labFetch(url)
        if (!res.ok) return `**Error**: OpenAQ API returned ${res.status} ${res.statusText}`
        const data = await res.json() as {
          results: Array<{
            location: string
            city: string
            country: string
            coordinates: { latitude: number; longitude: number }
            measurements: Array<{
              parameter: string
              value: number
              unit: string
              lastUpdated: string
            }>
          }>
        }

        const results = data.results || []
        if (results.length === 0) {
          return `**No air quality stations found** near ${city || `(${lat}, ${lon})`}. OpenAQ coverage varies — try a nearby city or broader coordinates.`
        }

        const lines: string[] = [
          '# Air Quality Data',
          `**Source**: OpenAQ`,
          `**Search**: ${city || `(${lat}, ${lon}), radius 25 km`}`,
          `**Stations found**: ${results.length}\n`,
        ]

        // AQI breakpoints for PM2.5 (EPA standard)
        function pm25Aqi(v: number): string {
          if (v <= 12) return 'Good'
          if (v <= 35.4) return 'Moderate'
          if (v <= 55.4) return 'Unhealthy for Sensitive Groups'
          if (v <= 150.4) return 'Unhealthy'
          if (v <= 250.4) return 'Very Unhealthy'
          return 'Hazardous'
        }

        for (const station of results) {
          lines.push(
            `## ${station.location}`,
            `**City**: ${station.city || 'N/A'} | **Country**: ${station.country || 'N/A'}`,
            `**Coordinates**: (${station.coordinates.latitude.toFixed(3)}, ${station.coordinates.longitude.toFixed(3)})\n`,
            '| Parameter | Value | Unit | Last Updated |',
            '|-----------|-------|------|-------------|',
          )

          for (const m of station.measurements) {
            const name = m.parameter.toUpperCase()
            const updated = m.lastUpdated ? m.lastUpdated.replace('T', ' ').replace(/\.\d+.*/, '') : '?'
            let extra = ''
            if (m.parameter === 'pm25' && m.unit === 'µg/m³') {
              extra = ` (${pm25Aqi(m.value)})`
            }
            lines.push(`| ${name} | ${m.value}${extra} | ${m.unit} | ${updated} |`)
          }
          lines.push('')
        }

        // WHO guideline comparison
        lines.push(
          '### WHO Air Quality Guidelines (2021)',
          '| Pollutant | Annual Mean | 24-hour Mean |',
          '|-----------|------------|-------------|',
          '| PM2.5 | 5 ug/m3 | 15 ug/m3 |',
          '| PM10 | 15 ug/m3 | 45 ug/m3 |',
          '| O3 | - | 100 ug/m3 (8-hr) |',
          '| NO2 | 10 ug/m3 | 25 ug/m3 |',
          '| SO2 | - | 40 ug/m3 |',
          '| CO | - | 4 mg/m3 |',
        )

        return lines.join('\n')
      } catch (err) {
        return `**Error**: Failed to query OpenAQ — ${err instanceof Error ? err.message : String(err)}`
      }
    },
  })

  // ── 7. Soil Data ────────────────────────────────────────────────────────

  registerTool({
    name: 'soil_data',
    description: 'Retrieve soil properties by location from SoilGrids (ISRIC): pH, soil organic carbon, bulk density, clay/sand/silt fractions. Returns predicted values at 0-5cm depth.',
    parameters: {
      latitude: { type: 'number', description: 'Latitude', required: true },
      longitude: { type: 'number', description: 'Longitude', required: true },
    },
    tier: 'free',
    async execute(args) {
      const lat = args.latitude as number
      const lon = args.longitude as number

      const url = `https://rest.isric.org/soilgrids/v2.0/properties/query?lon=${lon}&lat=${lat}&property=phh2o&property=soc&property=bdod&property=clay&property=sand&property=silt&depth=0-5cm&value=mean`

      try {
        const res = await labFetch(url)
        if (!res.ok) return `**Error**: SoilGrids API returned ${res.status}. Location (${lat}, ${lon}) may be outside coverage (oceans, ice, etc.).`

        const data = await res.json() as {
          type: string
          geometry: { type: string; coordinates: number[] }
          properties: {
            layers: Array<{
              name: string
              unit_measure: { mapped_units: string; target_units: string; conversion_factor: number }
              depths: Array<{
                label: string
                range: { top_depth: number; bottom_depth: number; unit_depth: string }
                values: { mean?: number; Q0_05?: number; Q0_5?: number; Q0_95?: number; uncertainty?: number }
              }>
            }>
          }
        }

        const layers = data.properties?.layers || []
        if (layers.length === 0) {
          return `**No soil data** available for (${lat}, ${lon}). The location may be ocean, ice, or outside SoilGrids coverage.`
        }

        const lines: string[] = [
          '# Soil Properties',
          `**Source**: ISRIC SoilGrids v2.0 (250m resolution)`,
          `**Location**: (${lat}, ${lon})`,
          `**Depth**: 0-5 cm\n`,
          '| Property | Value | Unit | Description |',
          '|----------|-------|------|-------------|',
        ]

        const descriptions: Record<string, string> = {
          phh2o: 'Soil pH in H2O solution',
          soc: 'Soil organic carbon content',
          bdod: 'Bulk density of fine earth fraction',
          clay: 'Clay content (< 2 um)',
          sand: 'Sand content (50-2000 um)',
          silt: 'Silt content (2-50 um)',
        }

        const scaleFactors: Record<string, number> = {
          phh2o: 10,  // stored as pH*10
          soc: 10,    // stored as dg/kg (need g/kg)
          bdod: 100,  // stored as cg/cm3 (need g/cm3 => kg/m3)
          clay: 10,   // stored as g/kg
          sand: 10,   // stored as g/kg
          silt: 10,   // stored as g/kg
        }

        const units: Record<string, string> = {
          phh2o: 'pH units',
          soc: 'g/kg',
          bdod: 'cg/cm3',
          clay: 'g/kg',
          sand: 'g/kg',
          silt: 'g/kg',
        }

        for (const layer of layers) {
          const name = layer.name
          const depth = layer.depths?.[0]
          if (!depth || depth.values?.mean === undefined || depth.values.mean === null) continue

          const rawValue = depth.values.mean
          const factor = scaleFactors[name] || 1
          const displayValue = rawValue / factor
          const unit = layer.unit_measure?.target_units || units[name] || layer.unit_measure?.mapped_units || ''
          const desc = descriptions[name] || name

          lines.push(`| **${name.toUpperCase()}** | ${displayValue.toFixed(2)} | ${unit} | ${desc} |`)
        }

        // Soil texture classification
        let clay = 0, sand = 0, silt = 0
        for (const layer of layers) {
          const val = layer.depths?.[0]?.values?.mean
          if (val === undefined || val === null) continue
          if (layer.name === 'clay') clay = val / 10  // g/kg to %
          if (layer.name === 'sand') sand = val / 10
          if (layer.name === 'silt') silt = val / 10
        }

        if (clay + sand + silt > 0) {
          // Convert g/kg to percentage
          const total = clay + sand + silt
          const clayPct = (clay / total) * 100
          const sandPct = (sand / total) * 100
          const siltPct = (silt / total) * 100

          let textureClass = 'Unknown'
          // USDA soil texture triangle (simplified)
          if (clayPct >= 40) {
            if (sandPct >= 45) textureClass = 'Sandy Clay'
            else if (siltPct >= 40) textureClass = 'Silty Clay'
            else textureClass = 'Clay'
          } else if (clayPct >= 27) {
            if (sandPct >= 20 && sandPct <= 45) textureClass = 'Clay Loam'
            else if (sandPct < 20) textureClass = 'Silty Clay Loam'
            else textureClass = 'Sandy Clay Loam'
          } else if (siltPct >= 50) {
            if (clayPct < 12) textureClass = 'Silt'
            else textureClass = 'Silt Loam'
          } else if (sandPct >= 85) {
            textureClass = 'Sand'
          } else if (sandPct >= 70) {
            textureClass = 'Loamy Sand'
          } else if (sandPct >= 52) {
            textureClass = 'Sandy Loam'
          } else {
            textureClass = 'Loam'
          }

          lines.push(
            '',
            '### Soil Texture',
            `- **Clay**: ${clayPct.toFixed(1)}%`,
            `- **Sand**: ${sandPct.toFixed(1)}%`,
            `- **Silt**: ${siltPct.toFixed(1)}%`,
            `- **USDA Classification**: ${textureClass}`,
          )
        }

        return lines.join('\n')
      } catch (err) {
        return `**Error**: Failed to query SoilGrids — ${err instanceof Error ? err.message : String(err)}`
      }
    },
  })

  // ── 8. Volcano Monitor ──────────────────────────────────────────────────

  registerTool({
    name: 'volcano_monitor',
    description: 'Get global volcano activity data: search by volcano name or region. Uses embedded data for ~50 major active volcanoes from Smithsonian GVP with name, country, region, elevation, type, last eruption, and status.',
    parameters: {
      volcano: { type: 'string', description: 'Volcano name to search for (fuzzy match)' },
      region: { type: 'string', description: 'Region to filter by (e.g. Hawaii, Kamchatka, Java, Cascades)' },
    },
    tier: 'free',
    async execute(args) {
      const volcanoQuery = typeof args.volcano === 'string' ? args.volcano.toLowerCase().trim() : ''
      const regionQuery = typeof args.region === 'string' ? args.region.toLowerCase().trim() : ''

      let filtered = MAJOR_VOLCANOES

      if (volcanoQuery) {
        filtered = filtered.filter(v =>
          v.name.toLowerCase().includes(volcanoQuery) ||
          v.country.toLowerCase().includes(volcanoQuery)
        )
      }

      if (regionQuery) {
        filtered = filtered.filter(v =>
          v.region.toLowerCase().includes(regionQuery) ||
          v.country.toLowerCase().includes(regionQuery)
        )
      }

      if (filtered.length === 0) {
        // Show available regions as a hint
        const regions = [...new Set(MAJOR_VOLCANOES.map(v => v.region))].sort()
        return `**No volcanoes found** matching "${volcanoQuery || regionQuery}".\n\n**Available regions**: ${regions.join(', ')}\n\n**Tip**: Try a partial name like "etna", "kil", or a region like "kamchatka", "java".`
      }

      const lines: string[] = [
        '# Volcano Monitor',
        `**Source**: Smithsonian GVP (Global Volcanism Program)`,
        `**Results**: ${filtered.length} volcano(es)\n`,
        '| Volcano | Country | Region | Elev (m) | Type | Last Eruption | Status |',
        '|---------|---------|--------|----------|------|---------------|--------|',
      ]

      for (const v of filtered) {
        lines.push(`| ${v.name} | ${v.country} | ${v.region} | ${v.elevation_m} | ${v.type} | ${v.last_eruption} | ${v.status} |`)
      }

      // Also try to fetch live data from USGS VONA (Volcano Observatory Notices)
      try {
        const usgsUrl = 'https://volcanoes.usgs.gov/api/1/observatoryNotices?limit=5'
        const res = await labFetch(usgsUrl)
        if (res.ok) {
          const notices = await res.json() as {
            data?: Array<{
              title: string
              content: string
              issued: string
              volcano_name?: string
              color_code?: string
              alert_level?: string
            }>
          }
          const items = notices.data || []
          if (items.length > 0) {
            lines.push(
              '',
              '### Recent USGS Volcano Notices',
            )
            for (const n of items.slice(0, 5)) {
              const dateStr = n.issued ? new Date(n.issued).toISOString().split('T')[0] : '?'
              const alert = n.alert_level ? ` [${n.alert_level.toUpperCase()}]` : ''
              const color = n.color_code ? ` (${n.color_code})` : ''
              lines.push(`- **${n.volcano_name || n.title}**${alert}${color} — ${dateStr}`)
            }
          }
        }
      } catch {
        // Silently skip live notices if unavailable
      }

      // Stats
      const activeCount = filtered.filter(v => v.status === 'Active').length
      const dormantCount = filtered.filter(v => v.status === 'Dormant').length
      const countries = [...new Set(filtered.map(v => v.country))]
      const avgElev = filtered.reduce((s, v) => s + v.elevation_m, 0) / filtered.length

      lines.push(
        '',
        '### Summary',
        `- **Active**: ${activeCount} | **Dormant**: ${dormantCount}`,
        `- **Countries**: ${countries.join(', ')}`,
        `- **Avg elevation**: ${avgElev.toFixed(0)} m`,
        `- **Highest**: ${filtered.reduce((max, v) => v.elevation_m > max.elevation_m ? v : max).name} (${Math.max(...filtered.map(v => v.elevation_m))} m)`,
      )

      return lines.join('\n')
    },
  })

  // ── 9. Water Resources ──────────────────────────────────────────────────

  registerTool({
    name: 'water_resources',
    description: 'Retrieve USGS water data: real-time streamflow, groundwater levels, and water temperature at monitoring sites. Search by state or specific site ID.',
    parameters: {
      site_id: { type: 'string', description: 'USGS site number (e.g. "09380000" for Colorado River at Lees Ferry)' },
      parameter: { type: 'string', description: 'Parameter: streamflow, groundwater, or temperature', required: true },
      state: { type: 'string', description: 'Two-letter state code (e.g. "AZ", "CO") for state-wide search' },
      days: { type: 'number', description: 'Number of days of data (default: 7, max: 30)' },
    },
    tier: 'free',
    async execute(args) {
      const parameter = String(args.parameter).toLowerCase().trim()
      const siteId = typeof args.site_id === 'string' ? args.site_id.trim() : undefined
      const state = typeof args.state === 'string' ? args.state.toUpperCase().trim() : undefined
      const days = typeof args.days === 'number' ? Math.min(args.days, 30) : 7

      // USGS parameter codes
      const paramCodes: Record<string, { code: string; name: string; unit: string; siteType: string }> = {
        streamflow: { code: '00060', name: 'Discharge', unit: 'cfs', siteType: 'ST' },
        groundwater: { code: '72019', name: 'Depth to water level', unit: 'ft below surface', siteType: 'GW' },
        temperature: { code: '00010', name: 'Water Temperature', unit: 'deg C', siteType: 'ST' },
      }

      const pc = paramCodes[parameter]
      if (!pc) return `**Error**: Unknown parameter "${parameter}". Supported: streamflow, groundwater, temperature.`

      let url: string
      if (siteId) {
        url = `https://waterservices.usgs.gov/nwis/iv/?format=json&sites=${siteId}&parameterCd=${pc.code}&period=P${days}D`
      } else if (state) {
        url = `https://waterservices.usgs.gov/nwis/iv/?format=json&stateCd=${state}&parameterCd=${pc.code}&period=P${days}D&siteType=${pc.siteType}&siteStatus=active`
      } else {
        return '**Error**: Provide either a site_id or state code.'
      }

      try {
        const res = await labFetch(url)
        if (!res.ok) return `**Error**: USGS Water Services returned ${res.status}`
        const data = await res.json() as {
          value: {
            timeSeries: Array<{
              sourceInfo: {
                siteName: string
                siteCode: Array<{ value: string }>
                geoLocation: { geogLocation: { latitude: number; longitude: number } }
              }
              variable: {
                variableName: string
                unit: { unitCode: string }
              }
              values: Array<{
                value: Array<{
                  value: string
                  dateTime: string
                  qualifiers: string[]
                }>
              }>
            }>
          }
        }

        const series = data.value?.timeSeries || []
        if (series.length === 0) {
          return `**No water data** found for ${parameter}${state ? ` in ${state}` : ''}${siteId ? ` at site ${siteId}` : ''}. The parameter may not be monitored at these sites.`
        }

        const lines: string[] = [
          `# USGS Water Resources Data`,
          `**Parameter**: ${pc.name} (${pc.code})`,
          `**Period**: Last ${days} days`,
          `**Sites**: ${series.length}\n`,
        ]

        // Limit to 10 sites for readability
        const shown = series.slice(0, 10)
        for (const ts of shown) {
          const siteName = ts.sourceInfo.siteName || 'Unknown site'
          const siteCode = ts.sourceInfo.siteCode?.[0]?.value || '?'
          const geo = ts.sourceInfo.geoLocation?.geogLocation
          const unit = ts.variable?.unit?.unitCode || pc.unit

          const values = ts.values?.[0]?.value || []
          const numericValues = values
            .map(v => parseFloat(v.value))
            .filter(v => !isNaN(v) && v >= 0)

          lines.push(`## ${siteName}`)
          lines.push(`- **Site ID**: ${siteCode}`)
          if (geo) lines.push(`- **Location**: (${geo.latitude.toFixed(4)}, ${geo.longitude.toFixed(4)})`)

          if (numericValues.length > 0) {
            const current = numericValues[numericValues.length - 1]
            const min = Math.min(...numericValues)
            const max = Math.max(...numericValues)
            const avg = numericValues.reduce((s, v) => s + v, 0) / numericValues.length

            lines.push(
              `- **Current**: ${current.toFixed(1)} ${unit}`,
              `- **Min**: ${min.toFixed(1)} ${unit}`,
              `- **Max**: ${max.toFixed(1)} ${unit}`,
              `- **Mean**: ${avg.toFixed(1)} ${unit}`,
              `- **Observations**: ${numericValues.length}`,
            )

            // Last 5 readings
            const recent = values.slice(-5)
            if (recent.length > 0) {
              lines.push('', '**Recent readings**:', '')
              lines.push('| Time | Value | Qualifiers |')
              lines.push('|------|-------|------------|')
              for (const r of recent) {
                const time = r.dateTime.replace('T', ' ').replace(/\.000.*/, '')
                lines.push(`| ${time} | ${r.value} ${unit} | ${r.qualifiers?.join(', ') || '-'} |`)
              }
            }
          } else {
            lines.push('- *No valid readings in the requested period.*')
          }
          lines.push('')
        }

        if (series.length > 10) {
          lines.push(`*...and ${series.length - 10} more sites. Use a specific site_id for detailed data.*`)
        }

        return lines.join('\n')
      } catch (err) {
        return `**Error**: Failed to query USGS Water Services — ${err instanceof Error ? err.message : String(err)}`
      }
    },
  })

  // ── 10. Biodiversity Index ──────────────────────────────────────────────

  registerTool({
    name: 'biodiversity_index',
    description: 'Calculate ecological diversity indices from species abundance data. Supports Shannon H\', Simpson D, Chao1, species richness, and Pielou evenness. All computation is local — no API calls needed.',
    parameters: {
      abundances: { type: 'string', description: 'Comma-separated species abundance counts (e.g. "10,20,30,5,1,1")', required: true },
      index_type: { type: 'string', description: 'Index: shannon, simpson, chao1, richness, evenness, or all (default: all)', required: true },
    },
    tier: 'free',
    async execute(args) {
      const raw = String(args.abundances)
      const counts = raw.split(',').map(s => s.trim()).filter(s => s !== '').map(Number).filter(n => !isNaN(n) && n >= 0)
      const indexType = String(args.index_type).toLowerCase().trim()

      if (counts.length === 0) return '**Error**: No valid abundance counts provided. Pass comma-separated integers (e.g. "10,20,30,5,1,1").'

      // Filter out zeros
      const abundances = counts.filter(n => n > 0)
      if (abundances.length === 0) return '**Error**: All abundance values are zero.'

      const N = abundances.reduce((s, v) => s + v, 0) // total individuals
      const S = abundances.length // species richness (observed)
      const pi = abundances.map(n => n / N) // proportional abundances

      // Shannon diversity: H' = -sum(pi * ln(pi))
      const shannon = -pi.reduce((s, p) => s + (p > 0 ? p * Math.log(p) : 0), 0)

      // Simpson diversity: D = 1 - sum(pi^2)
      const simpsonD = 1 - pi.reduce((s, p) => s + p * p, 0)

      // Simpson's reciprocal: 1/D (where D = sum(pi^2))
      const simpsonReciprocal = 1 / pi.reduce((s, p) => s + p * p, 0)

      // Chao1 estimator: S_est = S_obs + (f1^2 / (2 * f2))
      const f1 = abundances.filter(n => n === 1).length // singletons
      const f2 = abundances.filter(n => n === 2).length // doubletons
      let chao1: number
      if (f2 === 0) {
        // Bias-corrected Chao1 when f2 = 0
        chao1 = S + (f1 * (f1 - 1)) / 2
      } else {
        chao1 = S + (f1 * f1) / (2 * f2)
      }

      // Pielou evenness: J = H' / ln(S)
      const pielou = S > 1 ? shannon / Math.log(S) : 1

      // Maximum possible Shannon entropy
      const hMax = Math.log(S)

      // Effective number of species (Hill numbers)
      const hill0 = S                         // q=0: richness
      const hill1 = Math.exp(shannon)         // q=1: exp(H')
      const hill2 = simpsonReciprocal         // q=2: 1/sum(pi^2)

      // Berger-Parker dominance
      const maxAbundance = Math.max(...abundances)
      const bergerParker = maxAbundance / N

      const validTypes = ['shannon', 'simpson', 'chao1', 'richness', 'evenness', 'all']
      if (!validTypes.includes(indexType)) {
        return `**Error**: Unknown index_type "${indexType}". Supported: ${validTypes.join(', ')}.`
      }

      const lines: string[] = [
        '# Biodiversity Indices',
        `**Input**: ${S} species, ${N} total individuals`,
        `**Abundances**: [${abundances.join(', ')}]\n`,
      ]

      const showAll = indexType === 'all'

      if (showAll || indexType === 'richness') {
        lines.push(
          '## Species Richness',
          `- **Observed species (S)**: ${S}`,
          `- **Singletons (f1)**: ${f1}`,
          `- **Doubletons (f2)**: ${f2}`,
          `- **Total individuals (N)**: ${N}`,
          `- **Berger-Parker dominance**: ${bergerParker.toFixed(4)} (${(bergerParker * 100).toFixed(1)}%)`,
          '',
        )
      }

      if (showAll || indexType === 'shannon') {
        lines.push(
          "## Shannon Diversity (H')",
          `- **H'**: ${shannon.toFixed(4)}`,
          `- **H' max (ln S)**: ${hMax.toFixed(4)}`,
          `- **Effective species (exp H')**: ${hill1.toFixed(2)}`,
          `- **Formula**: H' = -sum(pi * ln(pi))`,
          '',
          '**Interpretation**: H\' typically ranges 1.5-3.5 for ecological communities.',
          shannon < 1.5 ? 'This community shows **low diversity**.' :
          shannon < 3.5 ? 'This community shows **moderate diversity**.' :
          'This community shows **high diversity**.',
          '',
        )
      }

      if (showAll || indexType === 'simpson') {
        lines.push(
          '## Simpson Diversity',
          `- **Simpson D (1 - sum pi^2)**: ${simpsonD.toFixed(4)}`,
          `- **Simpson reciprocal (1/sum pi^2)**: ${simpsonReciprocal.toFixed(4)}`,
          `- **Formula**: D = 1 - sum(pi^2)`,
          '',
          '**Interpretation**: D ranges 0-1. Higher values indicate greater diversity.',
          simpsonD > 0.8 ? 'This community is **highly diverse** (D > 0.8).' :
          simpsonD > 0.5 ? 'This community has **moderate diversity** (0.5 < D < 0.8).' :
          'This community has **low diversity** (D < 0.5).',
          '',
        )
      }

      if (showAll || indexType === 'chao1') {
        lines.push(
          '## Chao1 Richness Estimator',
          `- **Chao1 estimate**: ${chao1.toFixed(2)}`,
          `- **Observed species**: ${S}`,
          `- **Undetected species (est.)**: ${(chao1 - S).toFixed(2)}`,
          `- **Singletons (f1)**: ${f1}`,
          `- **Doubletons (f2)**: ${f2}`,
          f2 === 0
            ? `- **Formula** (bias-corrected): S + f1*(f1-1)/2`
            : `- **Formula**: S + f1^2 / (2*f2)`,
          '',
          `**Interpretation**: Chao1 estimates true species richness from incomplete sampling.`,
          chao1 > S * 1.5 ? `The estimate suggests **significant undersampling** — ~${((chao1 - S) / S * 100).toFixed(0)}% more species likely exist.` :
          chao1 > S * 1.1 ? `The estimate suggests **moderate undersampling** — ~${((chao1 - S) / S * 100).toFixed(0)}% more species likely exist.` :
          'Sampling appears **relatively complete** — Chao1 is close to observed richness.',
          '',
        )
      }

      if (showAll || indexType === 'evenness') {
        lines.push(
          '## Pielou Evenness (J)',
          `- **J = H' / ln(S)**: ${pielou.toFixed(4)}`,
          `- **Formula**: J = H' / ln(S)`,
          '',
          '**Interpretation**: J ranges 0-1. Values near 1 indicate equal abundances across species.',
          pielou > 0.8 ? 'This community is **highly even** (J > 0.8).' :
          pielou > 0.5 ? 'This community has **moderate evenness** (0.5 < J < 0.8).' :
          'This community is **highly uneven** (J < 0.5) — a few species dominate.',
          '',
        )
      }

      if (showAll) {
        lines.push(
          '## Hill Numbers (Effective Species)',
          '| Order (q) | Name | Value |',
          '|-----------|------|-------|',
          `| 0 | Species richness | ${hill0} |`,
          `| 1 | exp(Shannon H') | ${hill1.toFixed(2)} |`,
          `| 2 | Simpson reciprocal | ${hill2.toFixed(2)} |`,
          '',
          '**Note**: Hill numbers provide a unified framework for diversity. Higher q gives more weight to abundant species.',
        )

        // Rank-abundance breakdown
        const sorted = [...abundances].sort((a, b) => b - a)
        lines.push(
          '',
          '## Rank-Abundance Distribution',
          '| Rank | Abundance | Proportion | Cumulative % |',
          '|------|-----------|------------|-------------|',
        )
        let cumulative = 0
        for (let i = 0; i < sorted.length; i++) {
          const prop = sorted[i] / N
          cumulative += prop
          lines.push(`| ${i + 1} | ${sorted[i]} | ${(prop * 100).toFixed(1)}% | ${(cumulative * 100).toFixed(1)}% |`)
        }
      }

      return lines.join('\n')
    },
  })
}
