#!/usr/bin/env python3
"""
Quick script to analyze The Way of Code website design
"""
import asyncio
import json
from playwright.async_api import async_playwright

async def analyze_website():
    """Capture design details from thewayofcode.com"""
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()

        try:
            # Navigate to the site
            await page.goto('https://www.thewayofcode.com/', wait_until='networkidle')
            await asyncio.sleep(2)  # Wait for any animations

            # Extract design information
            design_info = await page.evaluate('''() => {
                const body = document.body;
                const root = document.documentElement;
                const computedStyle = window.getComputedStyle(root);
                const bodyStyle = window.getComputedStyle(body);

                // Extract CSS variables
                const cssVars = {};
                for (let i = 0; i < computedStyle.length; i++) {
                    const prop = computedStyle[i];
                    if (prop.startsWith('--')) {
                        cssVars[prop] = computedStyle.getPropertyValue(prop).trim();
                    }
                }

                // Get typography
                const headings = {};
                ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].forEach(tag => {
                    const el = document.querySelector(tag);
                    if (el) {
                        const style = window.getComputedStyle(el);
                        headings[tag] = {
                            fontFamily: style.fontFamily,
                            fontSize: style.fontSize,
                            fontWeight: style.fontWeight,
                            lineHeight: style.lineHeight,
                            letterSpacing: style.letterSpacing,
                            color: style.color
                        };
                    }
                });

                // Get body text
                const bodyText = {
                    fontFamily: bodyStyle.fontFamily,
                    fontSize: bodyStyle.fontSize,
                    fontWeight: bodyStyle.fontWeight,
                    lineHeight: bodyStyle.lineHeight,
                    color: bodyStyle.color,
                    backgroundColor: bodyStyle.backgroundColor
                };

                // Get layout structure
                const mainElements = [];
                document.querySelectorAll('main, section, article, div[class*="container"]').forEach(el => {
                    if (el.offsetHeight > 100) {  // Only significant elements
                        const style = window.getComputedStyle(el);
                        mainElements.push({
                            tag: el.tagName,
                            className: el.className,
                            maxWidth: style.maxWidth,
                            padding: style.padding,
                            margin: style.margin
                        });
                    }
                });

                return {
                    cssVariables: cssVars,
                    typography: {
                        headings: headings,
                        body: bodyText
                    },
                    layout: mainElements,
                    viewport: {
                        width: window.innerWidth,
                        height: window.innerHeight
                    },
                    title: document.title,
                    bodyClasses: body.className
                };
            }''')

            # Get the full page content
            content = await page.content()

            # Take screenshot
            await page.screenshot(path='/tmp/wayofcode-screenshot.png', full_page=True)

            print("=== THE WAY OF CODE - DESIGN ANALYSIS ===\n")
            print(json.dumps(design_info, indent=2))
            print(f"\n✓ Screenshot saved to /tmp/wayofcode-screenshot.png")

            # Extract visible text content
            text_content = await page.evaluate('() => document.body.innerText')
            print(f"\n=== VISIBLE CONTENT ===\n{text_content[:1000]}")

        except Exception as e:
            print(f"Error analyzing site: {e}")
        finally:
            await browser.close()

if __name__ == '__main__':
    asyncio.run(analyze_website())
