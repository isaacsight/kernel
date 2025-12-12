
import json
import os

def convert_netscape_to_playwright(netscape_path, output_path):
    cookies = []
    
    with open(netscape_path, 'r') as f:
        for line in f:
            if line.startswith('#') or not line.strip():
                continue
                
            parts = line.strip().split('\t')
            if len(parts) >= 7:
                domain = parts[0]
                flag = parts[1] == 'TRUE'
                path = parts[2]
                secure = parts[3] == 'TRUE'
                expiry = int(parts[4])
                name = parts[5]
                value = parts[6]
                
                cookie = {
                    "name": name,
                    "value": value,
                    "domain": domain,
                    "path": path,
                    "expires": expiry,
                    "httpOnly": False, # Netscape doesn't usually specify this, assume False
                    "secure": secure,
                    "sameSite": "Lax"
                }
                cookies.append(cookie)
                
    storage_state = {
        "cookies": cookies,
        "origins": []
    }
    
    with open(output_path, 'w') as f:
        json.dump(storage_state, f, indent=2)
        
    print(f"✅ Converted {len(cookies)} cookies to {output_path}")

if __name__ == "__main__":
    convert_netscape_to_playwright(
        "cookies_netscape.txt", 
        "substack_cookies.json"
    )
