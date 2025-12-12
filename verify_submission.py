import requests
import os

def test_submission():
    url = "http://localhost:8000/api/consulting/submit"
    
    # Create dummy files
    with open("test1.txt", "w") as f:
        f.write("content 1")
    with open("test2.txt", "w") as f:
        f.write("content 2")
        
    try:
        # 1. Test Text Only
        print("Testing Text Only...")
        data = {
            "name": "Test User",
            "email": "test@example.com",
            "message": "This is a text only test."
        }
        res = requests.post(url, data=data)
        print(f"Status: {res.status_code}")
        print(f"Response: {res.text}")
        
        # 2. Test Single File
        print("\nTesting Single File...")
        files = [
            ('images', ('test1.txt', open('test1.txt', 'rb'), 'text/plain'))
        ]
        res = requests.post(url, data=data, files=files)
        print(f"Status: {res.status_code}")
        print(f"Response: {res.text}")

        # 3. Test Multiple Files
        print("\nTesting Multiple Files...")
        # Reset file pointers
        files = [
            ('images', ('test1.txt', open('test1.txt', 'rb'), 'text/plain')),
            ('images', ('test2.txt', open('test2.txt', 'rb'), 'text/plain'))
        ]
        res = requests.post(url, data=data, files=files)
        print(f"Status: {res.status_code}")
        print(f"Response: {res.text}")
        
    finally:
        # Cleanup
        if os.path.exists("test1.txt"):
            os.remove("test1.txt")
        if os.path.exists("test2.txt"):
            os.remove("test2.txt")

if __name__ == "__main__":
    test_submission()
