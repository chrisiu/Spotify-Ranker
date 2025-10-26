// State management
const state = {
    selectedAlbum: null,
    tracks: [],
    comparisons: [],
    currentPairIndex: 0,
    rankings: []
};

// DOM elements
const searchPage = document.getElementById('searchPage');
const rankingPage = document.getElementById('rankingPage');
const resultsPage = document.getElementById('resultsPage');

const albumSearch = document.getElementById('albumSearch');
const searchBtn = document.getElementById('searchBtn');
const searchResults = document.getElementById('searchResults');
const searchError = document.getElementById('searchError');

const startRankingBtn = document.getElementById('startRankingBtn');
const comparisonContainer = document.getElementById('comparisonContainer');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');

const backBtn = document.getElementById('backBtn');
const rankAgainBtn = document.getElementById('rankAgainBtn');
const newSearchBtn = document.getElementById('newSearchBtn');

const resultsList = document.getElementById('resultsList');

searchBtn.addEventListener('click', handleSearch);
albumSearch.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleSearch();
});

startRankingBtn.addEventListener('click', handleStartRanking);
backBtn.addEventListener('click', handleBackToSearch);
rankAgainBtn.addEventListener('click', handleRankAgain);
newSearchBtn.addEventListener('click', handleNewSearch);

// Search functionality
async function handleSearch() {
    const query = albumSearch.value.trim();
    if (!query) return;

    searchError.innerHTML = '';
    searchResults.innerHTML = '<div class="loading"><div class="spinner"></div><p>Searching...</p></div>';

    try {
        const response = await fetch('/api/search-albums', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query })
        });

        if (!response.ok) throw new Error('Search failed');

        const data = await response.json();
        displaySearchResults(data.albums);
    } catch (error) {
        searchError.innerHTML = `<div class="error">Error: ${error.message}</div>`;
        searchResults.innerHTML = '';
    }
}

function displaySearchResults(albums) {
    searchResults.innerHTML = '';

    if (albums.length === 0) {
        searchResults.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #999;">No albums found</p>';
        return;
    }

    albums.forEach(album => {
        const card = document.createElement('div');
        card.className = 'album-card';
        card.innerHTML = `
            <img src="${album.image || 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22200%22 height=%22200%22%3E%3Crect fill=%22%23ddd%22 width=%22200%22 height=%22200%22/%3E%3C/svg%3E'}" alt="${album.name}" class="album-art">
            <div class="album-info">
                <div class="album-name">${escapeHtml(album.name)}</div>
                <div class="album-artist">${escapeHtml(album.artist)}</div>
                <div class="album-year">${album.release_date.split('-')[0]} • ${album.total_tracks} tracks</div>
            </div>
        `;

        card.addEventListener('click', () => selectAlbum(album, card));
        searchResults.appendChild(card);
    });
}

function selectAlbum(album, cardElement) {
    // Remove previous selection
    document.querySelectorAll('.album-card.selected').forEach(card => {
        card.classList.remove('selected');
    });

    // Select new album
    state.selectedAlbum = album;
    cardElement.classList.add('selected');
    startRankingBtn.disabled = false;
}

// Ranking functionality
async function handleStartRanking() {
    const albumId = state.selectedAlbum.id;
    rankingPage.classList.add('active');
    searchPage.classList.remove('active');

    // Set album info
    document.getElementById('rankingAlbumArt').src = state.selectedAlbum.image || '';
    document.getElementById('rankingAlbumName').textContent = state.selectedAlbum.name;
    document.getElementById('rankingAlbumArtist').textContent = state.selectedAlbum.artist;

    comparisonContainer.innerHTML = '<div class="loading"><div class="spinner"></div><p>Loading tracks...</p></div>';

    try {
        const response = await fetch(`/api/album-tracks/${albumId}`);
        if (!response.ok) throw new Error('Failed to load tracks');

        const data = await response.json();
        state.tracks = data.tracks.filter(track => track.preview_url); // Only tracks with previews

        if (state.tracks.length < 2) {
            comparisonContainer.innerHTML = '<div class="error">Not enough tracks with previews available</div>';
            return;
        }

        // Initialize comparisons using bubble sort style
        initializeComparisons();
        displayNextComparison();
    } catch (error) {
        comparisonContainer.innerHTML = `<div class="error">Error: ${error.message}</div>`;
    }
}

function initializeComparisons() {
    state.comparisons = [];
    state.currentPairIndex = 0;
    
    for (let i = 0; i < state.tracks.length - 1; i++) {
        state.comparisons.push([i, i + 1]);
    }

    for (let i = 0; i < Math.floor(state.tracks.length / 2); i++) {
        for (let j = i + 2; j < Math.min(i + 5, state.tracks.length); j++) {
            state.comparisons.push([i, j]);
        }
    }

    state.comparisons = state.comparisons.sort(() => Math.random() - 0.5);
}

