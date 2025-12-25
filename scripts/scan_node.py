import socket
from urllib.parse import urlparse

ip = "100.98.193.42"
ports = [80, 8001, 8080, 11434, 52415]

print(f"Scanning {ip}...")

for port in ports:
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(2.0)
        result = sock.connect_ex((ip, port))
        if result == 0:
            print(f"Port {port}: OPEN")
        else:
            print(f"Port {port}: Closed/Filtered")
        sock.close()
    except Exception as e:
        print(f"Port {port}: Error {e}")

print("Scan complete.")
