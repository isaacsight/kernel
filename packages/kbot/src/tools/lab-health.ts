// kbot Lab Health Tools — Public Health, Epidemiology, Agriculture, Education
// Self-contained implementations: no external dependencies beyond Node.js built-ins.
// Covers SIR/SEIR compartmental models, epidemiological calculators, health equity,
// disease surveillance, crop modeling, nutrition analysis, learning analytics,
// vaccination modeling, environmental health risk assessment, and WHO data queries.

import { registerTool } from './index.js'

// ─────────────────────────────────────────────────────────────────────────────
// SHARED HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const UA = 'KBot/3.0 (Lab Health Tools)'

function fmt(n: number, d = 4): string {
  if (!isFinite(n)) return String(n)
  if (Number.isInteger(n) && Math.abs(n) < 1e15) return String(n)
  return n.toFixed(d)
}

function pct(n: number, d = 2): string {
  return (n * 100).toFixed(d) + '%'
}

function safeParse<T>(s: string, label: string): T {
  try {
    return JSON.parse(s) as T
  } catch {
    throw new Error(`Invalid JSON for ${label}: ${s}`)
  }
}

async function labFetch(url: string, timeout = 10000): Promise<Response> {
  return fetch(url, {
    headers: { 'User-Agent': UA },
    signal: AbortSignal.timeout(timeout),
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// EMBEDDED DATA: CROP PARAMETERS
// ─────────────────────────────────────────────────────────────────────────────

interface CropParams {
  name: string
  base_temp_c: number       // Base temperature for GDD
  gdd_maturity: number      // Growing degree-days to maturity
  water_need_mm: number     // Total water requirement (mm over season)
  typical_yield_kg_ha: number // Typical yield in kg/hectare
  season_days: number       // Typical growing season length
}

const CROPS: Record<string, CropParams> = {
  corn:       { name: 'Corn (Maize)',     base_temp_c: 10, gdd_maturity: 1400, water_need_mm: 500, typical_yield_kg_ha: 10000, season_days: 125 },
  wheat:      { name: 'Wheat',            base_temp_c: 0,  gdd_maturity: 1800, water_need_mm: 450, typical_yield_kg_ha: 3500,  season_days: 140 },
  rice:       { name: 'Rice',             base_temp_c: 10, gdd_maturity: 2100, water_need_mm: 900, typical_yield_kg_ha: 4500,  season_days: 150 },
  soybean:    { name: 'Soybean',          base_temp_c: 10, gdd_maturity: 1300, water_need_mm: 450, typical_yield_kg_ha: 2800,  season_days: 120 },
  potato:     { name: 'Potato',           base_temp_c: 7,  gdd_maturity: 1200, water_need_mm: 500, typical_yield_kg_ha: 20000, season_days: 110 },
  tomato:     { name: 'Tomato',           base_temp_c: 10, gdd_maturity: 1200, water_need_mm: 600, typical_yield_kg_ha: 60000, season_days: 100 },
  cotton:     { name: 'Cotton',           base_temp_c: 15, gdd_maturity: 1600, water_need_mm: 700, typical_yield_kg_ha: 1500,  season_days: 160 },
  barley:     { name: 'Barley',           base_temp_c: 0,  gdd_maturity: 1500, water_need_mm: 400, typical_yield_kg_ha: 3000,  season_days: 120 },
  oat:        { name: 'Oat',              base_temp_c: 5,  gdd_maturity: 1400, water_need_mm: 400, typical_yield_kg_ha: 2500,  season_days: 110 },
  sorghum:    { name: 'Sorghum',          base_temp_c: 15, gdd_maturity: 1500, water_need_mm: 450, typical_yield_kg_ha: 4000,  season_days: 120 },
  sugarcane:  { name: 'Sugarcane',        base_temp_c: 15, gdd_maturity: 4000, water_need_mm: 1500, typical_yield_kg_ha: 70000, season_days: 365 },
  sunflower:  { name: 'Sunflower',        base_temp_c: 8,  gdd_maturity: 1400, water_need_mm: 500, typical_yield_kg_ha: 1700,  season_days: 120 },
  canola:     { name: 'Canola (Rapeseed)',base_temp_c: 5,  gdd_maturity: 1100, water_need_mm: 400, typical_yield_kg_ha: 2000,  season_days: 110 },
  peanut:     { name: 'Peanut',           base_temp_c: 13, gdd_maturity: 1500, water_need_mm: 500, typical_yield_kg_ha: 3000,  season_days: 140 },
  cassava:    { name: 'Cassava',          base_temp_c: 15, gdd_maturity: 3500, water_need_mm: 1000, typical_yield_kg_ha: 12000, season_days: 300 },
  millet:     { name: 'Millet',           base_temp_c: 10, gdd_maturity: 1200, water_need_mm: 350, typical_yield_kg_ha: 1000,  season_days: 90 },
  chickpea:   { name: 'Chickpea',         base_temp_c: 5,  gdd_maturity: 1100, water_need_mm: 350, typical_yield_kg_ha: 1000,  season_days: 100 },
  lentil:     { name: 'Lentil',           base_temp_c: 5,  gdd_maturity: 1000, water_need_mm: 300, typical_yield_kg_ha: 1100,  season_days: 100 },
  alfalfa:    { name: 'Alfalfa',          base_temp_c: 5,  gdd_maturity: 2000, water_need_mm: 800, typical_yield_kg_ha: 8000,  season_days: 180 },
  tobacco:    { name: 'Tobacco',          base_temp_c: 13, gdd_maturity: 1300, water_need_mm: 500, typical_yield_kg_ha: 2500,  season_days: 120 },
}

// ─────────────────────────────────────────────────────────────────────────────
// EMBEDDED DATA: FOOD COMPOSITION (~100 common foods)
// Per 100g: kcal, protein_g, fat_g, carbs_g, fiber_g, vit_c_mg, calcium_mg, iron_mg
// ─────────────────────────────────────────────────────────────────────────────

interface FoodEntry {
  name: string
  kcal: number
  protein: number
  fat: number
  carbs: number
  fiber: number
  vit_c: number
  calcium: number
  iron: number
  potassium: number
  vit_a_mcg: number
}

const FOOD_DB: Record<string, FoodEntry> = {
  'apple':              { name: 'Apple, raw',             kcal: 52,  protein: 0.3, fat: 0.2, carbs: 13.8, fiber: 2.4, vit_c: 4.6, calcium: 6, iron: 0.1, potassium: 107, vit_a_mcg: 3 },
  'banana':             { name: 'Banana, raw',            kcal: 89,  protein: 1.1, fat: 0.3, carbs: 22.8, fiber: 2.6, vit_c: 8.7, calcium: 5, iron: 0.3, potassium: 358, vit_a_mcg: 3 },
  'orange':             { name: 'Orange, raw',            kcal: 47,  protein: 0.9, fat: 0.1, carbs: 11.8, fiber: 2.4, vit_c: 53.2, calcium: 40, iron: 0.1, potassium: 181, vit_a_mcg: 11 },
  'strawberry':         { name: 'Strawberry, raw',        kcal: 32,  protein: 0.7, fat: 0.3, carbs: 7.7, fiber: 2.0, vit_c: 58.8, calcium: 16, iron: 0.4, potassium: 153, vit_a_mcg: 1 },
  'blueberry':          { name: 'Blueberry, raw',         kcal: 57,  protein: 0.7, fat: 0.3, carbs: 14.5, fiber: 2.4, vit_c: 9.7, calcium: 6, iron: 0.3, potassium: 77, vit_a_mcg: 3 },
  'grape':              { name: 'Grape, raw',             kcal: 69,  protein: 0.7, fat: 0.2, carbs: 18.1, fiber: 0.9, vit_c: 3.2, calcium: 10, iron: 0.4, potassium: 191, vit_a_mcg: 3 },
  'watermelon':         { name: 'Watermelon, raw',        kcal: 30,  protein: 0.6, fat: 0.2, carbs: 7.6, fiber: 0.4, vit_c: 8.1, calcium: 7, iron: 0.2, potassium: 112, vit_a_mcg: 28 },
  'avocado':            { name: 'Avocado, raw',           kcal: 160, protein: 2.0, fat: 14.7, carbs: 8.5, fiber: 6.7, vit_c: 10.0, calcium: 12, iron: 0.6, potassium: 485, vit_a_mcg: 7 },
  'mango':              { name: 'Mango, raw',             kcal: 60,  protein: 0.8, fat: 0.4, carbs: 15.0, fiber: 1.6, vit_c: 36.4, calcium: 11, iron: 0.2, potassium: 168, vit_a_mcg: 54 },
  'pineapple':          { name: 'Pineapple, raw',         kcal: 50,  protein: 0.5, fat: 0.1, carbs: 13.1, fiber: 1.4, vit_c: 47.8, calcium: 13, iron: 0.3, potassium: 109, vit_a_mcg: 3 },
  'broccoli':           { name: 'Broccoli, raw',          kcal: 34,  protein: 2.8, fat: 0.4, carbs: 6.6, fiber: 2.6, vit_c: 89.2, calcium: 47, iron: 0.7, potassium: 316, vit_a_mcg: 31 },
  'carrot':             { name: 'Carrot, raw',            kcal: 41,  protein: 0.9, fat: 0.2, carbs: 9.6, fiber: 2.8, vit_c: 5.9, calcium: 33, iron: 0.3, potassium: 320, vit_a_mcg: 835 },
  'spinach':            { name: 'Spinach, raw',           kcal: 23,  protein: 2.9, fat: 0.4, carbs: 3.6, fiber: 2.2, vit_c: 28.1, calcium: 99, iron: 2.7, potassium: 558, vit_a_mcg: 469 },
  'kale':               { name: 'Kale, raw',              kcal: 49,  protein: 4.3, fat: 0.9, carbs: 8.8, fiber: 3.6, vit_c: 120, calcium: 150, iron: 1.5, potassium: 491, vit_a_mcg: 500 },
  'sweet potato':       { name: 'Sweet Potato, raw',      kcal: 86,  protein: 1.6, fat: 0.1, carbs: 20.1, fiber: 3.0, vit_c: 2.4, calcium: 30, iron: 0.6, potassium: 337, vit_a_mcg: 709 },
  'potato':             { name: 'Potato, raw',            kcal: 77,  protein: 2.0, fat: 0.1, carbs: 17.5, fiber: 2.2, vit_c: 19.7, calcium: 12, iron: 0.8, potassium: 421, vit_a_mcg: 0 },
  'tomato':             { name: 'Tomato, raw',            kcal: 18,  protein: 0.9, fat: 0.2, carbs: 3.9, fiber: 1.2, vit_c: 13.7, calcium: 10, iron: 0.3, potassium: 237, vit_a_mcg: 42 },
  'onion':              { name: 'Onion, raw',             kcal: 40,  protein: 1.1, fat: 0.1, carbs: 9.3, fiber: 1.7, vit_c: 7.4, calcium: 23, iron: 0.2, potassium: 146, vit_a_mcg: 0 },
  'garlic':             { name: 'Garlic, raw',            kcal: 149, protein: 6.4, fat: 0.5, carbs: 33.1, fiber: 2.1, vit_c: 31.2, calcium: 181, iron: 1.7, potassium: 401, vit_a_mcg: 0 },
  'bell pepper':        { name: 'Bell Pepper, raw',       kcal: 26,  protein: 1.0, fat: 0.3, carbs: 6.0, fiber: 2.1, vit_c: 127.7, calcium: 7, iron: 0.4, potassium: 211, vit_a_mcg: 18 },
  'cucumber':           { name: 'Cucumber, raw',          kcal: 15,  protein: 0.7, fat: 0.1, carbs: 3.6, fiber: 0.5, vit_c: 2.8, calcium: 16, iron: 0.3, potassium: 147, vit_a_mcg: 5 },
  'lettuce':            { name: 'Lettuce, raw',           kcal: 15,  protein: 1.4, fat: 0.2, carbs: 2.9, fiber: 1.3, vit_c: 9.2, calcium: 36, iron: 0.9, potassium: 194, vit_a_mcg: 370 },
  'celery':             { name: 'Celery, raw',            kcal: 16,  protein: 0.7, fat: 0.2, carbs: 3.0, fiber: 1.6, vit_c: 3.1, calcium: 40, iron: 0.2, potassium: 260, vit_a_mcg: 22 },
  'cabbage':            { name: 'Cabbage, raw',           kcal: 25,  protein: 1.3, fat: 0.1, carbs: 5.8, fiber: 2.5, vit_c: 36.6, calcium: 40, iron: 0.5, potassium: 170, vit_a_mcg: 5 },
  'cauliflower':        { name: 'Cauliflower, raw',       kcal: 25,  protein: 1.9, fat: 0.3, carbs: 5.0, fiber: 2.0, vit_c: 48.2, calcium: 22, iron: 0.4, potassium: 299, vit_a_mcg: 0 },
  'mushroom':           { name: 'Mushroom, white, raw',   kcal: 22,  protein: 3.1, fat: 0.3, carbs: 3.3, fiber: 1.0, vit_c: 2.1, calcium: 3, iron: 0.5, potassium: 318, vit_a_mcg: 0 },
  'corn':               { name: 'Sweet Corn, raw',        kcal: 86,  protein: 3.3, fat: 1.4, carbs: 18.7, fiber: 2.0, vit_c: 6.8, calcium: 2, iron: 0.5, potassium: 270, vit_a_mcg: 9 },
  'peas':               { name: 'Green Peas, raw',        kcal: 81,  protein: 5.4, fat: 0.4, carbs: 14.5, fiber: 5.7, vit_c: 40.0, calcium: 25, iron: 1.5, potassium: 244, vit_a_mcg: 38 },
  'asparagus':          { name: 'Asparagus, raw',         kcal: 20,  protein: 2.2, fat: 0.1, carbs: 3.9, fiber: 2.1, vit_c: 5.6, calcium: 24, iron: 2.1, potassium: 202, vit_a_mcg: 38 },
  'zucchini':           { name: 'Zucchini, raw',          kcal: 17,  protein: 1.2, fat: 0.3, carbs: 3.1, fiber: 1.0, vit_c: 17.9, calcium: 16, iron: 0.4, potassium: 261, vit_a_mcg: 10 },
  'chicken breast':     { name: 'Chicken Breast, cooked', kcal: 165, protein: 31.0, fat: 3.6, carbs: 0.0, fiber: 0.0, vit_c: 0.0, calcium: 15, iron: 1.0, potassium: 256, vit_a_mcg: 6 },
  'chicken thigh':      { name: 'Chicken Thigh, cooked',  kcal: 209, protein: 26.0, fat: 10.9, carbs: 0.0, fiber: 0.0, vit_c: 0.0, calcium: 12, iron: 1.3, potassium: 222, vit_a_mcg: 17 },
  'beef steak':         { name: 'Beef Steak, cooked',     kcal: 271, protein: 26.1, fat: 17.4, carbs: 0.0, fiber: 0.0, vit_c: 0.0, calcium: 18, iron: 2.6, potassium: 315, vit_a_mcg: 0 },
  'ground beef':        { name: 'Ground Beef, 80/20',     kcal: 254, protein: 17.2, fat: 20.0, carbs: 0.0, fiber: 0.0, vit_c: 0.0, calcium: 18, iron: 2.2, potassium: 270, vit_a_mcg: 0 },
  'pork chop':          { name: 'Pork Chop, cooked',      kcal: 231, protein: 25.7, fat: 13.2, carbs: 0.0, fiber: 0.0, vit_c: 0.6, calcium: 19, iron: 0.7, potassium: 362, vit_a_mcg: 2 },
  'bacon':              { name: 'Bacon, cooked',          kcal: 541, protein: 37.0, fat: 42.0, carbs: 1.4, fiber: 0.0, vit_c: 0.0, calcium: 11, iron: 1.1, potassium: 565, vit_a_mcg: 0 },
  'salmon':             { name: 'Salmon, cooked',         kcal: 208, protein: 20.4, fat: 13.4, carbs: 0.0, fiber: 0.0, vit_c: 0.0, calcium: 12, iron: 0.3, potassium: 363, vit_a_mcg: 50 },
  'tuna':               { name: 'Tuna, canned',           kcal: 132, protein: 28.2, fat: 1.3, carbs: 0.0, fiber: 0.0, vit_c: 0.0, calcium: 11, iron: 1.0, potassium: 237, vit_a_mcg: 20 },
  'shrimp':             { name: 'Shrimp, cooked',         kcal: 99,  protein: 24.0, fat: 0.3, carbs: 0.2, fiber: 0.0, vit_c: 0.0, calcium: 70, iron: 0.5, potassium: 259, vit_a_mcg: 0 },
  'egg':                { name: 'Egg, whole, cooked',     kcal: 155, protein: 13.0, fat: 11.0, carbs: 1.1, fiber: 0.0, vit_c: 0.0, calcium: 56, iron: 1.8, potassium: 126, vit_a_mcg: 160 },
  'egg white':          { name: 'Egg White',              kcal: 52,  protein: 10.9, fat: 0.2, carbs: 0.7, fiber: 0.0, vit_c: 0.0, calcium: 7, iron: 0.1, potassium: 163, vit_a_mcg: 0 },
  'milk':               { name: 'Milk, whole',            kcal: 61,  protein: 3.2, fat: 3.3, carbs: 4.8, fiber: 0.0, vit_c: 0.0, calcium: 113, iron: 0.0, potassium: 132, vit_a_mcg: 46 },
  'skim milk':          { name: 'Milk, skim',             kcal: 34,  protein: 3.4, fat: 0.1, carbs: 5.0, fiber: 0.0, vit_c: 0.0, calcium: 122, iron: 0.0, potassium: 156, vit_a_mcg: 0 },
  'yogurt':             { name: 'Yogurt, plain',          kcal: 61,  protein: 3.5, fat: 3.3, carbs: 4.7, fiber: 0.0, vit_c: 0.5, calcium: 121, iron: 0.1, potassium: 155, vit_a_mcg: 27 },
  'greek yogurt':       { name: 'Greek Yogurt, plain',    kcal: 97,  protein: 9.0, fat: 5.0, carbs: 3.6, fiber: 0.0, vit_c: 0.0, calcium: 100, iron: 0.1, potassium: 141, vit_a_mcg: 23 },
  'cheddar':            { name: 'Cheddar Cheese',         kcal: 403, protein: 24.9, fat: 33.1, carbs: 1.3, fiber: 0.0, vit_c: 0.0, calcium: 721, iron: 0.7, potassium: 98, vit_a_mcg: 265 },
  'mozzarella':         { name: 'Mozzarella Cheese',      kcal: 280, protein: 27.5, fat: 17.1, carbs: 3.1, fiber: 0.0, vit_c: 0.0, calcium: 505, iron: 0.4, potassium: 76, vit_a_mcg: 174 },
  'butter':             { name: 'Butter',                 kcal: 717, protein: 0.9, fat: 81.1, carbs: 0.1, fiber: 0.0, vit_c: 0.0, calcium: 24, iron: 0.0, potassium: 24, vit_a_mcg: 684 },
  'olive oil':          { name: 'Olive Oil',              kcal: 884, protein: 0.0, fat: 100.0, carbs: 0.0, fiber: 0.0, vit_c: 0.0, calcium: 1, iron: 0.6, potassium: 1, vit_a_mcg: 0 },
  'white rice':         { name: 'White Rice, cooked',     kcal: 130, protein: 2.7, fat: 0.3, carbs: 28.2, fiber: 0.4, vit_c: 0.0, calcium: 10, iron: 0.2, potassium: 35, vit_a_mcg: 0 },
  'brown rice':         { name: 'Brown Rice, cooked',     kcal: 112, protein: 2.6, fat: 0.9, carbs: 23.5, fiber: 1.8, vit_c: 0.0, calcium: 10, iron: 0.4, potassium: 43, vit_a_mcg: 0 },
  'pasta':              { name: 'Pasta, cooked',          kcal: 131, protein: 5.0, fat: 1.1, carbs: 25.4, fiber: 1.8, vit_c: 0.0, calcium: 7, iron: 1.3, potassium: 44, vit_a_mcg: 0 },
  'bread white':        { name: 'Bread, white',           kcal: 265, protein: 9.0, fat: 3.2, carbs: 49.0, fiber: 2.7, vit_c: 0.0, calcium: 151, iron: 3.6, potassium: 100, vit_a_mcg: 0 },
  'bread whole wheat':  { name: 'Bread, whole wheat',     kcal: 247, protein: 13.0, fat: 3.4, carbs: 41.3, fiber: 6.8, vit_c: 0.0, calcium: 107, iron: 2.5, potassium: 254, vit_a_mcg: 0 },
  'oatmeal':            { name: 'Oatmeal, cooked',        kcal: 68,  protein: 2.4, fat: 1.4, carbs: 12.0, fiber: 1.7, vit_c: 0.0, calcium: 9, iron: 1.2, potassium: 61, vit_a_mcg: 0 },
  'quinoa':             { name: 'Quinoa, cooked',         kcal: 120, protein: 4.4, fat: 1.9, carbs: 21.3, fiber: 2.8, vit_c: 0.0, calcium: 17, iron: 1.5, potassium: 172, vit_a_mcg: 0 },
  'lentils':            { name: 'Lentils, cooked',        kcal: 116, protein: 9.0, fat: 0.4, carbs: 20.1, fiber: 7.9, vit_c: 1.5, calcium: 19, iron: 3.3, potassium: 369, vit_a_mcg: 0 },
  'black beans':        { name: 'Black Beans, cooked',    kcal: 132, protein: 8.9, fat: 0.5, carbs: 23.7, fiber: 8.7, vit_c: 0.0, calcium: 27, iron: 2.1, potassium: 355, vit_a_mcg: 0 },
  'chickpeas':          { name: 'Chickpeas, cooked',      kcal: 164, protein: 8.9, fat: 2.6, carbs: 27.4, fiber: 7.6, vit_c: 1.3, calcium: 49, iron: 2.9, potassium: 291, vit_a_mcg: 1 },
  'tofu':               { name: 'Tofu, firm',             kcal: 76,  protein: 8.2, fat: 4.8, carbs: 1.9, fiber: 0.3, vit_c: 0.1, calcium: 350, iron: 5.4, potassium: 121, vit_a_mcg: 0 },
  'almonds':            { name: 'Almonds',                kcal: 579, protein: 21.2, fat: 49.9, carbs: 21.6, fiber: 12.5, vit_c: 0.0, calcium: 269, iron: 3.7, potassium: 733, vit_a_mcg: 0 },
  'walnuts':            { name: 'Walnuts',                kcal: 654, protein: 15.2, fat: 65.2, carbs: 13.7, fiber: 6.7, vit_c: 1.3, calcium: 98, iron: 2.9, potassium: 441, vit_a_mcg: 1 },
  'peanuts':            { name: 'Peanuts',                kcal: 567, protein: 25.8, fat: 49.2, carbs: 16.1, fiber: 8.5, vit_c: 0.0, calcium: 92, iron: 4.6, potassium: 705, vit_a_mcg: 0 },
  'peanut butter':      { name: 'Peanut Butter',          kcal: 588, protein: 25.1, fat: 50.4, carbs: 20.0, fiber: 6.0, vit_c: 0.0, calcium: 43, iron: 1.7, potassium: 649, vit_a_mcg: 0 },
  'chia seeds':         { name: 'Chia Seeds',             kcal: 486, protein: 16.5, fat: 30.7, carbs: 42.1, fiber: 34.4, vit_c: 1.6, calcium: 631, iron: 7.7, potassium: 407, vit_a_mcg: 0 },
  'flax seeds':         { name: 'Flax Seeds',             kcal: 534, protein: 18.3, fat: 42.2, carbs: 28.9, fiber: 27.3, vit_c: 0.6, calcium: 255, iron: 5.7, potassium: 813, vit_a_mcg: 0 },
  'dark chocolate':     { name: 'Dark Chocolate (70%)',   kcal: 598, protein: 7.8, fat: 42.6, carbs: 45.9, fiber: 10.9, vit_c: 0.0, calcium: 73, iron: 11.9, potassium: 715, vit_a_mcg: 2 },
  'honey':              { name: 'Honey',                  kcal: 304, protein: 0.3, fat: 0.0, carbs: 82.4, fiber: 0.2, vit_c: 0.5, calcium: 6, iron: 0.4, potassium: 52, vit_a_mcg: 0 },
  'sugar':              { name: 'Sugar, white',           kcal: 387, protein: 0.0, fat: 0.0, carbs: 100, fiber: 0.0, vit_c: 0.0, calcium: 1, iron: 0.0, potassium: 2, vit_a_mcg: 0 },
  'coconut oil':        { name: 'Coconut Oil',            kcal: 862, protein: 0.0, fat: 100.0, carbs: 0.0, fiber: 0.0, vit_c: 0.0, calcium: 0, iron: 0.0, potassium: 0, vit_a_mcg: 0 },
  'coconut':            { name: 'Coconut Meat, raw',      kcal: 354, protein: 3.3, fat: 33.5, carbs: 15.2, fiber: 9.0, vit_c: 3.3, calcium: 14, iron: 2.4, potassium: 356, vit_a_mcg: 0 },
  'white flour':        { name: 'White Flour',            kcal: 364, protein: 10.3, fat: 1.0, carbs: 76.3, fiber: 2.7, vit_c: 0.0, calcium: 15, iron: 4.6, potassium: 107, vit_a_mcg: 0 },
  'whole wheat flour':  { name: 'Whole Wheat Flour',      kcal: 340, protein: 13.2, fat: 2.5, carbs: 71.9, fiber: 10.7, vit_c: 0.0, calcium: 34, iron: 3.6, potassium: 363, vit_a_mcg: 0 },
  'soy milk':           { name: 'Soy Milk',              kcal: 33,  protein: 2.8, fat: 1.6, carbs: 1.8, fiber: 0.4, vit_c: 0.0, calcium: 25, iron: 0.6, potassium: 118, vit_a_mcg: 0 },
  'almond milk':        { name: 'Almond Milk, unsweetened', kcal: 15, protein: 0.6, fat: 1.1, carbs: 0.6, fiber: 0.2, vit_c: 0.0, calcium: 184, iron: 0.3, potassium: 67, vit_a_mcg: 0 },
  'tempeh':             { name: 'Tempeh',                 kcal: 192, protein: 20.3, fat: 10.8, carbs: 7.6, fiber: 0.0, vit_c: 0.0, calcium: 111, iron: 2.7, potassium: 412, vit_a_mcg: 0 },
  'edamame':            { name: 'Edamame',                kcal: 121, protein: 11.9, fat: 5.2, carbs: 8.9, fiber: 5.2, vit_c: 6.1, calcium: 63, iron: 2.3, potassium: 436, vit_a_mcg: 0 },
  'seaweed':            { name: 'Seaweed, nori, dried',   kcal: 35,  protein: 5.8, fat: 0.3, carbs: 5.1, fiber: 0.3, vit_c: 0.0, calcium: 70, iron: 1.8, potassium: 356, vit_a_mcg: 260 },
  'hummus':             { name: 'Hummus',                 kcal: 166, protein: 7.9, fat: 9.6, carbs: 14.3, fiber: 6.0, vit_c: 0.0, calcium: 38, iron: 2.4, potassium: 228, vit_a_mcg: 1 },
  'cottage cheese':     { name: 'Cottage Cheese',         kcal: 98,  protein: 11.1, fat: 4.3, carbs: 3.4, fiber: 0.0, vit_c: 0.0, calcium: 83, iron: 0.1, potassium: 104, vit_a_mcg: 37 },
  'cream cheese':       { name: 'Cream Cheese',           kcal: 342, protein: 5.9, fat: 34.2, carbs: 4.1, fiber: 0.0, vit_c: 0.0, calcium: 98, iron: 0.4, potassium: 138, vit_a_mcg: 362 },
  'ham':                { name: 'Ham, cooked',            kcal: 145, protein: 21.0, fat: 5.5, carbs: 1.5, fiber: 0.0, vit_c: 0.0, calcium: 7, iron: 0.9, potassium: 287, vit_a_mcg: 0 },
  'turkey':             { name: 'Turkey Breast, cooked',  kcal: 135, protein: 30.0, fat: 1.0, carbs: 0.0, fiber: 0.0, vit_c: 0.0, calcium: 10, iron: 1.4, potassium: 249, vit_a_mcg: 0 },
  'lamb':               { name: 'Lamb, cooked',           kcal: 294, protein: 25.5, fat: 20.9, carbs: 0.0, fiber: 0.0, vit_c: 0.0, calcium: 17, iron: 1.9, potassium: 310, vit_a_mcg: 0 },
  'sardines':           { name: 'Sardines, canned',       kcal: 208, protein: 24.6, fat: 11.5, carbs: 0.0, fiber: 0.0, vit_c: 0.0, calcium: 382, iron: 2.9, potassium: 397, vit_a_mcg: 32 },
  'cod':                { name: 'Cod, cooked',            kcal: 82,  protein: 17.8, fat: 0.7, carbs: 0.0, fiber: 0.0, vit_c: 0.0, calcium: 18, iron: 0.4, potassium: 244, vit_a_mcg: 12 },
  'tilapia':            { name: 'Tilapia, cooked',        kcal: 128, protein: 26.2, fat: 2.7, carbs: 0.0, fiber: 0.0, vit_c: 0.0, calcium: 14, iron: 0.7, potassium: 380, vit_a_mcg: 0 },
  'lobster':            { name: 'Lobster, cooked',        kcal: 89,  protein: 19.0, fat: 0.9, carbs: 0.0, fiber: 0.0, vit_c: 0.0, calcium: 96, iron: 0.3, potassium: 230, vit_a_mcg: 2 },
  'rice cake':          { name: 'Rice Cake',              kcal: 387, protein: 8.0, fat: 2.8, carbs: 81.1, fiber: 3.4, vit_c: 0.0, calcium: 5, iron: 0.7, potassium: 101, vit_a_mcg: 0 },
  'granola':            { name: 'Granola',                kcal: 489, protein: 14.5, fat: 24.4, carbs: 53.7, fiber: 5.0, vit_c: 0.0, calcium: 76, iron: 4.1, potassium: 539, vit_a_mcg: 0 },
  'tortilla':           { name: 'Tortilla, flour',        kcal: 312, protein: 8.0, fat: 8.4, carbs: 50.6, fiber: 3.1, vit_c: 0.0, calcium: 128, iron: 3.1, potassium: 128, vit_a_mcg: 0 },
  'sausage':            { name: 'Sausage, pork, cooked',  kcal: 339, protein: 19.4, fat: 28.4, carbs: 0.0, fiber: 0.0, vit_c: 0.6, calcium: 13, iron: 1.2, potassium: 246, vit_a_mcg: 0 },
  'hot dog':            { name: 'Hot Dog, beef',          kcal: 290, protein: 10.3, fat: 26.1, carbs: 2.1, fiber: 0.0, vit_c: 0.0, calcium: 14, iron: 1.5, potassium: 152, vit_a_mcg: 0 },
  'ice cream':          { name: 'Ice Cream, vanilla',     kcal: 207, protein: 3.5, fat: 11.0, carbs: 23.6, fiber: 0.7, vit_c: 0.6, calcium: 128, iron: 0.1, potassium: 199, vit_a_mcg: 118 },
  'pizza':              { name: 'Pizza, cheese',          kcal: 266, protein: 11.4, fat: 10.4, carbs: 33.6, fiber: 2.3, vit_c: 1.0, calcium: 201, iron: 2.4, potassium: 172, vit_a_mcg: 74 },
  'french fries':       { name: 'French Fries',           kcal: 312, protein: 3.4, fat: 14.7, carbs: 41.4, fiber: 3.8, vit_c: 4.7, calcium: 18, iron: 0.8, potassium: 579, vit_a_mcg: 0 },
  'popcorn':            { name: 'Popcorn, air-popped',    kcal: 387, protein: 12.9, fat: 4.5, carbs: 77.9, fiber: 14.5, vit_c: 0.0, calcium: 7, iron: 3.2, potassium: 329, vit_a_mcg: 3 },
}

// ─────────────────────────────────────────────────────────────────────────────
// EMBEDDED DATA: DRI (Dietary Reference Intakes) — adult male/female averages
// ─────────────────────────────────────────────────────────────────────────────

interface DRI {
  nutrient: string
  unit: string
  rda: number
}

const DRI_TABLE: DRI[] = [
  { nutrient: 'Calories',    unit: 'kcal', rda: 2000 },
  { nutrient: 'Protein',     unit: 'g',    rda: 50 },
  { nutrient: 'Fat',         unit: 'g',    rda: 65 },
  { nutrient: 'Carbohydrates', unit: 'g',  rda: 300 },
  { nutrient: 'Fiber',       unit: 'g',    rda: 25 },
  { nutrient: 'Vitamin C',   unit: 'mg',   rda: 90 },
  { nutrient: 'Calcium',     unit: 'mg',   rda: 1000 },
  { nutrient: 'Iron',        unit: 'mg',   rda: 18 },
  { nutrient: 'Potassium',   unit: 'mg',   rda: 2600 },
  { nutrient: 'Vitamin A',   unit: 'mcg',  rda: 900 },
]

// ─────────────────────────────────────────────────────────────────────────────
// EMBEDDED DATA: WHO GHO Indicator Codes
// ─────────────────────────────────────────────────────────────────────────────

const WHO_INDICATORS: Record<string, { code: string; label: string; unit: string }> = {
  life_expectancy:    { code: 'WHOSIS_000001', label: 'Life expectancy at birth (years)',       unit: 'years' },
  infant_mortality:   { code: 'MDG_0000000001', label: 'Infant mortality rate (per 1000 live births)', unit: 'per 1000' },
  health_expenditure: { code: 'GHED_CHE_pc_PPP_SHA2011', label: 'Current health expenditure per capita (PPP)', unit: 'PPP int. $' },
  immunization:       { code: 'WHS4_100',      label: 'DTP3 immunization coverage (%)',         unit: '%' },
  physician_density:  { code: 'HWF_0001',      label: 'Physicians (per 10,000 population)',     unit: 'per 10k' },
}

// Common country name -> ISO3 mapping for convenience
const COUNTRY_ISO: Record<string, string> = {
  'united states': 'USA', 'us': 'USA', 'usa': 'USA',
  'united kingdom': 'GBR', 'uk': 'GBR', 'gbr': 'GBR',
  'canada': 'CAN', 'mexico': 'MEX', 'brazil': 'BRA',
  'germany': 'DEU', 'france': 'FRA', 'italy': 'ITA', 'spain': 'ESP',
  'japan': 'JPN', 'china': 'CHN', 'india': 'IND', 'australia': 'AUS',
  'south korea': 'KOR', 'korea': 'KOR', 'russia': 'RUS',
  'nigeria': 'NGA', 'south africa': 'ZAF', 'egypt': 'EGY', 'kenya': 'KEN',
  'argentina': 'ARG', 'colombia': 'COL', 'chile': 'CHL', 'peru': 'PER',
  'thailand': 'THA', 'indonesia': 'IDN', 'philippines': 'PHL', 'vietnam': 'VNM',
  'pakistan': 'PAK', 'bangladesh': 'BGD', 'iran': 'IRN', 'iraq': 'IRQ',
  'turkey': 'TUR', 'saudi arabia': 'SAU', 'israel': 'ISR',
  'sweden': 'SWE', 'norway': 'NOR', 'denmark': 'DNK', 'finland': 'FIN',
  'netherlands': 'NLD', 'belgium': 'BEL', 'switzerland': 'CHE', 'austria': 'AUT',
  'portugal': 'PRT', 'poland': 'POL', 'czech republic': 'CZE', 'czechia': 'CZE',
  'ireland': 'IRL', 'greece': 'GRC', 'romania': 'ROU', 'hungary': 'HUN',
  'new zealand': 'NZL', 'singapore': 'SGP', 'malaysia': 'MYS',
  'ghana': 'GHA', 'ethiopia': 'ETH', 'tanzania': 'TZA', 'uganda': 'UGA',
  'dr congo': 'COD', 'morocco': 'MAR', 'algeria': 'DZA', 'tunisia': 'TUN',
  'cuba': 'CUB', 'jamaica': 'JAM', 'haiti': 'HTI',
  'nepal': 'NPL', 'sri lanka': 'LKA', 'myanmar': 'MMR', 'cambodia': 'KHM',
}

function resolveCountryCode(input: string): string {
  const lower = input.trim().toLowerCase()
  if (COUNTRY_ISO[lower]) return COUNTRY_ISO[lower]
  // If already an ISO3 code
  if (input.length === 3 && input === input.toUpperCase()) return input
  // Try partial match
  for (const [name, code] of Object.entries(COUNTRY_ISO)) {
    if (name.includes(lower) || lower.includes(name)) return code
  }
  return input.toUpperCase()
}

// ═════════════════════════════════════════════════════════════════════════════
// REGISTRATION
// ═════════════════════════════════════════════════════════════════════════════

export function registerLabHealthTools(): void {

  // ════════════════════════════════════════════════════════════════════════════
  // 1. SIR MODEL — Compartmental epidemic models
  // ════════════════════════════════════════════════════════════════════════════

  registerTool({
    name: 'sir_model',
    description: 'Simulate epidemiological compartmental models (SIR, SEIR, SEIRS, SIS) with Euler method integration. Supports time-varying interventions (lockdowns, vaccines). Computes R0, herd immunity threshold, peak infection timing, total infected. Returns day-by-day compartment values for plotting.',
    parameters: {
      model:             { type: 'string', description: 'Model type: sir, seir, seirs, or sis', required: true },
      population:        { type: 'number', description: 'Total population N', required: true },
      initial_infected:  { type: 'number', description: 'Initial number of infected individuals', required: true },
      beta:              { type: 'number', description: 'Transmission rate (contacts per day * transmission probability)', required: true },
      gamma:             { type: 'number', description: 'Recovery rate (1/infectious period in days)', required: true },
      sigma:             { type: 'number', description: 'Incubation rate (1/latent period). Required for SEIR/SEIRS models.' },
      xi:                { type: 'number', description: 'Immunity loss rate (1/immunity duration). Required for SEIRS model.' },
      days:              { type: 'number', description: 'Simulation duration in days (default 180)' },
      interventions:     { type: 'string', description: 'JSON array of {day, beta_multiplier} to model lockdowns/vaccines' },
    },
    tier: 'free',
    async execute(args) {
      const modelType = String(args.model).toLowerCase()
      const N = Number(args.population)
      const I0 = Number(args.initial_infected)
      const beta0 = Number(args.beta)
      const gamma = Number(args.gamma)
      const sigma = args.sigma != null ? Number(args.sigma) : 0
      const xi = args.xi != null ? Number(args.xi) : 0
      const days = typeof args.days === 'number' ? args.days : 180
      const dt = 0.1 // Euler step size

      if (!['sir', 'seir', 'seirs', 'sis'].includes(modelType)) {
        return `**Error:** Unknown model "${modelType}". Choose sir, seir, seirs, or sis.`
      }
      if (N <= 0 || I0 <= 0 || beta0 <= 0 || gamma <= 0) {
        return '**Error:** population, initial_infected, beta, and gamma must be positive.'
      }
      if ((modelType === 'seir' || modelType === 'seirs') && sigma <= 0) {
        return `**Error:** sigma (incubation rate) is required for ${modelType.toUpperCase()} model.`
      }
      if (modelType === 'seirs' && xi <= 0) {
        return '**Error:** xi (immunity loss rate) is required for SEIRS model.'
      }

      // Parse interventions
      interface Intervention { day: number; beta_multiplier: number }
      let interventions: Intervention[] = []
      if (args.interventions) {
        interventions = safeParse<Intervention[]>(String(args.interventions), 'interventions')
        interventions.sort((a, b) => a.day - b.day)
      }

      // Get effective beta at a given day
      function getBeta(day: number): number {
        let b = beta0
        for (const iv of interventions) {
          if (day >= iv.day) {
            b = beta0 * iv.beta_multiplier
          }
        }
        return b
      }

      // State: [S, E, I, R]
      let S = N - I0
      let E = 0
      let I = I0
      let R = 0

      if (modelType === 'seir' || modelType === 'seirs') {
        // Start with some in exposed
        E = 0 // All initial cases start as infected
      }

      // Track day-by-day output
      interface DayRecord { day: number; S: number; E: number; I: number; R: number }
      const records: DayRecord[] = []
      let peakI = I
      let peakDay = 0
      let totalInfected = I0

      records.push({ day: 0, S: Math.round(S), E: Math.round(E), I: Math.round(I), R: Math.round(R) })

      const steps = Math.round(days / dt)
      for (let step = 1; step <= steps; step++) {
        const t = step * dt
        const beta = getBeta(t)

        let dS: number, dE: number, dI: number, dR: number

        if (modelType === 'sir') {
          const newInfections = beta * S * I / N
          dS = -newInfections
          dE = 0
          dI = newInfections - gamma * I
          dR = gamma * I
        } else if (modelType === 'sis') {
          const newInfections = beta * S * I / N
          dS = -newInfections + gamma * I
          dE = 0
          dI = newInfections - gamma * I
          dR = 0
        } else if (modelType === 'seir') {
          const newExposed = beta * S * I / N
          dS = -newExposed
          dE = newExposed - sigma * E
          dI = sigma * E - gamma * I
          dR = gamma * I
        } else {
          // SEIRS
          const newExposed = beta * S * I / N
          dS = -newExposed + xi * R
          dE = newExposed - sigma * E
          dI = sigma * E - gamma * I
          dR = gamma * I - xi * R
        }

        S += dS * dt
        E += dE * dt
        I += dI * dt
        R += dR * dt

        // Clamp to valid ranges
        S = Math.max(0, S)
        E = Math.max(0, E)
        I = Math.max(0, I)
        R = Math.max(0, R)

        // Track new infections for total count
        if (modelType === 'sir' || modelType === 'sis') {
          totalInfected += (beta * (S + dS * dt) * (I) / N) * dt // approximate
        } else {
          totalInfected += (beta * (S + dS * dt) * (I) / N) * dt
        }

        // Record integer days
        if (Math.abs(t - Math.round(t)) < dt / 2) {
          const day = Math.round(t)
          records.push({ day, S: Math.round(S), E: Math.round(E), I: Math.round(I), R: Math.round(R) })
          if (I > peakI) {
            peakI = I
            peakDay = day
          }
        }
      }

      // Compute key metrics
      const R0 = beta0 / gamma
      const herdImmunityThreshold = 1 - 1 / R0
      const finalS = records[records.length - 1].S
      const finalR = records[records.length - 1].R
      const totalInfectedFinal = N - finalS // More accurate

      // Build output
      const lines: string[] = []
      lines.push(`# ${modelType.toUpperCase()} Epidemic Model Simulation`)
      lines.push('')
      lines.push('## Parameters')
      lines.push(`| Parameter | Value |`)
      lines.push(`|-----------|-------|`)
      lines.push(`| Model | ${modelType.toUpperCase()} |`)
      lines.push(`| Population (N) | ${N.toLocaleString()} |`)
      lines.push(`| Initial Infected | ${I0.toLocaleString()} |`)
      lines.push(`| Beta (transmission) | ${beta0} |`)
      lines.push(`| Gamma (recovery) | ${gamma} |`)
      if (sigma > 0) lines.push(`| Sigma (incubation) | ${sigma} |`)
      if (xi > 0) lines.push(`| Xi (immunity loss) | ${xi} |`)
      lines.push(`| Duration | ${days} days |`)
      lines.push(`| Integration step | dt = ${dt} |`)
      lines.push('')

      if (interventions.length > 0) {
        lines.push('## Interventions')
        lines.push('| Day | Beta Multiplier | Effective Beta |')
        lines.push('|-----|----------------|----------------|')
        for (const iv of interventions) {
          lines.push(`| ${iv.day} | ${iv.beta_multiplier} | ${fmt(beta0 * iv.beta_multiplier)} |`)
        }
        lines.push('')
      }

      lines.push('## Key Metrics')
      lines.push(`| Metric | Value |`)
      lines.push(`|--------|-------|`)
      lines.push(`| R0 (basic reproduction number) | ${fmt(R0, 2)} |`)
      lines.push(`| Herd immunity threshold | ${pct(herdImmunityThreshold)} |`)
      lines.push(`| Peak infected | ${Math.round(peakI).toLocaleString()} (day ${peakDay}) |`)
      lines.push(`| Peak infected (% of N) | ${pct(peakI / N)} |`)
      lines.push(`| Total ever infected | ${Math.round(totalInfectedFinal).toLocaleString()} (${pct(totalInfectedFinal / N)}) |`)
      lines.push(`| Final susceptible | ${finalS.toLocaleString()} |`)
      lines.push(`| Final recovered/removed | ${finalR.toLocaleString()} |`)
      if (R0 > 1) {
        lines.push(`| Epidemic outcome | **Epidemic spreads** (R0 > 1) |`)
      } else {
        lines.push(`| Epidemic outcome | **Disease dies out** (R0 <= 1) |`)
      }
      lines.push('')

      // Output time series (sample every N days to keep output manageable)
      const sampleInterval = days <= 30 ? 1 : days <= 90 ? 3 : days <= 180 ? 7 : 14
      const hasE = modelType === 'seir' || modelType === 'seirs'
      lines.push('## Time Series')
      if (hasE) {
        lines.push('| Day | Susceptible | Exposed | Infected | Recovered |')
        lines.push('|-----|-------------|---------|----------|-----------|')
      } else {
        lines.push('| Day | Susceptible | Infected | Recovered |')
        lines.push('|-----|-------------|----------|-----------|')
      }
      for (const r of records) {
        if (r.day % sampleInterval === 0 || r.day === days) {
          if (hasE) {
            lines.push(`| ${r.day} | ${r.S.toLocaleString()} | ${r.E.toLocaleString()} | ${r.I.toLocaleString()} | ${r.R.toLocaleString()} |`)
          } else {
            lines.push(`| ${r.day} | ${r.S.toLocaleString()} | ${r.I.toLocaleString()} | ${r.R.toLocaleString()} |`)
          }
        }
      }

      return lines.join('\n')
    }
  })

  // ════════════════════════════════════════════════════════════════════════════
  // 2. EPIDEMIOLOGY CALC — Standard epidemiological measures
  // ════════════════════════════════════════════════════════════════════════════

  registerTool({
    name: 'epidemiology_calc',
    description: 'Calculate standard epidemiological measures: incidence rate, prevalence, mortality rate, case fatality rate, attack rate, relative risk, odds ratio, attributable risk, NNT/NNH, sensitivity/specificity/PPV/NPV from 2x2 tables.',
    parameters: {
      measure: { type: 'string', description: 'Measure to compute: incidence, prevalence, risk_ratio, odds_ratio, diagnostic, or all (computes all applicable)', required: true },
      data:    { type: 'string', description: 'JSON data. For incidence: {cases, person_years}. For prevalence: {cases, population}. For risk_ratio/odds_ratio/diagnostic/all: {a, b, c, d} (2x2 table: a=exposed+disease, b=exposed+no_disease, c=unexposed+disease, d=unexposed+no_disease)', required: true },
    },
    tier: 'free',
    async execute(args) {
      const measure = String(args.measure).toLowerCase()
      const data = safeParse<Record<string, number>>(String(args.data), 'data')

      const lines: string[] = []
      lines.push('# Epidemiological Calculator')
      lines.push('')

      if (measure === 'incidence' || measure === 'all') {
        if (data.cases != null && data.person_years != null) {
          const rate = data.cases / data.person_years
          lines.push('## Incidence Rate')
          lines.push(`- **Cases:** ${data.cases}`)
          lines.push(`- **Person-years:** ${data.person_years.toLocaleString()}`)
          lines.push(`- **Incidence rate:** ${fmt(rate, 6)} per person-year`)
          lines.push(`- **Per 1,000:** ${fmt(rate * 1000, 2)} per 1,000 person-years`)
          lines.push(`- **Per 100,000:** ${fmt(rate * 100000, 2)} per 100,000 person-years`)
          lines.push('')
        }
      }

      if (measure === 'prevalence' || measure === 'all') {
        if (data.cases != null && data.population != null) {
          const prev = data.cases / data.population
          lines.push('## Prevalence')
          lines.push(`- **Cases:** ${data.cases.toLocaleString()}`)
          lines.push(`- **Population:** ${data.population.toLocaleString()}`)
          lines.push(`- **Prevalence:** ${pct(prev)}`)
          lines.push(`- **Per 100,000:** ${fmt(prev * 100000, 2)}`)
          lines.push('')
        }
      }

      // 2x2 table measures
      if (data.a != null && data.b != null && data.c != null && data.d != null) {
        const a = data.a, b = data.b, c = data.c, d = data.d
        const n = a + b + c + d

        lines.push('## 2x2 Contingency Table')
        lines.push('|  | Disease+ | Disease- | Total |')
        lines.push('|--|----------|----------|-------|')
        lines.push(`| Exposed+ | ${a} | ${b} | ${a + b} |`)
        lines.push(`| Exposed- | ${c} | ${d} | ${c + d} |`)
        lines.push(`| Total | ${a + c} | ${b + d} | ${n} |`)
        lines.push('')

        if (measure === 'risk_ratio' || measure === 'all') {
          const riskExposed = a / (a + b)
          const riskUnexposed = c / (c + d)
          const rr = riskExposed / riskUnexposed
          const arisk = riskExposed - riskUnexposed
          const arp = arisk / riskExposed
          const par = ((a + c) / n - riskUnexposed) / ((a + c) / n)
          const nnt = 1 / Math.abs(arisk)

          // 95% CI for RR using log method
          const lnRR = Math.log(rr)
          const seRR = Math.sqrt(1 / a - 1 / (a + b) + 1 / c - 1 / (c + d))
          const rrLower = Math.exp(lnRR - 1.96 * seRR)
          const rrUpper = Math.exp(lnRR + 1.96 * seRR)

          lines.push('## Risk Ratio (Relative Risk)')
          lines.push(`- **Risk in exposed:** ${fmt(riskExposed, 4)} (${pct(riskExposed)})`)
          lines.push(`- **Risk in unexposed:** ${fmt(riskUnexposed, 4)} (${pct(riskUnexposed)})`)
          lines.push(`- **Relative Risk (RR):** ${fmt(rr, 4)}`)
          lines.push(`- **95% CI:** [${fmt(rrLower, 4)}, ${fmt(rrUpper, 4)}]`)
          lines.push(`- **Attributable Risk (AR):** ${fmt(arisk, 4)}`)
          lines.push(`- **AR% (in exposed):** ${pct(arp)}`)
          lines.push(`- **Population Attributable Fraction:** ${pct(par)}`)
          if (arisk > 0) {
            lines.push(`- **NNH (Number Needed to Harm):** ${fmt(nnt, 1)}`)
          } else {
            lines.push(`- **NNT (Number Needed to Treat):** ${fmt(nnt, 1)}`)
          }
          lines.push('')
        }

        if (measure === 'odds_ratio' || measure === 'all') {
          const or = (a * d) / (b * c)
          const lnOR = Math.log(or)
          const seOR = Math.sqrt(1 / a + 1 / b + 1 / c + 1 / d)
          const orLower = Math.exp(lnOR - 1.96 * seOR)
          const orUpper = Math.exp(lnOR + 1.96 * seOR)

          lines.push('## Odds Ratio')
          lines.push(`- **Odds in exposed:** ${fmt(a / b, 4)}`)
          lines.push(`- **Odds in unexposed:** ${fmt(c / d, 4)}`)
          lines.push(`- **Odds Ratio (OR):** ${fmt(or, 4)}`)
          lines.push(`- **95% CI:** [${fmt(orLower, 4)}, ${fmt(orUpper, 4)}]`)
          lines.push(`- **ln(OR):** ${fmt(lnOR, 4)} (SE: ${fmt(seOR, 4)})`)
          if (or > 1) {
            lines.push(`- **Interpretation:** Exposure is associated with **increased** odds of disease.`)
          } else if (or < 1) {
            lines.push(`- **Interpretation:** Exposure is associated with **decreased** odds of disease.`)
          } else {
            lines.push(`- **Interpretation:** No association between exposure and disease.`)
          }
          lines.push('')
        }

        if (measure === 'diagnostic' || measure === 'all') {
          // For diagnostic: a=TP, b=FP, c=FN, d=TN
          const tp = a, fp = b, fn = c, tn = d
          const sensitivity = tp / (tp + fn)
          const specificity = tn / (tn + fp)
          const ppv = tp / (tp + fp)
          const npv = tn / (tn + fn)
          const accuracy = (tp + tn) / n
          const prevalence = (tp + fn) / n
          const lrPos = sensitivity / (1 - specificity)
          const lrNeg = (1 - sensitivity) / specificity
          const youden = sensitivity + specificity - 1

          lines.push('## Diagnostic Test Performance')
          lines.push('|  | Disease+ | Disease- |')
          lines.push('|--|----------|----------|')
          lines.push(`| Test+ | TP=${tp} | FP=${fp} |`)
          lines.push(`| Test- | FN=${fn} | TN=${tn} |`)
          lines.push('')
          lines.push(`- **Sensitivity (recall):** ${pct(sensitivity)}`)
          lines.push(`- **Specificity:** ${pct(specificity)}`)
          lines.push(`- **PPV (precision):** ${pct(ppv)}`)
          lines.push(`- **NPV:** ${pct(npv)}`)
          lines.push(`- **Accuracy:** ${pct(accuracy)}`)
          lines.push(`- **Prevalence:** ${pct(prevalence)}`)
          lines.push(`- **LR+ (positive likelihood ratio):** ${fmt(lrPos, 2)}`)
          lines.push(`- **LR- (negative likelihood ratio):** ${fmt(lrNeg, 4)}`)
          lines.push(`- **Youden's J index:** ${fmt(youden, 4)}`)
          lines.push('')
        }

        // Attack rate & case fatality (always when 2x2 available and measure=all)
        if (measure === 'all') {
          const attackRate = (a + c) / n
          const cfr = data.deaths != null ? data.deaths / (a + c) : null
          lines.push('## Additional Measures')
          lines.push(`- **Attack rate:** ${pct(attackRate)}`)
          if (cfr != null) {
            lines.push(`- **Case fatality rate:** ${pct(cfr)}`)
          }
          lines.push('')
        }
      }

      if (lines.length <= 2) {
        return '**Error:** Insufficient data for the requested measure. Provide {cases, person_years} for incidence, {cases, population} for prevalence, or {a, b, c, d} for 2x2 table measures.'
      }

      return lines.join('\n')
    }
  })

  // ════════════════════════════════════════════════════════════════════════════
  // 3. HEALTH EQUITY — Disparity metrics
  // ════════════════════════════════════════════════════════════════════════════

  registerTool({
    name: 'health_equity',
    description: 'Calculate health equity and disparity metrics across population groups: rate ratio, rate difference, population attributable fraction, concentration index, slope index of inequality (SII), relative index of inequality (RII), and Theil index for health outcomes.',
    parameters: {
      groups:       { type: 'string', description: 'JSON array of {name, rate, population} for each group, ordered from most to least disadvantaged', required: true },
      outcome_name: { type: 'string', description: 'Name of the health outcome (e.g., "infant mortality")' },
    },
    tier: 'free',
    async execute(args) {
      interface Group { name: string; rate: number; population: number }
      const groups = safeParse<Group[]>(String(args.groups), 'groups')
      const outcomeName = args.outcome_name ? String(args.outcome_name) : 'Health outcome'

      if (groups.length < 2) return '**Error:** At least 2 groups required.'

      const totalPop = groups.reduce((s, g) => s + g.population, 0)
      const overallRate = groups.reduce((s, g) => s + g.rate * g.population, 0) / totalPop

      // Sort by rate for some metrics (keep original order for SII)
      const best = Math.min(...groups.map(g => g.rate))
      const worst = Math.max(...groups.map(g => g.rate))
      const bestGroup = groups.find(g => g.rate === best)!
      const worstGroup = groups.find(g => g.rate === worst)!

      // Rate ratio and rate difference
      const rateRatio = worst / best
      const rateDifference = worst - best

      // Population attributable fraction
      const paf = (overallRate - best) / overallRate

      // Concentration Index (based on cumulative population share)
      // Groups should be ordered from most to least disadvantaged
      let concentrationIndex = 0
      let cumulPop = 0
      for (const g of groups) {
        const popFrac = g.population / totalPop
        const midpoint = (cumulPop + cumulPop + popFrac) / 2
        concentrationIndex += popFrac * g.rate * midpoint
        cumulPop += popFrac
      }
      concentrationIndex = (2 / overallRate) * concentrationIndex - 1

      // Slope Index of Inequality (SII) — weighted linear regression of rate on cumulative pop rank
      // RII = SII / overall rate
      let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumW = 0
      let cumulPop2 = 0
      for (const g of groups) {
        const popFrac = g.population / totalPop
        const midpoint = cumulPop2 + popFrac / 2
        cumulPop2 += popFrac
        const w = g.population
        sumX += w * midpoint
        sumY += w * g.rate
        sumXY += w * midpoint * g.rate
        sumX2 += w * midpoint * midpoint
        sumW += w
      }
      const siiSlope = (sumW * sumXY - sumX * sumY) / (sumW * sumX2 - sumX * sumX)
      const sii = siiSlope // SII = slope (rate change from rank 0 to rank 1)
      const rii = sii / overallRate

      // Theil Index (entropy-based inequality)
      let theilIndex = 0
      for (const g of groups) {
        if (g.rate > 0 && overallRate > 0) {
          const ratio = g.rate / overallRate
          const popFrac = g.population / totalPop
          theilIndex += popFrac * ratio * Math.log(ratio)
        }
      }

      const lines: string[] = []
      lines.push(`# Health Equity Analysis: ${outcomeName}`)
      lines.push('')
      lines.push('## Group Data')
      lines.push('| Group | Rate | Population | Pop Share |')
      lines.push('|-------|------|------------|-----------|')
      for (const g of groups) {
        lines.push(`| ${g.name} | ${fmt(g.rate, 2)} | ${g.population.toLocaleString()} | ${pct(g.population / totalPop)} |`)
      }
      lines.push('')

      lines.push('## Summary Measures')
      lines.push(`| Metric | Value |`)
      lines.push(`|--------|-------|`)
      lines.push(`| Overall rate | ${fmt(overallRate, 2)} |`)
      lines.push(`| Best rate | ${fmt(best, 2)} (${bestGroup.name}) |`)
      lines.push(`| Worst rate | ${fmt(worst, 2)} (${worstGroup.name}) |`)
      lines.push('')

      lines.push('## Disparity Measures')
      lines.push(`| Measure | Value | Interpretation |`)
      lines.push(`|---------|-------|----------------|`)
      lines.push(`| Rate Ratio | ${fmt(rateRatio, 2)} | Worst group has ${fmt(rateRatio, 1)}x the rate of best |`)
      lines.push(`| Rate Difference | ${fmt(rateDifference, 2)} | Absolute gap between worst and best |`)
      lines.push(`| Population Attributable Fraction | ${pct(paf)} | Proportion of total burden attributable to inequity |`)
      lines.push(`| Concentration Index | ${fmt(concentrationIndex, 4)} | Range [-1,1]: 0 = perfect equality |`)
      lines.push(`| Slope Index of Inequality (SII) | ${fmt(sii, 2)} | Rate change from most to least disadvantaged |`)
      lines.push(`| Relative Index of Inequality (RII) | ${fmt(rii, 4)} | SII as proportion of overall rate |`)
      lines.push(`| Theil Index | ${fmt(theilIndex, 6)} | Entropy-based; 0 = perfect equality |`)
      lines.push('')

      // Interpretation
      lines.push('## Interpretation')
      if (Math.abs(concentrationIndex) < 0.1) {
        lines.push(`- Concentration Index near zero indicates **relatively equal** distribution of ${outcomeName}.`)
      } else if (concentrationIndex > 0) {
        lines.push(`- Positive Concentration Index indicates ${outcomeName} is **concentrated among the advantaged** groups.`)
      } else {
        lines.push(`- Negative Concentration Index indicates ${outcomeName} is **concentrated among the disadvantaged** groups.`)
      }
      if (rateRatio > 2) {
        lines.push(`- Rate ratio > 2 indicates **substantial disparity** between groups.`)
      }
      lines.push(`- If the best group's rate were achieved across all groups, ${pct(paf)} of the total burden would be eliminated.`)

      return lines.join('\n')
    }
  })

  // ════════════════════════════════════════════════════════════════════════════
  // 4. DISEASE SURVEILLANCE — Outbreak detection & time series analysis
  // ════════════════════════════════════════════════════════════════════════════

  registerTool({
    name: 'disease_surveillance',
    description: 'Analyze disease case time series: detect outbreaks using CUSUM or moving average exceedance, calculate doubling time, and generate epidemic curves. Supports daily or weekly case counts.',
    parameters: {
      cases:           { type: 'string', description: 'Comma-separated case counts (daily or weekly)', required: true },
      method:          { type: 'string', description: 'Analysis method: cusum, moving_average, doubling_time, or epidemic_curve', required: true },
      baseline_period: { type: 'number', description: 'Number of initial periods to use as baseline (default: first 1/3 of data)' },
      threshold:       { type: 'number', description: 'Alert threshold — for CUSUM: k standard deviations (default 2), for moving_average: multiplier above mean (default 1.5)' },
    },
    tier: 'free',
    async execute(args) {
      const caseStr = String(args.cases).trim()
      const caseCounts = caseStr.split(',').map(s => {
        const v = parseFloat(s.trim())
        return isNaN(v) ? 0 : v
      })
      const method = String(args.method).toLowerCase()
      const n = caseCounts.length

      if (n < 3) return '**Error:** Need at least 3 data points.'

      const baselinePeriod = typeof args.baseline_period === 'number'
        ? args.baseline_period
        : Math.max(3, Math.floor(n / 3))

      const lines: string[] = []

      if (method === 'cusum') {
        const threshold = typeof args.threshold === 'number' ? args.threshold : 2

        // Baseline statistics
        const baseline = caseCounts.slice(0, baselinePeriod)
        const mean = baseline.reduce((a, b) => a + b, 0) / baseline.length
        const variance = baseline.reduce((a, b) => a + (b - mean) ** 2, 0) / baseline.length
        const sd = Math.sqrt(variance)

        // CUSUM calculation
        const k = 0.5 * sd // Allowance (slack value)
        const h = threshold * sd // Decision interval
        let cusumHigh = 0
        let cusumLow = 0
        interface CusumRecord { period: number; cases: number; cusumH: number; cusumL: number; alert: string }
        const records: CusumRecord[] = []
        const alerts: number[] = []

        for (let i = 0; i < n; i++) {
          cusumHigh = Math.max(0, cusumHigh + caseCounts[i] - mean - k)
          cusumLow = Math.min(0, cusumLow + caseCounts[i] - mean + k)
          const alert = cusumHigh > h ? 'HIGH' : Math.abs(cusumLow) > h ? 'LOW' : ''
          if (alert) alerts.push(i + 1)
          records.push({ period: i + 1, cases: caseCounts[i], cusumH: cusumHigh, cusumL: cusumLow, alert })
        }

        lines.push('# CUSUM Outbreak Detection')
        lines.push('')
        lines.push('## Baseline Statistics')
        lines.push(`- **Baseline periods:** ${baselinePeriod}`)
        lines.push(`- **Baseline mean:** ${fmt(mean, 2)}`)
        lines.push(`- **Baseline SD:** ${fmt(sd, 2)}`)
        lines.push(`- **Decision interval (h):** ${fmt(h, 2)} (${threshold} SDs)`)
        lines.push(`- **Slack value (k):** ${fmt(k, 2)}`)
        lines.push('')

        if (alerts.length > 0) {
          lines.push(`## ALERTS: ${alerts.length} periods exceeded threshold`)
          lines.push(`- **Alert periods:** ${alerts.join(', ')}`)
          lines.push(`- **First alert:** Period ${alerts[0]}`)
          lines.push('')
        } else {
          lines.push('## No outbreak signals detected.')
          lines.push('')
        }

        lines.push('## CUSUM Values')
        lines.push('| Period | Cases | CUSUM+ | CUSUM- | Alert |')
        lines.push('|--------|-------|--------|--------|-------|')
        for (const r of records) {
          lines.push(`| ${r.period} | ${r.cases} | ${fmt(r.cusumH, 2)} | ${fmt(r.cusumL, 2)} | ${r.alert} |`)
        }

      } else if (method === 'moving_average') {
        const multiplier = typeof args.threshold === 'number' ? args.threshold : 1.5
        const windowSize = Math.max(3, baselinePeriod)

        interface MARecord { period: number; cases: number; ma: number; upper: number; alert: boolean }
        const records: MARecord[] = []
        const alerts: number[] = []

        for (let i = 0; i < n; i++) {
          const start = Math.max(0, i - windowSize)
          const window = caseCounts.slice(start, i)
          if (window.length === 0) {
            records.push({ period: i + 1, cases: caseCounts[i], ma: caseCounts[i], upper: caseCounts[i] * multiplier, alert: false })
            continue
          }
          const ma = window.reduce((a, b) => a + b, 0) / window.length
          const upper = ma * multiplier
          const alert = caseCounts[i] > upper
          if (alert) alerts.push(i + 1)
          records.push({ period: i + 1, cases: caseCounts[i], ma, upper, alert })
        }

        lines.push('# Moving Average Outbreak Detection')
        lines.push('')
        lines.push(`- **Window size:** ${windowSize} periods`)
        lines.push(`- **Threshold multiplier:** ${multiplier}x`)
        lines.push('')

        if (alerts.length > 0) {
          lines.push(`## ALERTS: ${alerts.length} periods exceeded threshold`)
          lines.push(`- **Alert periods:** ${alerts.join(', ')}`)
          lines.push('')
        } else {
          lines.push('## No outbreak signals detected.')
          lines.push('')
        }

        lines.push('## Values')
        lines.push('| Period | Cases | Moving Avg | Upper Limit | Alert |')
        lines.push('|--------|-------|-----------|-------------|-------|')
        for (const r of records) {
          lines.push(`| ${r.period} | ${r.cases} | ${fmt(r.ma, 1)} | ${fmt(r.upper, 1)} | ${r.alert ? 'YES' : ''} |`)
        }

      } else if (method === 'doubling_time') {
        // Calculate cumulative cases and doubling time
        const cumulative: number[] = []
        let cum = 0
        for (const c of caseCounts) {
          cum += c
          cumulative.push(cum)
        }

        // Find doubling time using log-linear regression on recent growth phase
        // Find the growth phase (where cases are increasing)
        const growthStart = caseCounts.findIndex(c => c > 0)
        if (growthStart === -1) {
          return '**Error:** No positive case counts found.'
        }

        // Use last half of data for doubling time estimate (or full growth phase)
        const recentStart = Math.max(growthStart, Math.floor(n / 2))
        const xVals: number[] = []
        const yVals: number[] = []
        for (let i = recentStart; i < n; i++) {
          if (cumulative[i] > 0) {
            xVals.push(i)
            yVals.push(Math.log(cumulative[i]))
          }
        }

        let doublingTime = NaN
        let growthRate = NaN
        let r2 = NaN

        if (xVals.length >= 2) {
          // Linear regression on log(cumulative) vs time
          const xMean = xVals.reduce((a, b) => a + b, 0) / xVals.length
          const yMean = yVals.reduce((a, b) => a + b, 0) / yVals.length
          let ssXY = 0, ssXX = 0, ssTot = 0, ssRes = 0
          for (let i = 0; i < xVals.length; i++) {
            ssXY += (xVals[i] - xMean) * (yVals[i] - yMean)
            ssXX += (xVals[i] - xMean) ** 2
          }
          growthRate = ssXY / ssXX
          const intercept = yMean - growthRate * xMean
          for (let i = 0; i < yVals.length; i++) {
            const predicted = growthRate * xVals[i] + intercept
            ssRes += (yVals[i] - predicted) ** 2
            ssTot += (yVals[i] - yMean) ** 2
          }
          r2 = 1 - ssRes / ssTot
          doublingTime = Math.LN2 / growthRate
        }

        // Generation interval estimate (serial interval proxy)
        // Using the time between peaks approach
        let peakPeriod = 0
        let peakVal = 0
        for (let i = 0; i < n; i++) {
          if (caseCounts[i] > peakVal) {
            peakVal = caseCounts[i]
            peakPeriod = i + 1
          }
        }

        const totalCases = cumulative[n - 1]

        lines.push('# Doubling Time Analysis')
        lines.push('')
        lines.push('## Summary')
        lines.push(`- **Total periods:** ${n}`)
        lines.push(`- **Total cumulative cases:** ${totalCases.toLocaleString()}`)
        lines.push(`- **Peak cases:** ${peakVal} (period ${peakPeriod})`)
        lines.push('')
        lines.push('## Growth Analysis')
        if (isFinite(doublingTime) && doublingTime > 0) {
          lines.push(`- **Doubling time:** ${fmt(doublingTime, 1)} periods`)
          lines.push(`- **Growth rate:** ${fmt(growthRate, 4)} per period`)
          lines.push(`- **R-squared (fit):** ${fmt(r2, 4)}`)
        } else if (isFinite(growthRate) && growthRate <= 0) {
          lines.push(`- **Growth rate is negative or zero** — epidemic may be declining.`)
          lines.push(`- **Growth rate:** ${fmt(growthRate, 4)} per period`)
          lines.push(`- **Halving time:** ${fmt(Math.abs(Math.LN2 / growthRate), 1)} periods`)
        } else {
          lines.push(`- Insufficient data to estimate doubling time.`)
        }
        lines.push('')

        // Epidemic curve data
        lines.push('## Epidemic Curve')
        lines.push('| Period | New Cases | Cumulative |')
        lines.push('|--------|-----------|-----------|')
        for (let i = 0; i < n; i++) {
          lines.push(`| ${i + 1} | ${caseCounts[i]} | ${cumulative[i]} |`)
        }

      } else if (method === 'epidemic_curve') {
        // Generate descriptive epidemic curve statistics
        const total = caseCounts.reduce((a, b) => a + b, 0)
        const mean = total / n
        const max = Math.max(...caseCounts)
        const maxPeriod = caseCounts.indexOf(max) + 1
        const median = [...caseCounts].sort((a, b) => a - b)[Math.floor(n / 2)]

        // Find epidemic phases
        let onsetPeriod = caseCounts.findIndex(c => c > 0) + 1
        let peakStart = maxPeriod
        let peakEnd = maxPeriod
        const peakThreshold = max * 0.75
        for (let i = 0; i < n; i++) {
          if (caseCounts[i] >= peakThreshold) {
            if (i + 1 < peakStart) peakStart = i + 1
            if (i + 1 > peakEnd) peakEnd = i + 1
          }
        }

        // Build ASCII bar chart
        const barWidth = 40
        const scale = max > 0 ? barWidth / max : 0

        lines.push('# Epidemic Curve Analysis')
        lines.push('')
        lines.push('## Summary Statistics')
        lines.push(`| Metric | Value |`)
        lines.push(`|--------|-------|`)
        lines.push(`| Total cases | ${total.toLocaleString()} |`)
        lines.push(`| Periods | ${n} |`)
        lines.push(`| Mean cases/period | ${fmt(mean, 1)} |`)
        lines.push(`| Median cases/period | ${median} |`)
        lines.push(`| Peak cases | ${max} (period ${maxPeriod}) |`)
        lines.push(`| Onset period | ${onsetPeriod} |`)
        lines.push(`| Peak plateau | periods ${peakStart}--${peakEnd} |`)
        lines.push('')

        lines.push('## Epidemic Curve')
        lines.push('```')
        for (let i = 0; i < n; i++) {
          const bar = '#'.repeat(Math.round(caseCounts[i] * scale))
          const label = String(i + 1).padStart(3)
          lines.push(`${label} | ${bar} ${caseCounts[i]}`)
        }
        lines.push('```')

      } else {
        return `**Error:** Unknown method "${method}". Choose cusum, moving_average, doubling_time, or epidemic_curve.`
      }

      return lines.join('\n')
    }
  })

  // ════════════════════════════════════════════════════════════════════════════
  // 5. CROP MODEL — Degree-day accumulation and yield estimation
  // ════════════════════════════════════════════════════════════════════════════

  registerTool({
    name: 'crop_model',
    description: 'Simple crop growth modeling: degree-day (GDD) accumulation, water balance tracking (precipitation - evapotranspiration), and yield estimation. Supports ~20 major crops with embedded growing parameters.',
    parameters: {
      crop:          { type: 'string', description: 'Crop name (corn, wheat, rice, soybean, potato, tomato, cotton, barley, oat, sorghum, sugarcane, sunflower, canola, peanut, cassava, millet, chickpea, lentil, alfalfa, tobacco)', required: true },
      daily_temps:   { type: 'string', description: 'JSON array of {min, max} daily temperatures in Celsius', required: true },
      daily_precip:  { type: 'string', description: 'Comma-separated daily precipitation in mm', required: true },
      soil_capacity: { type: 'number', description: 'Soil water holding capacity in mm (default 200)' },
      planting_date: { type: 'string', description: 'Planting date (YYYY-MM-DD) for reference' },
    },
    tier: 'free',
    async execute(args) {
      const cropKey = String(args.crop).toLowerCase().trim()
      const crop = CROPS[cropKey]
      if (!crop) {
        const available = Object.keys(CROPS).join(', ')
        return `**Error:** Unknown crop "${cropKey}". Available: ${available}`
      }

      interface DailyTemp { min: number; max: number }
      const temps = safeParse<DailyTemp[]>(String(args.daily_temps), 'daily_temps')
      const precipStr = String(args.daily_precip).trim()
      const precip = precipStr.split(',').map(s => parseFloat(s.trim()) || 0)
      const soilCapacity = typeof args.soil_capacity === 'number' ? args.soil_capacity : 200
      const plantingDate = args.planting_date ? String(args.planting_date) : null

      const nDays = Math.min(temps.length, precip.length)
      if (nDays < 1) return '**Error:** Need at least 1 day of temperature and precipitation data.'

      // Simulate day by day
      let cumulativeGDD = 0
      let soilWater = soilCapacity * 0.5 // Start at 50% capacity
      let totalPrecip = 0
      let totalET = 0
      let waterStressDays = 0
      let heatStressDays = 0

      interface DayRecord {
        day: number
        tMin: number
        tMax: number
        gdd: number
        cumulGDD: number
        precip: number
        et: number
        soilWater: number
        stress: string
      }
      const records: DayRecord[] = []

      for (let i = 0; i < nDays; i++) {
        const tMin = temps[i].min
        const tMax = temps[i].max
        const tAvg = (tMin + tMax) / 2

        // Growing Degree Days (modified: clamp min at base temp)
        const adjMin = Math.max(tMin, crop.base_temp_c)
        const adjMax = Math.max(tMax, crop.base_temp_c)
        const gdd = Math.max(0, (adjMin + adjMax) / 2 - crop.base_temp_c)
        cumulativeGDD += gdd

        // Simple ET estimate using Hargreaves method (simplified)
        // ET0 = 0.0023 * (tMean + 17.8) * sqrt(tMax - tMin) * Ra
        // Using Ra ~ 15 MJ/m2/day (typical mid-latitude)
        const Ra = 15
        const tRange = Math.max(0, tMax - tMin)
        const et0 = 0.0023 * (tAvg + 17.8) * Math.sqrt(tRange) * Ra
        const cropKc = gdd > 0 ? (cumulativeGDD < crop.gdd_maturity * 0.3 ? 0.5 : cumulativeGDD < crop.gdd_maturity * 0.7 ? 1.0 : 0.7) : 0.3
        const et = et0 * cropKc

        // Water balance
        totalPrecip += precip[i]
        totalET += et
        soilWater += precip[i] - et
        soilWater = Math.max(0, Math.min(soilCapacity, soilWater))

        // Stress detection
        const stresses: string[] = []
        if (soilWater < soilCapacity * 0.2) {
          waterStressDays++
          stresses.push('drought')
        }
        if (tMax > 35) {
          heatStressDays++
          stresses.push('heat')
        }

        records.push({
          day: i + 1,
          tMin, tMax, gdd,
          cumulGDD: cumulativeGDD,
          precip: precip[i],
          et,
          soilWater,
          stress: stresses.join('+') || '-',
        })
      }

      // Growth stage determination
      const gddProgress = cumulativeGDD / crop.gdd_maturity
      let growthStage: string
      if (gddProgress < 0.15) growthStage = 'Emergence/Seedling'
      else if (gddProgress < 0.35) growthStage = 'Vegetative'
      else if (gddProgress < 0.55) growthStage = 'Reproductive/Flowering'
      else if (gddProgress < 0.80) growthStage = 'Grain Fill/Fruit Development'
      else if (gddProgress < 1.0) growthStage = 'Maturation'
      else growthStage = 'Harvest Ready'

      // Yield estimation
      // Factors: GDD completion, water stress, heat stress
      const gddFactor = Math.min(1, gddProgress)
      const waterFactor = Math.max(0.3, 1 - (waterStressDays / nDays) * 0.8)
      const heatFactor = Math.max(0.4, 1 - (heatStressDays / nDays) * 0.6)
      const precipFactor = Math.min(1, totalPrecip / (crop.water_need_mm * (nDays / crop.season_days)))
      const yieldFactor = gddFactor * waterFactor * heatFactor * Math.min(1, precipFactor)
      const estimatedYield = crop.typical_yield_kg_ha * yieldFactor

      const lines: string[] = []
      lines.push(`# Crop Growth Model: ${crop.name}`)
      lines.push('')
      if (plantingDate) lines.push(`**Planting date:** ${plantingDate}`)
      lines.push(`**Simulation days:** ${nDays}`)
      lines.push('')

      lines.push('## Crop Parameters')
      lines.push(`| Parameter | Value |`)
      lines.push(`|-----------|-------|`)
      lines.push(`| Base temperature | ${crop.base_temp_c} C |`)
      lines.push(`| GDD to maturity | ${crop.gdd_maturity} |`)
      lines.push(`| Water requirement | ${crop.water_need_mm} mm/season |`)
      lines.push(`| Typical yield | ${crop.typical_yield_kg_ha.toLocaleString()} kg/ha |`)
      lines.push(`| Typical season | ${crop.season_days} days |`)
      lines.push('')

      lines.push('## Growth Summary')
      lines.push(`| Metric | Value |`)
      lines.push(`|--------|-------|`)
      lines.push(`| Cumulative GDD | ${fmt(cumulativeGDD, 1)} / ${crop.gdd_maturity} (${pct(gddProgress)}) |`)
      lines.push(`| Current stage | ${growthStage} |`)
      lines.push(`| Total precipitation | ${fmt(totalPrecip, 1)} mm |`)
      lines.push(`| Total ET (estimated) | ${fmt(totalET, 1)} mm |`)
      lines.push(`| Water balance | ${fmt(totalPrecip - totalET, 1)} mm |`)
      lines.push(`| Final soil water | ${fmt(records[records.length - 1].soilWater, 1)} / ${soilCapacity} mm |`)
      lines.push(`| Water stress days | ${waterStressDays} / ${nDays} |`)
      lines.push(`| Heat stress days (>35C) | ${heatStressDays} / ${nDays} |`)
      lines.push('')

      lines.push('## Yield Estimation')
      lines.push(`| Factor | Value |`)
      lines.push(`|--------|-------|`)
      lines.push(`| GDD completion factor | ${pct(gddFactor)} |`)
      lines.push(`| Water stress factor | ${pct(waterFactor)} |`)
      lines.push(`| Heat stress factor | ${pct(heatFactor)} |`)
      lines.push(`| Precipitation factor | ${pct(Math.min(1, precipFactor))} |`)
      lines.push(`| **Combined yield factor** | **${pct(yieldFactor)}** |`)
      lines.push(`| **Estimated yield** | **${Math.round(estimatedYield).toLocaleString()} kg/ha** |`)
      lines.push(`| Estimated yield (tons/ha) | ${fmt(estimatedYield / 1000, 2)} |`)
      lines.push('')

      // Daily data (sample to keep output manageable)
      const interval = nDays <= 30 ? 1 : nDays <= 90 ? 7 : 14
      lines.push('## Daily Data (sampled)')
      lines.push('| Day | Tmin | Tmax | GDD | Cumul GDD | Precip | ET | Soil H2O | Stress |')
      lines.push('|-----|------|------|-----|-----------|--------|-----|----------|--------|')
      for (const r of records) {
        if (r.day === 1 || r.day % interval === 0 || r.day === nDays) {
          lines.push(`| ${r.day} | ${fmt(r.tMin, 1)} | ${fmt(r.tMax, 1)} | ${fmt(r.gdd, 1)} | ${fmt(r.cumulGDD, 0)} | ${fmt(r.precip, 1)} | ${fmt(r.et, 1)} | ${fmt(r.soilWater, 0)} | ${r.stress} |`)
        }
      }

      return lines.join('\n')
    }
  })

  // ════════════════════════════════════════════════════════════════════════════
  // 6. NUTRITION ANALYZE — Food composition lookup and DRI comparison
  // ════════════════════════════════════════════════════════════════════════════

  registerTool({
    name: 'nutrition_analyze',
    description: 'Nutritional analysis: look up food composition data for ~100 common foods (USDA-based), calculate daily intake totals from a list of foods, and compare intake against Dietary Reference Intakes (DRI).',
    parameters: {
      foods:     { type: 'string', description: 'JSON array of {name, grams} — food items and amounts', required: true },
      operation: { type: 'string', description: 'Operation: lookup (show per-100g data), daily_total (sum intake), or compare_dri (compare to daily recommended)', required: true },
    },
    tier: 'free',
    async execute(args) {
      interface FoodInput { name: string; grams: number }
      const foods = safeParse<FoodInput[]>(String(args.foods), 'foods')
      const operation = String(args.operation).toLowerCase()

      if (foods.length === 0) return '**Error:** No foods provided.'

      // Resolve food names to DB entries
      function findFood(name: string): FoodEntry | null {
        const lower = name.toLowerCase().trim()
        // Exact match
        if (FOOD_DB[lower]) return FOOD_DB[lower]
        // Partial match
        for (const [key, entry] of Object.entries(FOOD_DB)) {
          if (key.includes(lower) || lower.includes(key) || entry.name.toLowerCase().includes(lower)) {
            return entry
          }
        }
        return null
      }

      const lines: string[] = []

      if (operation === 'lookup') {
        lines.push('# Food Composition Lookup (per 100g)')
        lines.push('')
        lines.push('| Food | kcal | Protein | Fat | Carbs | Fiber | Vit C | Calcium | Iron | Potassium | Vit A |')
        lines.push('|------|------|---------|-----|-------|-------|-------|---------|------|-----------|-------|')
        for (const f of foods) {
          const entry = findFood(f.name)
          if (entry) {
            lines.push(`| ${entry.name} | ${entry.kcal} | ${entry.protein}g | ${entry.fat}g | ${entry.carbs}g | ${entry.fiber}g | ${entry.vit_c}mg | ${entry.calcium}mg | ${entry.iron}mg | ${entry.potassium}mg | ${entry.vit_a_mcg}mcg |`)
          } else {
            lines.push(`| ${f.name} | -- | *not found in database* | | | | | | | | |`)
          }
        }
        lines.push('')
        lines.push(`*Database contains ${Object.keys(FOOD_DB).length} foods. Values per 100g.*`)

      } else if (operation === 'daily_total' || operation === 'compare_dri') {
        // Calculate totals
        let totalKcal = 0, totalProtein = 0, totalFat = 0, totalCarbs = 0, totalFiber = 0
        let totalVitC = 0, totalCalcium = 0, totalIron = 0, totalPotassium = 0, totalVitA = 0
        const notFound: string[] = []

        lines.push('# Nutritional Intake Analysis')
        lines.push('')
        lines.push('## Foods Consumed')
        lines.push('| Food | Amount | kcal | Protein | Fat | Carbs | Fiber |')
        lines.push('|------|--------|------|---------|-----|-------|-------|')

        for (const f of foods) {
          const entry = findFood(f.name)
          if (!entry) {
            notFound.push(f.name)
            continue
          }
          const scale = f.grams / 100
          const kcal = entry.kcal * scale
          const protein = entry.protein * scale
          const fat = entry.fat * scale
          const carbs = entry.carbs * scale
          const fiber = entry.fiber * scale
          totalKcal += kcal
          totalProtein += protein
          totalFat += fat
          totalCarbs += carbs
          totalFiber += fiber
          totalVitC += entry.vit_c * scale
          totalCalcium += entry.calcium * scale
          totalIron += entry.iron * scale
          totalPotassium += entry.potassium * scale
          totalVitA += entry.vit_a_mcg * scale

          lines.push(`| ${entry.name} | ${f.grams}g | ${fmt(kcal, 0)} | ${fmt(protein, 1)}g | ${fmt(fat, 1)}g | ${fmt(carbs, 1)}g | ${fmt(fiber, 1)}g |`)
        }
        lines.push('')

        if (notFound.length > 0) {
          lines.push(`> **Not found in database:** ${notFound.join(', ')}`)
          lines.push('')
        }

        lines.push('## Daily Totals')
        lines.push(`| Nutrient | Intake |`)
        lines.push(`|----------|--------|`)
        lines.push(`| Calories | ${fmt(totalKcal, 0)} kcal |`)
        lines.push(`| Protein | ${fmt(totalProtein, 1)} g |`)
        lines.push(`| Fat | ${fmt(totalFat, 1)} g |`)
        lines.push(`| Carbohydrates | ${fmt(totalCarbs, 1)} g |`)
        lines.push(`| Fiber | ${fmt(totalFiber, 1)} g |`)
        lines.push(`| Vitamin C | ${fmt(totalVitC, 1)} mg |`)
        lines.push(`| Calcium | ${fmt(totalCalcium, 0)} mg |`)
        lines.push(`| Iron | ${fmt(totalIron, 1)} mg |`)
        lines.push(`| Potassium | ${fmt(totalPotassium, 0)} mg |`)
        lines.push(`| Vitamin A | ${fmt(totalVitA, 0)} mcg |`)
        lines.push('')

        // Macronutrient breakdown
        const totalMacroKcal = totalProtein * 4 + totalFat * 9 + totalCarbs * 4
        if (totalMacroKcal > 0) {
          lines.push('## Macronutrient Breakdown')
          lines.push(`- **Protein:** ${pct(totalProtein * 4 / totalMacroKcal)} of calories`)
          lines.push(`- **Fat:** ${pct(totalFat * 9 / totalMacroKcal)} of calories`)
          lines.push(`- **Carbs:** ${pct(totalCarbs * 4 / totalMacroKcal)} of calories`)
          lines.push('')
        }

        if (operation === 'compare_dri') {
          const intakes: Record<string, number> = {
            'Calories': totalKcal,
            'Protein': totalProtein,
            'Fat': totalFat,
            'Carbohydrates': totalCarbs,
            'Fiber': totalFiber,
            'Vitamin C': totalVitC,
            'Calcium': totalCalcium,
            'Iron': totalIron,
            'Potassium': totalPotassium,
            'Vitamin A': totalVitA,
          }

          lines.push('## Comparison to DRI (Dietary Reference Intakes)')
          lines.push('| Nutrient | Intake | RDA | % of RDA | Status |')
          lines.push('|----------|--------|-----|----------|--------|')
          for (const dri of DRI_TABLE) {
            const intake = intakes[dri.nutrient] || 0
            const pctRDA = intake / dri.rda
            let status: string
            if (pctRDA < 0.5) status = 'LOW'
            else if (pctRDA < 0.8) status = 'Below target'
            else if (pctRDA <= 1.2) status = 'Adequate'
            else if (pctRDA <= 2.0) status = 'Above RDA'
            else status = 'Excessive'
            lines.push(`| ${dri.nutrient} | ${fmt(intake, 1)} ${dri.unit} | ${dri.rda} ${dri.unit} | ${pct(pctRDA)} | ${status} |`)
          }
          lines.push('')
          lines.push('*DRI values based on adult averages (19-50 years). Individual needs vary.*')
        }

      } else {
        return `**Error:** Unknown operation "${operation}". Choose lookup, daily_total, or compare_dri.`
      }

      return lines.join('\n')
    }
  })

  // ════════════════════════════════════════════════════════════════════════════
  // 7. LEARNING ANALYTICS — Education and assessment analysis
  // ════════════════════════════════════════════════════════════════════════════

  registerTool({
    name: 'learning_analytics',
    description: 'Education and learning analytics: item analysis (difficulty/discrimination), test reliability (KR-20, split-half), learning curve modeling (power law of practice), and spaced repetition scheduling (SM-2 algorithm).',
    parameters: {
      operation: { type: 'string', description: 'Operation: item_analysis, reliability, learning_curve, or spaced_repetition', required: true },
      data:      { type: 'string', description: 'JSON data. For item_analysis/reliability: {responses: [[0,1,...], ...]} (2D array, rows=students, cols=items, 0/1). For learning_curve: {trials: [time1, time2, ...]}. For spaced_repetition: {cards: [{quality, easiness?, interval?, repetitions?}, ...]}', required: true },
    },
    tier: 'free',
    async execute(args) {
      const operation = String(args.operation).toLowerCase()
      const lines: string[] = []

      if (operation === 'item_analysis') {
        interface ItemData { responses: number[][] }
        const data = safeParse<ItemData>(String(args.data), 'data')
        const responses = data.responses
        const nStudents = responses.length
        const nItems = responses[0]?.length || 0

        if (nStudents < 2 || nItems < 2) return '**Error:** Need at least 2 students and 2 items.'

        // Calculate total scores for each student
        const totals = responses.map(r => r.reduce((a, b) => a + b, 0))
        const sortedByTotal = totals.map((t, i) => ({ score: t, index: i })).sort((a, b) => b.score - a.score)

        // Upper and lower 27% groups for discrimination
        const n27 = Math.max(1, Math.round(nStudents * 0.27))
        const upperGroup = sortedByTotal.slice(0, n27).map(s => s.index)
        const lowerGroup = sortedByTotal.slice(-n27).map(s => s.index)

        lines.push('# Item Analysis')
        lines.push('')
        lines.push(`- **Students:** ${nStudents}`)
        lines.push(`- **Items:** ${nItems}`)
        lines.push('')
        lines.push('| Item | Difficulty (p) | Discrimination (D) | Point-Biserial (rpb) | Quality |')
        lines.push('|------|---------------|-------------------|---------------------|---------|')

        for (let j = 0; j < nItems; j++) {
          // Difficulty = proportion correct
          const correct = responses.reduce((s, r) => s + r[j], 0)
          const p = correct / nStudents

          // Discrimination index (D) = upper27% correct rate - lower27% correct rate
          const upperCorrect = upperGroup.reduce((s, i) => s + responses[i][j], 0) / n27
          const lowerCorrect = lowerGroup.reduce((s, i) => s + responses[i][j], 0) / n27
          const D = upperCorrect - lowerCorrect

          // Point-biserial correlation
          const itemScores = responses.map(r => r[j])
          const totalMean = totals.reduce((a, b) => a + b, 0) / nStudents
          const totalSD = Math.sqrt(totals.reduce((s, t) => s + (t - totalMean) ** 2, 0) / nStudents)

          let rpb = 0
          if (totalSD > 0 && p > 0 && p < 1) {
            const correctMean = totals.filter((_, i) => itemScores[i] === 1).reduce((a, b) => a + b, 0) / correct
            const mp = correct / nStudents
            const mq = 1 - mp
            rpb = ((correctMean - totalMean) / totalSD) * Math.sqrt(mp / mq)
          }

          // Quality rating
          let quality: string
          if (p < 0.2 || p > 0.9) quality = 'Revise (difficulty)'
          else if (D < 0.2 || rpb < 0.2) quality = 'Revise (discrimination)'
          else if (D >= 0.4 && rpb >= 0.3) quality = 'Excellent'
          else quality = 'Acceptable'

          lines.push(`| ${j + 1} | ${fmt(p, 3)} | ${fmt(D, 3)} | ${fmt(rpb, 3)} | ${quality} |`)
        }

        lines.push('')
        lines.push('## Interpretation')
        lines.push('- **Difficulty (p):** 0 = nobody correct, 1 = all correct. Ideal: 0.3-0.8')
        lines.push('- **Discrimination (D):** Higher = better item. D >= 0.4 = excellent, D < 0.2 = poor')
        lines.push('- **Point-Biserial (rpb):** Correlation between item score and total score. rpb >= 0.3 = good')

      } else if (operation === 'reliability') {
        interface RelData { responses: number[][] }
        const data = safeParse<RelData>(String(args.data), 'data')
        const responses = data.responses
        const nStudents = responses.length
        const nItems = responses[0]?.length || 0

        if (nStudents < 2 || nItems < 2) return '**Error:** Need at least 2 students and 2 items.'

        // KR-20 (Kuder-Richardson 20) — for dichotomous items
        const totals = responses.map(r => r.reduce((a, b) => a + b, 0))
        const totalMean = totals.reduce((a, b) => a + b, 0) / nStudents
        const totalVariance = totals.reduce((s, t) => s + (t - totalMean) ** 2, 0) / nStudents

        let sumPQ = 0
        for (let j = 0; j < nItems; j++) {
          const p = responses.reduce((s, r) => s + r[j], 0) / nStudents
          sumPQ += p * (1 - p)
        }

        const kr20 = totalVariance > 0
          ? (nItems / (nItems - 1)) * (1 - sumPQ / totalVariance)
          : 0

        // Split-half reliability (odd-even split + Spearman-Brown)
        const oddScores = responses.map(r => r.filter((_, i) => i % 2 === 0).reduce((a, b) => a + b, 0))
        const evenScores = responses.map(r => r.filter((_, i) => i % 2 === 1).reduce((a, b) => a + b, 0))

        const oddMean = oddScores.reduce((a, b) => a + b, 0) / nStudents
        const evenMean = evenScores.reduce((a, b) => a + b, 0) / nStudents
        let covOE = 0, varOdd = 0, varEven = 0
        for (let i = 0; i < nStudents; i++) {
          covOE += (oddScores[i] - oddMean) * (evenScores[i] - evenMean)
          varOdd += (oddScores[i] - oddMean) ** 2
          varEven += (evenScores[i] - evenMean) ** 2
        }
        covOE /= nStudents
        varOdd /= nStudents
        varEven /= nStudents

        const rHalf = (varOdd > 0 && varEven > 0) ? covOE / Math.sqrt(varOdd * varEven) : 0
        const rSB = (2 * rHalf) / (1 + rHalf) // Spearman-Brown correction

        // Standard Error of Measurement
        const sem = Math.sqrt(totalVariance) * Math.sqrt(1 - kr20)

        // Interpretation
        let interpretation: string
        if (kr20 >= 0.9) interpretation = 'Excellent reliability — suitable for high-stakes decisions'
        else if (kr20 >= 0.8) interpretation = 'Good reliability — suitable for most purposes'
        else if (kr20 >= 0.7) interpretation = 'Acceptable — suitable for group comparisons'
        else if (kr20 >= 0.6) interpretation = 'Questionable — use with caution'
        else interpretation = 'Poor — revise test items'

        lines.push('# Test Reliability Analysis')
        lines.push('')
        lines.push(`- **Students:** ${nStudents}`)
        lines.push(`- **Items:** ${nItems}`)
        lines.push(`- **Mean score:** ${fmt(totalMean, 2)} / ${nItems}`)
        lines.push(`- **Score variance:** ${fmt(totalVariance, 2)}`)
        lines.push(`- **Score SD:** ${fmt(Math.sqrt(totalVariance), 2)}`)
        lines.push('')
        lines.push('## Reliability Coefficients')
        lines.push(`| Measure | Value | Interpretation |`)
        lines.push(`|---------|-------|----------------|`)
        lines.push(`| KR-20 | ${fmt(kr20, 4)} | ${interpretation} |`)
        lines.push(`| Split-half (r) | ${fmt(rHalf, 4)} | Raw half-test correlation |`)
        lines.push(`| Spearman-Brown | ${fmt(rSB, 4)} | Corrected full-test reliability |`)
        lines.push(`| SEM | ${fmt(sem, 2)} | Standard Error of Measurement |`)
        lines.push('')
        lines.push('## Score Distribution')
        lines.push(`- **Min score:** ${Math.min(...totals)}`)
        lines.push(`- **Max score:** ${Math.max(...totals)}`)
        lines.push(`- **Median:** ${[...totals].sort((a, b) => a - b)[Math.floor(nStudents / 2)]}`)
        lines.push(`- **68% CI for a score at the mean:** ${fmt(totalMean - sem, 1)} to ${fmt(totalMean + sem, 1)}`)

      } else if (operation === 'learning_curve') {
        interface LCData { trials: number[] }
        const data = safeParse<LCData>(String(args.data), 'data')
        const trials = data.trials
        const n = trials.length

        if (n < 3) return '**Error:** Need at least 3 trial data points.'

        // Power Law of Practice: T = a * N^(-b)
        // Log-linear regression: ln(T) = ln(a) - b * ln(N)
        const xVals = trials.map((_, i) => Math.log(i + 1))
        const yVals = trials.map(t => Math.log(t))

        const xMean = xVals.reduce((a, b) => a + b, 0) / n
        const yMean = yVals.reduce((a, b) => a + b, 0) / n
        let ssXY = 0, ssXX = 0, ssTot = 0, ssRes = 0
        for (let i = 0; i < n; i++) {
          ssXY += (xVals[i] - xMean) * (yVals[i] - yMean)
          ssXX += (xVals[i] - xMean) ** 2
        }
        const negB = ssXY / ssXX
        const lnA = yMean - negB * xMean
        const a = Math.exp(lnA)
        const b = -negB

        for (let i = 0; i < n; i++) {
          const predicted = lnA + negB * xVals[i]
          ssRes += (yVals[i] - predicted) ** 2
          ssTot += (yVals[i] - yMean) ** 2
        }
        const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0

        // Predictions
        const predict = (trial: number) => a * Math.pow(trial, -b)

        // Learning rate (% improvement from trial N to trial N+1)
        const improvements: number[] = []
        for (let i = 1; i < n; i++) {
          improvements.push((trials[i - 1] - trials[i]) / trials[i - 1])
        }

        lines.push('# Learning Curve Analysis (Power Law of Practice)')
        lines.push('')
        lines.push(`**Model:** T = ${fmt(a, 2)} * N^(-${fmt(b, 4)})`)
        lines.push('')
        lines.push('## Parameters')
        lines.push(`| Parameter | Value |`)
        lines.push(`|-----------|-------|`)
        lines.push(`| a (initial performance) | ${fmt(a, 2)} |`)
        lines.push(`| b (learning rate exponent) | ${fmt(b, 4)} |`)
        lines.push(`| R-squared | ${fmt(r2, 4)} |`)
        lines.push(`| Total trials | ${n} |`)
        lines.push(`| First trial time | ${trials[0]} |`)
        lines.push(`| Last trial time | ${trials[n - 1]} |`)
        lines.push(`| Total improvement | ${pct((trials[0] - trials[n - 1]) / trials[0])} |`)
        lines.push('')

        lines.push('## Trial Data & Predictions')
        lines.push('| Trial | Actual | Predicted | Improvement |')
        lines.push('|-------|--------|-----------|-------------|')
        for (let i = 0; i < n; i++) {
          const pred = predict(i + 1)
          const imp = i > 0 ? pct(improvements[i - 1]) : '-'
          lines.push(`| ${i + 1} | ${trials[i]} | ${fmt(pred, 1)} | ${imp} |`)
        }
        lines.push('')

        // Future predictions
        lines.push('## Predictions')
        const futureTrial = [n * 2, n * 5, n * 10]
        for (const ft of futureTrial) {
          lines.push(`- **Trial ${ft}:** ${fmt(predict(ft), 1)} (${pct((trials[0] - predict(ft)) / trials[0])} improvement from start)`)
        }

      } else if (operation === 'spaced_repetition') {
        // SM-2 Algorithm implementation
        interface CardInput { quality: number; easiness?: number; interval?: number; repetitions?: number }
        interface SRData { cards: CardInput[] }
        const data = safeParse<SRData>(String(args.data), 'data')
        const cards = data.cards

        if (cards.length === 0) return '**Error:** No cards provided.'

        interface CardResult {
          index: number
          quality: number
          prevEF: number
          newEF: number
          prevInterval: number
          newInterval: number
          repetitions: number
          nextReview: string
        }

        const results: CardResult[] = []

        for (let i = 0; i < cards.length; i++) {
          const card = cards[i]
          const quality = Math.max(0, Math.min(5, card.quality))
          let ef = card.easiness ?? 2.5
          let interval = card.interval ?? 0
          let reps = card.repetitions ?? 0
          const prevEF = ef
          const prevInterval = interval

          if (quality >= 3) {
            // Correct response
            if (reps === 0) {
              interval = 1
            } else if (reps === 1) {
              interval = 6
            } else {
              interval = Math.round(interval * ef)
            }
            reps++
          } else {
            // Incorrect — reset
            reps = 0
            interval = 1
          }

          // Update easiness factor
          ef = ef + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
          ef = Math.max(1.3, ef)

          // Calculate next review date
          const nextDate = new Date()
          nextDate.setDate(nextDate.getDate() + interval)
          const nextReview = nextDate.toISOString().split('T')[0]

          results.push({
            index: i + 1,
            quality,
            prevEF,
            newEF: ef,
            prevInterval,
            newInterval: interval,
            repetitions: reps,
            nextReview,
          })
        }

        lines.push('# Spaced Repetition Schedule (SM-2 Algorithm)')
        lines.push('')
        lines.push('## Quality Scale')
        lines.push('- **5:** Perfect response, no hesitation')
        lines.push('- **4:** Correct after slight hesitation')
        lines.push('- **3:** Correct with difficulty')
        lines.push('- **2:** Incorrect, but upon seeing answer it was easy to recall')
        lines.push('- **1:** Incorrect, answer remembered after seeing it')
        lines.push('- **0:** Complete blackout')
        lines.push('')

        lines.push('## Card Schedule')
        lines.push('| Card | Quality | Prev EF | New EF | Prev Interval | New Interval | Reps | Next Review |')
        lines.push('|------|---------|---------|--------|---------------|-------------|------|-------------|')
        for (const r of results) {
          lines.push(`| ${r.index} | ${r.quality} | ${fmt(r.prevEF, 2)} | ${fmt(r.newEF, 2)} | ${r.prevInterval}d | ${r.newInterval}d | ${r.repetitions} | ${r.nextReview} |`)
        }
        lines.push('')

        // Summary
        const avgQuality = results.reduce((s, r) => s + r.quality, 0) / results.length
        const needsReview = results.filter(r => r.quality < 3).length
        lines.push('## Summary')
        lines.push(`- **Total cards:** ${cards.length}`)
        lines.push(`- **Average quality:** ${fmt(avgQuality, 2)}`)
        lines.push(`- **Cards needing immediate review (q < 3):** ${needsReview}`)
        lines.push(`- **Average new EF:** ${fmt(results.reduce((s, r) => s + r.newEF, 0) / results.length, 2)}`)

      } else {
        return `**Error:** Unknown operation "${operation}". Choose item_analysis, reliability, learning_curve, or spaced_repetition.`
      }

      return lines.join('\n')
    }
  })

  // ════════════════════════════════════════════════════════════════════════════
  // 8. VACCINATION MODEL — Herd immunity and vaccine impact
  // ════════════════════════════════════════════════════════════════════════════

  registerTool({
    name: 'vaccination_model',
    description: 'Vaccine impact modeling: herd immunity calculator, vaccine effectiveness from case-control data, number needed to vaccinate, and age-structured vaccination strategy comparison.',
    parameters: {
      r0:              { type: 'number', description: 'Basic reproduction number of the pathogen', required: true },
      vaccine_efficacy: { type: 'number', description: 'Vaccine efficacy (0-1)', required: true },
      coverage:        { type: 'number', description: 'Vaccination coverage (0-1)', required: true },
      population:      { type: 'number', description: 'Total population (for absolute numbers)' },
      age_groups:      { type: 'string', description: 'JSON array of {age, fraction, contact_rate} for age-structured analysis. fraction should sum to 1, contact_rate is relative (1.0 = average)' },
    },
    tier: 'free',
    async execute(args) {
      const r0 = Number(args.r0)
      const ve = Number(args.vaccine_efficacy)
      const coverage = Number(args.coverage)
      const population = typeof args.population === 'number' ? args.population : 1000000

      if (r0 <= 0 || ve < 0 || ve > 1 || coverage < 0 || coverage > 1) {
        return '**Error:** R0 must be positive, efficacy and coverage must be between 0 and 1.'
      }

      const lines: string[] = []
      lines.push('# Vaccination Impact Model')
      lines.push('')

      // Basic herd immunity
      const herdThreshold = 1 - 1 / r0
      const effectiveCoverage = coverage * ve
      const effectiveR = r0 * (1 - effectiveCoverage)
      const herdAchieved = effectiveCoverage >= herdThreshold
      const coverageNeeded = herdThreshold / ve
      const nnv = 1 / ve // Number needed to vaccinate to prevent 1 case (simplified)

      // Population-level estimates
      // Without vaccination: using SIR final size equation approximation
      // R_inf ~ 1 - exp(-R0 * R_inf) — solve iteratively
      let finalSizeNoVax = 0.9 // initial guess
      for (let iter = 0; iter < 100; iter++) {
        finalSizeNoVax = 1 - Math.exp(-r0 * finalSizeNoVax)
      }
      let finalSizeWithVax = 0
      if (effectiveR > 1) {
        finalSizeWithVax = 0.9
        for (let iter = 0; iter < 100; iter++) {
          finalSizeWithVax = 1 - Math.exp(-effectiveR * finalSizeWithVax)
        }
        // Scale to unvaccinated susceptible pool
        finalSizeWithVax = finalSizeWithVax * (1 - effectiveCoverage)
      }

      const casesWithout = Math.round(finalSizeNoVax * population)
      const casesWith = Math.round(finalSizeWithVax * population)
      const casesPrevented = casesWithout - casesWith
      const vaccinated = Math.round(coverage * population)

      lines.push('## Parameters')
      lines.push(`| Parameter | Value |`)
      lines.push(`|-----------|-------|`)
      lines.push(`| R0 | ${r0} |`)
      lines.push(`| Vaccine efficacy | ${pct(ve)} |`)
      lines.push(`| Coverage | ${pct(coverage)} |`)
      lines.push(`| Population | ${population.toLocaleString()} |`)
      lines.push('')

      lines.push('## Herd Immunity Analysis')
      lines.push(`| Metric | Value |`)
      lines.push(`|--------|-------|`)
      lines.push(`| Herd immunity threshold | ${pct(herdThreshold)} |`)
      lines.push(`| Effective coverage (coverage x efficacy) | ${pct(effectiveCoverage)} |`)
      lines.push(`| Effective R (with vaccination) | ${fmt(effectiveR, 2)} |`)
      lines.push(`| Herd immunity achieved? | ${herdAchieved ? '**YES**' : '**NO**'} |`)
      lines.push(`| Coverage needed (for this efficacy) | ${pct(Math.min(1, coverageNeeded))}${coverageNeeded > 1 ? ' (impossible with this efficacy)' : ''} |`)
      lines.push('')

      lines.push('## Population Impact')
      lines.push(`| Metric | Value |`)
      lines.push(`|--------|-------|`)
      lines.push(`| People vaccinated | ${vaccinated.toLocaleString()} |`)
      lines.push(`| Expected cases (no vaccination) | ${casesWithout.toLocaleString()} (${pct(finalSizeNoVax)}) |`)
      lines.push(`| Expected cases (with vaccination) | ${casesWith.toLocaleString()} (${pct(finalSizeWithVax)}) |`)
      lines.push(`| Cases prevented | ${casesPrevented.toLocaleString()} |`)
      lines.push(`| % reduction in cases | ${pct(casesPrevented / Math.max(1, casesWithout))} |`)
      lines.push(`| NNV (per case prevented) | ${fmt(vaccinated / Math.max(1, casesPrevented), 0)} |`)
      lines.push('')

      // Sensitivity analysis: coverage vs effective R
      lines.push('## Sensitivity: Coverage vs Effective R')
      lines.push('| Coverage | Effective Coverage | Effective R | Herd Immunity? |')
      lines.push('|----------|--------------------|-------------|----------------|')
      for (let c = 0.1; c <= 1.0; c += 0.1) {
        const ec = c * ve
        const er = r0 * (1 - ec)
        const hi = ec >= herdThreshold ? 'Yes' : 'No'
        lines.push(`| ${pct(c)} | ${pct(ec)} | ${fmt(er, 2)} | ${hi} |`)
      }
      lines.push('')

      // Age-structured analysis if provided
      if (args.age_groups) {
        interface AgeGroup { age: string; fraction: number; contact_rate: number }
        const ageGroups = safeParse<AgeGroup[]>(String(args.age_groups), 'age_groups')

        lines.push('## Age-Structured Analysis')
        lines.push('')
        lines.push('### Strategy 1: Uniform coverage across all groups')
        lines.push('| Age Group | Pop Fraction | Contact Rate | Eff. Coverage | Group R |')
        lines.push('|-----------|-------------|-------------|---------------|---------|')

        for (const ag of ageGroups) {
          const groupR = r0 * ag.contact_rate * (1 - coverage * ve)
          lines.push(`| ${ag.age} | ${pct(ag.fraction)} | ${fmt(ag.contact_rate, 2)} | ${pct(coverage * ve)} | ${fmt(groupR, 2)} |`)
        }
        lines.push('')

        // Strategy 2: Prioritize high-contact groups
        const sorted = [...ageGroups].sort((a, b) => b.contact_rate - a.contact_rate)
        lines.push('### Strategy 2: Prioritize high-contact groups')
        lines.push('Allocating vaccines to groups with highest contact rates first:')
        lines.push('')

        let remainingDoses = coverage // as fraction of total pop
        lines.push('| Age Group | Contact Rate | Allocated Coverage | Group Eff. Coverage |')
        lines.push('|-----------|-------------|-------------------|---------------------|')
        for (const ag of sorted) {
          const allocCoverage = Math.min(1, remainingDoses / ag.fraction)
          remainingDoses -= allocCoverage * ag.fraction
          remainingDoses = Math.max(0, remainingDoses)
          lines.push(`| ${ag.age} | ${fmt(ag.contact_rate, 2)} | ${pct(allocCoverage)} | ${pct(allocCoverage * ve)} |`)
        }
        lines.push('')

        // Compute weighted effective R for both strategies
        let weightedR_uniform = 0
        let weightedR_priority = 0
        let remainingDoses2 = coverage
        for (const ag of ageGroups) {
          weightedR_uniform += ag.fraction * r0 * ag.contact_rate * (1 - coverage * ve)
        }
        for (const ag of sorted) {
          const allocCoverage = Math.min(1, remainingDoses2 / ag.fraction)
          remainingDoses2 -= allocCoverage * ag.fraction
          remainingDoses2 = Math.max(0, remainingDoses2)
          weightedR_priority += ag.fraction * r0 * ag.contact_rate * (1 - allocCoverage * ve)
        }

        lines.push('### Strategy Comparison')
        lines.push(`| Strategy | Weighted Effective R |`)
        lines.push(`|----------|---------------------|`)
        lines.push(`| Uniform | ${fmt(weightedR_uniform, 3)} |`)
        lines.push(`| Priority (high-contact first) | ${fmt(weightedR_priority, 3)} |`)
        if (weightedR_priority < weightedR_uniform) {
          lines.push(`\n**Priority strategy reduces effective R by ${fmt(weightedR_uniform - weightedR_priority, 3)}** compared to uniform distribution.`)
        }
      }

      return lines.join('\n')
    }
  })

  // ════════════════════════════════════════════════════════════════════════════
  // 9. ENVIRONMENTAL HEALTH — Risk assessment and dose-response
  // ════════════════════════════════════════════════════════════════════════════

  registerTool({
    name: 'environmental_health',
    description: 'Environmental health risk assessment: dose-response modeling (linear, threshold, hormesis), exposure assessment (EPA intake equation), hazard quotient, reference dose comparison, and lifetime cancer risk calculation.',
    parameters: {
      calculation: { type: 'string', description: 'Calculation type: dose_response, exposure, hazard_quotient, or cancer_risk', required: true },
      params:      { type: 'string', description: 'JSON parameters. For dose_response: {model, doses, responses}. For exposure: {concentration_mg_L, intake_rate_L_day, exposure_frequency_days, exposure_duration_years, body_weight_kg, averaging_time_days}. For hazard_quotient: {dose_mg_kg_day, reference_dose}. For cancer_risk: {dose_mg_kg_day, slope_factor}', required: true },
    },
    tier: 'free',
    async execute(args) {
      const calculation = String(args.calculation).toLowerCase()
      const params = safeParse<Record<string, unknown>>(String(args.params), 'params')
      const lines: string[] = []

      if (calculation === 'dose_response') {
        const model = String(params.model || 'linear').toLowerCase()
        const doses = params.doses as number[]
        const responses = params.responses as number[]

        if (!doses || !responses || doses.length !== responses.length || doses.length < 2) {
          return '**Error:** Need matching arrays of doses and responses with at least 2 points.'
        }

        const n = doses.length
        lines.push('# Dose-Response Analysis')
        lines.push('')

        if (model === 'linear' || model === 'all') {
          // Linear: response = a + b * dose
          const xMean = doses.reduce((a, b) => a + b, 0) / n
          const yMean = responses.reduce((a, b) => a + b, 0) / n
          let ssXY = 0, ssXX = 0, ssTot = 0, ssRes = 0
          for (let i = 0; i < n; i++) {
            ssXY += (doses[i] - xMean) * (responses[i] - yMean)
            ssXX += (doses[i] - xMean) ** 2
          }
          const slope = ssXX > 0 ? ssXY / ssXX : 0
          const intercept = yMean - slope * xMean
          for (let i = 0; i < n; i++) {
            const pred = intercept + slope * doses[i]
            ssRes += (responses[i] - pred) ** 2
            ssTot += (responses[i] - yMean) ** 2
          }
          const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0

          lines.push('## Linear Model')
          lines.push(`**Response = ${fmt(intercept, 4)} + ${fmt(slope, 4)} x Dose**`)
          lines.push('')
          lines.push(`- **Slope:** ${fmt(slope, 4)} (response per unit dose)`)
          lines.push(`- **Intercept:** ${fmt(intercept, 4)}`)
          lines.push(`- **R-squared:** ${fmt(r2, 4)}`)
          lines.push('')
        }

        if (model === 'threshold' || model === 'all') {
          // Threshold model: find the best-fit threshold (NOAEL/LOAEL approach)
          // Try each data point as a potential threshold
          let bestThreshold = 0
          let bestR2 = -Infinity

          for (let t = 0; t < n - 1; t++) {
            const threshold = (doses[t] + doses[t + 1]) / 2
            let ssRes = 0, ssTot = 0
            const yMean = responses.reduce((a, b) => a + b, 0) / n
            for (let i = 0; i < n; i++) {
              const effectiveDose = Math.max(0, doses[i] - threshold)
              // Fit linear above threshold
              const pred = responses[0] + (doses[i] <= threshold ? 0 : (responses[n - 1] - responses[0]) * effectiveDose / (doses[n - 1] - threshold))
              ssRes += (responses[i] - pred) ** 2
              ssTot += (responses[i] - yMean) ** 2
            }
            const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0
            if (r2 > bestR2) {
              bestR2 = r2
              bestThreshold = threshold
            }
          }

          // NOAEL/LOAEL
          let noael = 0
          let loael = doses[0]
          const baseResponse = responses[0]
          const baseSD = Math.abs(baseResponse * 0.1) || 1 // approximate
          for (let i = 0; i < n; i++) {
            if (Math.abs(responses[i] - baseResponse) > 2 * baseSD) {
              loael = doses[i]
              noael = i > 0 ? doses[i - 1] : 0
              break
            }
          }

          lines.push('## Threshold Model')
          lines.push(`- **Estimated threshold:** ${fmt(bestThreshold, 4)}`)
          lines.push(`- **R-squared:** ${fmt(bestR2, 4)}`)
          lines.push(`- **NOAEL (approx):** ${fmt(noael, 4)}`)
          lines.push(`- **LOAEL (approx):** ${fmt(loael, 4)}`)
          lines.push('')
        }

        if (model === 'hormesis' || model === 'all') {
          // Hormesis: U-shaped or J-shaped — fit a quadratic
          // response = a + b*dose + c*dose^2
          // Using least squares: solve normal equations
          let sumX = 0, sumX2 = 0, sumX3 = 0, sumX4 = 0
          let sumY = 0, sumXY = 0, sumX2Y = 0
          for (let i = 0; i < n; i++) {
            const x = doses[i], y = responses[i]
            sumX += x; sumX2 += x ** 2; sumX3 += x ** 3; sumX4 += x ** 4
            sumY += y; sumXY += x * y; sumX2Y += x ** 2 * y
          }
          // Solve 3x3 system (Cramer's rule)
          const A = [
            [n, sumX, sumX2],
            [sumX, sumX2, sumX3],
            [sumX2, sumX3, sumX4],
          ]
          const B = [sumY, sumXY, sumX2Y]

          function det3(m: number[][]): number {
            return m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1])
              - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0])
              + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0])
          }

          const detA = det3(A)
          if (Math.abs(detA) > 1e-12) {
            const a = det3([
              [B[0], A[0][1], A[0][2]],
              [B[1], A[1][1], A[1][2]],
              [B[2], A[2][1], A[2][2]],
            ]) / detA
            const b = det3([
              [A[0][0], B[0], A[0][2]],
              [A[1][0], B[1], A[1][2]],
              [A[2][0], B[2], A[2][2]],
            ]) / detA
            const c = det3([
              [A[0][0], A[0][1], B[0]],
              [A[1][0], A[1][1], B[1]],
              [A[2][0], A[2][1], B[2]],
            ]) / detA

            const yMean = responses.reduce((s, v) => s + v, 0) / n
            let ssRes = 0, ssTot = 0
            for (let i = 0; i < n; i++) {
              const pred = a + b * doses[i] + c * doses[i] ** 2
              ssRes += (responses[i] - pred) ** 2
              ssTot += (responses[i] - yMean) ** 2
            }
            const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0

            // Minimum/maximum of quadratic: dose = -b/(2c)
            const extremeDose = c !== 0 ? -b / (2 * c) : 0
            const isHormetic = c > 0 && extremeDose > 0 && extremeDose < doses[n - 1]

            lines.push('## Hormesis (Quadratic) Model')
            lines.push(`**Response = ${fmt(a, 4)} + ${fmt(b, 4)} x Dose + ${fmt(c, 6)} x Dose^2**`)
            lines.push('')
            lines.push(`- **R-squared:** ${fmt(r2, 4)}`)
            if (isHormetic) {
              lines.push(`- **Hormetic zone detected:** minimum response at dose = ${fmt(extremeDose, 4)}`)
              lines.push(`- **Minimum response:** ${fmt(a + b * extremeDose + c * extremeDose ** 2, 4)}`)
            } else {
              lines.push(`- **No clear hormetic zone** within the dose range tested.`)
            }
            lines.push('')
          }
        }

        // Data table
        lines.push('## Data Points')
        lines.push('| Dose | Response |')
        lines.push('|------|----------|')
        for (let i = 0; i < n; i++) {
          lines.push(`| ${doses[i]} | ${responses[i]} |`)
        }

      } else if (calculation === 'exposure') {
        // EPA Exposure Assessment: ADD = (C * IR * EF * ED) / (BW * AT)
        const C = Number(params.concentration_mg_L || params.concentration || 0)
        const IR = Number(params.intake_rate_L_day || params.intake_rate || 2)
        const EF = Number(params.exposure_frequency_days || params.exposure_frequency || 350)
        const ED = Number(params.exposure_duration_years || params.exposure_duration || 30)
        const BW = Number(params.body_weight_kg || params.body_weight || 70)
        const AT_days = Number(params.averaging_time_days || params.averaging_time || ED * 365)

        const ADD = (C * IR * EF * ED) / (BW * AT_days)

        // Lifetime average daily dose (for carcinogens, average over 70 years)
        const LADD = (C * IR * EF * ED) / (BW * 70 * 365)

        lines.push('# Exposure Assessment (EPA Methodology)')
        lines.push('')
        lines.push('**ADD = (C x IR x EF x ED) / (BW x AT)**')
        lines.push('')
        lines.push('## Input Parameters')
        lines.push(`| Parameter | Value | Description |`)
        lines.push(`|-----------|-------|-------------|`)
        lines.push(`| C | ${C} mg/L | Concentration in medium |`)
        lines.push(`| IR | ${IR} L/day | Intake rate |`)
        lines.push(`| EF | ${EF} days/year | Exposure frequency |`)
        lines.push(`| ED | ${ED} years | Exposure duration |`)
        lines.push(`| BW | ${BW} kg | Body weight |`)
        lines.push(`| AT | ${AT_days} days | Averaging time |`)
        lines.push('')
        lines.push('## Results')
        lines.push(`| Metric | Value |`)
        lines.push(`|--------|-------|`)
        lines.push(`| Average Daily Dose (ADD) | ${ADD.toExponential(4)} mg/kg/day |`)
        lines.push(`| Lifetime Average Daily Dose (LADD) | ${LADD.toExponential(4)} mg/kg/day |`)
        lines.push(`| Total lifetime intake | ${fmt(C * IR * EF * ED / 1000, 2)} g |`)

      } else if (calculation === 'hazard_quotient') {
        const dose = Number(params.dose_mg_kg_day || params.dose || 0)
        const rfd = Number(params.reference_dose || params.rfd || 0)

        if (rfd <= 0) return '**Error:** Reference dose must be positive.'

        const hq = dose / rfd
        const mos = rfd / (dose || 1e-10)

        lines.push('# Hazard Quotient Assessment')
        lines.push('')
        lines.push('## Parameters')
        lines.push(`| Parameter | Value |`)
        lines.push(`|-----------|-------|`)
        lines.push(`| Exposure dose | ${dose.toExponential(4)} mg/kg/day |`)
        lines.push(`| Reference dose (RfD) | ${rfd.toExponential(4)} mg/kg/day |`)
        lines.push('')
        lines.push('## Results')
        lines.push(`| Metric | Value | Interpretation |`)
        lines.push(`|--------|-------|----------------|`)
        lines.push(`| Hazard Quotient (HQ) | ${fmt(hq, 4)} | ${hq > 1 ? '**EXCEEDS threshold** — potential health concern' : 'Below threshold — acceptable risk'} |`)
        lines.push(`| Margin of Safety (MOS) | ${fmt(mos, 1)} | ${mos > 100 ? 'Adequate' : mos > 10 ? 'Marginal' : '**Insufficient**'} |`)
        lines.push('')
        lines.push('## Risk Categories')
        lines.push('| HQ Range | Risk Level |')
        lines.push('|----------|-----------|')
        lines.push(`| < 0.1 | Negligible ${hq < 0.1 ? '<-- current' : ''} |`)
        lines.push(`| 0.1 - 1.0 | Acceptable ${hq >= 0.1 && hq <= 1 ? '<-- current' : ''} |`)
        lines.push(`| 1.0 - 10 | Concern ${hq > 1 && hq <= 10 ? '<-- current' : ''} |`)
        lines.push(`| > 10 | Significant concern ${hq > 10 ? '<-- current' : ''} |`)

      } else if (calculation === 'cancer_risk') {
        const dose = Number(params.dose_mg_kg_day || params.dose || 0)
        const sf = Number(params.slope_factor || params.cancer_slope_factor || 0)

        if (sf <= 0) return '**Error:** Cancer slope factor must be positive.'

        const risk = dose * sf
        const oneInN = risk > 0 ? Math.round(1 / risk) : Infinity

        lines.push('# Lifetime Cancer Risk Assessment')
        lines.push('')
        lines.push('**Risk = LADD x Cancer Slope Factor (CSF)**')
        lines.push('')
        lines.push('## Parameters')
        lines.push(`| Parameter | Value |`)
        lines.push(`|-----------|-------|`)
        lines.push(`| Lifetime Average Daily Dose | ${dose.toExponential(4)} mg/kg/day |`)
        lines.push(`| Cancer Slope Factor | ${sf.toExponential(4)} (mg/kg/day)^-1 |`)
        lines.push('')
        lines.push('## Results')
        lines.push(`| Metric | Value |`)
        lines.push(`|--------|-------|`)
        lines.push(`| Lifetime cancer risk | ${risk.toExponential(4)} |`)
        lines.push(`| Risk expressed as 1 in | 1 in ${oneInN.toLocaleString()} |`)
        lines.push('')

        let riskLevel: string
        if (risk < 1e-6) riskLevel = 'De minimis (< 1 in 1,000,000) — generally considered acceptable'
        else if (risk < 1e-4) riskLevel = 'Acceptable range (EPA target: 10^-6 to 10^-4)'
        else if (risk < 1e-3) riskLevel = 'Elevated — may warrant risk management action'
        else riskLevel = 'HIGH — significant concern, action recommended'

        lines.push(`**Risk level:** ${riskLevel}`)
        lines.push('')
        lines.push('## EPA Risk Benchmarks')
        lines.push('| Risk Level | Value | Status |')
        lines.push('|-----------|-------|--------|')
        lines.push(`| 10^-6 (de minimis) | ${(1e-6).toExponential(1)} | ${risk < 1e-6 ? 'BELOW' : 'ABOVE'} |`)
        lines.push(`| 10^-4 (upper acceptable) | ${(1e-4).toExponential(1)} | ${risk < 1e-4 ? 'BELOW' : 'ABOVE'} |`)

      } else {
        return `**Error:** Unknown calculation "${calculation}". Choose dose_response, exposure, hazard_quotient, or cancer_risk.`
      }

      return lines.join('\n')
    }
  })

  // ════════════════════════════════════════════════════════════════════════════
  // 10. GLOBAL HEALTH DATA — WHO GHO API queries
  // ════════════════════════════════════════════════════════════════════════════

  registerTool({
    name: 'global_health_data',
    description: 'Query WHO Global Health Observatory (GHO) data for country-level health indicators: life expectancy, infant mortality, health expenditure, immunization coverage, physician density. Uses the public GHO OData API.',
    parameters: {
      indicator: { type: 'string', description: 'Indicator: life_expectancy, infant_mortality, health_expenditure, immunization, or physician_density', required: true },
      country:   { type: 'string', description: 'Country name or ISO 3166 code (e.g., "USA", "Japan", "Brazil")' },
      year:      { type: 'number', description: 'Specific year to filter (optional — returns latest if omitted)' },
    },
    tier: 'free',
    async execute(args) {
      const indicatorKey = String(args.indicator).toLowerCase().trim()
      const indicatorInfo = WHO_INDICATORS[indicatorKey]

      if (!indicatorInfo) {
        const available = Object.keys(WHO_INDICATORS).join(', ')
        return `**Error:** Unknown indicator "${indicatorKey}". Available: ${available}`
      }

      const country = args.country ? String(args.country) : null
      const year = typeof args.year === 'number' ? args.year : null

      // Build OData query URL
      let url = `https://ghoapi.azureedge.net/api/${indicatorInfo.code}`
      const filters: string[] = []
      if (country) {
        const code = resolveCountryCode(country)
        filters.push(`SpatialDim eq '${code}'`)
      }
      if (year) {
        filters.push(`TimeDim eq ${year}`)
      }
      if (filters.length > 0) {
        url += `?$filter=${filters.join(' and ')}`
      }
      // Limit results
      url += (filters.length > 0 ? '&' : '?') + '$top=50&$orderby=TimeDim desc'

      try {
        const response = await labFetch(url, 15000)
        if (!response.ok) {
          return `**Error:** WHO GHO API returned ${response.status}. URL: \`${url}\``
        }

        interface GHORecord {
          SpatialDim: string
          TimeDim: number
          NumericValue: number
          Dim1?: string
          Value?: string
        }
        interface GHOResponse { value: GHORecord[] }

        const json = await response.json() as GHOResponse
        const records = json.value || []

        if (records.length === 0) {
          return `**No data found** for indicator "${indicatorInfo.label}" with the given filters.\n\nTry a different country code or year, or omit filters to see all available data.`
        }

        // Deduplicate and get most relevant records
        // Group by country + year, prefer "Both sexes" or "Total"
        const seen = new Map<string, GHORecord>()
        for (const r of records) {
          const key = `${r.SpatialDim}-${r.TimeDim}`
          if (!seen.has(key) || (r.Dim1 === 'BTSX' || r.Dim1 === 'TOTAL')) {
            seen.set(key, r)
          }
        }
        const unique = Array.from(seen.values())
          .filter(r => r.NumericValue != null)
          .sort((a, b) => b.TimeDim - a.TimeDim)

        const lines: string[] = []
        lines.push(`# WHO Global Health Data: ${indicatorInfo.label}`)
        lines.push('')
        if (country) lines.push(`**Country filter:** ${country} (${resolveCountryCode(country)})`)
        if (year) lines.push(`**Year filter:** ${year}`)
        lines.push(`**Records found:** ${unique.length}`)
        lines.push('')

        lines.push('| Country | Year | Value | Unit |')
        lines.push('|---------|------|-------|------|')
        for (const r of unique.slice(0, 30)) {
          lines.push(`| ${r.SpatialDim} | ${r.TimeDim} | ${fmt(r.NumericValue, 2)} | ${indicatorInfo.unit} |`)
        }

        if (unique.length > 1 && country) {
          // Trend analysis
          const sorted = unique.sort((a, b) => a.TimeDim - b.TimeDim)
          const first = sorted[0]
          const last = sorted[sorted.length - 1]
          const change = last.NumericValue - first.NumericValue
          const pctChange = change / first.NumericValue
          const years = last.TimeDim - first.TimeDim

          lines.push('')
          lines.push('## Trend')
          lines.push(`- **Period:** ${first.TimeDim} to ${last.TimeDim} (${years} years)`)
          lines.push(`- **Change:** ${fmt(change, 2)} ${indicatorInfo.unit} (${pct(pctChange)})`)
          lines.push(`- **Annual change:** ${fmt(change / Math.max(1, years), 3)} ${indicatorInfo.unit}/year`)
        }

        lines.push('')
        lines.push(`*Source: WHO Global Health Observatory (GHO). API endpoint: ${indicatorInfo.code}*`)

        return lines.join('\n')

      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        if (msg.includes('timeout') || msg.includes('abort')) {
          return `**Error:** WHO GHO API timed out. The service may be temporarily unavailable. Try again or use a more specific query.`
        }
        return `**Error querying WHO GHO API:** ${msg}`
      }
    }
  })

} // end registerLabHealthTools
