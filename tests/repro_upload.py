import requests
import os

def test_multiple_upload():
    url = "http://localhost:8000/api/consulting/submit"
    
    # Create dummy files
    with open("test_file_1.txt", "w") as f:
        f.write("Content of test file 1")
    with open("test_file_2.txt", "w") as f:
        f.write("Content of test file 2")
        
    try:
        files = [
            ('images', ('test_file_1.txt', open('test_file_1.txt', 'rb'), 'text/plain')),
            ('images', ('test_file_2.txt', open('test_file_2.txt', 'rb'), 'text/plain'))
        ]
        
        data = {
            'name': 'Test User',
            'email': 'test@example.com',
            'message': 'Testing multiple file upload'
        }
        
        print(f"Sending request to {url}...")
        response = requests.post(url, data=data, files=files)
        
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            print("Upload successful!")
        else:
            print("Upload failed.")
            
    except Exception as e:
        print(f"An error occurred: {e}")
    finally:
        # Cleanup
        if os.path.exists("test_file_1.txt"):
            os.remove("test_file_1.txt")
        if os.path.exists("test_file_2.txt"):
            os.remove("test_file_2.txt")

if __name__ == "__main__":
    test_multiple_upload()
