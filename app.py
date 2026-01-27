import http.server
import socketserver
import webbrowser
import os

PORT = 8000

# Change to the directory where this script is located
os.chdir(os.path.dirname(os.path.abspath(__file__)))

Handler = http.server.SimpleHTTPRequestHandler

try:
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        print(f"✅ Server started at http://localhost:{PORT}")
        print("Press Ctrl+C to stop.")
        
        # Try to open the browser automatically
        webbrowser.open(f"http://localhost:{PORT}/index.html")
        
        httpd.serve_forever()
except OSError as e:
    print(f"❌ Error: Could not start server on port {PORT}. Maybe it's already in use?")
    print("Try a different port or close the other server.")
except KeyboardInterrupt:
    print("\n🛑 Server stopped.")