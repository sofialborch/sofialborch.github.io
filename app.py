import os
import json
import requests
from dotenv import load_dotenv
from flask import Flask, render_template, jsonify, url_for, request, session, redirect, flash
from datetime import timedelta
from werkzeug.exceptions import HTTPException
import functools

load_dotenv()
app = Flask(__name__, template_folder="", static_folder="")

app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(days=7)

ASSET_SERVER_URL = os.getenv('ASSET_SERVER_URL', 'http://127.0.0.1:4000')

DATA_ASSETS_BASE_URL = f"{ASSET_SERVER_URL}/data_assets/availability"

@app.context_processor
def inject_user_and_assets():    
    # Inject user status, asset server URL, and dynamic navigation items
    return dict(
        asset_server=ASSET_SERVER_URL,
    )

@app.errorhandler(HTTPException)
def handle_exception(e):
    if request.path.startswith('/api/'):
        response = e.get_response()        
        response.data = jsonify({
            'code': e.code,
            'name': e.name,
            'description': e.description,
        }).data
        response.content_type = 'application/json'
        return response
        
    flash(f'An error occurred: {e.name} ({e.code}).', 'error')
    return redirect(url_for('index'))

def load_data_from_server(filename, default_value):
    try:        
        url = f"{DATA_ASSETS_BASE_URL}/{filename}"
        response = requests.get(url, timeout=5)
        if response.status_code == 404:            
            print(f"File not found on server: {filename}. Returning default.")
            return default_value
        response.raise_for_status()
        return response.json()
    except (requests.exceptions.RequestException, json.JSONDecodeError) as e:        
        print(f"Error loading {filename} from server: {e}. Returning default.")
        return default_value

def save_data_to_server(filename, data):
    try:        
        url = f"{DATA_ASSETS_BASE_URL}/{filename}"
        response = requests.post(url, json=data, timeout=5)
        response.raise_for_status()
        return True
    except requests.exceptions.RequestException as e:        
        print(f"Error saving {filename} to server: {e}")
        return False

@app.route('/')
def index():
    return render_template('index.html')

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5080))
    app.run(debug=True, host='0.0.0.0', port=port)