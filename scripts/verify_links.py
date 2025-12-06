import os
from pathlib import Path
from bs4 import BeautifulSoup
from urllib.parse import unquote, urlparse

DOCS_DIR = Path("docs")

def get_all_html_files():
    return list(DOCS_DIR.rglob("*.html"))

def check_links():
    html_files = get_all_html_files()
    broken_links = []
    checked_count = 0

    print(f"Checking {len(html_files)} HTML files...")

    for file_path in html_files:
        try:
            content = file_path.read_text(encoding="utf-8")
            soup = BeautifulSoup(content, "html.parser")
            
            for a in soup.find_all("a", href=True):
                href = a["href"]
                
                # Skip external links, anchors, and mailto/tel
                if href.startswith(("http", "https", "mailto:", "tel:", "#")):
                    continue
                
                # Handle root-relative paths
                if href.startswith("/"):
                    # Assuming / points to docs root for verification purposes
                    target_path = DOCS_DIR / href.lstrip("/")
                else:
                    # Relative path
                    target_path = (file_path.parent / href).resolve()

                # Remove query params and anchors for file existence check
                if "?" in str(target_path):
                    target_path = Path(str(target_path).split("?")[0])
                if "#" in str(target_path):
                    target_path = Path(str(target_path).split("#")[0])

                # Check existence
                # Note: target_path might be absolute now due to resolve(), need to check if it exists on FS
                if not target_path.exists():
                    # Try adding index.html if it's a directory link
                    if not target_path.suffix and (target_path / "index.html").exists():
                        continue
                    
                    broken_links.append({
                        "source": str(file_path),
                        "link": href,
                        "resolved": str(target_path)
                    })
                checked_count += 1

        except Exception as e:
            print(f"Error processing {file_path}: {e}")

    return broken_links, checked_count

if __name__ == "__main__":
    if not DOCS_DIR.exists():
        print("docs directory not found.")
        exit(1)
        
    broken, count = check_links()
    
    print(f"\nChecked {count} links.")
    if broken:
        print(f"Found {len(broken)} broken links:")
        for err in broken:
            print(f"  [{err['source']}] -> {err['link']}")
            # print(f"     (Tried: {err['resolved']})")
    else:
        print("All internal links appear valid! ✅")
