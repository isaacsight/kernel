from flask import Flask, request, jsonify
import threading
import os

app = Flask(__name__)

# Global variable to store the captured code
auth_code = None
server_thread = None

@app.route('/callback')
def callback():
    global auth_code
    auth_code = request.args.get('code')
    if auth_code:
        with open(".tiktok_auth_code", "w") as f:
            f.write(auth_code)
        return "Authorization successful! You can close this window and return to the terminal."
    return "Error: No code received."

def start_server():
    app.run(port=8080)

if __name__ == '__main__':
    start_server()
