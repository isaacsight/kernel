import asyncio
import os
from playwright.async_api import async_playwright
from markdown_it import MarkdownIt

# Configuration
DOCS_DIR = "static/documents"
FILES = [
    {"input": "isaac-hernandez-resume.md", "output": "Isaac_Hernandez_Resume.pdf"},
    {"input": "isaac-hernandez-cover-letter.md", "output": "Isaac_Hernandez_Cover_Letter.pdf"}
]

# Simple, clean CSS for professional output
CSS = """
<style>
    body {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        line-height: 1.5;
        max-width: 800px;
        margin: 0 auto;
        padding: 40px;
        color: #333;
    }
    h1 { border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 20px; }
    h2 { border-bottom: 1px solid #eee; padding-bottom: 5px; margin-top: 30px; }
    h3 { margin-top: 20px; margin-bottom: 5px; }
    a { color: #2563eb; text-decoration: none; }
    ul { padding-left: 20px; }
    li { margin-bottom: 5px; }
    code { background: #f5f5f5; padding: 2px 5px; border-radius: 3px; font-family: "SF Mono", Menlo, monospace; font-size: 0.9em; }
    p { margin-bottom: 16px; }
    
    /* Header/Contact info styling */
    h1 + p { 
        margin-top: -15px; 
        color: #666; 
        font-size: 0.95em;
    }
</style>
"""

async def generate_pdf(input_path, output_path):
    print(f"Generating {output_path}...")
    
    # Read Markdown
    with open(input_path, "r") as f:
        md_content = f.read()
    
    # Convert to HTML
    md = MarkdownIt()
    html_content = md.render(md_content)
    
    # Combine with CSS
    full_html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        {CSS}
    </head>
    <body>
        {html_content}
    </body>
    </html>
    """
    
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()
        await page.set_content(full_html)
        await page.pdf(path=output_path, format="Letter", margin={"top": "0.5in", "bottom": "0.5in", "left": "0.5in", "right": "0.5in"})
        await browser.close()
    
    print(f"Done: {output_path}")

async def main():
    if not os.path.exists(DOCS_DIR):
        print(f"Directory {DOCS_DIR} does not exist.")
        return

    for file_info in FILES:
        input_full_path = os.path.join(DOCS_DIR, file_info["input"])
        output_full_path = os.path.join(DOCS_DIR, file_info["output"])
        
        if os.path.exists(input_full_path):
            await generate_pdf(input_full_path, output_full_path)
        else:
            print(f"Input file not found: {input_full_path}")

if __name__ == "__main__":
    asyncio.run(main())
