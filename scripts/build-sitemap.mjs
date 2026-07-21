#!/usr/bin/env node
/**
 * Build public/sitemap.xml from the issue registry.
 *
 * Companion to build-artifact-index.mjs: paths went real when the
 * router left hash mode, so the sitemap enumerates every routed
 * surface plus one entry per catalogued issue. CI runs it before the
 * build; run it locally after pressing an issue. Idempotent.
 */
import { readdirSync, writeFileSync } from 'node:fs'

const SITE = 'https://kernel.chat'
const ISSUES_DIR = 'src/content/issues'
const OUT = 'public/sitemap.xml'

const STATIC_ROUTES = [
  { path: '/', priority: '1.0', changefreq: 'weekly' },
  { path: '/issues', priority: '0.9', changefreq: 'weekly' },
  { path: '/about', priority: '0.5', changefreq: 'monthly' },
  { path: '/pressroom', priority: '0.5', changefreq: 'monthly' },
  { path: '/refusals', priority: '0.4', changefreq: 'monthly' },
  { path: '/atelier', priority: '0.4', changefreq: 'monthly' },
  { path: '/artifacts/index.html', priority: '0.4', changefreq: 'weekly' },
  { path: '/privacy', priority: '0.3', changefreq: 'monthly' },
  { path: '/terms', priority: '0.3', changefreq: 'monthly' },
]

const issues = readdirSync(ISSUES_DIR)
  .map((f) => /^(\d+)\.ts$/.exec(f)?.[1])
  .filter(Boolean)
  .map(Number)
  .sort((a, b) => a - b)

const url = ({ path, priority, changefreq }) =>
  [
    '  <url>',
    `    <loc>${SITE}${path}</loc>`,
    `    <changefreq>${changefreq}</changefreq>`,
    `    <priority>${priority}</priority>`,
    '  </url>',
  ].join('\n')

const body = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...STATIC_ROUTES.map(url),
  ...issues.map((n) =>
    url({ path: `/issues/${n}`, priority: '0.6', changefreq: 'yearly' }),
  ),
  '</urlset>',
  '',
].join('\n')

writeFileSync(OUT, body)
console.log(`${OUT}: ${STATIC_ROUTES.length} routes + ${issues.length} issues`)
