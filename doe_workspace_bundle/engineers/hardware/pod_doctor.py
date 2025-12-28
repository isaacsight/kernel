import platform
import psutil
import subprocess
import sys
import json
import os

def get_system_info():
    info = {
        "system": platform.system(),
        "processor": platform.processor(),
        "arch": platform.machine(),
        "ram_gb": round(psutil.virtual_memory().total / (1024**3)),
        "apple_silicon": False,
        "gpu": "Unknown"
    }

    # Check for Apple Silicon
    if info["system"] == "Darwin" and "arm" in info["processor"].lower():
        info["apple_silicon"] = True
        try:
            # Get GPU Core Count on Mac
            cmd = "system_profiler SPDisplaysDataType | grep 'Cores'"
            output = subprocess.check_output(cmd, shell=True).decode()
            info["gpu"] = output.strip()
        except:
            pass
            
    return info

def recommend_models(info):
    ram = info["ram_gb"]
    recommendations = {
        "text_model": None,
        "vision_model": None,
        "audio_model": "whisper-base.en",
        "quantization": "q4_0"
    }

    if ram >= 64:
        recommendations["text_model"] = "Llama-3-70B-Instruct"
        recommendations["quantization"] = "q4_k_m"
        recommendations["audio_model"] = "whisper-large-v3"
        recommendations["notes"] = "Sovereign Class: Full Intelligence capable."
    elif ram >= 32:
        recommendations["text_model"] = "Mixtral-8x7B-Instruct"
        recommendations["quantization"] = "q4_0"
        recommendations["audio_model"] = "whisper-medium.en"
        recommendations["notes"] = "Pro Class: High reasoning, good speed."
    elif ram >= 16:
        recommendations["text_model"] = "Llama-3-8B-Instruct"
        recommendations["quantization"] = "q8_0"
        recommendations["audio_model"] = "whisper-small.en"
        recommendations["notes"] = "Standard Class: Great for code/assist."
    else:
        recommendations["text_model"] = "Phi-3-Mini-4k"
        recommendations["quantization"] = "q4_0"
        recommendations["audio_model"] = "whisper-tiny.en"
        recommendations["notes"] = "Edge Class: Fast, lightweight tasks only."

    return recommendations

def main():
    print("🏥 Pod Doctor: Analyzing Hardware Sovereignty...")
    info = get_system_info()
    
    print("\n--- System Telemetry ---")
    print(f"OS: {info['system']}")
    print(f"Chip: {info['processor']}")
    print(f"RAM: {info['ram_gb']} GB")
    print(f"Apple Silicon: {'✅ Yes' if info['apple_silicon'] else '❌ No'}")
    if info['apple_silicon']:
        print(f"GPU: {info['gpu']}")

    print("\n--- Model Recommendations ---")
    recs = recommend_models(info)
    print(f"Tier: {recs['notes']}")
    print(f"LLM:  {recs['text_model']} ({recs['quantization']})")
    print(f"Audio: {recs['audio_model']}")
    
    # Generate Config
    config_path = "admin/engineers/hardware/pod_config.json"
    with open(config_path, 'w') as f:
        json.dump({**info, "recommendations": recs}, f, indent=2)
    
    print(f"\n✅ Configuration saved to {config_path}")
    print("Review this to configure your local inferencing engine (Ollama/LM Studio).")

if __name__ == "__main__":
    main()
