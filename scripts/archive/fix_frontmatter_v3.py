import os

CONTENT_DIR = 'content'

def fix_file(filename):
    filepath = os.path.join(CONTENT_DIR, filename)
    with open(filepath, 'r') as f:
        lines = f.readlines()

    new_lines = []
    in_frontmatter = False
    i = 0
    while i < len(lines):
        line = lines[i]
        stripped = line.strip()
        
        if i == 0 and stripped == '---':
            in_frontmatter = True
            new_lines.append(line)
            i += 1
            continue
            
        if in_frontmatter:
            if stripped.startswith('title: \''):
                # Check if it ends with quote
                if not stripped.endswith('\''):
                    # It's a multi-line title
                    full_title = stripped
                    i += 1
                    while i < len(lines):
                        next_line = lines[i].strip()
                        full_title += " " + next_line
                        if next_line.endswith('\''):
                            break
                        i += 1
                    new_lines.append(full_title + '\n')
                else:
                    new_lines.append(line)
            elif stripped.startswith('---'):
                # End of frontmatter
                in_frontmatter = False
                # Check if it has content immediately after
                if '##' in line:
                    # Split it
                    parts = line.split('##', 1)
                    new_lines.append(parts[0].strip() + '\n')
                    new_lines.append('\n')
                    new_lines.append('##' + parts[1])
                else:
                    new_lines.append(line)
            else:
                new_lines.append(line)
        else:
            # Not in frontmatter, just copy
            # But check if we missed the end of frontmatter (e.g. if --- was missing newline)
            if '---##' in line:
                 parts = line.split('##', 1)
                 new_lines.append(parts[0].strip() + '\n')
                 new_lines.append('\n')
                 new_lines.append('##' + parts[1])
            else:
                new_lines.append(line)
        
        i += 1

    with open(filepath, 'w') as f:
        f.writelines(new_lines)
    print(f"Processed {filename}")

for filename in os.listdir(CONTENT_DIR):
    if filename.endswith('.md') and filename.startswith('ai-'):
        fix_file(filename)
