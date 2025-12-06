import os
import shutil
import datetime

print("Loading build.py...")

# Configuration
CONTENT_DIR = 'content'
TEMPLATE_DIR = 'templates'
OUTPUT_DIR = 'docs'
STATIC_DIR = 'static'
BASE_URL = 'https://www.doesthisfeelright.com'
DEFAULT_IMAGE = 'https://isaacsight.com/static/images/og-default.jpg' # Placeholder

def read_file(path):
    with open(path, 'r', encoding='utf-8') as f:
        return f.read()

def write_file(path, content):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)

def parse_frontmatter(content):
    """
    Parses simple frontmatter bounded by ---
    Returns metadata dict and body content.
    """
    parts = content.split('---', 2)
    if len(parts) < 3:
        return {}, content # No frontmatter
    
    frontmatter = parts[1].strip()
    body = parts[2].strip()
    
    metadata = {}
    for line in frontmatter.split('\n'):
        if ':' in line:
            key, value = line.split(':', 1)
            metadata[key.strip()] = value.strip()
            
    return metadata, body

def markdown_to_html(text):
    import re
    
    lines = text.split('\n')
    html_lines = []
    in_list = False
    in_code_block = False
    paragraph_buffer = []
    
    def flush_paragraph():
        if paragraph_buffer:
            content = ' '.join(paragraph_buffer)
            html_lines.append(f'<p>{content}</p>')
            paragraph_buffer.clear()

    for line in lines:
        # Code Blocks
        if line.strip().startswith('```'):
            flush_paragraph()
            if in_code_block:
                html_lines.append('</code></pre>')
                in_code_block = False
            else:
                if in_list:
                    html_lines.append('</ul>')
                    in_list = False
                html_lines.append('<pre><code>')
                in_code_block = True
            continue
            
        if in_code_block:
            html_lines.append(line) # Keep indentation in code blocks
            continue

        line = line.rstrip()
        
        # Empty lines (Paragraph breaks)
        if not line:
            flush_paragraph()
            continue

        # Headers
        if line.startswith('#'):
            flush_paragraph()
            if in_list:
                html_lines.append('</ul>')
                in_list = False
                
            level = len(line.split(' ')[0])
            content = line[level+1:].strip()
            html_lines.append(f'<h{level}>{content}</h{level}>')
            continue
            
        # Lists
        if line.startswith('* ') or line.startswith('- '):
            flush_paragraph()
            if not in_list:
                html_lines.append('<ul>')
                in_list = True
            content = line[2:].strip()
            html_lines.append(f'<li>{content}</li>')
            continue
        else:
            if in_list:
                html_lines.append('</ul>')
                in_list = False
        
        # Blockquotes
        if line.startswith('> '):
            flush_paragraph()
            html_lines.append(f'<blockquote>{line[2:].strip()}</blockquote>')
            continue
            
        # Regular text - append to buffer
        paragraph_buffer.append(line.strip())
        
    # End of loop cleanup
    flush_paragraph()
    if in_list:
        html_lines.append('</ul>')
    if in_code_block:
        html_lines.append('</code></pre>')
        
    html = '\n'.join(html_lines)
    
    # Inline formatting
    # Bold
    html = re.sub(r'\*\*(.*?)\*\*', r'<strong>\1</strong>', html)
    # Italic
    html = re.sub(r'\*(.*?)\*', r'<em>\1</em>', html)
    # Links
    html = re.sub(r'\[(.*?)\]\((.*?)\)', r'<a href="\2">\1</a>', html)
    
    return html

def calculate_similarity(text1, text2):
    """
    Calculates Jaccard similarity between two texts.
    Simple, fast, and effective for small-to-medium corpuses.
    """
    import re
    
    # Simple stop words list
    stop_words = {'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'that', 'this', 'it', 'he', 'she', 'they', 'i', 'you', 'we', 'as', 'from', 'can', 'will', 'not', 'have', 'has', 'had', 'do', 'does', 'did', 'but', 'at', 'by', 'with', 'from', 'here', 'when', 'where', 'how', 'all', 'any', 'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 's', 't', 'can', 'will', 'just', 'don', 'should', 'now'}
    
    def tokenize(text):
        # Lowercase and remove non-alphanumeric
        text = re.sub(r'[^\w\s]', '', text.lower())
        words = text.split()
        return set(w for w in words if w not in stop_words and len(w) > 2)
        
    tokens1 = tokenize(text1)
    tokens2 = tokenize(text2)
    
    if not tokens1 or not tokens2:
        return 0.0
        
    intersection = len(tokens1.intersection(tokens2))
    union = len(tokens1.union(tokens2))
    
    return intersection / union if union > 0 else 0.0

