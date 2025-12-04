import os
import datetime
from flask import Flask, render_template, request, redirect, url_for, jsonify
import frontmatter
import subprocess
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)

import core

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

if __name__ == '__main__':
    app.run(debug=True, port=5001)
