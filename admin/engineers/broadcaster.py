import os
import logging
from moviepy import TextClip, CompositeVideoClip, ColorClip
from tiktok_uploader.upload import upload_video

logger = logging.getLogger("Broadcaster")

class Broadcaster:
    def __init__(self):
        self.cookies_path = os.path.join(os.path.dirname(__file__), "../cookies.txt")
        self.output_dir = os.path.join(os.path.dirname(__file__), "../../static/videos")
        if not os.path.exists(self.output_dir):
            os.makedirs(self.output_dir)

    def generate_video(self, post, vibe="chill"):
        """
        Generates a video from blog post screenshots with background music and effects.
        vibe: 'chill' (default), 'upbeat', 'tech'
        """
        try:
            from ..config import config
            from moviepy import concatenate_videoclips, ImageClip, AudioFileClip, CompositeVideoClip, vfx, CompositeAudioClip
            from moviepy.audio.fx import AudioFadeOut, AudioNormalize, MultiplyVolume, AudioLoop
            from selenium import webdriver
            from selenium.webdriver.chrome.options import Options
            import time

            title = post.get('title', 'New Post')
            slug = post.get('slug')
            
            # 1. Capture Screenshots
            screenshots = self.capture_screenshots(slug)
            if not screenshots:
                logger.error("No screenshots captured.")
                return None

            # 2. Create Video Clips with Ken Burns Effect
            clips = []
            slide_duration = 4
            transition_duration = 0.5
            
            # Adjust pacing based on vibe
            if vibe == "upbeat":
                slide_duration = 2.5
            elif vibe == "tech":
                slide_duration = 3
            
            for i, screen_path in enumerate(screenshots):
                # Create Image Clip
                clip = ImageClip(screen_path).with_duration(slide_duration + transition_duration)
                
                # Apply Ken Burns (Zoom In)
                # Zoom from 1.0 to 1.1 over the duration
                # MoviePy v2: use with_effects
                try:
                    # Try v2 syntax first
                    clip = clip.with_effects([vfx.Resize(lambda t: 1 + 0.02 * t)]) 
                except AttributeError:
                    # Fallback to v1 syntax if vfx not found or different
                    # But we know it's v2 from previous error.
                    # Let's assume vfx is imported from moviepy
                    pass

                # Center the clip (important after resizing)
                clip = clip.with_position('center')
                
                # Fade in/out for smooth transitions
                if i > 0:
                    clip = clip.with_effects([vfx.CrossFadeIn(transition_duration)])
                
                clips.append(clip)

            # Combine clips
            final_video = concatenate_videoclips(clips, method="compose", padding=-transition_duration)

            # 3. Add Audio
            # Path relative to admin/engineers/ is ../static/audio/lofi_beat.mp            # 3. Add Audio
            # Select track based on vibe
            audio_filename = "lofi_beat.mp3" # Default chill
            if vibe == "upbeat":
                audio_filename = "upbeat.mp3" 
            elif vibe == "tech":
                audio_filename = "tech.mp3" 
                
            bg_music_path = os.path.join(os.path.dirname(__file__), f"../static/audio/{audio_filename}")
            if not os.path.exists(bg_music_path):
                 bg_music_path = os.path.join(os.path.dirname(__file__), "../static/audio/lofi_beat.mp3")

            # Generate Voiceover with Captions (re-enabled!)
            voiceover_path, vtt_path = self.generate_voiceover(post, vibe)
            
            final_audio = None
            
            if os.path.exists(bg_music_path):
                try:
                    logger.info(f"Found background audio at {bg_music_path}")
                    bg_music = AudioFileClip(bg_music_path)
                    
                    # Loop background music to match video duration
                    if bg_music.duration < final_video.duration:
                        bg_music = AudioLoop(duration=final_video.duration).apply(bg_music)
                    else:
                        bg_music = bg_music.subclipped(0, final_video.duration)
                    
                    # Mix voiceover with background music if voiceover exists
                    if voiceover_path and os.path.exists(voiceover_path):
                        logger.info(f"Mixing voiceover from {voiceover_path}")
                        voiceover = AudioFileClip(voiceover_path)
                        
                        # Reduce bg music volume when voiceover is present (ducking)
                        bg_music = bg_music.with_effects([MultiplyVolume(0.3)])  # 30% volume for background
                        voiceover = voiceover.with_effects([AudioNormalize(), MultiplyVolume(2.0)])  # Boost voiceover
                        
                        # Composite audio: voiceover + background
                        final_audio = CompositeAudioClip([bg_music, voiceover])
                        final_audio = final_audio.with_effects([AudioFadeOut(2)])
                        
                        # Add captions if VTT exists
                        if vtt_path and os.path.exists(vtt_path):
                            logger.info(f"Adding captions from {vtt_path}")
                            final_video = self.add_captions(final_video, vtt_path)
                    else:
                        # Just background music (no voiceover)
                        bg_music = bg_music.with_effects([AudioFadeOut(2), AudioNormalize(), MultiplyVolume(2.5)])
                        final_audio = bg_music
                        
                    final_video.audio = final_audio
                        
                except Exception as e:
                    logger.error(f"Failed to add audio: {e}")

            # Sanitize filename - remove special characters that break FFMPEG
            import re
            safe_title = re.sub(r'[^\w\s-]', '', title.lower())  # Remove non-alphanumeric except spaces/hyphens
            safe_title = re.sub(r'\s+', '-', safe_title)  # Replace spaces with hyphens
            safe_title = safe_title[:50]  # Limit length
            filename = f"{safe_title}.mp4"
            output_path = os.path.join(self.output_dir, filename)
            
            # Write video file with audio codec and bitrate
            final_video.write_videofile(output_path, fps=24, audio_codec='aac', audio_bitrate='192k')
            
            return output_path
        except Exception as e:
            logger.error(f"Failed to generate video: {e}")
            import traceback
            traceback.print_exc()
            return None

    def generate_script(self, post, vibe="chill"):
        """Generates a short TikTok script using Gemini."""
        try:
            import google.generativeai as genai
            from ..config import config
            
            if not config.GEMINI_API_KEY:
                logger.warning("No Gemini API key found. Skipping script generation.")
                return None
                
            genai.configure(api_key=config.GEMINI_API_KEY)
            model = genai.GenerativeModel(config.GEMINI_MODEL)
            
            # Get content - handle both dict and frontmatter.Post objects
            content = post.get('content', '') if isinstance(post, dict) else getattr(post, 'content', '')
            
            prompt = f"""
            You are a TikTok content creator. Write a short, engaging script (max 30 seconds spoken) summarizing this blog post.
            The vibe is {vibe}.
            
            Title: {post.get('title')}
            Content: {content[:2000]}...
            
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

    def generate_voiceover(self, post, vibe="chill"):
        """Generates voiceover audio and subtitles using edge-tts."""
        try:
            import subprocess
            
            script = self.generate_script(post, vibe)
            if not script:
                return None, None
                
            logger.info(f"Generated Script: {script}")
            
            # Select voice based on vibe
            # edge-tts voices:
            # Chill: en-GB-SoniaNeural (British, soft)
            # Upbeat: en-US-GuyNeural (Energetic)
            # Tech: en-US-ChristopherNeural (Professional)
            
            voice = "en-GB-SoniaNeural"
            if vibe == "upbeat":
                voice = "en-US-GuyNeural"
            elif vibe == "tech":
                voice = "en-US-ChristopherNeural"
            
            filename_base = f"voiceover_{post.get('slug', 'temp')}"
            audio_path = os.path.join(self.output_dir, f"{filename_base}.mp3")
            vtt_path = os.path.join(self.output_dir, f"{filename_base}.vtt")
            
            # Use edge-tts CLI
            # edge-tts --voice en-US-GuyNeural --text "Hello" --write-media hello.mp3 --write-subtitles hello.vtt
            
            cmd = [
                "edge-tts",
                "--voice", voice,
                "--text", script,
                "--write-media", audio_path,
                "--write-subtitles", vtt_path
            ]
            
            subprocess.run(cmd, check=True)
            
            return audio_path, vtt_path
        except Exception as e:
            logger.error(f"Failed to generate voiceover: {e}")
            import traceback
            traceback.print_exc()
            return None, None

    def add_captions(self, video_clip, vtt_path):
        """Overlays captions from a VTT file onto the video."""
        try:
            import webvtt
            from moviepy import TextClip, CompositeVideoClip
            
            captions = []
            
            # Parse VTT
            # We need a simple VTT parser or just regex if webvtt not installed
            # Let's try to install webvtt-py or just parse manually
            # Simple manual parser for now to avoid extra dependency if possible, 
            # but edge-tts output is standard.
            
            def time_to_seconds(time_str):
                # 00:00:00.000 or 00:00:00,000
                time_str = time_str.replace(',', '.')
                h, m, s = time_str.split(':')
                return float(h) * 3600 + float(m) * 60 + float(s)

            with open(vtt_path, 'r', encoding='utf-8') as f:
                lines = f.readlines()
            
            # Simple state machine
            start = None
            end = None
            text = []
            
            for line in lines:
                line = line.strip()
                
                # Skip WEBVTT header and block numbers
                if line.startswith('WEBVTT') or line.isdigit():
                    continue
                    
                if '-->' in line:
                    # Time line
                    times = line.split(' --> ')
                    start = time_to_seconds(times[0])
                    end = time_to_seconds(times[1])
                    text = []
                elif line and start is not None:
                    # Text line
                    text.append(line)
                elif not line and start is not None:
                    # End of block
                    if text:
                        full_text = "\n".join(text)
                        
                        # Create TextClip
                    # TikTok Style: Yellow text, Black stroke, Bottom Center
                    try:
                        # Determine font - try to find a bold one
                        font_path = 'Arial-Bold'
                        if os.path.exists('/System/Library/Fonts/Supplemental/Arial Bold.ttf'):
                            font_path = '/System/Library/Fonts/Supplemental/Arial Bold.ttf'
                        elif os.path.exists('/System/Library/Fonts/Supplemental/Impact.ttf'):
                            font_path = '/System/Library/Fonts/Supplemental/Impact.ttf'

                        txt_clip = TextClip(
                            text=full_text,
                            font_size=70,  # Larger for mobile
                            color='yellow',
                            stroke_color='black',
                            stroke_width=4,  # Thicker stroke
                            font=font_path,
                            method='caption', # Wrap text
                            size=(video_clip.w * 0.8, None), # 80% width
                            text_align='center'
                        )
                        
                        txt_clip = txt_clip.with_start(start).with_duration(end - start)
                        txt_clip = txt_clip.with_position(('center', 0.65), relative=True) # Higher up to avoid UI
                        
                        captions.append(txt_clip)
                        logger.info(f"Added caption: {full_text[:30]}...")
                    except Exception as e:
                        logger.error(f"Failed to create TextClip: {e}")
                    
                    start = None
                    end = None
            
            # Handle last block if file doesn't end with newline
            if start is not None and text:
                 full_text = "\n".join(text)
                 txt_clip = TextClip(
                    text=full_text,
                    font_size=40,
                    color='yellow',
                    stroke_color='black',
                    stroke_width=2,
                    font='/System/Library/Fonts/Supplemental/Arial Bold.ttf',
                    method='caption',
                    size=(video_clip.w * 0.9, None),
                    text_align='center'
                )
                 txt_clip = txt_clip.with_start(start).with_duration(end - start)
                 txt_clip = txt_clip.with_position(('center', 0.8), relative=True)
                 captions.append(txt_clip)

            if captions:
                return CompositeVideoClip([video_clip] + captions)
            else:
                return video_clip
                
        except Exception as e:
            logger.error(f"Failed to add captions: {e}")
            import traceback
            traceback.print_exc()
            return video_clip

    def capture_screenshots(self, slug):
        """
        Captures screenshots of the blog post using Selenium.
        """
        try:
            from selenium import webdriver
            from selenium.webdriver.chrome.options import Options
            import time

            options = Options()
            options.add_argument("--headless=new")
            options.add_argument("--window-size=1080,1920") # Mobile aspect ratio
            options.add_argument("--hide-scrollbars")
            
            driver = webdriver.Chrome(options=options)
            
            # Construct file URL
            # Assuming running from project root
            project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../"))
            file_path = os.path.join(project_root, "docs", "posts", f"{slug}.html")
            
            if not os.path.exists(file_path):
                logger.error(f"Post file not found: {file_path}")
                return []
                
            url = f"file://{file_path}"
            logger.info(f"Navigating to {url}")
            driver.get(url)
            time.sleep(2) # Wait for render
            
            screenshots = []
            
            # Screenshot 1: Top (Title)
            path1 = os.path.join(self.output_dir, f"{slug}-1.png")
            driver.save_screenshot(path1)
            screenshots.append(path1)
            
            # Screenshot 2: Middle (Scroll down)
            driver.execute_script("window.scrollBy(0, 1000);")
            time.sleep(1)
            path2 = os.path.join(self.output_dir, f"{slug}-2.png")
            driver.save_screenshot(path2)
            screenshots.append(path2)
            
            # Screenshot 3: Bottom (CTA/Footer)
            driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
            time.sleep(1)
            path3 = os.path.join(self.output_dir, f"{slug}-3.png")
            driver.save_screenshot(path3)
            screenshots.append(path3)
            
            driver.quit()
            return screenshots
        except Exception as e:
            logger.error(f"Screenshot capture failed: {e}")
            return []

    def upload_to_tiktok(self, video_path, description="New post on my blog! #blog #tech"):
        """
        Uploads a video to TikTok.
        """
        if not os.path.exists(self.cookies_path):
            logger.warning("TikTok cookies not found. Skipping upload.")
            return False
        
        try:
            from ..config import config
            # ... rest of upload logic ...
            # We need to re-implement this part because I'm replacing the whole method block in the tool call
            # Wait, the tool call replaces from line 15 to 76.
            # I need to include upload_to_tiktok implementation.
            
            full_description = f"{description}\n\nRead more at: {config.SITE_URL}/posts/{os.path.basename(video_path).replace('.mp4', '')}"
            
            upload_video(
                filename=video_path,
                description=full_description,
                cookies=self.cookies_path,
                browser='chrome',
                headless=False 
            )
            return True
        except Exception as e:
            logger.error(f"Failed to upload to TikTok: {e}")
            return False