def build():
    print("Starting build...")
    # Initialize The Architect
    from admin.engineers.architect import Architect
    architect = Architect()
    
    # Register Plugins
    from admin.plugins.style_guide import StyleGuidePlugin
    from admin.plugins.visual_qa import VisualQAPlugin
    from admin.plugins.librarian_plugin import LibrarianPlugin
    from admin.plugins.guardian_plugin import GuardianPlugin
    
    # architect.register_plugin(StyleGuidePlugin())
    # architect.register_plugin(VisualQAPlugin())
    # architect.register_plugin(LibrarianPlugin())
    # architect.register_plugin(GuardianPlugin())
    
    # Hook: Pre-Build
    architect.run_hook('on_pre_build')

    # 1. Prepare Output Directory
    print("Step 1: Preparing Output Directory...")
    if os.path.exists(OUTPUT_DIR):
        shutil.rmtree(OUTPUT_DIR)
    os.makedirs(OUTPUT_DIR)

    # 1b. Create CNAME and .nojekyll
    write_file(os.path.join(OUTPUT_DIR, 'CNAME'), 'www.doesthisfeelright.com')
    write_file(os.path.join(OUTPUT_DIR, '.nojekyll'), '')
    
    # 2. Copy Static Assets
    print("Step 2: Copying Static Assets...")
    # Copy all static assets to docs/static (Primary Location)
    shutil.copytree(STATIC_DIR, os.path.join(OUTPUT_DIR, 'static'))

    # Selective Copy to Root (Legacy Compatibility for Templates)
    # Only copy 'css' and 'js' to docs/css and docs/js
    # We consciously SKIP 'images' and 'videos' to save space (avoiding duplication)
    for item in ['css', 'js']:
        s = os.path.join(STATIC_DIR, item)
        d = os.path.join(OUTPUT_DIR, item)
        if os.path.exists(s):
            if os.path.isdir(s):
                shutil.copytree(s, d)
            else:
                shutil.copy2(s, d)

    # 3. Load Templates
    print("Step 3: Loading Templates...")
    base_template = read_file(os.path.join(TEMPLATE_DIR, 'base.html'))
    post_template = read_file(os.path.join(TEMPLATE_DIR, 'post.html'))
    index_template = read_file(os.path.join(TEMPLATE_DIR, 'index.html'))

    # 4. Process Posts
    print("Step 4: Processing Posts...")
    posts = []
    for filename in os.listdir(CONTENT_DIR):
        if not filename.endswith('.html') and not filename.endswith('.md'):
            continue
            
        # Skip standalone pages
        if filename in ['about.html', 'consulting.md']:
            continue
            
        filepath = os.path.join(CONTENT_DIR, filename)
        raw_content = read_file(filepath)
        metadata, body = parse_frontmatter(raw_content)
        
        # Convert Markdown to HTML if it's a markdown file or just generally
        # Since we are writing raw markdown in the files, we should convert it.
        if filename.endswith('.md') or True: # Always try to convert for now
            body = markdown_to_html(body)
            
        # Slug is filename without extension (Sanitized)
        raw_slug = os.path.splitext(filename)[0]
        # Remove question marks, colons, ampersands, and handling other special chars for URLs
        clean_slug = raw_slug.replace('?', '').replace(':', '').replace('&', '').replace("'", "").replace('"', "")
        metadata['slug'] = clean_slug
        metadata['original_filename'] = filename

        # Hook: Post-Process
        architect.run_hook('on_post_process', metadata, body)
        
        # Series Indicator
        series = metadata.get('series')
        series_html = ""
        if series:
            series_html = f'<div class="series-indicator">Series: {series}</div>'



        # Related Posts (Placeholder for now, we need a second pass or pre-calculation)
        # Since we are iterating through posts to generate them, we might not have the full list yet if we do it in one pass.
        # However, we collected `posts` list earlier? No, we are inside the loop that populates `posts`.
        # We need to change the order: First collect all metadata, THEN generate HTML.
        
        # For now, let's just append metadata to list first, then do a second pass for generation.
        posts.append(metadata)

    # Pre-load all bodies for similarity check to avoid O(N^2) disk reads
    print("Pre-loading post bodies...")
    post_bodies = {}
    for post in posts:
        slug = post['slug']
        original_filename = post.get('original_filename', slug + '.md') # Fallback
        filepath = os.path.join(CONTENT_DIR, original_filename)
        # Fallback check
        if not os.path.exists(filepath):
            # Try varying extensions if original_filename wasn't accurate (shouldn't happen with new logic)
            if os.path.exists(os.path.join(CONTENT_DIR, slug + '.md')):
                filepath = os.path.join(CONTENT_DIR, slug + '.md')
            elif os.path.exists(os.path.join(CONTENT_DIR, slug + '.html')):
                filepath = os.path.join(CONTENT_DIR, slug + '.html')
        _, body = parse_frontmatter(read_file(filepath))
        post_bodies[slug] = body

    # Sort posts: Featured first, then by Date (descending), then by Title (ascending)
    def post_sort_key(p):
        is_featured = p.get('featured', 'false').lower() == 'true'
        date_str = p.get('date', '1970-01-01')
        title = p.get('title', '')
        return (not is_featured, date_str, title) # False < True for boolean sort? No, False=0, True=1. We want True first.
        # Wait, False < True. So (True, ...) comes AFTER (False, ...).
        # We want Featured (True) to be FIRST (smallest index) or LAST (largest index)?
        # If we sort descending (reverse=True), True > False, so True comes first.
        # But date should be descending (newest first).
        # And title should be ascending (A-Z).
        # Complex sort. Let's use a tuple with negation for descending parts if we use default sort.
        # Or just use reverse=True and negate the ascending parts.
        # Let's do: (is_featured, date_str) -> reverse=True.
        # Title is secondary.
        
    # Let's keep it simple.
    # Primary: Featured (True > False)
    # Secondary: Date (New > Old)
    # Tertiary: Title (Z > A if reverse=True, which is weird).
    
    # Better approach:
    
    # --- Move Logic Here ---
    # Sort posts by date (descending) for general usage
    posts.sort(key=lambda x: x.get('date', '0000-00-00'), reverse=True)

    # Split Featured vs Recent vs Experiments
    starter_set_slugs = [
        'to-be-witnessed',
        'the-invisible-architect',
        'the-rise-of-the-non-musician'
    ]
    
    starter_set_posts = []
    experiments_posts = []
    main_feed_posts = []
    
    for post in posts:
        if post['slug'] == 'about':
            continue
            
        # Check for Starter Set (Highlighted, but also keep in main feed or not? 
        # User said "include experiments into primary essays". 
        # Usually starter set is just a "Start Here" block. 
        # Let's keep them in separate arrays for the specific sections, but for the MAIN FEED, 
        # we want everything.
        
        if post['slug'] in starter_set_slugs:
            starter_set_posts.append(post)
            # Don't continue, let it fall through to main feed? 
            # Original logic had 'continue'. Let's keep them exclusive for the specific sections 
            # IF that was the intent, but usually "Latest Essays" implies chronological list of EVERYTHING.
            # Let's add everything to main_feed_posts.
        
        if post['slug'].startswith('ai-'):
            experiments_posts.append(post)
            # Also add to main feed!
            
        main_feed_posts.append(post)

    # Sort Starter Set by the order in starter_set_slugs
    starter_set_posts.sort(key=lambda x: starter_set_slugs.index(x['slug']))

    # Generate Starter Set HTML & Nav HTML
    starter_set_html = ""
    starter_set_nav_html = ""
    for i, post in enumerate(starter_set_posts):
        tags = post.get('tags', '').split(',') if post.get('tags') else [post.get('category', 'General')]
        tags = [t.strip() for t in tags if t.strip()]
        primary_tag = tags[0] if tags else 'General'
        
        starter_set_html += f"""
            <a href="posts/{post['slug']}.html" class="starter-card">
                <div class="starter-header">
                    <span class="starter-number">0{i+1}</span>
                    <span class="starter-chip">Start Here</span>
                </div>
                <h3 class="starter-title">{post.get('title', 'Untitled')}</h3>
                <p class="starter-excerpt">{post.get('excerpt', '')}</p>
                <div class="starter-meta">{primary_tag}</div>
            </a>
        """
        
        # Sidebar Nav Item
        starter_set_nav_html += f'<a href="{{{{ root }}}}posts/{post["slug"]}.html" class="nav-link">{post.get("title", "Untitled")}</a>'

    # 4b. Second Pass: Generate HTML for Posts
    print("Step 4b: Generating HTML for Posts...")
    for post in posts:
        slug = post['slug']
        # Re-read body because we didn't store it in metadata (to save memory/complexity, though we could have)
        # Actually, let's just re-read the file. It's fast enough.
        # Wait, we need the body content.
        # Let's refactor slightly to store body in a separate dict or just re-read.
        # Re-reading is safer for now to avoid breaking the loop structure too much.
        
        # Find related posts using AI (Jaccard Similarity)
        # We compare the current post's body with every other post's body
        related_scores = []
        
        # Get current post body from cache
        current_body = post_bodies.get(slug, "")
        
        for p in posts:
            if p['slug'] == slug: continue
            
            # Get other post body from cache
            p_body = post_bodies.get(p['slug'], "")
            
            # Calculate score
            # score = calculate_similarity(current_body, p_body)
            
            # Boost score if categories match
            # if p.get('category') == post.get('category'):
            #     score += 0.1
                
            # related_scores.append((score, p))
            
        # Sort by score descending
        # related_scores.sort(key=lambda x: x[0], reverse=True)
        
        # Take top 2
        # related = [item[1] for item in related_scores[:2] if item[0] > 0.05] # Threshold to avoid garbage matches
        related = []
        
        related_html = ""
        if related:
            related_items = ""
            for r in related:
                r_tags = r.get('tags', '').split(',') if r.get('tags') else [r.get('category', 'General')]
                r_primary_tag = r_tags[0].strip() if r_tags else 'General'
                related_items += f"""
                <a href="{r['slug']}.html" class="post-card">
                    <span class="post-meta">{r_primary_tag} • {r.get('read_time', '5 min read')}</span>
                    <h3>{r.get('title')}</h3>
                </a>
                """
            related_html = f"""
            <div class="related-posts">
                <div class="related-header">Read Next</div>
                <div class="related-grid">
                    {related_items}
                </div>
            </div>
            """

        # Re-read content for generation
        # We need to duplicate some logic here, or better yet, just move the generation here.
        # Let's grab the body again.
        # Use original filename if available (it should be)
        original_filename = post.get('original_filename', slug + '.md')
        filepath = os.path.join(CONTENT_DIR, original_filename)
        
        # Fallback (old logic)
        if not os.path.exists(filepath):
             if os.path.exists(os.path.join(CONTENT_DIR, slug + '.md')):
                filepath = os.path.join(CONTENT_DIR, slug + '.md')
             else:
                filepath = os.path.join(CONTENT_DIR, slug + '.html')
            
        raw_content = read_file(filepath)
        _, body = parse_frontmatter(raw_content)
        if filepath.endswith('.md'):
            body = markdown_to_html(body)

        # Generate Tags HTML again
        raw_tags = post.get('tags', '')
        if raw_tags.startswith('[') and raw_tags.endswith(']'):
            raw_tags = raw_tags[1:-1]
            
        tags = raw_tags.split(',') if raw_tags else [post.get('category', 'General')]
        tags_html = ""
        for tag in tags:
            tag = tag.strip().replace("'", "").replace('"', "").replace('[', "").replace(']', "")
            if not tag: continue
            
            # Strict slugify
            tag_slug = tag.lower().replace(' ', '-')
            tag_slug = "".join(c for c in tag_slug if c.isalnum() or c == '-')
            color_index = sum(ord(c) for c in tag) % 6
            tags_html += f'<a href="{{{{ root }}}}tags/{tag_slug}.html" class="post-tag tag-color-{color_index}">{tag}</a> '

        # Series HTML again (since we are in new loop)
        series = post.get('series')
        series_html = ""
        if series:
            series_html = f'<div class="series-indicator">Series: {series}</div>'

        post_html = post_template.replace('{{ title }}', post.get('title', 'Untitled'))
        post_html = post_html.replace('{{ category }}', post.get('category', 'General'))
        post_html = post_html.replace('{{ tags_html }}', tags_html)
        post_html = post_html.replace('{{ series_indicator }}', series_html)
        post_html = post_html.replace('{{ post_content }}', body)
        # post_html = post_html.replace('{{ reply_section }}', reply_html) # Removed
        post_html = post_html.replace('{{ related_posts }}', related_html)
        post_html = post_html.replace('{{ root }}', '../')
        post_html = post_html.replace('{{ slug }}', slug)

        # Date formatting
        date_str = post.get('date', '')
        try:
            # Flexible date parsing
            date_str = str(date_str).strip()
            if len(date_str) == 10: # YYYY-MM-DD
                date_obj = datetime.datetime.strptime(date_str, '%Y-%m-%d')
            else:
                date_obj = datetime.datetime.strptime(date_str, '%Y-%m-%d %H:%M:%S')
            
            date_display = date_obj.strftime('%B %d, %Y')
        except Exception as e:
            # print(f"Date formatting error for {slug}: {e}")
            date_display = date_str
        post_html = post_html.replace('{{ date }}', date_display)
        
        # Generate JSON-LD
        import json
        json_ld_data = {
            "@context": "https://schema.org",
            "@type": "BlogPosting",
            "headline": post.get('title', 'Untitled'),
            "image": [post.get('image', DEFAULT_IMAGE)],
            "datePublished": post.get('date', ''),
            "dateModified": post.get('date', ''),
            "author": [{
                "@type": "Person",
                "name": "Isaac Hernandez",
                "url": BASE_URL
            }]
        }
        json_ld_script = f'<script type="application/ld+json">{json.dumps(json_ld_data)}</script>'

        full_page = base_template.replace('{{ title }}', post.get('title', 'Untitled'))
        full_page = full_page.replace('{{ starter_set_nav }}', starter_set_nav_html)
        full_page = full_page.replace('{{ content }}', post_html)
        full_page = full_page.replace('{{ root }}', '../')
        full_page = full_page.replace('{{ description }}', post.get('excerpt', 'Thoughts on business, technology, and the human condition.'))
        full_page = full_page.replace('{{ url }}', f"{BASE_URL}/posts/{slug}.html")
        full_page = full_page.replace('{{ image }}', post.get('image', DEFAULT_IMAGE))
        full_page = full_page.replace('{{ og_type }}', 'article')
        full_page = full_page.replace('{{ json_ld }}', json_ld_script)
        
        write_file(os.path.join(OUTPUT_DIR, 'posts', f'{slug}.html'), full_page)

    # 5. Generate Homepage
    print("Step 5: Generating Homepage...")
    # Sorting and Splitting already done above.
    
    # Generate Filter HTML
    # Generate Filter HTML
    # Normalize categories
    raw_categories = [p.get('category', 'General') for p in posts if p.get('slug') != 'about']
    clean_categories = set()
    for cat in raw_categories:
        # Remove quotes if present
        cat = cat.strip()
        if (cat.startswith('"') and cat.endswith('"')) or (cat.startswith("'") and cat.endswith("'")):
            cat = cat[1:-1]
        clean_categories.add(cat)
    
    categories = sorted(list(clean_categories))

    filter_html = '<div class="filter-bar">'
    filter_html += '<button class="filter-btn active" data-filter="all">All</button>'
    for cat in categories:
        filter_html += f'<button class="filter-btn" data-filter="{cat}">{cat}</button>'
    filter_html += '</div>'
    
    # Add Sort Controls
    filter_html += '''
    <div class="sort-bar">
        <span class="sort-label">Sort:</span>
        <button class="sort-btn active" data-sort="date-desc">Newest</button>
        <span class="sort-divider">/</span>
        <button class="sort-btn" data-sort="date-asc">Oldest</button>
        
        <!-- Desktop Search (Added) -->
        <div class="feed-search-container desktop-only">
            <input type="text" id="feed-search-input" placeholder="Search essays..." aria-label="Search essays">
            <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
        </div>
    </div>
    '''
    
    # Logic moved up.
    # Logic moved up.

    # Generate Experiments Sidebar HTML (Top 8 for Homepage)
    # Sort experiments by date descending
    experiments_posts.sort(key=lambda x: x.get('date', '0000-00-00'), reverse=True)
    
    experiments_sidebar_html = ""
    sidebar_experiments = experiments_posts[:8]
    
    for post in sidebar_experiments:
        date_str = post.get('date', '')
        try:
            date_obj = datetime.datetime.strptime(date_str, '%Y-%m-%d')
            date_display = date_obj.strftime('%b %d')
        except:
            date_display = ""
            
        title = post.get('title', 'Untitled')
        title = title.replace('AI: ', '').replace('Experiment: ', '')
        if '(Theme:' in title:
            title = title.split('(Theme:')[0].strip()
            
        experiments_sidebar_html += f"""
            <a href="posts/{post['slug']}.html" class="experiment-card-small">
                <span class="experiment-date">{date_display}</span>
                <span class="experiment-title">{title}</span>
            </a>
        """
        
    experiments_sidebar_html += """
        <a href="experiments.html" class="experiment-card-small view-all">
            <span class="experiment-title">View All Experiments →</span>
        </a>
    """

    # Generate Sidebar Collections List
    tag_counts = {}
    for post in posts:
        if post['slug'] == 'about': continue
        
        raw_tags = post.get('tags', '')
        if raw_tags.startswith('[') and raw_tags.endswith(']'):
            raw_tags = raw_tags[1:-1]
            
        tags_list = raw_tags.split(',') if raw_tags else [post.get('category', 'General')]
        
        for tag in tags_list:
            tag = tag.strip()
            if (tag.startswith("'") and tag.endswith("'")) or (tag.startswith('"') and tag.endswith('"')):
                tag = tag[1:-1]
                
            if not tag: continue
            tag_counts[tag] = tag_counts.get(tag, 0) + 1
            
    top_tags = sorted(tag_counts.items(), key=lambda x: x[1], reverse=True)[:5]
    
    collections_list_html = ""
    for tag, count in top_tags:
        tag_slug = tag.lower().replace(' ', '-')
        collections_list_html += f"""
            <li>
                <a href="tags/{tag_slug}.html" class="collection-link">
                    <span class="name">{tag}</span>
                    <span class="count">{count}</span>
                </a>
            </li>
        """

    # --- Pagination Logic Helper ---
    def generate_pagination_html(current_page, total_pages, base_url_pattern):
        if total_pages <= 1:
            return ""
            
        html = '<div class="pagination">'
        
        # Previous
        if current_page > 1:
            prev_url = base_url_pattern.format(page=current_page - 1) if current_page - 1 > 1 else 'index.html'
            # Check if pattern handles page 1 explicitly or we assume index.html
            if 'latest-essays' in base_url_pattern:
                if current_page == 2:
                    prev_url = 'index.html'
                else:
                    prev_url = f'latest-essays-{current_page - 1}.html'
            elif 'experiments' in base_url_pattern:
                 if current_page == 2:
                    prev_url = 'experiments.html'
                 else:
                    prev_url = f'experiments-{current_page - 1}.html'
            
            html += f'<a href="{prev_url}" class="pagination-link prev">&larr; Previous</a>'
        
        # Numbers
        html += f'<span class="pagination-info">Page {current_page} of {total_pages}</span>'
        
        # Next
        if current_page < total_pages:
            next_url = base_url_pattern.format(page=current_page + 1)
            html += f'<a href="{next_url}" class="pagination-link next">Next &rarr;</a>'
            
        html += '</div>'
        return html

    # Sort main feed by date
    main_feed_posts.sort(key=lambda x: x.get('date', '0000-00-00'), reverse=True)

    # --- Generate Homepage with Client-Side Functionality ---
    # We render ALL posts into index.html so main.js can handle filtering/sorting/pagination.
    # We remove the server-side pagination loop for index.html.
    
    posts_html = ""
    for post in main_feed_posts:
        raw_tags = post.get('tags', '')
        if raw_tags.startswith('[') and raw_tags.endswith(']'):
            raw_tags = raw_tags[1:-1]
        tags_list = raw_tags.split(',') if raw_tags else [post.get('category', 'General')]
        cleaned_tags = []
        for t in tags_list:
            t = t.strip()
            # Clean tags
            t = t.replace("'", "").replace('"', "").replace('[', "").replace(']', "")
            if t: cleaned_tags.append(t)
        tags = cleaned_tags if cleaned_tags else ['General']
        primary_tag = tags[0]
        
        # Clean Category for data attribute
        raw_cat = post.get('category', 'General').strip()
        clean_cat = raw_cat.replace("'", "").replace('"', "")
        
        date_str = post.get('date', '')
        try:
            date_obj = datetime.datetime.strptime(date_str, '%Y-%m-%d')
            date_display = date_obj.strftime('%b %d, %Y')
        except:
            date_display = date_str
            
        posts_html += f"""
            <a href="posts/{post['slug']}.html" class="post-card category-{clean_cat.lower().replace(' ', '-')}" data-category="{clean_cat}" data-date="{date_str}">
                <div class="post-card-content">
                    <div class="post-header">
                        <h2 class="post-title">{post.get('title', 'Untitled')}</h2>
                        <span class="post-category-chip">{primary_tag}</span>
                    </div>
                    <p class="post-excerpt">{post.get('excerpt', '')}</p>
                    <div class="post-meta-row">
                        <span class="post-meta">{date_display} • {post.get('read_time', '5 min read')}</span>
                    </div>
                </div>
            </a>
        """
        
    # Generate Single Index Page (No Server Pagination)
    index_content = index_template.replace('{{ starter_set }}', starter_set_html)
    index_content = index_content.replace('{{ recent_posts }}', posts_html) # No server pagination
    index_content = index_content.replace('{{ experiments_list }}', experiments_sidebar_html)
    index_content = index_content.replace('{{ filters }}', filter_html)
    index_content = index_content.replace('{{ collections_list }}', collections_list_html)
    
    full_index = base_template.replace('{{ content }}', index_content)
    full_index = full_index.replace('{{ starter_set_nav }}', starter_set_nav_html)
    full_index = full_index.replace('{{ root }}', '') 
    full_index = full_index.replace('{{ image }}', DEFAULT_IMAGE)
    full_index = full_index.replace('{{ og_type }}', 'website')
    full_index = full_index.replace('{{ json_ld }}', '')

    full_index = full_index.replace('{{ title }}', 'Does This Feel Right?')
    full_index = full_index.replace('{{ description }}', 'Thoughts on business, technology, and the human condition.')
    full_index = full_index.replace('{{ url }}', f"{BASE_URL}/index.html")
    write_file(os.path.join(OUTPUT_DIR, 'index.html'), full_index)

    # Note: We are SKIPPING generation of latest-essays-N.html to force client-side pagination usage
    # If users have JS disabled, they will see ONE LONG PAGE, which is acceptable/better than partial pages.
    pass 
    
    # 8. Generate Experiments Page (Paginated)
    print("Step 8: Generating Experiments Page...")
    
    EXP_PER_PAGE = 8 # Same limit for consistency
    total_exp = len(experiments_posts)
    total_exp_pages = (total_exp + EXP_PER_PAGE - 1) // EXP_PER_PAGE
    
    for page in range(1, total_exp_pages + 1):
        start_idx = (page - 1) * EXP_PER_PAGE
        end_idx = start_idx + EXP_PER_PAGE
        display_exp = experiments_posts[start_idx:end_idx]
        
        experiments_page_inner_html = '<div class="experiments-archive">'
        experiments_page_inner_html += '<div class="archive-header-flex">'
        experiments_page_inner_html += '<div class="header-content">'
        experiments_page_inner_html += '<h1 class="experiments-archive-title">Experiments</h1>'
        experiments_page_inner_html += '<p class="experiments-archive-desc">Technical notes, AI workshops, and raw ideas.</p>'
        experiments_page_inner_html += '</div>'
        experiments_page_inner_html += '''
        <div class="feed-search-container desktop-only">
            <input type="text" id="feed-search-input" placeholder="Search experiments..." aria-label="Search experiments">
            <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
        </div>
        '''
        experiments_page_inner_html += '</div>'
        experiments_page_inner_html += '<div class="experiments-grid">'
        
        for post in display_exp:
            date_str = post.get('date', '')
            try:
                date_obj = datetime.datetime.strptime(date_str, '%Y-%m-%d')
                date_display = date_obj.strftime('%b %d, %Y')
            except:
                date_display = ""
                
            title = post.get('title', 'Untitled')
            title = title.replace('AI: ', '').replace('Experiment: ', '')
            if '(Theme:' in title:
                title = title.split('(Theme:')[0].strip()
                
            experiments_page_inner_html += f"""
                <a href="posts/{post['slug']}.html" class="experiment-card">
                    <div class="experiment-card-header">
                        <span class="experiment-card-date">{date_display}</span>
                        <span class="experiment-card-chip">Experiment</span>
                    </div>
                    <h3 class="experiment-card-title">{title}</h3>
                </a>
            """
        experiments_page_inner_html += '</div>'
        
        # Add Pagination
        experiments_page_inner_html += generate_pagination_html(page, total_exp_pages, 'experiments-{page}.html')
        
        experiments_page_inner_html += '</div>'
        
        full_experiments_page = base_template.replace('{{ content }}', experiments_page_inner_html)
        full_experiments_page = full_experiments_page.replace('{{ starter_set_nav }}', starter_set_nav_html)
        full_experiments_page = full_experiments_page.replace('{{ root }}', '')
        full_experiments_page = full_experiments_page.replace('{{ image }}', DEFAULT_IMAGE)
        full_experiments_page = full_experiments_page.replace('{{ og_type }}', 'website')
        full_experiments_page = full_experiments_page.replace('{{ json_ld }}', '')
        
        if page == 1:
            full_experiments_page = full_experiments_page.replace('{{ title }}', 'Experiments - Does This Feel Right?')
            full_experiments_page = full_experiments_page.replace('{{ description }}', 'Technical notes and experiments.')
            full_experiments_page = full_experiments_page.replace('{{ url }}', f"{BASE_URL}/experiments.html")
            write_file(os.path.join(OUTPUT_DIR, 'experiments.html'), full_experiments_page)
        else:
            full_experiments_page = full_experiments_page.replace('{{ title }}', f'Experiments - Page {page}')
            full_experiments_page = full_experiments_page.replace('{{ description }}', f'Experiments page {page}.')
            full_experiments_page = full_experiments_page.replace('{{ url }}', f"{BASE_URL}/experiments-{page}.html")
            write_file(os.path.join(OUTPUT_DIR, f'experiments-{page}.html'), full_experiments_page)



    # 9. Generate About Page (Special Case)
    # We can just have an about.md in content and treat it differently or just hardcode it.
    # Let's look for about.html in content
    if os.path.exists(os.path.join(CONTENT_DIR, 'about.html')):
        raw_about = read_file(os.path.join(CONTENT_DIR, 'about.html'))
        meta, body = parse_frontmatter(raw_about)
        
        # About page uses a simpler layout, usually just the article content
        # We can reuse post template logic but without the newsletter box if we wanted, 
        # but for now let's just use the generic page logic.
        
        # Actually, the about page in the design had a newsletter box too.
        # Let's just render it like a post but without the "Back to Home" link maybe?
        # Or just render it.
        
        about_html = f"""
            <article>
                <h1>{meta.get('title')}</h1>
                {body}
                <div class="newsletter-box newsletter-embed">
                    <p>Subscribe via <a href="feed.xml">RSS</a> to get new posts directly.</p>
                </div>
            </article>
        """
        
        full_about = base_template.replace('{{ title }}', meta.get('title'))
        full_about = full_about.replace('{{ starter_set_nav }}', starter_set_nav_html)
        full_about = full_about.replace('{{ content }}', about_html)
        full_about = full_about.replace('{{ root }}', '')
        full_about = full_about.replace('{{ description }}', meta.get('excerpt', 'About us.'))
        full_about = full_about.replace('{{ url }}', f"{BASE_URL}/about.html")
        full_about = full_about.replace('{{ image }}', DEFAULT_IMAGE)
        full_about = full_about.replace('{{ og_type }}', 'website')
        full_about = full_about.replace('{{ json_ld }}', '')
        
        write_file(os.path.join(OUTPUT_DIR, 'about.html'), full_about)

    # 9b. Generate Consulting Page
    if os.path.exists(os.path.join(CONTENT_DIR, 'consulting.md')):
        raw_consulting = read_file(os.path.join(CONTENT_DIR, 'consulting.md'))
        meta, body = parse_frontmatter(raw_consulting)
        body = markdown_to_html(body)
        
        consulting_html = f"""
            <article>
                <h1>{meta.get('title')}</h1>
                {body}
            </article>
        """
        
        full_consulting = base_template.replace('{{ title }}', meta.get('title'))
        full_consulting = full_consulting.replace('{{ content }}', consulting_html)
        full_consulting = full_consulting.replace('{{ root }}', '')
        full_consulting = full_consulting.replace('{{ description }}', meta.get('excerpt', 'Consulting services.'))
        full_consulting = full_consulting.replace('{{ url }}', f"{BASE_URL}/consulting.html")
        full_consulting = full_consulting.replace('{{ image }}', DEFAULT_IMAGE)
        full_consulting = full_consulting.replace('{{ og_type }}', 'website')
        full_consulting = full_consulting.replace('{{ json_ld }}', '')
        
        write_file(os.path.join(OUTPUT_DIR, 'consulting.html'), full_consulting)

    # 10. Generate RSS Feed
    import html
    
    rss_items = ""
    for post in posts:
        if post['slug'] == 'about':
            continue
        
        # Escape XML special characters
        title = html.escape(post.get('title', 'Untitled'))
        excerpt = html.escape(post.get('excerpt', ''))
        category = html.escape(post.get('category', 'General'))
        
        # Format Date for RSS (RFC 822)
        pub_date = ""
        date_val = post.get('date')
        if date_val:
            try:
                import datetime
                import email.utils
                
                if isinstance(date_val, str):
                    date_obj = datetime.datetime.strptime(date_val, '%Y-%m-%d')
                elif isinstance(date_val, datetime.date):
                    # Convert date to datetime (midnight)
                    date_obj = datetime.datetime.combine(date_val, datetime.time.min)
                elif isinstance(date_val, datetime.datetime):
                    date_obj = date_val
                else:
                    date_obj = None
                
                if date_obj:
                    pub_date = email.utils.formatdate(date_obj.timestamp(), usegmt=True)
            except Exception as e:
                print(f"Error parsing date for RSS: {e}")
                pass

        rss_items += f"""
        <item>
            <title>{title}</title>
            <link>{BASE_URL}/posts/{html.escape(post['slug'])}.html</link>
            <description>{excerpt}</description>
            <category>{category}</category>
            <guid>{BASE_URL}/posts/{html.escape(post['slug'])}.html</guid>
            <pubDate>{pub_date}</pubDate>
        </item>
        """
    
    rss_feed = f"""<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0">
<channel>
    <title>Does This Feel Right?</title>
    <link>{BASE_URL}</link>
    <description>Thoughts on business, technology, and the human condition.</description>
    <language>en-us</language>
    {rss_items}
</channel>
</rss>"""
    
    write_file(os.path.join(OUTPUT_DIR, 'feed.xml'), rss_feed)
    
    # Hook: Post-Build
    architect.run_hook('on_post_build', OUTPUT_DIR)

    # 10b. Generate Search Index
    import json
    search_index = []
    for post in posts:
        if post['slug'] == 'about': continue
        
        # Strip HTML from excerpt for cleaner search
        import re
        clean_excerpt = re.sub('<[^<]+?>', '', post.get('excerpt', ''))
        
        search_index.append({
            'title': post.get('title', 'Untitled'),
            'slug': post['slug'],
            'excerpt': clean_excerpt,
            'tags': post.get('tags', ''),
            'category': post.get('category', 'General'),
            'date': post.get('date', '')
        })
    
    search_index_path = os.path.join(OUTPUT_DIR, 'search.json')
    write_file(search_index_path, json.dumps(search_index))
    
    # Generate Manifest.json (PWA)
    manifest = {
      "name": "Does This Feel Right?",
      "short_name": "DTFR",
      "start_url": "/index.html",
      "display": "standalone",
      "background_color": "#fafafa",
      "theme_color": "#fafafa",
      "orientation": "portrait",
      "icons": [
        {
          "src": "/static/images/icon-192.png",
          "sizes": "192x192",
          "type": "image/png"
        },
        {
          "src": "/static/images/icon-512.png",
          "sizes": "512x512",
          "type": "image/png"
        }
      ]
    }
    manifest_path = os.path.join(OUTPUT_DIR, 'manifest.json')
    write_file(manifest_path, json.dumps(manifest, indent=2))

    # --- NEW: Generate Collections Page and Tag Pages ---
    print("Step 9b: Generating Collections and Tag Pages...")
    
    # 1. Aggregate Tags (Global)
    global_tag_counts = {}
    tag_to_posts = {}
    
    for post in posts:
        if post['slug'] == 'about': continue
        
        raw_tags = post.get('tags', '')
        # Robust tag cleaning
        if raw_tags.startswith('[') and raw_tags.endswith(']'):
            raw_tags = raw_tags[1:-1]
            
        tags_list = raw_tags.split(',') if raw_tags else [post.get('category', 'General')]
        
        for tag in tags_list:
            tag = tag.strip()
            # Remove quotes and brackets from individual tags
            tag = tag.replace("'", "").replace('"', "").replace('[', "").replace(']', "")
            
            if not tag: continue
            
            global_tag_counts[tag] = global_tag_counts.get(tag, 0) + 1
            if tag not in tag_to_posts:
                tag_to_posts[tag] = []
            tag_to_posts[tag].append(post)

    # 2. Generate Collections Page (collections.html)
    # Sort tags by count descending
    sorted_tags = sorted(global_tag_counts.items(), key=lambda x: x[1], reverse=True)
    
    collections_html = """
    <div class="collections-archive">
        <div class="collections-header">
            <div class="archive-header-flex">
                <div class="header-content">
                    <h1>Collections</h1>
                    <p>Explore essays by topic.</p>
                </div>
                <div class="feed-search-container desktop-only">
                    <input type="text" id="feed-search-input" placeholder="Search collections..." aria-label="Search collections">
                    <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="11" cy="11" r="8"></circle>
                        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                    </svg>
                </div>
            </div>
        </div>
        <div class="collections-grid">
    """
    
    for tag, count in sorted_tags:
        # Strict slugify for URLs
        tag_slug = tag.lower().replace(' ', '-')
        tag_slug = "".join(c for c in tag_slug if c.isalnum() or c == '-')
        
        collections_html += f"""
            <a href="tags/{tag_slug}.html" class="collection-card">
                <h3>{tag}</h3>
                <span class="count">{count} {"essay" if count == 1 else "essays"}</span>
            </a>
        """
    
    collections_html += """
        </div>
    </div>
    """
    
    full_collections = base_template.replace('{{ content }}', collections_html)
    full_collections = full_collections.replace('{{ starter_set_nav }}', starter_set_nav_html)
    full_collections = full_collections.replace('{{ root }}', '') 
    full_collections = full_collections.replace('{{ image }}', DEFAULT_IMAGE)
    full_collections = full_collections.replace('{{ og_type }}', 'website')
    full_collections = full_collections.replace('{{ json_ld }}', '')
    full_collections = full_collections.replace('{{ title }}', 'Collections - Does This Feel Right?')
    full_collections = full_collections.replace('{{ description }}', 'Explore essays by topic.')
    full_collections = full_collections.replace('{{ url }}', f"{BASE_URL}/collections.html")
    
    write_file(os.path.join(OUTPUT_DIR, 'collections.html'), full_collections)
    
    # 3. Generate Individual Tag Pages (tags/{slug}.html)
    os.makedirs(os.path.join(OUTPUT_DIR, 'tags'), exist_ok=True)
    
    for tag, tag_posts in tag_to_posts.items():
        # Strict slugify
        tag_slug = tag.lower().replace(' ', '-')
        tag_slug = "".join(c for c in tag_slug if c.isalnum() or c == '-')
        
        # Sort posts by date
        tag_posts.sort(key=lambda x: x.get('date', '0000-00-00'), reverse=True)
        
        tag_page_html = f"""
        <div class="tag-archive">
            <div class="tag-header">
                <div class="archive-header-flex">
                    <div class="header-content">
                        <span class="tag-label">Collection</span>
                        <h1>{tag}</h1>
                        <p>{len(tag_posts)} {"essay" if len(tag_posts) == 1 else "essays"} in this collection.</p>
                    </div>
                    <div class="feed-search-container desktop-only">
                        <input type="text" id="feed-search-input" placeholder="Search logic..." aria-label="Search essays">
                        <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="11" cy="11" r="8"></circle>
                            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                        </svg>
                    </div>
                </div>
            </div>
            <div class="post-feed">
        """
        
        for post in tag_posts:
            # Reusing post card generation logic (simplified)
            date_str = post.get('date', '')
            try:
                date_obj = datetime.datetime.strptime(date_str, '%Y-%m-%d')
                date_display = date_obj.strftime('%b %d, %Y')
            except:
                date_display = date_str
            
            # Ensure slug is clean
            # Note: post['slug'] comes from frontmatter or filename, need to ensure consistency
            # But here we just use it. If the post file exists, verify_links will check it.
                
            tag_page_html += f"""
                <a href="../posts/{post['slug']}.html" class="post-card">
                    <div class="post-card-content">
                        <div class="post-header">
                            <h2 class="post-title">{post.get('title', 'Untitled')}</h2>
                        </div>
                        <p class="post-excerpt">{post.get('excerpt', '')}</p>
                        <div class="post-meta-row">
                            <span class="post-meta">{date_display} • {post.get('read_time', '5 min read')}</span>
                        </div>
                    </div>
                </a>
            """
            
        tag_page_html += """
            </div>
            <div class="back-link-container">
                <a href="../collections.html" class="back-link">← All Collections</a>
            </div>
        </div>
        """
        
        full_tag_page = base_template.replace('{{ content }}', tag_page_html)
        # Fix root path for subdirectory
        full_tag_page = full_tag_page.replace('{{ starter_set_nav }}', starter_set_nav_html.replace('href="', 'href="../').replace('src="', 'src="../'))
        full_tag_page = full_tag_page.replace('{{ root }}', '../') 
        full_tag_page = full_tag_page.replace('{{ image }}', DEFAULT_IMAGE)
        full_tag_page = full_tag_page.replace('{{ og_type }}', 'website')
        full_tag_page = full_tag_page.replace('{{ json_ld }}', '')
        full_tag_page = full_tag_page.replace('{{ title }}', f'{tag} - Does This Feel Right?')
        full_tag_page = full_tag_page.replace('{{ description }}', f'Essays about {tag}.')
        full_tag_page = full_tag_page.replace('{{ url }}', f"{BASE_URL}/tags/{tag_slug}.html")
        
        write_file(os.path.join(OUTPUT_DIR, f'tags/{tag_slug}.html'), full_tag_page)

    # 11. Generate Sitemap
    sitemap_items = ""
    # Homepage
    sitemap_items += f"""
    <url>
        <loc>{BASE_URL}/</loc>
        <changefreq>daily</changefreq>
        <priority>1.0</priority>
    </url>
    """
    # Static Pages
    static_pages = ['about.html', 'collections.html', 'consulting.html']
    for page in static_pages:
        sitemap_items += f"""
        <url>
            <loc>{BASE_URL}/{page}</loc>
            <changefreq>monthly</changefreq>
            <priority>0.8</priority>
        </url>
        """
    # Posts
    for post in posts:
        if post['slug'] == 'about': continue
        sitemap_items += f"""
        <url>
            <loc>{BASE_URL}/posts/{post['slug']}.html</loc>
            <lastmod>{post.get('date', datetime.datetime.now().strftime('%Y-%m-%d'))}</lastmod>
            <changefreq>monthly</changefreq>
            <priority>0.9</priority>
        </url>
        """
    
    sitemap_content = f"""<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
{sitemap_items}
</urlset>"""
    write_file(os.path.join(OUTPUT_DIR, 'sitemap.xml'), sitemap_content)

    # 12. Generate Robots.txt
    robots_content = f"""User-agent: *
Allow: /
Sitemap: {BASE_URL}/sitemap.xml
"""
    write_file(os.path.join(OUTPUT_DIR, 'robots.txt'), robots_content)

    # 13. Generate CNAME for GitHub Pages
    write_file(os.path.join(OUTPUT_DIR, 'CNAME'), 'www.doesthisfeelright.com')
    # 9. Generate RSS Feed
    print("Step 9: Generating RSS Feed...")
    rss_items = ""
    # Use top 200 posts for feed to capture the new batch for Substack
    for post in main_feed_posts[:200]:
        title = post.get('title', 'Untitled')
        slug = post['slug']
        link = f"{BASE_URL}/posts/{slug}.html"
        description = post.get('excerpt', '')
        date_str = post.get('date', '')
        
        # Format date for RSS (RFC 822)
        try:
            if len(date_str) == 10:
                d = datetime.datetime.strptime(date_str, '%Y-%m-%d')
            else:
                d = datetime.datetime.strptime(date_str, '%Y-%m-%d %H:%M:%S')
            pub_date = d.strftime('%a, %d %b %Y %H:%M:%S +0000')
        except:
            pub_date = date_str

        # Get full content
        content_body = post_bodies.get(slug, "")
        
        rss_items += f"""
        <item>
            <title>{title}</title>
            <link>{link}</link>
            <guid>{link}</guid>
            <pubDate>{pub_date}</pubDate>
            <description><![CDATA[{description}]]></description>
            <content:encoded><![CDATA[{content_body}]]></content:encoded>
        </item>
        """

    rss_xml = f"""<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
    <title>Does This Feel Right?</title>
    <link>{BASE_URL}</link>
    <atom:link href="{BASE_URL}/feed.xml" rel="self" type="application/rss+xml" />
    <description>Thoughts on business, technology, and the human condition.</description>
    <language>en-us</language>
    {rss_items}
</channel>
</rss>
"""
    write_file(os.path.join(OUTPUT_DIR, 'feed.xml'), rss_xml)

    print(f"Build complete. Output in {OUTPUT_DIR}/")

if __name__ == "__main__":
    build()
