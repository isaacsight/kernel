import os

CONTENT_DIR = 'content'

def fix_file(filename):
    filepath = os.path.join(CONTENT_DIR, filename)
    with open(filepath, 'r') as f:
        lines = f.readlines()

    new_lines = []
    i = 0
    modified = False
    while i < len(lines):
        line = lines[i]
        stripped = line.strip()
        
        # Fix split title where first line is quoted but second line is orphaned
        # title: '... Part 1'
        #   Part 2)'
        if stripped.startswith('title: \'') and stripped.endswith('\''):
            # Check next line
            if i + 1 < len(lines):
                next_line = lines[i+1]
                next_stripped = next_line.strip()
                # Relaxed Heuristic: next line is indented and has no colon (not a key)
                if next_line.startswith(' ') and ':' not in next_stripped:
                    # Merge
                    # Remove trailing quote from first line
                    part1 = stripped[:-1]
                    # Remove leading whitespace from second line
                    part2 = next_stripped
                    # Combine
                    full_title = f"{part1} {part2}\n"
                    new_lines.append(full_title)
                    i += 2
                    modified = True
                    print(f"Fixed split title in {filename}")
                    continue

        # Fix separator missing newline
        if '---##' in line:
             parts = line.split('##', 1)
             new_lines.append(parts[0].strip() + '\n')
             new_lines.append('\n')
             new_lines.append('##' + parts[1])
             i += 1
             modified = True
             print(f"Fixed separator in {filename}")
             continue

        new_lines.append(line)
        i += 1

    if modified:
        with open(filepath, 'w') as f:
            f.writelines(new_lines)

for filename in os.listdir(CONTENT_DIR):
    if filename.endswith('.md') and filename.startswith('ai-'):
        fix_file(filename)
