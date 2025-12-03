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
DEFAULT_IMAGE = 'https://www.doesthisfeelright.com/static/images/og-default.jpg' # Placeholder

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
    shutil.copytree(STATIC_DIR, os.path.join(OUTPUT_DIR, 'static'))
    # Also copy style.css to root css/ folder for compatibility if needed, 
    # but our templates use {{ root }}static/css so we should be good.
    # Wait, templates use {{ root }}css/style.css. 
    # Let's match the template expectation: static/css -> docs/css
    # Actually, let's just copy static/* to docs/*
    # So docs/css/style.css exists.
    
    # Re-copying to match structure
    # static/css -> docs/css
    # static/js -> docs/js
    for item in os.listdir(STATIC_DIR):
        s = os.path.join(STATIC_DIR, item)
        d = os.path.join(OUTPUT_DIR, item)
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
            
        # Slug is filename without extension
        slug = os.path.splitext(filename)[0]
        metadata['slug'] = slug

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
        filepath = os.path.join(CONTENT_DIR, slug + '.md')
        if not os.path.exists(filepath): filepath = os.path.join(CONTENT_DIR, slug + '.html')
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
    posts.sort(key=lambda x: (
        x.get('featured', 'false').lower() == 'true', # True (1) > False (0)
        x.get('date', '1970-01-01'),
        x.get('title', '')
    ), reverse=True)

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
        filepath = os.path.join(CONTENT_DIR, post['slug'] + ('.md' if os.path.exists(os.path.join(CONTENT_DIR, post['slug'] + '.md')) else '.html'))
        # Actually filename was lost. Let's just look for it.
        if os.path.exists(os.path.join(CONTENT_DIR, slug + '.md')):
            filepath = os.path.join(CONTENT_DIR, slug + '.md')
        else:
            filepath = os.path.join(CONTENT_DIR, slug + '.html')
            
        raw_content = read_file(filepath)
        _, body = parse_frontmatter(raw_content)
        if filepath.endswith('.md'):
            body = markdown_to_html(body)

        # Generate Tags HTML again
        tags = post.get('tags', '').split(',') if post.get('tags') else [post.get('category', 'General')]
        tags_html = ""
        for tag in tags:
            tag = tag.strip()
            if not tag: continue
            tag_slug = tag.lower().replace(' ', '-')
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
    # Sort posts by date (descending)
    posts.sort(key=lambda x: x.get('date', '0000-00-00'), reverse=True)
    
    # Generate Filter HTML
    categories = sorted(list(set(p.get('category', 'General') for p in posts if p.get('slug') != 'about')))
    filter_html = '<div class="filter-bar">'
    filter_html += '<button class="filter-btn active" data-filter="all">All</button>'
    for cat in categories:
        filter_html += f'<button class="filter-btn" data-filter="{cat}">{cat}</button>'
    filter_html += '</div>'
    
    # Add Sort Controls
    filter_html += '''
    <div class="sort-bar" style="margin-top: 1rem; display: flex; gap: 0.5rem; align-items: center;">
        <span style="font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em; color: #666; font-weight: 700;">Sort:</span>
        <button class="sort-btn active" data-sort="date-desc" style="background:none; border:none; cursor:pointer; font-size:0.9rem; color:#111; font-weight:600; padding:0;">Newest</button>
        <span style="color:#ccc">/</span>
        <button class="sort-btn" data-sort="date-asc" style="background:none; border:none; cursor:pointer; font-size:0.9rem; color:#666; font-weight:400; padding:0;">Oldest</button>
    </div>
    '''
    
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
            
        # Check for Starter Set
        if post['slug'] in starter_set_slugs:
            starter_set_posts.append(post)
            continue
            
        # Check for Experiments (AI posts)
        # Assuming AI posts start with 'ai-' based on file listing
        if post['slug'].startswith('ai-'):
            experiments_posts.append(post)
            continue
            
        # Otherwise, Main Feed
        main_feed_posts.append(post)

    # Sort Starter Set by the order in starter_set_slugs
    starter_set_posts.sort(key=lambda x: starter_set_slugs.index(x['slug']))
    
    # Generate Starter Set HTML
    starter_set_html = ""
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

    # Generate Main Feed HTML
    posts_html = ""
    for post in main_feed_posts:
        # Handle tags for display
        tags = post.get('tags', '').split(',') if post.get('tags') else [post.get('category', 'General')]
        tags = [t.strip() for t in tags if t.strip()]
        primary_tag = tags[0] if tags else 'General'
        
        # Format date
        date_str = post.get('date', '')
        if date_str:
            try:
                date_obj = datetime.datetime.strptime(date_str, '%Y-%m-%d')
                date_display = date_obj.strftime('%b %d, %Y')
            except:
                date_display = date_str
        else:
            date_display = ""
            
        posts_html += f"""
            <a href="posts/{post['slug']}.html" class="post-card category-{post.get('category', 'general').lower().replace(' ', '-')}" data-category="{post.get('category', 'General')}" data-date="{post.get('date', '')}">
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
        
    # Generate Experiments HTML (Lab Notebook Style)
    experiments_html = ""
    # Group by month/year or just list cleanly
    # Let's do a clean list with date and status indicator
    
    # Sort experiments by date descending
    experiments_posts.sort(key=lambda x: x.get('date', '0000-00-00'), reverse=True)
    
    # Limit to top 8 for sidebar
    sidebar_experiments = experiments_posts[:8]
    
    for post in sidebar_experiments:
        date_str = post.get('date', '')
        try:
            date_obj = datetime.datetime.strptime(date_str, '%Y-%m-%d')
            date_display = date_obj.strftime('%b %d')
        except:
            date_display = ""
            
        title = post.get('title', 'Untitled')
        # Clean up title
        title = title.replace('AI: ', '').replace('Experiment: ', '')
        # Remove Theme suffix if present (e.g. "(Theme: ...)")
        if '(Theme:' in title:
            title = title.split('(Theme:')[0].strip()
            
        experiments_html += f"""
            <li class="experiment-item">
                <a href="posts/{post['slug']}.html" class="experiment-link">
                    <div class="experiment-meta">
                        <span class="experiment-date">{date_display}</span>
                        <span class="experiment-status"></span>
                    </div>
                    <span class="experiment-title">{title}</span>
                </a>
            </li>
        """
        
    experiments_html += """
        <li class="experiment-item view-all">
            <a href="experiments.html" class="experiment-link">
                <span class="experiment-title" style="color: var(--text-main); font-weight: 600;">View all experiments →</span>
            </a>
        </li>
    """
        
    # Generate Sidebar Collections List
    # We need to calculate counts first (which we do later in step 6, but let's do a quick pass here or reorder)
    # Let's just do a quick pass to get counts
    tag_counts = {}
    for post in posts:
        if post['slug'] == 'about': continue
        post_tags = post.get('tags', '').split(',') if post.get('tags') else [post.get('category', 'General')]
        for tag in post_tags:
            tag = tag.strip()
            if not tag: continue
            tag_counts[tag] = tag_counts.get(tag, 0) + 1
            
    # Sort tags by count (descending) and take top 5
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
        
    index_content = index_template.replace('{{ starter_set }}', starter_set_html)
    index_content = index_content.replace('{{ recent_posts }}', posts_html)
    index_content = index_content.replace('{{ experiments_list }}', experiments_html)
    index_content = index_content.replace('{{ filters }}', filter_html)
    index_content = index_content.replace('{{ collections_list }}', collections_list_html)
    
    full_index = base_template.replace('{{ title }}', 'Does This Feel Right?')
    full_index = full_index.replace('{{ content }}', index_content)
    full_index = full_index.replace('{{ root }}', '') # Root is empty for index
    full_index = full_index.replace('{{ description }}', 'Thoughts on business, technology, and the human condition.')
    full_index = full_index.replace('{{ url }}', f"{BASE_URL}/index.html")
    full_index = full_index.replace('{{ image }}', DEFAULT_IMAGE)
    full_index = full_index.replace('{{ og_type }}', 'website')
    full_index = full_index.replace('{{ json_ld }}', '')
    
    write_file(os.path.join(OUTPUT_DIR, 'index.html'), full_index)

    # 6. Generate Tag Pages & Collections Index
    # Collect all tags
    all_tags = {}
    for post in posts:
        if post['slug'] == 'about': continue
        
        post_tags = post.get('tags', '').split(',') if post.get('tags') else [post.get('category', 'General')]
        for tag in post_tags:
            tag = tag.strip()
            if not tag: continue
            if tag not in all_tags:
                all_tags[tag] = []
            all_tags[tag].append(post)
            
    # Generate individual tag pages
    tag_template = read_file(os.path.join(TEMPLATE_DIR, 'tag.html'))
    
    for tag, tag_posts in all_tags.items():
        tag_slug = tag.lower().replace(' ', '-')
        
        tag_posts_html = ""
        for post in tag_posts:
            tag_posts_html += f"""
                <a href="../posts/{post['slug']}.html" class="post-card">
                    <span class="post-meta">{post.get('read_time', '5 min read')}</span>
                    <h2>{post.get('title', 'Untitled')}</h2>
                    <p class="post-excerpt">{post.get('excerpt', '')}</p>
                </a>
            """
            
        tag_page = tag_template.replace('{{ tag }}', tag)
        tag_page = tag_page.replace('{{ count }}', str(len(tag_posts)))
        tag_page = tag_page.replace('{{ posts_list }}', tag_posts_html)
        tag_page = tag_page.replace('{{ root }}', '../')
        
        full_tag_page = base_template.replace('{{ title }}', f'{tag} - Does This Feel Right?')
        full_tag_page = full_tag_page.replace('{{ content }}', tag_page)
        full_tag_page = full_tag_page.replace('{{ root }}', '../')
        full_tag_page = full_tag_page.replace('{{ description }}', f'Essays about {tag}.')
        full_tag_page = full_tag_page.replace('{{ url }}', f"{BASE_URL}/tags/{tag_slug}.html")
        full_tag_page = full_tag_page.replace('{{ image }}', DEFAULT_IMAGE)
        full_tag_page = full_tag_page.replace('{{ og_type }}', 'website')
        full_tag_page = full_tag_page.replace('{{ json_ld }}', '')
        
        write_file(os.path.join(OUTPUT_DIR, 'tags', f'{tag_slug}.html'), full_tag_page)
        
    # Generate Collections Index
    collections_template = read_file(os.path.join(TEMPLATE_DIR, 'collections.html'))
    
    collections_html = ""
    for tag in sorted(all_tags.keys()):
        tag_slug = tag.lower().replace(' ', '-')
        count = len(all_tags[tag])
        collections_html += f"""
            <a href="tags/{tag_slug}.html" class="collection-card">
                <h3>{tag}</h3>
                <span class="count">{count} essay{'s' if count != 1 else ''}</span>
            </a>
        """
        
    full_collections = collections_template.replace('{{ collections_list }}', collections_html)
    
    full_collections_page = base_template.replace('{{ title }}', 'Collections - Does This Feel Right?')
    full_collections_page = full_collections_page.replace('{{ content }}', full_collections)
    full_collections_page = full_collections_page.replace('{{ root }}', '')
    full_collections_page = full_collections_page.replace('{{ description }}', 'Explore essays by topic.')
    full_collections_page = full_collections_page.replace('{{ url }}', f"{BASE_URL}/collections.html")
    full_collections_page = full_collections_page.replace('{{ image }}', DEFAULT_IMAGE)
    full_collections_page = full_collections_page.replace('{{ og_type }}', 'website')
    full_collections_page = full_collections_page.replace('{{ json_ld }}', '')
    
    write_file(os.path.join(OUTPUT_DIR, 'collections.html'), full_collections_page)

    # 8. Generate Experiments Page
    # Reuse collections template or similar
    experiments_page_html = '<div class="experiments-archive">'
    experiments_page_html += '<h1 class="experiments-archive-title">Experiments</h1>'
    experiments_page_html += '<p class="experiments-archive-desc">Technical notes, AI workshops, and raw ideas.</p>'
    experiments_page_html += '<div class="experiments-grid">'
    
    for post in experiments_posts:
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
            
        experiments_page_html += f"""
            <a href="posts/{post['slug']}.html" class="experiment-card">
                <div class="experiment-card-header">
                    <span class="experiment-card-date">{date_display}</span>
                    <span class="experiment-card-chip">Experiment</span>
                </div>
                <h3 class="experiment-card-title">{title}</h3>
            </a>
        """
    experiments_page_html += '</div></div>'
    
    full_experiments_page = base_template.replace('{{ title }}', 'Experiments - Does This Feel Right?')
    full_experiments_page = full_experiments_page.replace('{{ content }}', experiments_page_html)
    full_experiments_page = full_experiments_page.replace('{{ root }}', '')
    full_experiments_page = full_experiments_page.replace('{{ description }}', 'Technical notes and experiments.')
    full_experiments_page = full_experiments_page.replace('{{ url }}', f"{BASE_URL}/experiments.html")
    full_experiments_page = full_experiments_page.replace('{{ image }}', DEFAULT_IMAGE)
    full_experiments_page = full_experiments_page.replace('{{ og_type }}', 'website')
    full_experiments_page = full_experiments_page.replace('{{ json_ld }}', '')
    
    write_file(os.path.join(OUTPUT_DIR, 'experiments.html'), full_experiments_page)



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
                    <iframe src="https://doesthisfeelright.substack.com/embed" width="100%" height="320" class="substack-embed" frameborder="0" scrolling="no"></iframe>
                </div>
            </article>
        """
        
        full_about = base_template.replace('{{ title }}', meta.get('title'))
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
        
        rss_items += f"""
        <item>
            <title>{title}</title>
            <link>{BASE_URL}/posts/{post['slug']}.html</link>
            <description>{excerpt}</description>
            <category>{category}</category>
            <guid>{BASE_URL}/posts/{post['slug']}.html</guid>
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

    print("Build complete.")

if __name__ == "__main__":
    build()
