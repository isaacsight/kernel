import os
import re

def remove_map_links(docs_dir):
    print(f"Scanning {docs_dir}...")
    count = 0
    
    # Regex to match the Map and Index links in the footer
    # Matches <a href="...">Map</a> or <a href="...">Index</a> where href contains map/graph.html or map/index.html
    # We'll target the key phrases "map/graph.html" and "map/index.html" inside an anchor tag
    
    for root, dirs, files in os.walk(docs_dir):
        for file in files:
            if file.endswith(".html"):
                filepath = os.path.join(root, file)
                with open(filepath, 'r', encoding='utf-8') as f:
                    content = f.readlines()
                
                new_content = []
                file_modified = False
                
                for line in content:
                    # Check if line contains the specific links we want to remove
                    if 'href="map/graph.html"' in line or 'href="../map/graph.html"' in line:
                        # Confirm it's the Map link
                        if '>Map</a>' in line or 'class="nav-link' in line:
                            print(f"Removing Map link from {filepath}")
                            file_modified = True
                            continue # Skip adding this line
                            
                    if 'href="map/index.html"' in line or 'href="../map/index.html"' in line:
                         # Confirm it's the Index link
                        if '>Index</a>' in line or 'class="nav-link' in line:
                            print(f"Removing Index link from {filepath}")
                            file_modified = True
                            continue # Skip adding this line

                    new_content.append(line)
                
                if file_modified:
                    with open(filepath, 'w', encoding='utf-8') as f:
                        f.writelines(new_content)
                    count += 1
    
    print(f"Modified {count} files.")

if __name__ == "__main__":
    docs_path = os.path.join(os.getcwd(), 'docs')
    remove_map_links(docs_path)
