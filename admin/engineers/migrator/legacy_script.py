import requests
import time

def fetch_data(urls):
    results = []
    for url in urls:
        print(f"Fetching {url}...")
        try:
            response = requests.get(url)
            if response.status_code == 200:
                results.append(response.json())
        except Exception as e:
            print(f"Error: {e}")
        time.sleep(1) # Simulated delay
    return results

if __name__ == "__main__":
    sites = ["https://api.github.com", "https://api.google.com"]
    data = fetch_data(sites)
    print(f"Fetched {len(data)} items.")
