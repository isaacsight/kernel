import os
import time
import json
import requests
from typing import Optional
from dotenv import load_dotenv

load_dotenv()

class VeoClient:
    def __init__(self, api_key: str = None, model_name: str = "models/veo-2.0-generate-001"):
        self.api_key = api_key or os.getenv("GOOGLE_API_KEY")
        if not self.api_key:
            raise ValueError("GOOGLE_API_KEY is not set.")
        self.model_name = model_name
        self.base_url = "https://generativelanguage.googleapis.com/v1beta"

    def generate_video(self, prompt: str, output_file: str = "output.mp4") -> Optional[str]:
        """
        Generates a video using the Veo model via the Gemini API.
        """
        endpoint = f"{self.base_url}/{self.model_name}:predictLongRunning?key={self.api_key}"
        
        payload = {
            "instances": [
                {
                    "prompt": prompt
                }
            ],
            "parameters": {
                "sampleCount": 1,
                "videoLength": "5s",
                "aspectRatio": "16:9"
            }
        }
        
        print(f"Submitting generation job to {self.model_name}...")
        try:
            response = requests.post(endpoint, json=payload)
            response.raise_for_status()
            operation = response.json()
            op_name = operation.get("name")
            print(f"Operation started: {op_name}")
            
            # Poll for completion
            return self._poll_operation(op_name, output_file)

        except requests.exceptions.HTTPError as e:
            print(f"HTTP Error: {e.response.status_code} - {e.response.text}")
            return None
        except Exception as e:
            print(f"Error generating video: {e}")
            return None

    def _poll_operation(self, op_name: str, output_file: str) -> Optional[str]:
        """Polls the long-running operation until complete."""
        poll_url = f"{self.base_url}/{op_name}?key={self.api_key}"
        
        while True:
            try:
                print("Polling for status...")
                resp = requests.get(poll_url)
                resp.raise_for_status()
                data = resp.json()
                
                if "done" in data and data["done"]:
                    if "error" in data:
                        print(f"Operation failed: {data['error']}")
                        return None
                    
                    # Operation done, retrieve result
                    # The result is typically nested in 'response' -> 'predictions' 
                    # dependent on the API contract.
                    # For LROs in GenAI, sometimes the result is embedded or a pointer.
                    
                    response_body = data.get("response")
                    if not response_body:
                         # Sometimes it's in 'result'
                        response_body = data.get("result")

                    if not response_body:
                         print(f"Completed but no response found: {data.keys()}")
                         return None
                        
                    predictions = response_body.get("predictions", []) # Standard format
                    # If empty, check generic keys
                    if not predictions and "videos" in response_body:
                         predictions = response_body["videos"]

                    if not predictions:
                        print(f"No predictions in response: {response_body}")
                        return None
                        
                    video_data = predictions[0]
                    # Check for bytesBase64 or uri
                    if "bytesBase64" in video_data:
                        import base64
                        video_bytes = base64.b64decode(video_data["bytesBase64"])
                        with open(output_file, "wb") as f:
                            f.write(video_bytes)
                        print(f"Video saved to {output_file}")
                        return output_file
                    
                    elif "videoUri" in video_data:
                        print(f"Downloading video from {video_data['videoUri']}...")
                        v_resp = requests.get(video_data['videoUri'])
                        with open(output_file, "wb") as f:
                            f.write(v_resp.content)
                        return output_file
                        
                    elif "gcsUri" in video_data: 
                        print(f"Video in GCS: {video_data['gcsUri']} (Download manually if no creds)")
                        return video_data['gcsUri']
                    else:
                        print(f"Unknown video format: {video_data.keys()}")
                        return None

                time.sleep(5)

            except Exception as e:
                print(f"Polling error: {e}")
                return None

if __name__ == "__main__":
    import sys
    try:
        client = VeoClient()
        prompt = sys.argv[1] if len(sys.argv) > 1 else "A cinematic drone shot of a futuristic city at sunset"
        client.generate_video(prompt)
    except ValueError as e:
        print(e)