function displayNextComparison() {
    if (state.currentPairIndex >= state.comparisons.length) {
        displayResults();
        return;
    }

    const [idx1, idx2] = state.comparisons[state.currentPairIndex];
    const track1 = state.tracks[idx1];
    const track2 = state.tracks[idx2];

    const progress = ((state.currentPairIndex) / state.comparisons.length) * 100;
    progressFill.style.width = progress + '%';
    progressText.textContent = `Comparison ${state.currentPairIndex + 1} of ${state.comparisons.length}`;

    const audioHtml1 = track1.preview_url 
        ? `<div class="audio-player"><audio id="audio1" controls><source src="${track1.preview_url}" type="audio/mpeg"></audio></div>`
        : `<div class="no-preview">No preview available</div>`;
    
    const audioHtml2 = track2.preview_url 
        ? `<div class="audio-player"><audio id="audio2" controls><source src="${track2.preview_url}" type="audio/mpeg"></audio></div>`
        : `<div class="no-preview">No preview available</div>`;

    comparisonContainer.innerHTML = `
        <div class="song-card" data-index="0">
            <div class="song-number">Track ${track1.track_number}</div>
            <div class="song-title">${escapeHtml(track1.name)}</div>
            <div class="song-artist">${escapeHtml(track1.artist)}</div>
            <div class="song-duration">${formatDuration(track1.duration_ms)}</div>
            ${audioHtml1}
            <button class="btn btn-select">Choose This Song</button>
        </div>

        <div class="song-card" data-index="1">
            <div class="song-number">Track ${track2.track_number}</div>
            <div class="song-title">${escapeHtml(track2.name)}</div>
            <div class="song-artist">${escapeHtml(track2.artist)}</div>
            <div class="song-duration">${formatDuration(track2.duration_ms)}</div>
            ${audioHtml2}
            <button class="btn btn-select">Choose This Song</button>
        </div>
    `;

    setTimeout(() => {
        const audio1 = document.getElementById('audio1');
        const audio2 = document.getElementById('audio2');
        
        if (audio1) {
            audio1.play().catch(() => {}); // Ignore autoplay restrictions
            audio1.addEventListener('timeupdate', () => {
                if (audio1.currentTime >= 30) {
                    audio1.pause();
                }
            }, { once: false });
        }
    }, 500);

    document.querySelectorAll('.song-card').forEach(card => {
        card.addEventListener('click', (e) => {
            if (!e.target.closest('.audio-player')) {
                handleSongSelection(card, idx1, idx2);
            }
        });

        card.querySelector('.btn-select').addEventListener('click', (e) => {
            e.stopPropagation();
            handleSongSelection(card, idx1, idx2);
        });
    });
}

function handleSongSelection(card, idx1, idx2) {
    const selectedIndex = parseInt(card.dataset.index);
    const winnerIdx = selectedIndex === 0 ? idx1 : idx2;
    
    document.querySelectorAll('audio').forEach(audio => {
        audio.pause();
        audio.currentTime = 0;
    });
    
    recordComparison(winnerIdx);
}

function recordComparison(winnerIdx) {
    if (!state.rankings[winnerIdx]) {
        state.rankings[winnerIdx] = 0;
    }
    state.rankings[winnerIdx]++;

    state.currentPairIndex++;
    displayNextComparison();
}

function displayResults() {
    rankingPage.classList.remove('active');
    resultsPage.classList.add('active');

    const sortedIndices = state.tracks
        .map((_, idx) => idx)
        .sort((a, b) => (state.rankings[b] || 0) - (state.rankings[a] || 0));

    resultsList.innerHTML = '';
    sortedIndices.forEach((idx, rank) => {
        const track = state.tracks[idx];
        const li = document.createElement('li');
        li.className = 'result-item';
        li.innerHTML = `
            <div class="result-rank">#${rank + 1}</div>
            <div class="result-info">
                <div class="result-title">${escapeHtml(track.name)}</div>
                <div class="result-artist">${escapeHtml(track.artist)}</div>
            </div>
        `;
        resultsList.appendChild(li);
    });
}

function handleBackToSearch() {
    rankingPage.classList.remove('active');
    searchPage.classList.add('active');
    state.currentPairIndex = 0;
    state.comparisons = [];
}

function handleRankAgain() {
    resultsPage.classList.remove('active');
    state.comparisons = [];
    state.currentPairIndex = 0;
    state.rankings = [];
    rankingPage.classList.add('active');
    initializeComparisons();
    displayNextComparison();
}

function handleNewSearch() {
    resultsPage.classList.remove('active');
    searchPage.classList.add('active');
    state.selectedAlbum = null;
    state.tracks = [];
    state.rankings = [];
    state.comparisons = [];
    state.currentPairIndex = 0;
    searchResults.innerHTML = '';
    albumSearch.value = '';
    startRankingBtn.disabled = true;
    document.querySelectorAll('.album-card.selected').forEach(card => {
        card.classList.remove('selected');
    });
}

function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

function formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
}