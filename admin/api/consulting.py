from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import HTMLResponse, FileResponse
from typing import List, Optional
import os
import shutil
from datetime import datetime
import json

router = APIRouter()

SUBMISSIONS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../submissions'))

@router.get("/dashboard", response_class=HTMLResponse)
async def get_dashboard():
    html_content = """
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Consulting Submissions</title>
        <style>
            :root { --bg: #0d0d0d; --text: #e0e0e0; --accent: #40DCA5; --card: #1a1a1a; }
            body { background: var(--bg); color: var(--text); font-family: -apple-system, system-ui, sans-serif; margin: 0; padding: 2rem; }
            h1 { color: var(--accent); margin-bottom: 2rem; }
            .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1.5rem; }
            .card { background: var(--card); padding: 1.5rem; border-radius: 8px; border: 1px solid #333; }
            .meta { font-size: 0.9rem; color: #888; margin-bottom: 1rem; }
            .message { white-space: pre-wrap; margin-bottom: 1rem; line-height: 1.5; }
            .images { display: grid; grid-template-columns: repeat(auto-fit, minmax(80px, 1fr)); gap: 0.5rem; margin-top: 1rem; }
            .img-thumb { width: 100%; height: 80px; object-fit: cover; border-radius: 4px; cursor: pointer; border: 1px solid #444; }
            .img-thumb:hover { border-color: var(--accent); }
            a { color: var(--accent); text-decoration: none; }
            .empty { color: #666; font-style: italic; }
        </style>
    </head>
    <body>
        <h1>Incoming Requests</h1>
        <div id="grid" class="grid">Loading...</div>

        <script>
            async function load() {
                const res = await fetch('/api/consulting/submissions');
                const data = await res.json();
                const grid = document.getElementById('grid');
                
                if (data.length === 0) {
                    grid.innerHTML = '<div class="empty">No submissions yet.</div>';
                    return;
                }

                grid.innerHTML = data.map(item => {
                    const images = item.files.filter(f => f.match(/\.(jpg|jpeg|png|gif|webp)$/i));
                    const docs = item.files.filter(f => !f.match(/\.(jpg|jpeg|png|gif|webp)$/i));
                    
                    return `
                    <div class="card">
                        <div class="meta">
                            <strong>${item.name}</strong><br>
                            ${item.email}<br>
                            ${new Date(item.timestamp).toLocaleString()}
                        </div>
                        <div class="message">${item.message}</div>
                        
                        ${images.length ? '<div class="images">' + 
                            images.map(f => `<a href="/api/consulting/submissions/${item.id}/files/${f}" target="_blank"><img src="/api/consulting/submissions/${item.id}/files/${f}" class="img-thumb"></a>`).join('') 
                        + '</div>' : ''}
                        
                        ${docs.length ? '<div class="docs" style="margin-top: 0.5rem; font-size: 0.9rem;">' +
                            docs.map(f => `<div>📄 <a href="/api/consulting/submissions/${item.id}/files/${f}" target="_blank">${f}</a></div>`).join('')
                        + '</div>' : ''}
                    </div>
                    `;
                }).join('');
            }
            load();
        </script>
    </body>
    </html>
    """
    return html_content

@router.get("/submissions")
async def list_submissions():
    if not os.path.exists(SUBMISSIONS_DIR):
        return []
        
    submissions = []
    # Sort by time desc
    items = sorted(os.listdir(SUBMISSIONS_DIR), reverse=True)
    
    for item in items:
        item_path = os.path.join(SUBMISSIONS_DIR, item)
        if os.path.isdir(item_path):
            info_path = os.path.join(item_path, "info.json")
            if os.path.exists(info_path):
                with open(info_path, 'r') as f:
                    try:
                        info = json.load(f)
                        # Add files/images list
                        files = [f for f in os.listdir(item_path) if f != "info.json" and not f.startswith(".")]
                        info['id'] = item
                        info['files'] = files
                        submissions.append(info)
                    except:
                        continue
    return submissions

@router.get("/submissions/{submission_id}/files/{filename}")
async def get_submission_file(submission_id: str, filename: str):
    # Security check: ensure submission_id is a valid directory name
    safe_id = os.path.basename(submission_id)
    safe_filename = os.path.basename(filename)
    
    file_path = os.path.join(SUBMISSIONS_DIR, safe_id, safe_filename)
    
    if os.path.exists(file_path):
        return FileResponse(file_path)
    raise HTTPException(status_code=404, detail="File not found")

@router.post("/submit")
async def submit_consulting_request(
    name: str = Form(...),
    email: str = Form(...),
    message: str = Form(...),
    images: List[UploadFile] = File(None)
):
    try:
        # Create unique directory for submission
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        safe_name = "".join([c for c in name if c.isalnum() or c in (' ', '_')]).strip().replace(' ', '_')
        submission_path = os.path.join(SUBMISSIONS_DIR, f"{timestamp}_{safe_name}")
        
        os.makedirs(submission_path, exist_ok=True)
        
        # Save Info
        info = {
            "name": name,
            "email": email,
            "message": message,
            "timestamp": datetime.now().isoformat()
        }
        
        with open(os.path.join(submission_path, "info.json"), "w") as f:
            json.dump(info, f, indent=4)
            
        # Save Images
        if images:
            for image in images:
                if image.filename:
                    file_path = os.path.join(submission_path, image.filename)
                    with open(file_path, "wb") as buffer:
                        shutil.copyfileobj(image.file, buffer)
                        
        return {"status": "success", "message": "Submission received"}
        
    except Exception as e:
        print(f"Error processing submission: {e}")
        raise HTTPException(status_code=500, detail=str(e))
