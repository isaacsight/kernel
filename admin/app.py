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

@app.route('/mission-control')
def mission_control():
    return render_template('mission_control.html')

@app.route('/api/mission-control')
def api_mission_control():
    try:
        from .engineers.data_analyst import DataAnalyst
        analyst = DataAnalyst()
        data = analyst.get_mission_control_data()
        return jsonify(data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/chat')
def chat():
    return render_template('chat.html')

@app.route('/api/chat', methods=['POST'])
def chat_api():
    try:
        data = request.json
        user_message = data.get('message')
        session_id = data.get('session_id', request.remote_addr)
        
        if not user_message:
            return jsonify({'status': 'error', 'message': 'No message provided'}), 400

        # Use the new route_and_log function for automatic conversation tracking
        from .engineers.command_router import route_and_log
        result = route_and_log(user_message, session_id=session_id)
        
        return jsonify({'status': 'success', 'result': result})
        
    except Exception as e:
        print(f"Chat Error: {e}")
        return jsonify({'status': 'error', 'message': str(e)}), 500

# ==================== COMMUNICATION ANALYTICS ====================

@app.route('/api/communication/stats')
def communication_stats():
    """Get communication analytics and statistics."""
    try:
        from .engineers.communication_analyzer import get_communication_analyzer
        analyzer = get_communication_analyzer()
        return jsonify({
            'status': 'success',
            'analytics': analyzer.get_analytics(),
            'health': analyzer.get_communication_health()
        })
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/api/communication/insights')
def communication_insights():
    """Get AI-powered improvement suggestions."""
    try:
        from .engineers.communication_analyzer import get_communication_analyzer
        analyzer = get_communication_analyzer()
        return jsonify({
            'status': 'success',
            'insights': analyzer.get_improvement_suggestions()
        })
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/api/communication/history')
def communication_history():
    """Get recent conversation history."""
    try:
        from .engineers.communication_analyzer import get_communication_analyzer
        analyzer = get_communication_analyzer()
        
        limit = request.args.get('limit', 50, type=int)
        session_id = request.args.get('session_id')
        intent = request.args.get('intent')
        
        return jsonify({
            'status': 'success',
            'conversations': analyzer.get_conversation_history(
                limit=limit,
                session_id=session_id,
                intent_filter=intent
            )
        })
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/api/communication/feedback', methods=['POST'])
def communication_feedback():
    """Submit feedback for a conversation."""
    try:
        from .engineers.communication_analyzer import get_communication_analyzer
        analyzer = get_communication_analyzer()
        
        data = request.json
        conversation_id = data.get('conversation_id')
        feedback = data.get('feedback', '')
        rating = data.get('rating')  # 1-5 stars
        
        if not conversation_id:
            return jsonify({'status': 'error', 'message': 'conversation_id required'}), 400
        
        success = analyzer.add_user_feedback(conversation_id, feedback, rating)
        
        return jsonify({
            'status': 'success' if success else 'error',
            'message': 'Feedback recorded' if success else 'Conversation not found'
        })
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/communication')
def communication_dashboard():
    """Communication analytics dashboard."""
    return render_template('communication_dashboard.html')

# ==================== SOCIAL NETWORK ====================

@app.route('/api/social/feed')
def social_feed():
    try:
        from .engineers.social_engine import get_social_engine
        engine = get_social_engine()
        return jsonify({
            'status': 'success',
            'feed': engine.get_feed()
        })
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/api/social/agents')
def social_agents():
    try:
        from .engineers.social_engine import get_social_engine
        engine = get_social_engine()
        return jsonify({
            'status': 'success',
            'agents': engine.get_personas()
        })
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500

# ==================== OFFICE SPACE ====================

@app.route('/office')
def office_space():
    """Visual Office Space."""
    return render_template('ai_office.html')

@app.route('/api/office/state')
def office_state():
    try:
        from .engineers.office_manager import get_office_manager
        mgr = get_office_manager()
        return jsonify({
            'status': 'success',
            'state': mgr.get_office_state()
        })
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/api/office/whiteboard', methods=['POST'])
def update_whiteboard():
    try:
        from .engineers.office_manager import get_office_manager
        mgr = get_office_manager()
        data = request.json
        
        if data.get('action') == 'add':
            item = mgr.add_whiteboard_item(
                data.get('content'), 
                data.get('author', 'User'), 
                data.get('category', 'Idea')
            )
            return jsonify({'status': 'success', 'item': item})
            
        elif data.get('action') == 'clear':
            mgr.clear_whiteboard()
            return jsonify({'status': 'success', 'message': 'Whiteboard cleared'})
            
        return jsonify({'status': 'error', 'message': 'Invalid action'})
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500

# ==================== FRONTIER TEAM DASHBOARD ====================

@app.route('/team')
def team_dashboard():
    """Render the Frontier Team Mission Control."""
    return render_template('team_dashboard.html')

@app.route('/api/team/roster')
def team_roster():
    """Get the list of all active agents."""
    # This could be dynamic, but utilizing our init exports
    from .engineers import (
        FrontierResearcher, InfrastructureEngineer, PrincipalEngineer, 
        QuantResearcher, RoboticsEngineer, SecurityArchitect, 
        EngineeringManager, RealityEngineer, KernelEngineer, ProductEngineer
    )
    
    # Instantiate briefly to get metadata
    agents = [
        EngineeringManager(),
        FrontierResearcher(),
        InfrastructureEngineer(),
        PrincipalEngineer(),
        ProductEngineer(),
        SecurityArchitect(),
        QuantResearcher(),
        RoboticsEngineer(),
        RealityEngineer(),
        KernelEngineer()
    ]
    
    return jsonify({
        "status": "success",
        "agents": [{"name": a.name, "role": a.role, "emoji": a.emoji} for a in agents]
    })

@app.route('/api/team/node-status')
def team_node_status():
    """Check Studio Node via Infrastructure Engineer."""
    from .engineers import InfrastructureEngineer
    infra = InfrastructureEngineer()
    status = infra.check_node_health()
    return jsonify(status)

@app.route('/api/team/audit', methods=['POST'])
def team_audit():
    """Run the Team Audit via Engineering Manager."""
    from .engineers import EngineeringManager
    manager = EngineeringManager()
    
    # Root dir is 2 levels up from app.py (admin/app.py -> admin -> root)
    root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    
    report = manager.audit_team(root_dir)
    return jsonify(report)

if __name__ == '__main__':
    app.run(debug=True, use_reloader=False, host='0.0.0.0', port=5001)

