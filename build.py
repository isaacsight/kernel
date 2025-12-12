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
        
        # Logic to identify Experiments/Studio content
        # Include:
        # 1. Slugs starting with 'ai-'
        # 2. Category 'Engineering'
        # 3. Tags containing 'experiment'
        is_experiment = (
            post['slug'].startswith('ai-') or 
            post.get('category') == 'Engineering' or 
            'experiment' in post.get('tags', '').lower()
        )

        if is_experiment:
            experiments_posts.append(post)
            
        # Always add to main feed (blended)
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
    
    # Helper: Compute Backlinks
    def compute_backlinks(posts_list, index_map):
        b_links = {p['slug']: [] for p in posts_list}
        for p in posts_list:
            source = p['slug']
            # Connections can be list or string
            raw_conns = p.get('connections', [])
            if isinstance(raw_conns, str):
                raw_conns = [c.strip() for c in raw_conns.split(',') if c.strip()]
            elif not isinstance(raw_conns, list):
                raw_conns = []
            
            for target in raw_conns:
                # strip potential .html extension if present in manual connection
                target = target.replace('.html', '')
                if target in b_links and source != target:
                    b_links[target].append(source)
                    
        # Dedup
        for t in b_links:
            b_links[t] = list(dict.fromkeys(b_links[t]))
        return b_links

    # Create Index and Backlinks Map
    posts_map = {p['slug']: p for p in posts}
    backlinks_map = compute_backlinks(posts, posts_map)

    for post in posts:
        slug = post['slug']
        
        # 1. Read Next Logic
        read_next_candidates = []
        used_slugs = {slug}
        
        # Explicit
        connections = post.get('connections', [])
        if isinstance(connections, str):
            connections = [c.strip() for c in connections.split(',') if c.strip()]
        
        for conn_slug in connections:
             conn_slug = conn_slug.replace('.html', '')
             if conn_slug in posts_map and conn_slug not in used_slugs:
                 read_next_candidates.append(posts_map[conn_slug])
                 used_slugs.add(conn_slug)
        
        # Pillar Fallback
        current_pillar = post.get('pillar')
        if len(read_next_candidates) < 4 and current_pillar:
             for p in posts:
                 if p['slug'] in used_slugs: continue
                 if p.get('pillar') == current_pillar:
                     read_next_candidates.append(p)
                     used_slugs.add(p['slug'])
                     if len(read_next_candidates) >= 4: break
        
        # Global Fallback
        if len(read_next_candidates) < 4:
            for p in posts:
                if p['slug'] in used_slugs: continue
                read_next_candidates.append(p)
                used_slugs.add(p['slug'])
                if len(read_next_candidates) >= 4: break
        
        read_next = read_next_candidates[:4]
        
        # Generate Read Next HTML
        read_next_html = ""
        if read_next:
            related_items = ""
            for r in read_next:
                r_slug = r['slug']
                r_title = r.get('title', r_slug)
                r_mode = r.get('mode', 'Essay')
                r_pillar = r.get('pillar', '').replace('-', ' ').title()
                r_tldr = r.get('tldr', '')
                r_date = r.get('date', '')
                
                related_items += f"""
                <a href="{r_slug}.html" class="card">
                    <div class="card__meta">
                        <span class="badge">{r_mode}</span>
                        <span class="badge badge--muted">{r_pillar}</span>
                        <span class="date">{r_date}</span>
                    </div>
                    <div class="card__title">{r_title}</div>
                    <div class="card__desc">{r_tldr}</div>
                </a>
                """
            read_next_html = f"""
            <section class="read-next">
                <h2>Read Next <span class="count">({len(read_next)})</span></h2>
                <div class="card-grid">
                    {related_items}
                </div>
            </section>
            """

        # 2. Backlinks (Referenced By)
        backlink_slugs = backlinks_map.get(slug, [])
        # Retrieve post objects
        backlink_posts = [posts_map[s] for s in backlink_slugs if s in posts_map]
        # Sort newest first
        def get_date_obj(p):
             d_str = str(p.get('date', '1900-01-01'))
             try: return datetime.datetime.strptime(d_str[:10], '%Y-%m-%d')
             except: return datetime.datetime(1900, 1, 1)
        backlink_posts.sort(key=get_date_obj, reverse=True)
        backlink_posts = backlink_posts[:8] # Cap at 8
        
        backlinks_html = ""
        if backlink_posts:
            list_items = ""
            for p in backlink_posts:
                p_title = p.get('title', 'Untitled')
                p_url = f"{p['slug']}.html"
                p_date = p.get('date', '')
                list_items += f'<li><a href="{p_url}">{p_title}</a> <span class="muted">— {p_date}</span></li>'
            
            backlinks_html = f"""
            <section class="backlinks">
                <h2>Referenced By <span class="count">({len(backlink_posts)})</span></h2>
                <ul class="link-list">
                    {list_items}
                </ul>
            </section>
            """

        # 3. More in Pillar
        more_in_pillar_html = ""
        if current_pillar:
            pillar_candidates = [p for p in posts if p.get('pillar') == current_pillar and p['slug'] != slug]
            pillar_candidates.sort(key=get_date_obj, reverse=True)
            pillar_candidates = pillar_candidates[:6]
            
            if pillar_candidates:
                list_items = ""
                for p in pillar_candidates:
                    p_title = p.get('title', 'Untitled')
                    p_url = f"{p['slug']}.html"
                    p_date = p.get('date', '')
                    list_items += f'<li><a href="{p_url}">{p_title}</a> <span class="muted">— {p_date}</span></li>'
                
                more_in_pillar_html = f"""
                <section class="more-in-pillar">
                    <h2>In This Pillar <span class="count">({len(pillar_candidates)})</span></h2>
                    <ul class="link-list">
                        {list_items}
                    </ul>
                    <a class="muted" href="../index.html#archive">View full archive →</a>
                </section>
                """

        # Data for Badges
        p_mode = post.get('mode', 'Essay')
        p_pillar = post.get('pillar', '').replace('-', ' ').title()
        is_canonical = str(post.get('canonical', '')).lower() == 'true'
        
        badges_html = f'<div class="post-badges">'
        if p_mode: badges_html += f'<span class="badge">{p_mode}</span>'
        if p_pillar: badges_html += f'<span class="badge badge--muted">{p_pillar}</span>'
        if is_canonical: badges_html += f'<span class="badge badge--canon">Canon</span>'
        badges_html += '</div>'

        # Combine Footer Nav
        # Order: Backlinks -> Read Next -> In This Pillar
        footer_nav_html = backlinks_html + read_next_html + more_in_pillar_html

        # Re-read content (existing logic)
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

        # Generate Tags HTML
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

        # Series HTML
        series = post.get('series')
        series_html = ""
        if series:
            series_html = f'<div class="series-indicator">Series: {series}</div>'

        post_html = post_template.replace('{{ title }}', post.get('title', 'Untitled'))
        post_html = post_html.replace('{{ category }}', post.get('category', 'General'))
        post_html = post_html.replace('{{ tags_html }}', tags_html)
        post_html = post_html.replace('{{ series_indicator }}', series_html)
        post_html = post_html.replace('{{ post_content }}', body)
        
        # Inject New Sections
        post_html = post_html.replace('{{ post_badges }}', badges_html)
        post_html = post_html.replace('{{ footer_navigation }}', footer_nav_html)
        
        # Legacy placeholders just in case
        post_html = post_html.replace('{{ related_posts }}', '') 
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

        # Mode Badge
        mode = post.get('mode', 'Essay')
        mode_html = f'<span class="mode-badge mode-{mode.lower()}">{mode}</span>'
        post_html = post_html.replace('{{ mode_display }}', mode_html)

        # Version Badge
        version = post.get('version', '')
        version_html = ""
        if version:
             version_html = f'<span class="version-badge">{version}</span>'
        post_html = post_html.replace('{{ version_display }}', version_html)

        # Connections (Graph)
        connects_to = post.get('connects_to', '')
        connections_html = ""
        if connects_to:
            connections_list = [c.strip() for c in connects_to.split(',') if c.strip()]
            links = []
            for c in connections_list:
                 # Find permalink for the connected title/slug
                 # Best effort match
                 target_slug = c.lower().replace(' ', '-')
                 links.append(f'<a href="{target_slug}.html" class="connection-link">{c}</a>')
            
            if links:
                 connections_html = f'<div class="connections-block"><span class="connection-label">Connects to:</span> {" • ".join(links)}</div>'
        
        post_html = post_html.replace('{{ connections }}', connections_html)
        
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

    # --- Generate Homepage with New Hierarchy ---
    # Step 5: Generating Homepage
    print("Step 5: Generating Homepage...")
    
    # Helpers
    def get_date_obj(p):
        d_str = str(p.get('date', '1900-01-01'))
        # simple parse
        try:
             return datetime.datetime.strptime(d_str[:10], '%Y-%m-%d')
        except:
             return datetime.datetime(1900, 1, 1)

    sorted_posts = sorted(posts, key=get_date_obj, reverse=True)
    
    # 1. Doctrine
    doctrine_text = "A living notebook on technology, intelligence, and modern life."
    
    # 2. Canon
    canon_posts = [p for p in posts if str(p.get('canonical', '')).lower() == 'true']
    canon_posts = sorted(canon_posts, key=get_date_obj, reverse=True)[:7]
    
    canon_html = ""
    if canon_posts:
        canon_cards = ""
        for p in canon_posts:
            # Card Generation (Reuse this reused snippet, sorry for duplication, can refactor later)
            p_slug = p['slug']
            p_title = p.get('title', p_slug)
            p_mode = p.get('mode', 'Essay')
            p_pillar = p.get('pillar', '').replace('-', ' ').title()
            p_tldr = p.get('tldr', '')
            p_date = p.get('date', '')
            
            canon_cards += f"""
            <a class="card" href="posts/{p_slug}.html">
                <div class="card__meta">
                    <span class="badge">{p_mode}</span>
                    <span class="badge badge--muted">{p_pillar}</span>
                    <span class="date">{p_date}</span>
                </div>
                <div class="card__title">{p_title}</div>
                <div class="card__desc">{p_tldr}</div>
            </a>
            """
        canon_html = f"""
        <section class="home-block">
            <div class="home-block__header">
                <h2>Start Here</h2>
                <p class="muted">Foundational essays that define the ethos of the studio.</p>
            </div>
            <div class="card-grid">
                {canon_cards}
            </div>
        </section>
        """

    # 3. Current Investigation
    investigations = [
        "Studio OS: agentic workflows and distributed compute",
        "Identity under algorithmic pressure (performance vs witness)",
        "Taste, creativity, and the new non-expert builder"
    ]
    inv_items = "".join([f"<li>{i}</li>" for i in investigations])
    investigation_html = f"""
    <section class="home-block">
        <div class="home-block__header">
            <h2>Current Investigation</h2>
            <p class="muted">What I’m actively building and thinking about right now.</p>
        </div>
        <ul class="home-list">
            {inv_items}
        </ul>
    </section>
    """

    # 4. Latest
    latest_posts = sorted_posts[:3]
    latest_html = ""
    if latest_posts:
        latest_cards = ""
        for p in latest_posts:
            p_slug = p['slug']
            p_title = p.get('title', p_slug)
            p_mode = p.get('mode', 'Essay')
            p_pillar = p.get('pillar', '').replace('-', ' ').title()
            p_tldr = p.get('tldr', '')
            p_date = p.get('date', '')
            
            latest_cards += f"""
            <a class="card" href="posts/{p_slug}.html">
                <div class="card__meta">
                    <span class="badge">{p_mode}</span>
                    <span class="badge badge--muted">{p_pillar}</span>
                    <span class="date">{p_date}</span>
                </div>
                <div class="card__title">{p_title}</div>
                <div class="card__desc">{p_tldr}</div>
            </a>
            """
        latest_html = f"""
        <section class="home-block">
            <div class="home-block__header home-block__header--row">
                <div>
                    <h2>Latest</h2>
                    <p class="muted">Three recent entries. The archive lives below.</p>
                </div>
                <a class="btn btn--ghost" href="#archive">Browse Archive</a>
            </div>
            <div class="card-grid card-grid--tight">
                {latest_cards}
            </div>
        </section>
        """

    # 5. Archive (Existing Logic for client-side filtering)
    # We still generate 'all_posts_html' for the #archive section
    all_posts_html = ""
    for post in sorted_posts: # Use date sorted
        # Existing card logic used in original build.py loop, simplified here for 'all'
        # Actually we should reuse the same card style or the filtered list style
        # The user said "Paste your existing 'Latest Essays' + filters block below this line"
        # So I will generate the list and letting main.js handle it?
        # The original code generated 'homepage_posts_html' (paginated) and 'all_posts_html'.
        # We need 'all_posts_html' for the filterable list.
        
        raw_cat = post.get('category', 'General').strip()
        clean_cat = raw_cat.replace("'", "").replace('"', "")
        p_mode = post.get('mode', 'Essay')
        mode_badge = f'<span class="mode-badge mode-{p_mode.lower()}">{p_mode}</span>'
        
        all_posts_html += f"""
            <a href="posts/{post['slug']}.html" class="post-card category-{clean_cat.lower().replace(' ', '-')}" data-category="{clean_cat}" data-date="{post.get('date', '')}">
                <div class="post-card-content">
                    <div class="post-meta-top">
                        {mode_badge}
                        <span class="post-category-label">{post.get('category', 'General')}</span>
                        <span class="post-date">{post.get('date', '')}</span>
                    </div>
                    <h3 class="post-title">{post.get('title', 'Untitled')}</h3>
                    <p class="post-excerpt">{post.get('tldr', post.get('excerpt', ''))}</p>
                    <div class="post-meta-bottom">
                         <span class="read-time">{post.get('read_time', '5 min read')}</span>
                         <span class="read-more">Read {p_mode} →</span>
                    </div>
                </div>
            </a>
        """

    # Construct Home Hero HTML
    home_hero_html = f"""
    <section class="home-hero">
      <h1>Does This Feel Right?</h1>
      <p class="home-doctrine">{doctrine_text}</p>
      <div class="home-cta-row">
        <a class="btn" href="about.html">About</a>
        <a class="btn btn--ghost" href="search/index.html">Search</a>
      </div>
    </section>
    """
    
    # Combine Sections
    full_home_content = f"""
    {home_hero_html}
    {canon_html}
    {investigation_html}
    {latest_html}
    <hr class="home-divider" />
    <section id="archive" class="home-archive">
        <div class="home-block__header">
            <h2>Archive</h2>
            <p class="muted">Filter, search, and explore everything.</p>
        </div>
        <!-- Archive Controls -->
         <div class="archive-controls">
            <div class="filter-buttons">
                <button class="filter-btn active" data-filter="all">All</button>
                <button class="filter-btn" data-filter="category-culture">Culture</button>
                <button class="filter-btn" data-filter="category-tech">Tech</button>
                 <button class="filter-btn" data-filter="category-society">Society</button>
                <button class="filter-btn" data-filter="category-reflection">Reflection</button>
            </div>
             <!-- Search trigger for archive specific if needed, or rely on global -->
        </div>
        <div class="posts-container" id="posts-container">
            {all_posts_html}
        </div>
         <div class="pagination-controls" id="pagination-controls">
            <!-- JS will populate -->
        </div>
    </section>
    """

    # Replace in Template
    # We need a placeholder in index.html, currently it likely has {{ content }} which we probably overwrote or it expects specific structure. 
    # Let's check index.html. Actually, I can just replace {{ content }} if index_template is simple base + content.
    # Ah, 'index.html' template usually has the 'Latest Essays' logic hardcoded or provided via {{ homepage_posts }}.
    # I will assume I need to replace simple placeholders. 
    # To be safe, I will rely on 'base_template' and replace '{{ content }}' with 'full_home_content'.
    
    # But wait, step 5 previously used `index_template`.
    # Let's check if I can just use `base_template` for the homepage to simplify.
    # If `index_template` exists, it might have specific hero stuff I want to remove.
    # The user provided a "Drop-in homepage layout".
    # I will use `base_template` and inject the computed content.
    
    full_home_page = base_template.replace('{{ content }}', full_home_content)
    full_home_page = full_home_page.replace('{{ starter_set_nav }}', starter_set_nav_html)
    full_home_page = full_home_page.replace('{{ root }}', '')
    full_home_page = full_home_page.replace('{{ image }}', DEFAULT_IMAGE)
    full_home_page = full_home_page.replace('{{ og_type }}', 'website')
    full_home_page = full_home_page.replace('{{ json_ld }}', '')
    full_home_page = full_home_page.replace('{{ title }}', 'Does This Feel Right? - Isaac Hernandez')
    full_home_page = full_home_page.replace('{{ description }}', 'A living notebook on technology, intelligence, and modern life.')
    full_home_page = full_home_page.replace('{{ url }}', BASE_URL)
    
    # Write Index
    write_file(os.path.join(OUTPUT_DIR, 'index.html'), full_home_page)

    # Generate Archive Page
    print("Step 7b: Generating Archive Page...")
    archive_template = read_file(os.path.join(TEMPLATE_DIR, 'archive.html'))
    archive_content = archive_template.replace('{{ recent_posts }}', all_posts_html)
    archive_content = archive_content.replace('{{ filters }}', filter_html)
    
    full_archive = base_template.replace('{{ content }}', archive_content)
    full_archive = full_archive.replace('{{ starter_set_nav }}', starter_set_nav_html)
    full_archive = full_archive.replace('{{ root }}', '')
    full_archive = full_archive.replace('{{ image }}', DEFAULT_IMAGE)
    full_archive = full_archive.replace('{{ og_type }}', 'website')
    full_archive = full_archive.replace('{{ json_ld }}', '')
    
    full_archive = full_archive.replace('{{ title }}', 'Archive - Does This Feel Right?')
    full_archive = full_archive.replace('{{ description }}', 'Complete archive of essays and experiments.')
    full_archive = full_archive.replace('{{ url }}', f"{BASE_URL}/archive.html")
    write_file(os.path.join(OUTPUT_DIR, 'archive.html'), full_archive)

    # Note: We are SKIPPING generation of latest-essays-N.html to force client-side pagination usage
    # If users have JS disabled, they will see ONE LONG PAGE, which is acceptable/better than partial pages.
    pass 
    
    # 8. Generate Experiments Page (Paginated)
    print("Step 8: Generating Experiments Page...")
    
    EXP_PER_PAGE = 8 # Same limit for consistency
    total_exp = len(experiments_posts)
    total_exp_pages = max(1, (total_exp + EXP_PER_PAGE - 1) // EXP_PER_PAGE)
    
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
                # import datetime removed

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

    # 12. Generate Search Index (search.json)
    import json
    search_index = []
    for post in posts:
        if post['slug'] == 'about': continue
        
        search_item = {
            'title': post.get('title', 'Untitled'),
            'slug': post['slug'],
            'excerpt': post.get('excerpt', ''),
            'tags': post.get('tags', ''),
            'category': post.get('category', 'General'),
            'date': post.get('date', '')
        }
        search_index.append(search_item)
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
    major_collections = [t for t in sorted_tags if t[1] >= 3]
    
    collections_html = """
    <div class="collections-archive">
        <div class="collections-header">
            <div class="archive-header-flex">
    <div class="collections-grid">
    """
    
    # 1. Pillars (Manual or derived, let's derive from unique pillars)
    pillars = sorted(list(set(p.get('pillar') for p in posts if p.get('pillar'))))
    collections_html += '<div class="collection-group"><h3>Pillars</h3><ul class="collection-list">'
    for pillar in pillars:
        p_slug = pillar.lower().replace(' ', '-')
        collections_html += f'<li><a href="pillars/{p_slug}.html" class="collection-item"><span class="name">{pillar}</span></a></li>'
    collections_html += '</ul></div>'

    # 2. Clusters (Tags >= 3)
    collections_html += '<div class="collection-group"><h3>Topics</h3><ul class="collection-list">'
    for tag, count in major_collections:
        tag_slug = tag.lower().replace(' ', '-')
        tag_slug = "".join(c for c in tag_slug if c.isalnum() or c == '-')
        collections_html += f"""
            <li>
                <a href="tags/{tag_slug}.html" class="collection-item">
                    <span class="name">{tag}</span>
                    <span class="count">{count}</span>
                </a>
            </li>
        """
    collections_html += '</ul></div>'
    collections_html += '</div>'
    
    # Render Collections Page
    full_collections_page = base_template.replace('{{ content }}', f"""
        <div class="magazine-layout">
            <div class="content-wrapper full-width">
                <header class="page-header">
                    <h1>Collections</h1>
                    <p class="section-desc">Pillars are the permanent structure. Collections are clusters.</p>
                </header>
                {collections_html}
                <div style="margin-top: 40px; text-align: center;">
                    <a href="search/index.html" class="muted">Search to find specific niche topics →</a>
                </div>
            </div>
        </div>
    """)
    # Fix paths
    full_collections_page = full_collections_page.replace('{{ starter_set_nav }}', starter_set_nav_html)
    full_collections_page = full_collections_page.replace('{{ root }}', '') 
    full_collections_page = full_collections_page.replace('{{ image }}', DEFAULT_IMAGE)
    full_collections_page = full_collections_page.replace('{{ og_type }}', 'website') 
    full_collections_page = full_collections_page.replace('{{ json_ld }}', '')
    full_collections_page = full_collections_page.replace('{{ title }}', 'Collections - Does This Feel Right?') 
    full_collections_page = full_collections_page.replace('{{ description }}', 'Curated clusters of thinking.')
    full_collections_page = full_collections_page.replace('{{ url }}', f"{BASE_URL}/collections.html")
    
    write_file(os.path.join(OUTPUT_DIR, 'collections.html'), full_collections_page)
    
    # Generate ALL Tag Pages (for search/filtering destinations)
    for tag, count in sorted_tags:
        tag_slug = tag.lower().replace(' ', '-')
        tag_slug = "".join(c for c in tag_slug if c.isalnum() or c == '-')
        
        # Filter posts
        tag_posts = []
        for post in posts:
            raw = post.get('tags', '')
            if raw.startswith('[') and raw.endswith(']'): raw = raw[1:-1]
            # ... simple check ...
            if tag in raw or tag == post.get('category'):
               tag_posts.append(post)
        
        tag_posts.sort(key=lambda x: str(x.get('date', '0000-00-00')), reverse=True)
        
        # Generate Tag Page Content (Card Grid)
        tag_page_html = f"""
        <div class="magazine-layout">
            <div class="content-wrapper full-width">
                <main class="main-feed">
                    <div class="feed-header">
                        <h2>{tag}</h2>
                        <p class="section-desc">{count} posts about {tag.lower()}.</p>
                    </div>
                    <div class="posts-container">
        """
        
        for post in tag_posts:
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

    # 9. Generate Projects Page
    print("Step 9: Generating Projects Page...")
    projects_template = read_file(os.path.join(TEMPLATE_DIR, 'projects.html'))
    
    full_projects = base_template.replace('{{ content }}', projects_template)
    # Restore substitutions that were deleted
    full_projects = full_projects.replace('{{ starter_set_nav }}', starter_set_nav_html) 
    full_projects = full_projects.replace('{{ root }}', '')
    full_projects = full_projects.replace('{{ image }}', DEFAULT_IMAGE)
    full_projects = full_projects.replace('{{ og_type }}', 'website')
    full_projects = full_projects.replace('{{ json_ld }}', '')
    full_projects = full_projects.replace('{{ title }}', 'AI Research Tools - Does This Feel Right?')
    full_projects = full_projects.replace('{{ description }}', 'Experimental interfaces and debuggers for Large Language Models.')
    full_projects = full_projects.replace('{{ url }}', f"{BASE_URL}/projects.html")
    
    write_file(os.path.join(OUTPUT_DIR, 'projects.html'), full_projects)

    # 10. Generate Meta Project Page (Standalone)
    print("Step 10: Generating Meta Project Page...")
    meta_content = read_file(os.path.join(TEMPLATE_DIR, 'meta.html'))
    write_file(os.path.join(OUTPUT_DIR, 'meta.html'), meta_content)

    # 11. Generate App Wrappers
    print("Step 11: Generating App Wrappers...")
    apps_wrapper = read_file(os.path.join(TEMPLATE_DIR, 'apps_wrapper.html'))
    
    # Debugger
    debugger_page = base_template.replace('{{ content }}', apps_wrapper)
    debugger_page = debugger_page.replace('{{ starter_set_nav }}', starter_set_nav_html)
    debugger_page = debugger_page.replace('{{ root }}', '')
    debugger_page = debugger_page.replace('{{ app_url }}', 'apps/debugger/index.html')
    debugger_page = debugger_page.replace('{{ app_title }}', 'Logit Debugger | Research Suite')
    debugger_page = debugger_page.replace('{{ title }}', 'Logit Debugger | Research Suite')
    debugger_page = debugger_page.replace('{{ description }}', 'Real-time alignment debugger.')
    debugger_page = debugger_page.replace('{{ url }}', f"{BASE_URL}/debugger.html")
    # Clean up leftovers
    debugger_page = debugger_page.replace('{{ image }}', DEFAULT_IMAGE)
    debugger_page = debugger_page.replace('{{ og_type }}', 'website')
    debugger_page = debugger_page.replace('{{ json_ld }}', '')
    
    # Fix positioning context and define app layout
    style_injection = '''<style>
        #main-content { animation: none !important; transform: none !important; }
        .app-wrapper {
            position: fixed !important;
            top: 60px;
            left: 0;
            right: 0;
            bottom: 0;
            z-index: 0;
        }
        @media (min-width: 768px) {
            .app-wrapper {
                top: 0;
                left: 72px; /* Sidebar width */
            }
        }
    </style></head>'''
    debugger_page = debugger_page.replace('</head>', style_injection)

    write_file(os.path.join(OUTPUT_DIR, 'debugger.html'), debugger_page)
    
    # Visualizer
    viz_page = base_template.replace('{{ content }}', apps_wrapper)
    viz_page = viz_page.replace('{{ starter_set_nav }}', starter_set_nav_html)
    viz_page = viz_page.replace('{{ root }}', '')
    viz_page = viz_page.replace('{{ app_url }}', 'apps/visualizer/index.html')
    viz_page = viz_page.replace('{{ app_title }}', 'Dynamics Visualizer | Research Suite')
    viz_page = viz_page.replace('{{ title }}', 'Dynamics Visualizer | Research Suite')
    viz_page = viz_page.replace('{{ description }}', 'Transformer state visualization.')
    viz_page = viz_page.replace('{{ url }}', f"{BASE_URL}/visualizer.html")
    # Clean up leftovers
    viz_page = viz_page.replace('{{ image }}', DEFAULT_IMAGE)
    viz_page = viz_page.replace('{{ og_type }}', 'website')
    viz_page = viz_page.replace('{{ json_ld }}', '')
    
    # Fix positioning context and define app layout
    style_injection = '''<style>
        #main-content { animation: none !important; transform: none !important; }
        .app-wrapper {
            position: fixed !important;
            top: 60px;
            left: 0;
            right: 0;
            bottom: 0;
            z-index: 0;
        }
        @media (min-width: 768px) {
            .app-wrapper {
                top: 0;
                left: 72px; /* Sidebar width */
            }
        }
    </style></head>'''
    
    # 9a. Generate Mode Pages
    print("Step 9a: Generating Mode Pages...")
    modes = ['Essay', 'Log', 'Research', 'Note']
    for mode in modes:
        mode_slug = mode.lower() + 's' # pluralize roughly
        if mode == 'Research': mode_slug = 'research' # exception
        
        mode_posts = [p for p in posts if p.get('mode', 'Essay').lower() == mode.lower()]
        mode_posts.sort(key=lambda x: str(x.get('date', '0000-00-00')), reverse=True)
        
        mode_html = ""
        for post in mode_posts:
            # Re-use card generation logic or simple list
            raw_cat = post.get('category', 'General').strip()
            clean_cat = raw_cat.replace("'", "").replace('"', "")
            date_str = post.get('date', '')
             # Mode Badge logic for Card
            mode_badge = f'<span class="mode-badge mode-{mode.lower()}">{mode}</span>'
            
            mode_html += f"""
                <a href="posts/{post['slug']}.html" class="post-card category-{clean_cat.lower().replace(' ', '-')}" data-category="{clean_cat}" data-date="{date_str}">
                    <div class="post-card-content">
                        <div class="post-meta-top">
                             {mode_badge}
                            <span class="post-category-label">{post.get('category', 'General')}</span>
                            <span class="post-date">{post.get('date', '')}</span>
                        </div>
                        <h3 class="post-title">{post.get('title', 'Untitled')}</h3>
                        <p class="post-excerpt">{post.get('tldr', post.get('excerpt', ''))}</p>
                        <div class="post-meta-bottom">
                            <span class="read-time">{post.get('read_time', '5 min read')}</span>
                            <span class="read-more">Read {mode} →</span>
                        </div>
                    </div>
                </a>
            """
            
        # Create Mode Page
        mode_page_content = f"""
        <div class="magazine-layout">
            <div class="content-wrapper full-width">
                <main class="main-feed">
                    <div class="feed-header">
                        <h2>{mode}s</h2>
                        <p class="section-desc">Filtered archive of {mode.lower()}s.</p>
                    </div>
                    <div class="posts-container">
                        {mode_html}
                    </div>
                </main>
            </div>
        </div>
        """
        
        full_mode_page = base_template.replace('{{ content }}', mode_page_content)
        full_mode_page = full_mode_page.replace('{{ starter_set_nav }}', starter_set_nav_html)
        full_mode_page = full_mode_page.replace('{{ root }}', '')
        full_mode_page = full_mode_page.replace('{{ image }}', DEFAULT_IMAGE)
        full_mode_page = full_mode_page.replace('{{ og_type }}', 'website')
        full_mode_page = full_mode_page.replace('{{ json_ld }}', '')
        full_mode_page = full_mode_page.replace('{{ title }}', f'{mode}s - Does This Feel Right?')
        full_mode_page = full_mode_page.replace('{{ description }}', f'Archive of {mode.lower()}s.')
        full_mode_page = full_mode_page.replace('{{ url }}', f"{BASE_URL}/{mode_slug}.html")
        
        write_file(os.path.join(OUTPUT_DIR, f'{mode_slug}.html'), full_mode_page)


    # 9b. Generate Pillar Pages
    print("Step 9b: Generating Pillar Pages...")
    # Define Pillars (Hardcoded or Dynamic, let's dynamic from posts to be safe, but map to known pillars)
    known_pillars = {
        'being-seen': 'Being Seen',
        'systems-power': 'Systems & Power',
        'making-public': 'Making Things in Public',
        'meaning-resistance': 'Meaning & Resistance'
    }
    
    # Bucket posts
    pillar_buckets = {k: [] for k in known_pillars.keys()}
    pillar_buckets['general'] = []
    
    for post in posts:
        p_slug = post.get('pillar', 'general').lower().replace(' & ', '-').replace(' ', '-')
        # Normalize
        found = False
        for k in known_pillars.keys():
            if k in p_slug: # Loose matching
                pillar_buckets[k].append(post)
                found = True
                break
        if not found:
            pillar_buckets['general'].append(post)
            
    # Create output dir
    if not os.path.exists(os.path.join(OUTPUT_DIR, 'pillars')):
        os.makedirs(os.path.join(OUTPUT_DIR, 'pillars'))

    for p_slug, p_name in known_pillars.items():
        pillar_posts = pillar_buckets[p_slug]
        if not pillar_posts: continue
        
        pillar_posts.sort(key=lambda x: str(x.get('date', '0000-00-00')), reverse=True)
        
        pillar_html = ""
        for post in pillar_posts:
            # Re-use card generation logic
            raw_cat = post.get('category', 'General').strip()
            clean_cat = raw_cat.replace("'", "").replace('"', "")
            date_str = post.get('date', '')
            mode = post.get('mode', 'Essay')
            mode_badge = f'<span class="mode-badge mode-{mode.lower()}">{mode}</span>'
            
            pillar_html += f"""
                <a href="../posts/{post['slug']}.html" class="post-card category-{clean_cat.lower().replace(' ', '-')}" data-category="{clean_cat}" data-date="{date_str}">
                    <div class="post-card-content">
                        <div class="post-meta-top">
                            {mode_badge}
                            <span class="post-category-label">{post.get('category', 'General')}</span>
                            <span class="post-date">{post.get('date', '')}</span>
                        </div>
                        <h3 class="post-title">{post.get('title', 'Untitled')}</h3>
                        <p class="post-excerpt">{post.get('tldr', post.get('excerpt', ''))}</p>
                        <div class="post-meta-bottom">
                            <span class="read-time">{post.get('read_time', '5 min read')}</span>
                            <span class="read-more">Read Essay →</span>
                        </div>
                    </div>
                </a>
            """
            
        # Create Pillar Page
        pillar_page_content = f"""
        <div class="magazine-layout">
            <div class="content-wrapper full-width">
                <main class="main-feed">
                    <div class="feed-header">
                        <h2>{p_name}</h2>
                        <p class="section-desc">Essays on {p_name.lower()}.</p>
                    </div>
                    <div class="posts-container">
                        {pillar_html}
                    </div>
                </main>
            </div>
        </div>
        """
        
        # Adjust root for pillars/ subdirectory
        # Actually simplest is to adjust links in pillar_html to be ../posts/ and put file in pillars/
        
        full_pillar_page = base_template.replace('{{ content }}', pillar_page_content)
        # Fix nav links for subdirectory
        # A bit hacky: simple replace
        full_pillar_page = full_pillar_page.replace('href="index.html"', 'href="../index.html"')
        full_pillar_page = full_pillar_page.replace('href="about.html"', 'href="../about.html"')
        full_pillar_page = full_pillar_page.replace('href="collections.html"', 'href="../collections.html"')
        full_pillar_page = full_pillar_page.replace('src="', 'src="../') # Fix scripts/css
        full_pillar_page = full_pillar_page.replace('href="css/', 'href="../css/')
        
        full_pillar_page = full_pillar_page.replace('{{ starter_set_nav }}', starter_set_nav_html.replace('posts/', '../posts/'))
        full_pillar_page = full_pillar_page.replace('{{ root }}', '../')
        full_pillar_page = full_pillar_page.replace('{{ image }}', DEFAULT_IMAGE)
        full_pillar_page = full_pillar_page.replace('{{ og_type }}', 'website')
        full_pillar_page = full_pillar_page.replace('{{ title }}', f'{p_name} - Does This Feel Right?')
        full_pillar_page = full_pillar_page.replace('{{ description }}', f'Essays on {p_name.lower()}.')
        full_pillar_page = full_pillar_page.replace('{{ url }}', f"{BASE_URL}/pillars/{p_slug}.html")
        
        write_file(os.path.join(OUTPUT_DIR, 'pillars', f'{p_slug}.html'), full_pillar_page)

    # 13. Generate Search Index
    print("Step 13: Generating Search Index...")
    import re
    search_index = []
    
    # Simple HTML stripper
    def strip_html(html):
        return re.sub('<[^<]+?>', '', html)

    for post in posts:
        slug = post['slug']
        # Retrieve body from cache or file
        # Best effort: use post_bodies cache populated earlier if available, or re-read
        # In current script state, post_bodies might be partial. Let's rely on re-reading if critical, 
        # but for speed let's check post_bodies first.
        body_html = post_bodies.get(slug, "")
        if not body_html:
             # Fallback read
             original_filename = post.get('original_filename', slug + '.md')
             filepath = os.path.join(CONTENT_DIR, original_filename)
             if os.path.exists(filepath):
                 raw = read_file(filepath)
                 _, body_html = parse_frontmatter(raw)
                 if filepath.endswith('.md'): body_html = markdown_to_html(body_html)

        body_text = strip_html(body_html)
        # Truncate body for index size
        if len(body_text) > 8000: body_text = body_text[:8000]
        
        search_index.append({
            "slug": slug,
            "title": post.get('title', 'Untitled'),
            "tldr": post.get('tldr', post.get('excerpt', '')),
            "mode": post.get('mode', 'Essay'),
            "pillar": post.get('pillar', 'General'),
            "date": post.get('date', ''),
            "canonical": post.get('canonical', False),
            "url": f"/posts/{slug}.html",
            "body": body_text
        })
        
    if not os.path.exists(os.path.join(OUTPUT_DIR, 'search')):
        os.makedirs(os.path.join(OUTPUT_DIR, 'search'))
        
    with open(os.path.join(OUTPUT_DIR, 'search', 'index.json'), 'w', encoding='utf-8') as f:
        json.dump(search_index, f, ensure_ascii=False)
        
    # Generate Search Page
    search_template = """
    <div class="magazine-layout">
        <div class="content-wrapper full-width">
            <main class="main-feed" style="max-width: 800px; margin: 0 auto;">
                <div class="feed-header">
                    <h2>Search</h2>
                    <p class="section-desc">Query the notebook.</p>
                </div>
                
                <div class="search-container-page" style="margin-top: 24px;">
                    <input id="searchInputPage" class="search-input-page" type="search" placeholder="Search essays, logs, ideas..." autocomplete="off" style="width: 100%; padding: 16px; font-size: 1.1em; border: 1px solid var(--border-emphasis); border-radius: 8px; background: var(--bg-secondary); color: var(--text-primary);">
                    <div id="searchMetaPage" class="search-meta-page" style="margin-top: 12px; color: var(--text-tertiary); font-size: 0.9em;"></div>
                    <div id="searchResultsPage" class="search-results-page" style="margin-top: 32px; display: grid; gap: 24px;"></div>
                </div>
            </main>
        </div>
    </div>
    <script src="../js/search-page.js"></script>
    """
    
    full_search_page = base_template.replace('{{ content }}', search_template)
    full_search_page = full_search_page.replace('{{ starter_set_nav }}', starter_set_nav_html) # Fix relative links if needed
    # Fix paths for search/ subdir
    full_search_page = full_search_page.replace('href="index.html"', 'href="../index.html"')
    full_search_page = full_search_page.replace('href="about.html"', 'href="../about.html"')
    full_search_page = full_search_page.replace('href="collections.html"', 'href="../collections.html"')
    full_search_page = full_search_page.replace('src="', 'src="../')
    full_search_page = full_search_page.replace('href="css/', 'href="../css/')
    full_search_page = full_search_page.replace('{{ starter_set_nav }}', starter_set_nav_html.replace('posts/', '../posts/'))
    
    full_search_page = full_search_page.replace('{{ root }}', '../')
    full_search_page = full_search_page.replace('{{ title }}', 'Search - Does This Feel Right?')
    full_search_page = full_search_page.replace('{{ description }}', 'Search the notebook.')
    full_search_page = full_search_page.replace('{{ url }}', f"{BASE_URL}/search/index.html")
    full_search_page = full_search_page.replace('{{ image }}', DEFAULT_IMAGE)
    full_search_page = full_search_page.replace('{{ og_type }}', 'website')
    full_search_page = full_search_page.replace('{{ json_ld }}', '')

    write_file(os.path.join(OUTPUT_DIR, 'search', 'index.html'), full_search_page)
    viz_page = viz_page.replace('</head>', style_injection)

    # 14. Generate Map Page (Adjacency & Graph)
    print("Step 14: Generating Map Page...")
    
    # Ensure directories
    if not os.path.exists(os.path.join(OUTPUT_DIR, 'map')):
        os.makedirs(os.path.join(OUTPUT_DIR, 'map'))

    # Re-verify/create maps if needed
    if 'posts_map' not in locals():
        posts_map = {p['slug']: p for p in posts}
    # Re-compute backlinks if needed (or rely on earlier presence)
    # We'll just assume backlinks_map exists or is empty. 
    # If not exists, strict error? Let's be safe and re-compute if missing.
    if 'backlinks_map' not in locals():
        # Duplicate helper just in case or assume it's there. 
        # Safest: Re-implement simple version inline
        raw_backlinks = {}
        for p in posts:
            s_slug = p['slug']
            conns = p.get('connections', [])
            if isinstance(conns, str): conns = [c.strip() for c in conns.split(',') if c.strip()]
            for t_slug in conns:
                t_slug = t_slug.replace('.html', '')
                if t_slug not in raw_backlinks: raw_backlinks[t_slug] = []
                if s_slug not in raw_backlinks[t_slug]: raw_backlinks[t_slug].append(s_slug)
        backlinks_map = raw_backlinks

    # Build Graph Data (JSON)
    graph_nodes = []
    graph_edges = []
    
    for p in posts:
        slug = p['slug']
        graph_nodes.append({
            "id": slug,
            "title": p.get("title", slug),
            "mode": p.get("mode", "Essay"),
            "pillar": p.get("pillar", ""),
            "canonical": str(p.get("canonical", "")).lower() == 'true',
            "date": p.get("date", "")
        })
        
        conns = p.get('connections', [])
        if isinstance(conns, str): conns = [c.strip() for c in conns.split(',') if c.strip()]
        for target in conns:
            target = target.replace('.html', '')
            if target in posts_map and target != slug:
                graph_edges.append({"source": slug, "target": target})
                
    graph_data = {"nodes": graph_nodes, "edges": graph_edges}
    
    with open(os.path.join(OUTPUT_DIR, 'map', 'graph.json'), 'w', encoding='utf-8') as f:
        json.dump(graph_data, f, ensure_ascii=False, indent=2)

    # Build Map Rows (Adjacency)
    map_rows = []
    def get_sort_date(d_str):
        try: return datetime.datetime.strptime(str(d_str)[:10], '%Y-%m-%d')
        except: return datetime.datetime(1900, 1, 1)

    for p in posts:
        slug = p['slug']
        # Outgoing
        conns = p.get('connections', [])
        if isinstance(conns, str): conns = [c.strip() for c in conns.split(',') if c.strip()]
        
        outgoing = []
        for t in conns:
            t = t.replace('.html', '')
            if t in posts_map:
                outgoing.append({
                    "title": posts_map[t].get('title', t),
                    "url": f"../posts/{t}.html"
                })
        
        # Incoming
        incoming_slugs = backlinks_map.get(slug, [])
        incoming = []
        for s in incoming_slugs:
            if s in posts_map:
                incoming.append({
                    "title": posts_map[s].get('title', s),
                    "url": f"../posts/{s}.html"
                })
        
        map_rows.append({
             "title": p.get('title', slug),
             "slug": slug,
             "url": f"../posts/{slug}.html",
             "mode": p.get('mode', 'Essay'),
             "pillar": p.get('pillar', ''),
             "canonical": str(p.get('canonical', '')).lower() == 'true',
             "date": p.get('date', ''),
             "outgoing": outgoing,
             "incoming": incoming,
             "out_count": len(outgoing),
             "in_count": len(incoming)
        })

    # Sort Rows: Canon -> Degree (In+Out) -> Date
    map_rows.sort(key=lambda r: (
        1 if r['canonical'] else 0,
        r['in_count'] + r['out_count'],
        get_sort_date(r['date'])
    ), reverse=True)

    # Generate HTML Rows
    rows_html = ""
    for r in map_rows:
        pillar_badge = f'<span class="badge badge--muted">{r["pillar"].replace("-", " ").title()}</span>' if r['pillar'] else ""
        canon_badge = '<span class="badge badge--canon">Canon</span>' if r['canonical'] else ""
        date_span = f'<span class="date">{r["date"]}</span>' if r['date'] else ""
        
        # Outgoing Links HTML
        out_links_html = ""
        if r['outgoing']:
            links = "".join([f'<a href="{l["url"]}">{l["title"]}</a>' for l in r['outgoing']])
            out_links_html = f"""
            <div class="map__block">
                <div class="map__label">Links to</div>
                <div class="map__links">{links}</div>
            </div>
            """
            
        # Incoming Links HTML
        in_links_html = ""
        if r['incoming']:
            links = "".join([f'<a href="{l["url"]}">{l["title"]}</a>' for l in r['incoming']])
            in_links_html = f"""
            <div class="map__block">
                <div class="map__label">Referenced by</div>
                <div class="map__links">{links}</div>
            </div>
            """
            
        rows_html += f"""
        <div class="map__row" 
             data-title="{r['title'].lower()}" 
             data-pillar="{r['pillar'].lower()}" 
             data-mode="{r['mode'].lower()}"
             data-canon="{'1' if r['canonical'] else '0'}">
             
            <div class="map__left">
                <div class="map__meta">
                    <span class="badge">{r['mode'].title()}</span>
                    {pillar_badge}
                    {canon_badge}
                    {date_span}
                </div>
                <a class="map__title" href="{r['url']}">{r['title']}</a>
                <div class="map__degree muted">
                    Out: {r['out_count']} • In: {r['in_count']}
                </div>
            </div>
            
            <div class="map__right">
                {out_links_html}
                {in_links_html}
            </div>
        </div>
        """

    # Full Map Page Content
    # Client-side filtering script included inline
    map_script = """
    <script>
    (function () {
      const input = document.getElementById("mapFilter");
      const canonOnly = document.getElementById("mapCanonOnly");
      const rows = Array.from(document.querySelectorAll(".map__row"));
    
      function apply() {
        const q = (input.value || "").trim().toLowerCase();
        const canon = canonOnly.checked;
    
        rows.forEach(r => {
          const title = r.dataset.title || "";
          const pillar = r.dataset.pillar || "";
          const mode = r.dataset.mode || "";
          const isCanon = r.dataset.canon === "1";
    
          const matchQ = !q || title.includes(q) || pillar.includes(q) || mode.includes(q);
          const matchCanon = !canon || isCanon;
    
          r.style.display = (matchQ && matchCanon) ? "" : "none";
        });
      }
    
      input.addEventListener("input", apply);
      canonOnly.addEventListener("change", apply);
    })();
    </script>
    """

    map_page_content = f"""
    <div class="magazine-layout">
        <div class="content-wrapper full-width">
            <section class="map">
              <div class="map__header">
                <h1>Map</h1>
                <p class="muted">
                  {len(graph_nodes)} nodes • {len(graph_edges)} connections
                </p>
            
                <div class="map__controls">
                  <input id="mapFilter" class="map__input" type="search" placeholder="Filter by title, pillar, mode…" autocomplete="off" />
                  <label class="map__toggle">
                    <input id="mapCanonOnly" type="checkbox" />
                    Canon only
                  </label>
                </div>
              </div>
            
              <div class="map__table" id="mapTable">
                {rows_html}
              </div>
            </section>
            {map_script}
        </div>
    </div>
    """
    
    full_map_page = base_template.replace('{{ content }}', map_page_content)
    full_map_page = full_map_page.replace('{{ starter_set_nav }}', starter_set_nav_html) 
    # Fix paths for sub-directory
    full_map_page = full_map_page.replace('href="index.html"', 'href="../index.html"')
    full_map_page = full_map_page.replace('href="about.html"', 'href="../about.html"')
    full_map_page = full_map_page.replace('href="collections.html"', 'href="../collections.html"')
    full_map_page = full_map_page.replace('src="', 'src="../')
    full_map_page = full_map_page.replace('href="css/', 'href="../css/')
    full_map_page = full_map_page.replace('{{ starter_set_nav }}', starter_set_nav_html.replace('posts/', '../posts/'))
    
    full_map_page = full_map_page.replace('{{ root }}', '../')
    full_map_page = full_map_page.replace('{{ title }}', 'Map - Does This Feel Right?')
    full_map_page = full_map_page.replace('{{ description }}', 'The network of thoughts.')
    full_map_page = full_map_page.replace('{{ url }}', f"{BASE_URL}/map/index.html")
    full_map_page = full_map_page.replace('{{ image }}', DEFAULT_IMAGE)
    full_map_page = full_map_page.replace('{{ og_type }}', 'website')
    full_map_page = full_map_page.replace('{{ json_ld }}', '')
    
    write_file(os.path.join(OUTPUT_DIR, 'map', 'index.html'), full_map_page)
    
    # Render map-graph.html
    try:
        map_graph_path = os.path.join(TEMPLATE_DIR, 'map-graph.html')
        if os.path.exists(map_graph_path):
            map_graph_template = read_file(map_graph_path)
            full_map_graph_page = base_template.replace('{{ content }}', map_graph_template)
            full_map_graph_page = full_map_graph_page.replace('{{ starter_set_nav }}', starter_set_nav_html) 
            
            # Fix paths for sub-directory
            full_map_graph_page = full_map_graph_page.replace('href="index.html"', 'href="../index.html"')
            full_map_graph_page = full_map_graph_page.replace('href="about.html"', 'href="../about.html"')
            full_map_graph_page = full_map_graph_page.replace('href="collections.html"', 'href="../collections.html"')
            full_map_graph_page = full_map_graph_page.replace('src="', 'src="../')
            full_map_graph_page = full_map_graph_page.replace('href="css/', 'href="../css/')
            
            # Fix absolute URLs broken by aggressive path replacement
            full_map_graph_page = full_map_graph_page.replace('src="../http', 'src="http')
            full_map_graph_page = full_map_graph_page.replace('src="..///', 'src="//')

            # Clean up double dots in static path if happened
            full_map_graph_page = full_map_graph_page.replace('../static/', '../static/')

            full_map_graph_page = full_map_graph_page.replace('{{ root }}', '../')
            full_map_graph_page = full_map_graph_page.replace('{{ title }}', 'Map — Does This Feel Right?')
            full_map_graph_page = full_map_graph_page.replace('{{ description }}', 'The network of thoughts.')
            full_map_graph_page = full_map_graph_page.replace('{{ url }}', f"{BASE_URL}/map/graph.html")
            full_map_graph_page = full_map_graph_page.replace('{{ image }}', DEFAULT_IMAGE)
            full_map_graph_page = full_map_graph_page.replace('{{ og_type }}', 'website') 
            full_map_graph_page = full_map_graph_page.replace('{{ json_ld }}', '')
            
            write_file(os.path.join(OUTPUT_DIR, 'map', 'graph.html'), full_map_graph_page)
        else:
            print("Template map-graph.html not found.")
    except Exception as e:
        print(f"Error generating map/graph.html: {e}")

    write_file(os.path.join(OUTPUT_DIR, 'visualizer.html'), viz_page)

    # 11b. Copy App Static Builds
    print("Step 11b: Copying App Static Builds...")
    apps_dest_dir = os.path.join(OUTPUT_DIR, 'apps')
    os.makedirs(apps_dest_dir, exist_ok=True)

    # Debugger
    debugger_src = os.path.join('ai-tools', 'apps', 'debugger', 'out')
    debugger_dest = os.path.join(apps_dest_dir, 'debugger')
    if os.path.exists(debugger_src):
        if os.path.exists(debugger_dest): shutil.rmtree(debugger_dest)
        shutil.copytree(debugger_src, debugger_dest)
        print(f"Copied debugger app to {debugger_dest}")
    else:
        print(f"WARNING: Debugger app build not found at {debugger_src}. Run 'turbo build' in ai-tools first.")

    # Visualizer (Context Viewer)
    visualizer_src = os.path.join('ai-tools', 'apps', 'context-viewer', 'out')
    visualizer_dest = os.path.join(apps_dest_dir, 'visualizer')
    if os.path.exists(visualizer_src):
        if os.path.exists(visualizer_dest): shutil.rmtree(visualizer_dest)
        shutil.copytree(visualizer_src, visualizer_dest)
        print(f"Copied visualizer app to {visualizer_dest}")
    else:
        print(f"WARNING: Visualizer app build not found at {visualizer_src}. Run 'turbo build' in ai-tools first.")

    print("Build Complete!")

if __name__ == "__main__":
    build()
