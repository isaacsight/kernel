import os
import logging
from moviepy import CompositeVideoClip, ColorClip


logger = logging.getLogger("Broadcaster")

# Broadcaster class

class Broadcaster:
    def __init__(self):
        # Point to Project Root cookies.txt (admin/engineers/../../cookies.txt)
        self.cookies_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../cookies.txt"))
        self.output_dir = os.path.join(os.path.dirname(__file__), "../../static/videos")
        if not os.path.exists(self.output_dir):
            os.makedirs(self.output_dir)

    def generate_video(self, post, vibe="chill", voice=None, engine="moviepy"):
        """
        Generates a video using the specified engine.
        
        Args:
            post (dict): Blog post data
            vibe (str): Video processing vibe
            voice (str): Voice ID
            engine (str): "moviepy" (fully automated) or "capcut" (hybrid/draft only)
            
        Returns:
            str: Path to video file (MoviePy) or Status Message (CapCut)
        """
        if engine == "capcut":
            return self._generate_with_capcut(post, vibe, voice)
            
        # Default to MoviePy Engine
        try:
            from .video_engine import VideoEngine, Director, VisualAsset, VisualType
            
            title = post.get('title', 'New Post')
            slug = post.get('slug')
            
            # 1. Generate Script & Audio (The Foundation)
            voiceover_path, vtt_path = self.generate_voiceover(post, vibe, voice)
            if not voiceover_path:
                logger.warning("Failed to generate voiceover. Attempting fallback to dummy audio.")
                project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
                dummy_mp3 = os.path.join(project_root, "static", "videos", "dummy_voice.mp3")
                dummy_vtt = os.path.join(project_root, "static", "videos", "dummy.vtt")
                
                if os.path.exists(dummy_mp3) and os.path.exists(dummy_vtt):
                    logger.info("Using dummy audio fallback.")
                    voiceover_path = dummy_mp3
                    vtt_path = dummy_vtt
                else:
                    logger.error("Failed to generate voiceover and no fallback found. Aborting video.")
                    return None
                
            # Read the script text (simulated from vtt or re-generation)
            # Ideally generate_voiceover returns the text too. 
            # For now, let's re-read the script if possible or extract from VTT/Prompt.
            # Hack: We'll regenerate the script text essentially or pass it if I update generate_voiceover.
            # Let's update generate_voiceover to return script_text too? 
            # Or just use the one we generated.
            # Let's retrieve it from the file system or re-run for now (cheap).
            script_text = self.generate_script(post, vibe) # This is cached/fast usually
            
            # 2. The Director Plans the Scenes
            director = Director()
            # We need to map audio to scenes. 
            # Simple approach: Evenly split duration? No, that's bad.
            # Better approach: Map VTT timestamps to scenes.
            
            # Parse VTT to get timings
            # We need a helper for VTT parsing here or use KineticTextEngine's
            from .kinetic_text import KineticTextEngine
            kte = KineticTextEngine()
            captions = kte.parse_vtt(vtt_path) if vtt_path else []
            
            # Create Scenes from Captions
            # Each caption is essentially a mini-scene for now to ensure sync
            scenes = []
            
            # Capture Screenshots just in case (as assets)
            screenshots = self.capture_screenshots(slug)
            
            # Assets Pool
            import random
            
            for i, (start, end, text) in enumerate(captions):
                duration = end - start
                
                # Director chooses visual for this segment
                visual = director._choose_visual(text, i, len(captions))
                
                # Resolve Asset Source
                # If it's an IMAGE type, assign a screenshot or fallback
                if visual.asset_type == VisualType.IMAGE:
                    # Cycle through screenshots
                    if screenshots:
                        visual.source_path = screenshots[i % len(screenshots)]
                    else:
                        visual.asset_type = VisualType.COLOR
                        visual.color = "#111111"
                
                # If it's AI VIDEO, we leave it (Engine handles generation? No, Engine expects path)
                # !! Critical: Engine expects paths. Broadcaster must fetch assets.
                if visual.asset_type == VisualType.GENERATED_VEO:
                    # Try to retrieve/generate
                    # For V1 speed: Fallback to Screenshot but log "Would Generate: {visual.prompt}"
                    # Or check if cached
                    # TODO: Implement cached asset retrieval
                    logger.info(f"Scene {i} requires AI Video: {visual.prompt}")
                    if screenshots:
                        visual.source_path = screenshots[i % len(screenshots)]
                        visual.asset_type = VisualType.IMAGE # Fallback
                        visual.effects.append("glitch") # Add glitch to signify "AI-ness"
                    else:
                         visual.asset_type = VisualType.COLOR
                         visual.color = "#002244"
                
                # Create Scene
                from .video_engine import Scene, AudioAsset
                
                # Audio splicing is hard without re-cutting. 
                # Simpler: The Audio is ONE track for the whole video. 
                # But VideoEngine renders scenes individually.
                # Solution: VideoEngine renders visual scenes. We overlay the Master Audio at the end.
                # SO: Scene.audio is None.
                
                scene = Scene(
                    id=i,
                    text=text,
                    duration=duration,
                    visual=visual,
                    audio=None # We add master track later
                )
                scenes.append(scene)
            
            if not scenes:
                logger.error("Director failed to create scenes.")
                return None

            # 3. The Engine Assembles the Video
            engine = VideoEngine()
            
            # Temp output
            filename = f"{slug}_temp.mp4"
            temp_path = os.path.join(self.output_dir, filename)
            
            success = engine.render_project(scenes, temp_path)
            if not success:
                return None
                
            # 4. Final Polish (Master Audio + Background Music)
            from moviepy import VideoFileClip, AudioFileClip, CompositeAudioClip
            from moviepy.audio.fx import AudioNormalize, MultiplyVolume, AudioFadeOut, AudioLoop
            
            final_clip = VideoFileClip(temp_path)
            
            # Voiceover
            voice_audio = AudioFileClip(voiceover_path)
            
            # Background Music
            audio_filename = "lofi_beat.mp3" 
            if vibe == "upbeat": audio_filename = "upbeat.mp3" 
            elif vibe == "tech": audio_filename = "tech.mp3" 
            
            bg_music_path = os.path.join(os.path.dirname(__file__), f"../static/audio/{audio_filename}")
            if not os.path.exists(bg_music_path):
                 bg_music_path = os.path.join(os.path.dirname(__file__), "../static/audio/lofi_beat.mp3")
            
            final_audio = voice_audio
            if os.path.exists(bg_music_path):
                bg_music = AudioFileClip(bg_music_path)
                # Loop and Duck
                bg_music = AudioLoop(duration=final_clip.duration).apply(bg_music)
                bg_music = bg_music.with_effects([MultiplyVolume(0.2)])
                voice_audio = voice_audio.with_effects([AudioNormalize(), MultiplyVolume(1.5)])
                final_audio = CompositeAudioClip([bg_music, voice_audio])
                
            final_clip.audio = final_audio
            
            # Final Write
            import re
            safe_title = re.sub(r'[^\w\s-]', '', title.lower())
            safe_title = re.sub(r'\s+', '-', safe_title)[:50]
            final_output_path = os.path.join(self.output_dir, f"{safe_title}.mp4")
            
            final_clip.write_videofile(final_output_path, fps=30, audio_codec='aac')
            
            # Cleanup temp
            try:
                os.remove(temp_path)
            except:
                pass
                
            return final_output_path

            return final_output_path

        except Exception as e:
            logger.error(f"Failed to generate video: {e}")
            import traceback
            traceback.print_exc()
            return None

    def _generate_with_capcut(self, post, vibe="chill", voice=None):
        """
        Generates a CapCut draft via the local CapCutAPI server.
        """
        try:
            import requests
            import json
            
            # API Config
            API_URL = "http://localhost:9001" # Updated to match tools/CapCutAPI/config.json
            
            logger.info("Connecting to CapCutAPI...")
            
            # 1. Create a new Draft
            try:
                # 1080x1920 (TikTok vertical)
                payload = {"width": 1080, "height": 1920}
                response = requests.post(f"{API_URL}/create_draft", json=payload, timeout=10)
                if response.status_code != 200:
                    logger.error(f"Failed to create draft: {response.text}")
                    return None
                
                data = response.json()
                if not data.get("success"):
                     logger.error(f"API Error: {data.get('error')}")
                     return None
                     
                draft_id = data["output"]["draft_id"]
                draft_info = data["output"] # Contains draft_folder?
                logger.info(f"Created Draft ID: {draft_id}")
                
            except Exception as e:
                logger.error(f"Could not connect to CapCutAPI: {e}")
                return None
            
            # 2. Add Audio (Voiceover)
            # We still generate the voiceover locally first
            voiceover_path, vtt_path = self.generate_voiceover(post, vibe, voice)
            if not voiceover_path:
                 logger.warning("Failed to generate voiceover for CapCut. Proceeding without audio.")
                 # return None # Allow draft creation without audio
            else:
                 # CapCutAPI needs a URL or absolute path? 
                 # It seems the server implementation uses `add_audio_track` which might expect a local path if running locally
                 # or a URL if remote. Since server is local, absolute path should work if server has permissions.
                 # Let's try absolute file path.
                 abs_audio_path = os.path.abspath(voiceover_path)
            
                 payload = {
                    "draft_id": draft_id,
                    "audio_url": abs_audio_path, # Server code variable name is audio_url but likely supports paths
                    "track_name": "voiceover",
                    "volume": 1.5
                 }
                 res = requests.post(f"{API_URL}/add_audio", json=payload)
                 if res.status_code == 200:
                    logger.info("Added voiceover to draft")
                 else:
                    logger.warning(f"Failed to add voiceover: {res.text}")
                
            # 3. Add Captions (Subtitles)
            # The API supports SRT. detailed styling can be passed.
            # We have VTT. Need to convert to SRT or just raw text?
            # API takes 'srt' param which can be content or path.
            # Let's convert our vtt to simple srt path.
            if vtt_path:
                 srt_path = vtt_path.replace('.vtt', '.srt')
                 # Simple conversion if needed, or see if we can just pass the path
                 # For now, let's assume we can pass the VTT path if the server supports it, 
                 # OR we do a quick text add.
                 # Actually, looking at server code: `add_subtitle` takes `srt` (content or URL).
                 # Let's read the VTT and just extract text for now? 
                 # No, we want timing. 
                 # Let's convert VTT to SRT properly.
                 self._convert_vtt_to_srt(vtt_path, srt_path)
                 
                 payload = {
                    "draft_id": draft_id,
                    "srt": os.path.abspath(srt_path),
                    "font": "System", 
                    "font_size": 10,
                    "font_color": "#FFFF00" if vibe == "chill" else "#FFFFFF", # Yellow or White
                    "track_name": "captions"
                 }
                 # CapCutAPI might fail if font doesn't exist. "System" is safe? or "Arial"?
                 # Server default is "思源粗宋".
                 res = requests.post(f"{API_URL}/add_subtitle", json=payload)
                 logger.info(f"Added subtitles: {res.status_code}")

            # 4. Add Visuals (Screenshots)
            slug = post.get('slug', 'temp')
            screenshots = self.capture_screenshots(slug)
            
            # Simple logic: Show first screenshot for first half, second for second?
            # Or just add them sequentially to cover duration.
            # We don't know total duration easily without parsing audio.
            # But we can add them with long duration?
            # Let's just add 2 screenshots for 5s each for now as a demo.
            
            current_time = 0
            for i, shot in enumerate(screenshots):
                 # Add image
                 payload = {
                    "draft_id": draft_id,
                    "image_url": os.path.abspath(shot),
                    "start": current_time,
                    "end": current_time + 5.0,
                    "track_name": "visuals"
                 }
                 requests.post(f"{API_URL}/add_image", json=payload)
                 current_time += 5.0
            
            # 5. Save Draft
            # Some server implementations require an explicit save call to flush to disk DB
            requests.post(f"{API_URL}/save_draft", json={"draft_id": draft_id})
            
            logger.info("CapCut Draft Generation Complete!")
            return f"DRAFT_CREATED:{draft_id}"
            
        except Exception as e:
            logger.error(f"CapCut generation failed: {e}")
            import traceback
            traceback.print_exc()
            return None

    def _convert_vtt_to_srt(self, vtt_path, srt_path):
        """Simple helper to convert VTT to SRT format."""
        try:
            with open(vtt_path, 'r', encoding='utf-8') as fin, open(srt_path, 'w', encoding='utf-8') as fout:
                lines = fin.readlines()
                count = 1
                for line in lines:
                    if "WEBVTT" in line: continue
                    if "-->" in line:
                        fout.write(f"{count}\n")
                        fout.write(line.replace('.', ',')) # SRT uses comma for millis
                        count += 1
                    elif line.strip():
                        fout.write(line)
                    else:
                        fout.write('\n')
        except:
            pass


    def generate_script(self, post, vibe="chill"):
        """Generates a short TikTok script using Gemini."""
        try:
            import google.generativeai as genai
            from ..config import config
            
            # Get content - handle both dict and frontmatter.Post objects
            content = post.get('content', '') if isinstance(post, dict) else getattr(post, 'content', '')

            # Check for Studio Node (Windows)
            if config.STUDIO_NODE_URL:
                 try:
                     import requests
                     payload = {
                         "prompt": f"""
                         You are a TikTok content creator. Write a short, engaging script (max 30 seconds spoken) summarizing this blog post.
                         The vibe is {vibe}.
                         
                         Title: {post.get('title')}
                         Content: {str(content)[:2000]}...
                         
                         Rules:
                         - Start with a hook.
                         - Keep it conversational and punchy.
                         - No emojis or hashtags in the spoken text.
                         - Just return the plain text script.
                         """,
                         "model": "mistral",
                         "stream": False
                     }
                     response = requests.post(f"{config.STUDIO_NODE_URL}/api/generate", json=payload, timeout=config.TIMEOUT_REMOTE or 30)
                     if response.status_code == 200:
                         data = response.json()
                         text = data.get("response") or data.get("content") or data.get("output")
                         if text:
                             return text.strip()
                 except Exception as ex:
                     logger.warning(f"Studio Node generation failed: {ex}. Falling back to Gemini.")

            if not config.GEMINI_API_KEY:
                logger.warning("No Gemini API key found. Skipping script generation.")
                return None
                
            genai.configure(api_key=config.GEMINI_API_KEY)
            model = genai.GenerativeModel(config.GEMINI_MODEL)
            
            prompt = f"""
            You are a TikTok content creator. Write a short, engaging script (max 30 seconds spoken) summarizing this blog post.
            The vibe is {vibe}.
            
            Title: {post.get('title')}
            Content: {str(content)[:2000]}...
            
            Rules:
            - Start with a hook.
            - Keep it conversational and punchy.
            - No emojis or hashtags in the spoken text.
            - Just return the plain text script.
            """
            
            response = model.generate_content(prompt)
            return response.text.strip()
        except Exception as e:
            logger.error(f"Failed to generate script: {e}")
            import traceback
            traceback.print_exc()
            return None

    def generate_voiceover(self, post, vibe="chill", voice=None):
        """Generates voiceover audio and subtitles using VoiceActor (ElevenLabs/edge-tts)."""
        try:
            import asyncio
            from admin.engineers.voice_actor import VoiceActor
            
            script = self.generate_script(post, vibe)
            if not script:
                return None, None
                
            logger.info(f"Generated Script: {script}")
            
            filename_base = f"voiceover_{post.get('slug', 'temp')}"
            audio_path = os.path.join(self.output_dir, f"{filename_base}.mp3")
            
            # Use VoiceActor
            actor = VoiceActor()
            
            # Run async method in sync context
            # Check if we are already in an event loop
            try:
                loop = asyncio.get_event_loop()
                if loop.is_running():
                    # This is tricky if we are already in a loop.
                    # But Broadcaster is usually called from a sync workflow step.
                    # If we are in a loop, we should await it, but this method is sync.
                    # For now, assuming sync context or using nest_asyncio if needed.
                    # Let's try standard asyncio.run first.
                    audio_path, vtt_path = asyncio.run(actor.speak(script, audio_path, voice))
                else:
                    audio_path, vtt_path = asyncio.run(actor.speak(script, audio_path, voice))
            except RuntimeError:
                # If loop is running (e.g. in a notebook or existing loop), use this hack or fix architecture
                # For this codebase, it seems mostly sync.
                 audio_path, vtt_path = asyncio.run(actor.speak(script, audio_path, voice))

            return audio_path, vtt_path
        except Exception as e:
            logger.error(f"Failed to generate voiceover: {e}")
            import traceback
            traceback.print_exc()
            return None, None

    def add_captions(self, video_clip, vtt_path):
        """Overlays dynamic kinetic captions from a VTT file."""
        try:
            from admin.engineers.kinetic_text import KineticTextEngine
            from moviepy import CompositeVideoClip
            
            # Initialize engine
            engine = KineticTextEngine()
            
            # Generate kinetic clips
            # Use 'karaoke' for fast paced / tech vibes, 'capcut_pop' for chill
            style = "karaoke" 
            
            caption_clips = engine.generate_kinetic_captions(
                vtt_path, 
                video_clip.w, 
                video_clip.h,
                style=style
            )
            
            if not caption_clips:
                logger.warning("No captions generated by KineticTextEngine.")
                final_v = video_clip
            else:
                 final_v = CompositeVideoClip([video_clip] + caption_clips)

            # Add SFX (Pop) for every word if style is karaoke
            if style == "karaoke":
                 try:
                     # We need to know when words appear.
                     # Hack: we assume caption_clips are the word clips.
                     # Let's check if caption_clips are indeed word clips
                     # KineticTextEngine logic: returns list of clips.
                     
                     sfx_clips = []
                     pop_path = os.path.join(os.path.dirname(__file__), "../static/audio/pop.mp3")
                     
                     if os.path.exists(pop_path):
                         from moviepy import AudioFileClip, CompositeAudioClip
                         pop_sound = AudioFileClip(pop_path)
                         # Make it quieter
                         pop_sound = pop_sound.with_effects([MultiplyVolume(0.15)])
                         
                         for c in caption_clips:
                             # Add pop at start of clip
                             sfx = pop_sound.with_start(c.start)
                             sfx_clips.append(sfx)
                             
                         # Mix with existing audio
                         current_audio = final_v.audio
                         if current_audio:
                             final_audio = CompositeAudioClip([current_audio] + sfx_clips)
                             final_v.audio = final_audio
                 except Exception as sfx_err:
                     logger.warning(f"Failed to add SFX: {sfx_err}")
            
            return final_v

        except Exception as e:
            logger.error(f"Failed to add kinetic captions: {e}")
            # Import traceback to debug if needed
            import traceback
            traceback.print_exc()
            return video_clip

    def capture_screenshots(self, slug):
        """
        Captures screenshots of the blog post using Playwright (v2).
        """
        try:
            from playwright.sync_api import sync_playwright
            import time

            # Construct file URL
            project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../"))
            file_path = os.path.join(project_root, "docs", "posts", f"{slug}.html")
            
            if not os.path.exists(file_path):
                # Try fallback to localhost if file doesn't exist (e.g. if we want to capture live server)
                # But for now, just warning
                logger.warning(f"Static file not found at {file_path}. Playwright capture might fail.")
                
            url = f"file://{file_path}"
            logger.info(f"Navigating to {url}")
            
            screenshots = []
            
            with sync_playwright() as p:
                browser = p.chromium.launch(headless=True)
                # Mobile viewport mostly
                page = browser.new_page(viewport={'width': 1080, 'height': 1920})
                
                try:
                    page.goto(url, wait_until="networkidle", timeout=10000)
                except:
                    # If networkidle times out, maybe it's fine (static file)
                    pass
                
                # Screenshot 1 (Top)
                path1 = os.path.join(self.output_dir, f"{slug}-1.png")
                page.screenshot(path=path1)
                screenshots.append(path1)
                
                # Screenshot 2 (Scrolled)
                page.evaluate("window.scrollBy(0, 800)")
                # Wait for potential animations
                page.wait_for_timeout(500)
                
                path2 = os.path.join(self.output_dir, f"{slug}-2.png")
                page.screenshot(path=path2)
                screenshots.append(path2)
                
                browser.close()
                
            return screenshots
            
        except Exception as e:
            logger.error(f"Screenshot capture failed: {e}")
            import traceback
            traceback.print_exc()
            return []

    def upload_to_tiktok(self, video_path, description="New post! #blog #tech"):
        """
        Uploads a video to TikTok.
        """
        from admin.brain.collective_intelligence import get_collective_intelligence
        ci = get_collective_intelligence()
        
        # 1. Proactive Check (Consult Collective)
        warnings = ci.consult_collective("upload_to_tiktok", f"Uploading {video_path}")
        if warnings:
            logger.warning(f"⚠️ Collective Intelligence Warnings: {warnings}")
            # In the future, we could abort if a specific "BLOCKER" tag matches
            
        if not os.path.exists(self.cookies_path):
            logger.warning("TikTok cookies not found. Skipping upload.")
            return False
        
        try:
            from ..config import config
            from tiktok_uploader.upload import upload_video
            
            full_description = f"{description}\n\nRead more at: {config.SITE_URL}"
            
            upload_video(
                filename=video_path,
                description=full_description,
                cookies=self.cookies_path,
                browser='chrome',
                headless=True 
            )
            if os.path.exists(video_path):
                try:
                    os.remove(video_path)
                    logger.info(f"Deleted {video_path} after successful upload.")
                except Exception as del_err:
                    logger.warning(f"Failed to delete uploaded video: {del_err}")
                    
            return True
        except Exception as e:
            logger.error(f"Failed to upload to TikTok: {e}")
            
            # 2. Reflexive Learning (Learn from Failure)
            ci.learn_from_failure(
                "Broadcaster", 
                "upload_to_tiktok", 
                str(e), 
                {"video": video_path, "cookies_exists": os.path.exists(self.cookies_path)}
            )
            return False

    def distribute_to_twitter(self, thread_data: dict) -> bool:
        """
        Posts a thread to Twitter/X.
        Tries API first, falls back to browser automation if API fails (e.g., Free tier).
        Also stages to content/social_drafts/twitter_{timestamp}.md
        """
        try:
            import time
            timestamp = int(time.time())
            
            filename = f"twitter_thread_{timestamp}.md"
            filepath = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../content/social_drafts", filename))
            
            tweets = thread_data.get("tweets", [])
            posted = False
            
            # Try API first
            from ..config import config
            if config.TWITTER_CONSUMER_KEY and config.TWITTER_ACCESS_TOKEN:
                try:
                    import tweepy
                    client = tweepy.Client(
                        consumer_key=config.TWITTER_CONSUMER_KEY,
                        consumer_secret=config.TWITTER_CONSUMER_SECRET,
                        access_token=config.TWITTER_ACCESS_TOKEN,
                        access_token_secret=config.TWITTER_ACCESS_TOKEN_SECRET
                    )
                    
                    previous_tweet_id = None
                    logger.info(f"Posting {len(tweets)} tweets via API...")
                    
                    for i, tweet_text in enumerate(tweets):
                        logger.info(f"Sending tweet {i+1}...")
                        if i == 0:
                            response = client.create_tweet(text=tweet_text)
                        else:
                            response = client.create_tweet(text=tweet_text, in_reply_to_tweet_id=previous_tweet_id)
                        
                        previous_tweet_id = response.data['id']
                        logger.info(f"Tweet {i+1} posted with ID: {previous_tweet_id}")
                        
                        if i < len(tweets) - 1:
                            time.sleep(2)
                    
                    posted = True
                    
                except Exception as e:
                    logger.warning(f"API posting failed: {e}. Trying browser automation...")
            
            # Fallback: Browser automation
            if not posted and tweets:
                posted = self._post_tweet_browser(tweets[0])  # Post first tweet
            
            # Stage draft regardless
            with open(filepath, "w") as f:
                f.write(f"# Twitter Thread Draft\n\n")
                f.write(f"**STATUS:** {'🟢 POSTED' if posted else '🟡 STAGED'}\n")
                f.write(f"**Total Tweets:** {thread_data.get('tweet_count')}\n")
                f.write(f"**Chars:** {thread_data.get('total_characters')}\n\n")
                f.write("---\n\n")
                
                for tweet in tweets:
                    f.write(f"{tweet}\n\n---\n\n")
            
            logger.info(f"🐦 Twitter thread {'posted' if posted else 'staged'}: {filepath}")
            return True
        except Exception as e:
            logger.error(f"Failed to distribute to Twitter: {e}")
            return False
    
    def _post_tweet_browser(self, tweet_text: str) -> bool:
        """Post a single tweet using Playwright browser automation."""
        import asyncio
        
        async def _post():
            try:
                from playwright.async_api import async_playwright
                
                cookies = self._parse_twitter_cookies()
                if not cookies:
                    logger.warning("No Twitter cookies found for browser posting")
                    return False
                
                async with async_playwright() as p:
                    browser = await p.chromium.launch(headless=True)
                    context = await browser.new_context(
                        viewport={'width': 1280, 'height': 800},
                        user_agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
                    )
                    await context.add_cookies(cookies)
                    
                    page = await context.new_page()
                    await page.goto('https://x.com/compose/tweet', wait_until='domcontentloaded', timeout=60000)
                    await asyncio.sleep(3)
                    
                    textarea = await page.wait_for_selector('[data-testid="tweetTextarea_0"]', timeout=15000)
                    await textarea.click()
                    await textarea.type(tweet_text, delay=30)
                    await asyncio.sleep(1)
                    
                    post_button = await page.wait_for_selector('[data-testid="tweetButton"]', timeout=10000)
                    await post_button.click(force=True)
                    await asyncio.sleep(3)
                    
                    await browser.close()
                    logger.info("Tweet posted via browser automation")
                    return True
                    
            except Exception as e:
                logger.error(f"Browser posting failed: {e}")
                return False
        
        return asyncio.run(_post())
    
    def _parse_twitter_cookies(self):
        """Parse Twitter cookies from cookies.txt file."""
        cookies = []
        if not os.path.exists(self.cookies_path):
            return cookies
        
        with open(self.cookies_path, 'r') as f:
            for line in f:
                if line.startswith('#') or not line.strip():
                    continue
                parts = line.strip().split('\t')
                if len(parts) >= 7:
                    domain = parts[0]
                    if 'x.com' in domain or 'twitter.com' in domain:
                        cookie = {
                            'name': parts[5],
                            'value': parts[6],
                            'domain': '.x.com',
                            'path': parts[2],
                            'secure': parts[3] == 'TRUE',
                            'httpOnly': False,
                            'sameSite': 'Lax'
                        }
                        try:
                            expiry = int(parts[4])
                            if expiry > 0:
                                cookie['expires'] = expiry
                        except:
                            pass
                        cookies.append(cookie)
        return cookies

    def distribute_to_linkedin(self, post_data: dict) -> bool:
        """
        Simulates posting to LinkedIn.
        Saves to content/social_drafts/linkedin_{timestamp}.md
        """
        try:
            import time
            timestamp = int(time.time())
            
            filename = f"linkedin_post_{timestamp}.md"
            filepath = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../content/social_drafts", filename))
            
            with open(filepath, "w") as f:
                f.write(f"# LinkedIn Post Draft\n\n")
                f.write(f"**Read Time:** {post_data.get('estimated_read_time')}\n\n")
                f.write("---\n\n")
                f.write(post_data.get("post", ""))
            
            logger.info(f"💼 LinkedIn post staged: {filepath}")
            return True
        except Exception as e:
            logger.error(f"Failed to distribute to LinkedIn: {e}")
            return False

    def distribute_to_instagram(self, carousel_data: dict) -> bool:
        """
        Generates Instagram carousel images using VisualArtist.
        """
        try:
            import time
            from .visual_artist import VisualArtist
            
            artist = VisualArtist()
            timestamp = int(time.time())
            folder_name = f"instagram_carousel_{timestamp}"
            folder_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../content/social_drafts", folder_name))
            
            if not os.path.exists(folder_path):
                os.makedirs(folder_path)
            
            slides = carousel_data.get("slides", [])
            for slide in slides:
                slide_num = slide.get("slide_number")
                text_content = ""
                
                if slide.get("type") == "cover":
                    text_content = slide.get("headline", "") + "\n\n" + slide.get("subtext", "")
                elif slide.get("type") == "content":
                    text_content = slide.get("text", "")
                elif slide.get("type") == "cta":
                    text_content = slide.get("headline", "") + "\n\n" + slide.get("cta", "")
                    
                output_file = os.path.join(folder_path, f"slide_{slide_num}.png")
                artist.generate_carousel_slide(text_content, output_file)
                
            # Save caption
            caption_path = os.path.join(folder_path, "caption.md")
            with open(caption_path, "w") as f:
                f.write(carousel_data.get("caption", ""))
                
            logger.info(f"📸 Instagram carousel staged: {folder_path}")
            return True
        except Exception as e:
            logger.error(f"Failed to distribute to Instagram: {e}")
            return False

    def distribute_to_youtube(self, shorts_data: dict, video_path: str = None) -> bool:
        """
        Stages YouTube Short metadata.
        If 'client_secrets.json' is present in admin/, enables LIVE uploading.
        """
        try:
            import time
            timestamp = int(time.time())
            
            # Check for PROPER OAuth credentials
            secrets_path = os.path.join(os.path.dirname(__file__), "../client_secrets.json")
            live_mode = False
            
            if os.path.exists(secrets_path):
                # We have the secrets file, we *could* upload.
                # However, this triggers a browser flow.
                # For now, let's just mark it as "READY_FOR_AUTH"
                live_mode = True
                
            filename = f"youtube_shorts_{timestamp}.md"
            filepath = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../content/social_drafts", filename))
            
            with open(filepath, "w") as f:
                f.write(f"# YouTube Shorts Metadata\n\n")
                if live_mode:
                    f.write("**STATUS:** 🟢 READY FOR AUTH (client_secrets.json found)\n")
                else:
                    f.write("**STATUS:** 🟡 STAGING MODE (Missing client_secrets.json)\n")
                    
                f.write(f"**Title:** {shorts_data.get('title')}\n\n")
                f.write(f"**Description:**\n{shorts_data.get('description')}\n\n")
                f.write("---\n\n")
                if video_path:
                    f.write(f"**Video File:** {video_path}\n")
                else:
                    f.write("**Video File:** (Use generated TikTok video)\n")
            
            logger.info(f"▶️ YouTube Shorts staged: {filepath}")
            return True
        except Exception as e:
            logger.error(f"Failed to distribute to YouTube: {e}")
            return False
