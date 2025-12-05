import os
import datetime
from flask import Flask, render_template, request, redirect, url_for, jsonify
import frontmatter
import subprocess
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)

from . import core

# Configuration
# Paths are now handled in core.py, but we might need them for static/templates if not in core
TEMPLATE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), 'templates'))
STATIC_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '../static'))

app = Flask(__name__, template_folder=TEMPLATE_DIR, static_folder=STATIC_DIR)

@app.route('/leads')
def leads():
    leads_data = core.get_leads()
    return render_template('leads.html', leads=leads_data)

@app.route('/')
def dashboard():
    posts = core.get_posts()
    return render_template('dashboard.html', posts=posts)

@app.route('/edit/<filename>')
def edit(filename):
    filepath = os.path.join(core.CONTENT_DIR, filename)
    if os.path.exists(filepath):
        with open(filepath, 'r') as f:
            post = frontmatter.load(f)
            return render_template('editor.html', post=post, filename=filename, content=post.content)
    return redirect(url_for('dashboard'))

@app.route('/new')
def new_post():
    return render_template('editor.html', post={}, filename=None, content="")

@app.route('/save', methods=['POST'])
def save():
    try:
        data = request.form
        filename = data.get('filename')
        title = data.get('title')
        date = data.get('date') or datetime.date.today().strftime('%Y-%m-%d')
        category = data.get('category')
        tags = data.get('tags')
        content = data.get('content')
        
        core.save_post(filename, title, date, category, tags, content)
            
        return redirect(url_for('dashboard'))
    except Exception as e:
        return f"Error saving post: {str(e)}", 500

@app.route('/publish', methods=['POST'])
def publish():
    try:
        message = core.publish_git()
        return jsonify({'status': 'success', 'message': message})
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)})





@app.route('/generate-post', methods=['POST'])
def generate_post():
    try:
        data = request.json
        topic = data.get('topic')
        
        if not topic:
            return jsonify({'status': 'error', 'message': 'No topic provided'})
            
        filename = core.generate_ai_post(topic)
        return jsonify({'status': 'success', 'message': 'Post generated successfully!', 'filename': filename})
        
    except Exception as e:
        print(f"AI Generation Error: {e}")
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/api/refine', methods=['POST'])
def refine_content_route():
    try:
        data = request.json
        content = data.get('content')
        
        if not content:
            return jsonify({'status': 'error', 'message': 'No content provided'}), 400

        refined_text = core.refine_content(content)
        
        return jsonify({'status': 'success', 'refined_content': refined_text})
        
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500

# --- Video Studio Routes ---

@app.route('/video-studio')
def video_studio():
    return render_template('video_studio.html')

@app.route('/api/videos')
def get_videos():
    try:
        posts = core.get_posts()
        videos = []
        for post in posts:
            slug = post.get('slug') or os.path.splitext(os.path.basename(post.get('path', '')))[0]
            # Assuming video filename convention: title-slug.mp4 or just slug.mp4?
            # Broadcaster uses title.lower().replace(' ', '-')
            title_slug = post.get('title', '').lower().replace(' ', '-')
            video_filename = f"{title_slug}.mp4"
            video_path = os.path.join(STATIC_DIR, 'videos', video_filename)
            
            videos.append({
                'title': post.get('title'),
                'date': post.get('date'),
                'slug': slug,
                'video_exists': os.path.exists(video_path),
                'video_url': url_for('static', filename=f'videos/{video_filename}') if os.path.exists(video_path) else None
            })
        return jsonify({'videos': videos})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/videos/regenerate', methods=['POST'])
def regenerate_video():
    try:
        data = request.json
        slug = data.get('slug')
        vibe = data.get('vibe', 'chill')
        
        # Find post by slug
        posts = core.get_posts()
        post = next((p for p in posts if (p.get('slug') == slug or os.path.splitext(os.path.basename(p.get('path', '')))[0] == slug)), None)
        
        if not post:
            return jsonify({'status': 'error', 'message': 'Post not found'})

        # Trigger Broadcaster
        from .engineers.broadcaster import Broadcaster
        broadcaster = Broadcaster()
        video_path = broadcaster.generate_video(post, vibe=vibe)
        
        if video_path:
            return jsonify({'status': 'success', 'video_path': video_path})
        else:
            return jsonify({'status': 'error', 'message': 'Failed to generate video'})
            
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/api/videos/upload', methods=['POST'])
def upload_video_route():
    try:
        data = request.json
        slug = data.get('slug')
        
        # Find post and video
        posts = core.get_posts()
        post = next((p for p in posts if (p.get('slug') == slug or os.path.splitext(os.path.basename(p.get('path', '')))[0] == slug)), None)
        
        if not post:
            return jsonify({'status': 'error', 'message': 'Post not found'})
            
        title_slug = post.get('title', '').lower().replace(' ', '-')
        video_filename = f"{title_slug}.mp4"
        video_path = os.path.join(STATIC_DIR, 'videos', video_filename)
        
        if not os.path.exists(video_path):
            return jsonify({'status': 'error', 'message': 'Video does not exist. Regenerate first.'})

        # Trigger Broadcaster Upload
        from .engineers.broadcaster import Broadcaster
        broadcaster = Broadcaster()
        description = f"New post: {post.get('title')} #blog #ai #tech"
        broadcaster.upload_to_tiktok(video_path, description)
        
        return jsonify({'status': 'success', 'message': 'Upload started'})
            
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5001)
