from flask import Flask, render_template, request, jsonify
import requests
import os
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)

# Deezer API (no authentication required for public data)
DEEZER_API_URL = "https://api.deezer.com"

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/search-albums', methods=['POST'])
def search_albums():
    """Search for albums on Deezer"""
    data = request.json
    query = data.get('query', '').strip()
    
    if not query:
        return jsonify({"error": "Query cannot be empty"}), 400
    
    try:
        params = {
            "q": query,
            "limit": 12
        }
        
        response = requests.get(
            f"{DEEZER_API_URL}/search/album",
            params=params
        )
        response.raise_for_status()
        
        albums_data = response.json().get("data", [])
        
        albums = []
        for album in albums_data:
            albums.append({
                "id": album["id"],
                "name": album["title"],
                "artist": album["artist"]["name"],
                "release_date": album.get("release_date", ""),
                "image": album.get("cover_big") or album.get("cover_medium") or album.get("cover_small"),
                "total_tracks": album.get("nb_tracks", 0)
            })
        
        return jsonify({"albums": albums})
    
    except Exception as e:
        print(f"Error searching albums: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/album-tracks/<album_id>', methods=['GET'])
def get_album_tracks(album_id):
    """Fetch all tracks from an album"""
    try:
        # Get album details
        album_response = requests.get(
            f"{DEEZER_API_URL}/album/{album_id}"
        )
        album_response.raise_for_status()
        album_data = album_response.json()
        
        # Get tracks
        tracks_response = requests.get(
            f"{DEEZER_API_URL}/album/{album_id}/tracks"
        )
        tracks_response.raise_for_status()
        tracks_data = tracks_response.json().get("data", [])
        
        all_tracks = []
        for track in tracks_data:
            all_tracks.append({
                "id": track["id"],
                "name": track["title"],
                "artist": ", ".join([artist["name"] for artist in track.get("artists", [track["artist"]])]) if track.get("artists") else track["artist"]["name"],
                "preview_url": track.get("preview"),
                "duration_ms": (track.get("duration", 0)) * 1000,
                "track_number": track.get("track_position", 0),
                "has_preview": bool(track.get("preview"))
            })
        
        return jsonify({
            "album": {
                "id": album_data["id"],
                "name": album_data["title"],
                "artist": album_data["artist"]["name"],
                "image": album_data.get("cover_big") or album_data.get("cover_medium") or album_data.get("cover_small")
            },
            "tracks": all_tracks
        })
    
    except Exception as e:
        print(f"Error fetching album tracks: {e}")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=8000)