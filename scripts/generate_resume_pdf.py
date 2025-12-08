import asyncio
import os
import re
from playwright.async_api import async_playwright
from markdown_it import MarkdownIt

# Configuration
DOCS_DIR = "static/documents"
FILES = [
    {"input": "isaac-hernandez-resume.md", "output": "Isaac_Hernandez_Resume.pdf", "type": "resume"},
    {"input": "isaac-hernandez-cover-letter.md", "output": "Isaac_Hernandez_Cover_Letter.pdf", "type": "cover_letter"}
]

# Standard CSS for Cover Letter
COVER_LETTER_CSS = """
<style>
    body {
        font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
        line-height: 1.6;
        max-width: 800px;
        margin: 0 auto;
        padding: 40px;
        color: #333;
        font-size: 11pt;
    }
    h1 { border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 20px; font-size: 24px; }
    p { margin-bottom: 16px; }
    a { color: #2563eb; text-decoration: none; }
</style>
"""

# Advanced CSS for Resume (2-Column)
RESUME_CSS = """
<style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&display=swap');
    
    body {
        font-family: 'Inter', sans-serif;
        line-height: 1.5;
        color: #1f2937;
        margin: 0;
        padding: 0;
        background: #fff;
        -webkit-print-color-adjust: exact;
    }

    .container {
        display: grid;
        grid-template-columns: 68% 32%; /* Optimized ratio */
        height: 100%; /* allows expansion */
    }

    /* Sidebar Styling */
    .sidebar {
        background: #f3f4f6;
        padding: 40px 25px;
        border-left: 1px solid #e5e7eb;
        height: 100%; /* Ensure it spans the full grid height */
    }

    /* Main Content Styling */
    .main-content {
        padding: 40px 35px;
    }

    /* Header */
    .header {
        margin-bottom: 25px;
        border-bottom: 2px solid #1f2937;
        padding-bottom: 15px;
    }

    h1 {
        font-size: 28px;
        font-weight: 700;
        margin: 0 0 5px 0;
        letter-spacing: -0.02em;
        text-transform: uppercase;
    }

    .subtitle {
        font-size: 14px;
        font-weight: 400;
        color: #4b5563;
        margin: 0;
        font-family: 'Inter', monospace;
    }

    /* Headings */
    h2 {
        font-size: 13px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: #6b7280;
        border-bottom: 1px solid #e5e7eb;
        padding-bottom: 5px;
        margin-top: 20px;
        margin-bottom: 10px;
        page-break-after: avoid; /* Keep heading with content */
    }

    .sidebar h2 {
        color: #4b5563;
        border-color: #d1d5db;
        margin-top: 20px;
    }

    /* Content Typography */
    h3 {
        font-size: 15px;
        font-weight: 600;
        margin: 12px 0 2px 0;
        color: #111;
        page-break-after: avoid;
    }

    p {
        font-size: 9.5pt;
        margin-bottom: 8px;
        color: #374151;
    }
    
    strong { font-weight: 600; }

    /* List Styling */
    ul {
        padding-left: 16px;
        margin-top: 4px;
        margin-bottom: 10px;
    }

    li {
        font-size: 9.5pt;
        margin-bottom: 3px;
        color: #374151;
        line-height: 1.4;
    }

    /* Links */
    a {
        color: #2563eb;
        text-decoration: none;
    }

    /* Contact Block in Sidebar */
    .contact-block {
        margin-bottom: 25px;
    }
    .contact-item {
        display: block;
        margin-bottom: 6px;
        font-size: 0.85rem;
        word-break: break-word;
    }
    
    /* Project Tags */
    code {
        background: #e5e7eb;
        color: #374151;
        padding: 1px 5px;
        border-radius: 3px;
        font-size: 0.8em;
        font-family: monospace;
    }

    /* Print Logic */
    @media print {
        .container {
            display: grid;
        }
        
        /* Ensure blocks don't break awkwardly */
        .section-block, li, h3, p {
            page-break-inside: auto;
        }
        
        h2, h3 {
            page-break-after: avoid;
        }
        
        /* Force background printing is usually browser setting, 
           but playwright handles it via argument. 
           We just ensure CSS doesn't hide it. */
        * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
        }
    }
</style>
"""

def parse_resume(md_content):
    """
    Parses the flat Markdown into sections for the 2-column layout.
    """
    md = MarkdownIt()
    
    # Simple regex parsing to extract blocks
    # Logic:
    # 1. Header: Everything up to the first H2
    # 2. Sections: Split by H2
    
    sections = {}
    
    lines = md_content.split('\n')
    
    # 1. Extract Header (Name and Title)
    header_raw = []
    line_idx = 0
    for i, line in enumerate(lines):
        if line.startswith('## '):
            line_idx = i
            break
        header_raw.append(line)
        
    header_md = '\n'.join(header_raw).strip()
    
    # 2. Extract Sections
    remaining_content = '\n'.join(lines[line_idx:])
    raw_sections = re.split(r'(^## .+$)', remaining_content, flags=re.MULTILINE)
    
    current_section = None
    for part in raw_sections:
        if part.startswith('## '):
            current_section = part.replace('## ', '').strip()
            sections[current_section] = ""
        elif current_section:
            sections[current_section] += part
            
    # Assemble HTML
    # We will manually build the grid structure
    
    # Render Header
    header_html = md.render(header_md)
    # Tweak Header HTML to wrap name/subtitle if possible, or just accept MD render
    # We'll use CSS to style the H1 and p inside .header
    
    # Define Column Distribution
    sidebar_keys = ['Contact', 'Core Competencies', 'Philosophy & Writing']
    main_keys = ['Professional Summary', 'Featured Projects']
    
    sidebar_html = ""
    for key in sidebar_keys:
        if key in sections:
            sidebar_html += f"<h2>{key}</h2>"
            sidebar_html += md.render(sections[key])
            
    main_html = f"<div class='header'>{header_html}</div>"
    for key in main_keys:
        if key in sections:
            main_html += f"<h2>{key}</h2>"
            main_html += md.render(sections[key])
            
    final_html = f"""
    <div class="container">
        <div class="main-content">
            {main_html}
        </div>
        <div class="sidebar">
            {sidebar_html}
        </div>
    </div>
    """
    
    return final_html

async def generate_pdf(input_path, output_path, doc_type="resume"):
    print(f"Generating {output_path}...")
    
    with open(input_path, "r") as f:
        md_content = f.read()
    
    if doc_type == "resume":
        html_body = parse_resume(md_content)
        css = RESUME_CSS
    else:
        # Cover Letter - Standard Render
        md = MarkdownIt()
        html_body = md.render(md_content)
        css = COVER_LETTER_CSS

    full_html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        {css}
    </head>
    <body>
        {html_body}
    </body>
    </html>
    """
    
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()
        await page.set_content(full_html)
        await page.pdf(path=output_path, format="Letter", print_background=True)
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
            await generate_pdf(input_full_path, output_full_path, file_info.get("type", "resume"))
        else:
            print(f"Input file not found: {input_full_path}")

if __name__ == "__main__":
    asyncio.run(main())
