const API_KEY = 'AIzaSyDhD0KWm-LknAtXwOpblp3nSG061cqz07w'; // ⚠️ You must replace this with your actual YouTube Data API key

// Load the YouTube IFrame Player API
const tag = document.createElement('script');
tag.src = 'https://www.youtube.com/iframe_api';
const firstScriptTag = document.getElementsByTagName('script')[0];
firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

let player;
let nextPageToken = '';
let isLoading = false;
let hasMoreVideos = true;

// Sketch Feature
let isDrawing = false;
let currentColor = '#ff0000';
let currentSize = 5;
let currentCanvas = null;
let currentContext = null;

let currentCategory = 'trending';
const safeMode = true; // Enable safe content filtering by default

function initTheme() {
    const theme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', theme);
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
}

// Initialize YouTube API
function loadYouTubeAPI() {
    return new Promise((resolve, reject) => {
        if (window.YT) {
            resolve();
            return;
        }

        window.onYouTubeIframeAPIReady = () => resolve();

        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    });
}

// Update fetchVideos function to include channels in search
async function fetchVideos(query = '', loadMore = false) {
    if (isLoading || (!loadMore && !hasMoreVideos)) return;
    
    isLoading = true;
    document.getElementById('loader').style.display = 'block';

    try {
        const pageToken = loadMore ? `&pageToken=${nextPageToken}` : '';
        let apiUrl;

        if (query) {
            // Search only for videos, removed channel search
            apiUrl = `https://www.googleapis.com/youtube/v3/search?key=${API_KEY}&part=snippet&type=video&maxResults=20&q=${encodeURIComponent(query)}${pageToken}&safeSearch=${safeMode ? 'strict' : 'none'}`;
        } else if (currentCategory === 'gaming') {
            // Special handling for gaming category
            const gameKeywords = [
                'Clash of Clans gameplay',
                'Valorant gameplay',
                'PUBG gameplay',
                'Call of Duty Warzone',
                'Minecraft gameplay',
                'Fortnite gameplay',
                'GTA V gameplay',
                'gaming live'
            ];
            
            const selectedKeywords = gameKeywords
                .sort(() => 0.5 - Math.random())
                .slice(0, 3)
                .join('|');
            
            apiUrl = `https://www.googleapis.com/youtube/v3/search?key=${API_KEY}&part=snippet&type=video&maxResults=50&q=${encodeURIComponent(selectedKeywords)}&videoCategoryId=20&relevanceLanguage=en&order=date${pageToken}`;
        } else {
            // Category-based videos
            const categoryParams = getCategoryParams(currentCategory);
            if (currentCategory === 'trending') {
                apiUrl = `https://www.googleapis.com/youtube/v3/videos?key=${API_KEY}&part=snippet,statistics,contentDetails&maxResults=20${pageToken}&${categoryParams}`;
            } else {
                apiUrl = `https://www.googleapis.com/youtube/v3/search?key=${API_KEY}&part=snippet&maxResults=20${pageToken}&${categoryParams}`;
            }
        }

        const response = await fetch(apiUrl);
        const data = await response.json();

        if (data.error) {
            throw new Error(`API Error: ${data.error.message}`);
        }

        nextPageToken = data.nextPageToken;
        hasMoreVideos = Boolean(nextPageToken);

        if (!loadMore) {
            document.getElementById('videos-container').innerHTML = '';
        }

        const videos = data.items.filter(item => !isVideoRestricted(item) && isQualityContent(item));
        await displayVideos(videos, loadMore);

    } catch (error) {
        console.error('Error fetching content:', error);
        const container = document.getElementById('videos-container');
        container.innerHTML = `
            <div class="error-message">
                <i class="fas fa-exclamation-circle"></i>
                <p>${error.message}</p>
                <button onclick="fetchVideos()">Retry</button>
            </div>
        `;
    } finally {
        isLoading = false;
        document.getElementById('loader').style.display = 'none';
    }
}

// Display videos function with enhanced error handling
async function displayVideos(videos, append = false) {
    const container = document.getElementById('videos-container');
    if (!append) {
        container.innerHTML = '';
    }

    for (const video of videos) {
        try {
            // Get additional video details if needed
            const videoId = video.id.videoId || video.id;
            const statsResponse = await fetch(
                `https://www.googleapis.com/youtube/v3/videos?key=${API_KEY}&id=${videoId}&part=contentDetails,statistics`
            );
            const statsData = await statsResponse.json();
            const videoStats = statsData.items[0];

            const videoCard = document.createElement('div');
            videoCard.className = 'video-card fade-in';
            videoCard.innerHTML = `
                <div class="thumbnail-container">
                    <img src="${video.snippet.thumbnails.high.url}" alt="${video.snippet.title}">
                    <div class="duration-badge">${formatDuration(videoStats.contentDetails.duration)}</div>
                    <div class="hover-info">
                        <div class="hover-content">
                            <i class="fas fa-play"></i>
                            <p>${formatNumber(videoStats.statistics.viewCount)} views</p>
                        </div>
                    </div>
                </div>
                <div class="video-info">
                    <h4>${video.snippet.title}</h4>
                    <p>${video.snippet.channelTitle}</p>
                    <p>${formatTimeAgo(video.snippet.publishedAt)}</p>
                </div>
            `;
            
            videoCard.addEventListener('click', () => openVideo(videoId));
            container.appendChild(videoCard);
        } catch (error) {
            console.error('Error displaying video:', error);
        }
    }
}

// Add this function to fetch related videos with a simpler approach
async function fetchRelatedVideos(videoId) {
    const relatedContainer = document.getElementById('related-videos');
    
    try {
        // Show loading state
        relatedContainer.innerHTML = `
            <h3>Related Videos</h3>
            <div class="loading">Loading related videos...</div>
        `;

        // First fetch related videos
        const response = await fetch(
            `https://www.googleapis.com/youtube/v3/search?key=${API_KEY}&part=snippet&type=video&maxResults=20&relatedToVideoId=${videoId}`
        );
        
        const data = await response.json();

        if (!data.items || data.items.length === 0) {
            throw new Error('No related videos found');
        }

        // Display the videos immediately
        displayRelatedVideos(data.items);

    } catch (error) {
        console.error('Error fetching related videos:', error);
        relatedContainer.innerHTML = `
            <h3>Related Videos</h3>
            <div class="error-message">
                <i class="fas fa-exclamation-circle"></i>
                <p>Couldn't load related videos</p>
            </div>
        `;
    }
}

// Simplified display function
function displayRelatedVideos(videos) {
    const container = document.getElementById('related-videos');
    container.innerHTML = '<h3>Related Videos</h3>';

    videos.forEach(video => {
        const videoCard = document.createElement('div');
        videoCard.className = 'related-video-card';
        videoCard.innerHTML = `
            <div class="related-thumbnail">
                <img src="${video.snippet.thumbnails.medium.url}" alt="">
                <div class="duration-overlay">
                    <span class="duration"></span>
                </div>
            </div>
            <div class="related-info">
                <h4 class="related-title">${video.snippet.title}</h4>
                <p class="related-channel">${video.snippet.channelTitle}</p>
                <div class="related-meta">
                    <span>${formatTimeAgo(video.snippet.publishedAt)}</span>
                </div>
            </div>
        `;

        // Add click event
        videoCard.addEventListener('click', () => {
            openVideo(video.id.videoId);
        });

        container.appendChild(videoCard);
    });
}

// Update the updateVideoDescription function to preserve all content
function updateVideoDescription(description, thumbnailUrl, videoTitle, videoId) {
    const descriptionContainer = document.getElementById('video-description');
    const shortDescription = description.slice(0, 200);
    const isLongDescription = description.length > 200;

    descriptionContainer.innerHTML = `
        <div class="description-header">
            <div class="video-tools">
                <button class="tool-btn download-btn" onclick="downloadThumbnail('${thumbnailUrl}', '${videoTitle.replace(/'/g, "\\'")}')">
                    <i class="fas fa-download"></i>
                    Thumbnail
                </button>
                <button class="tool-btn notes-btn" onclick="toggleNotesPanel('${videoId}', '${videoTitle.replace(/'/g, "\\'")}')">
                    <i class="fas fa-sticky-note"></i>
                    Notes
                </button>
                <button class="tool-btn sketch-btn" onclick="toggleSketchPanel('${videoId}', '${videoTitle.replace(/'/g, "\\'")}')">
                    <i class="fas fa-paint-brush"></i>
                    Sketch
                </button>
                <button class="tool-btn summary-btn" onclick="toggleSummaryPanel('${videoId}', '${videoTitle.replace(/'/g, "\\'")}', '${description.replace(/'/g, "\\'")}')">
                    <i class="fas fa-file-alt"></i>
                    Summary
                </button>
            </div>
        </div>

        <!-- Sketch Panel -->
        <div id="sketch-panel-${videoId}" class="sketch-panel hidden">
            <div class="sketch-header">
                <h4>Video Sketch</h4>
                <div class="sketch-tools">
                    <button class="color-btn" data-color="#ff0000"><i class="fas fa-circle" style="color: #ff0000"></i></button>
                    <button class="color-btn" data-color="#00ff00"><i class="fas fa-circle" style="color: #00ff00"></i></button>
                    <button class="color-btn" data-color="#0000ff"><i class="fas fa-circle" style="color: #0000ff"></i></button>
                    <button class="color-btn" data-color="#ffff00"><i class="fas fa-circle" style="color: #ffff00"></i></button>
                    <input type="range" id="brush-size" min="1" max="20" value="5">
                    <button class="clear-btn"><i class="fas fa-trash"></i></button>
                    <button class="capture-btn"><i class="fas fa-camera"></i></button>
                    <button class="close-sketch"><i class="fas fa-times"></i></button>
                </div>
            </div>
            <div class="sketch-content">
                <canvas id="sketch-canvas-${videoId}" class="sketch-canvas"></canvas>
            </div>
            <div class="sketch-footer">
                <button class="export-btn" onclick="exportSketch('${videoId}', '${videoTitle.replace(/'/g, "\\'")}')">
                    <i class="fas fa-file-export"></i> Export Sketch
                </button>
            </div>
        </div>

        <!-- Notes Panel -->
        <div id="notes-panel-${videoId}" class="notes-panel hidden">
            <div class="notes-header">
                <h4>Video Notes</h4>
                <div class="notes-actions">
                    <button class="timestamp-btn" onclick="addTimestamp('${videoId}')">
                        <i class="fas fa-clock"></i> Add Timestamp
                    </button>
                    <button class="save-notes-btn" onclick="saveNotes('${videoId}')">
                        <i class="fas fa-save"></i> Save
                    </button>
                </div>
            </div>
            <textarea id="notes-area-${videoId}" class="notes-textarea" 
                placeholder="Add your notes here..."
            >${localStorage.getItem(`notes_${videoId}`) || ''}</textarea>
            <div class="notes-footer">
                <button class="export-btn" onclick="exportNotes('${videoId}', '${videoTitle.replace(/'/g, "\\'")}')">
                    <i class="fas fa-file-export"></i> Export Notes
                </button>
            </div>
        </div>

        <!-- Summary Panel -->
        <div id="summary-panel-${videoId}" class="summary-panel hidden">
            <div class="summary-header">
                <h4>Video Summary</h4>
                <button class="close-summary" onclick="toggleSummaryPanel('${videoId}')">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="summary-content" id="summary-content-${videoId}">
                <div class="summary-loading hidden">
                    <i class="fas fa-spinner fa-spin"></i>
                    Generating summary...
                </div>
                <div class="summary-text"></div>
            </div>
            <div class="summary-footer">
                <button class="export-btn" onclick="exportSummary('${videoId}', '${videoTitle.replace(/'/g, "\\'")}')">
                    <i class="fas fa-file-export"></i> Export Summary
                </button>
            </div>
        </div>

        <!-- Video Description -->
        <div class="description-content">
            <div class="description-text ${isLongDescription ? 'collapsed' : ''}">
                ${description}
            </div>
            ${isLongDescription ? `
                <button class="show-more-btn">
                    <span class="more-text">Show more</span>
                    <span class="less-text">Show less</span>
                    <i class="fas fa-chevron-down"></i>
                </button>
            ` : ''}
        </div>
    `;

    // Add click event for show more button
    const showMoreBtn = descriptionContainer.querySelector('.show-more-btn');
    if (showMoreBtn) {
        showMoreBtn.addEventListener('click', () => {
            const descriptionText = descriptionContainer.querySelector('.description-text');
            descriptionText.classList.toggle('collapsed');
            showMoreBtn.classList.toggle('expanded');
        });
    }
}

// Toggle notes panel
function toggleNotesPanel(videoId, videoTitle) {
    const notesPanel = document.getElementById(`notes-panel-${videoId}`);
    const isHidden = notesPanel.classList.contains('hidden');
    
    notesPanel.classList.toggle('hidden');
    
    if (isHidden) {
        // Load saved notes when panel is opened
        const savedNotes = localStorage.getItem(`notes_${videoId}`);
        const notesArea = document.getElementById(`notes-area-${videoId}`);
        if (savedNotes) {
            notesArea.value = savedNotes;
        }
        
        // Setup timestamp click handlers
        setupTimestampClickHandlers(videoId);
        
        // Auto-save notes every 30 seconds
        const autoSaveInterval = setInterval(() => {
            if (!notesPanel.classList.contains('hidden')) {
                saveNotes(videoId);
            } else {
                clearInterval(autoSaveInterval);
            }
        }, 30000);
    }
}

// Toggle summary panel
function toggleSummaryPanel(videoId, title, description) {
    const summaryPanel = document.getElementById(`summary-panel-${videoId}`);
    const isHidden = summaryPanel.classList.contains('hidden');
    
    summaryPanel.classList.toggle('hidden');
    
    if (isHidden && title && description) {
        generateSummary(videoId, title, description);
    }
}

// Generate summary
async function generateSummary(videoId, title, description) {
    const summaryContent = document.getElementById(`summary-content-${videoId}`);
    const loadingDiv = summaryContent.querySelector('.summary-loading');
    const summaryText = summaryContent.querySelector('.summary-text');
    
    loadingDiv.classList.remove('hidden');
    summaryText.innerHTML = '';

    try {
        // Generate summary from title and description
        const summary = await createVideoSummary(title, description);
        
        // Format and display the summary
        const formattedSummary = formatSummary(summary);
        summaryText.innerHTML = formattedSummary;
        
        // Save to localStorage
        localStorage.setItem(`summary_${videoId}`, formattedSummary);
        
    } catch (error) {
        summaryText.innerHTML = `
            <div class="summary-error">
                <i class="fas fa-exclamation-circle"></i>
                <p>Couldn't generate summary. Please try again.</p>
            </div>
        `;
    } finally {
        loadingDiv.classList.add('hidden');
    }
}

// Create video summary
function createVideoSummary(title, description) {
    return new Promise((resolve) => {
        // Extract key points from description
        const lines = description.split('\n').filter(line => line.trim().length > 0);
        const keyPoints = lines.slice(0, 5); // Take first 5 non-empty lines
        
        // Create summary sections
        const summary = {
            title: `📺 ${title}`,
            overview: description.slice(0, 150) + '...',
            keyPoints: keyPoints.map(point => `• ${point.slice(0, 100)}...`),
            length: `Length: ${formatDuration(player.getDuration())}`,
        };

        // Format the summary
        const formattedSummary = [
            summary.title,
            '\n📝 Overview:',
            summary.overview,
            '\n🔑 Key Points:',
            ...summary.keyPoints,
            '\n⏱️ ' + summary.length
        ].join('\n');

        resolve(formattedSummary);
    });
}

// Format summary with HTML
function formatSummary(summaryText) {
    return summaryText
        .split('\n')
        .map(line => {
            if (line.startsWith('📺')) return `<h3>${line}</h3>`;
            if (line.startsWith('📝')) return `<h4>${line}</h4>`;
            if (line.startsWith('🔑')) return `<h4>${line}</h4>`;
            if (line.startsWith('•')) return `<p class="key-point">${line}</p>`;
            if (line.startsWith('⏱️')) return `<p class="duration">${line}</p>`;
            return `<p>${line}</p>`;
        })
        .join('');
}

// Export summary
function exportSummary(videoId, videoTitle) {
    const summary = localStorage.getItem(`summary_${videoId}`);
    if (!summary) return;

    const plainText = summary.replace(/<[^>]+>/g, '');
    const blob = new Blob([plainText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${videoTitle}_summary.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Add this function to handle thumbnail download
async function downloadThumbnail(url, title) {
    try {
        // Show loading state
        const downloadBtn = document.querySelector('.download-btn');
        const originalContent = downloadBtn.innerHTML;
        downloadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Downloading...';
        downloadBtn.disabled = true;

        // Fetch the image
        const response = await fetch(url);
        const blob = await response.blob();

        // Create download link
        const downloadLink = document.createElement('a');
        downloadLink.href = URL.createObjectURL(blob);
        downloadLink.download = `${title.substring(0, 30)}_thumbnail.jpg`;
        
        // Trigger download
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);

        // Show success state
        downloadBtn.innerHTML = '<i class="fas fa-check"></i> Downloaded!';
        setTimeout(() => {
            downloadBtn.innerHTML = originalContent;
            downloadBtn.disabled = false;
        }, 2000);

    } catch (error) {
        console.error('Error downloading thumbnail:', error);
        const downloadBtn = document.querySelector('.download-btn');
        downloadBtn.innerHTML = '<i class="fas fa-exclamation-circle"></i> Error';
        downloadBtn.disabled = false;
        setTimeout(() => {
            downloadBtn.innerHTML = originalContent;
        }, 2000);
    }
}

// Update the openVideo function to pass thumbnail URL
async function openVideo(videoId) {
    const modal = document.getElementById('video-player-modal');
    modal.style.display = 'block';

    try {
        if (player) {
            player.destroy();
        }

        // Updated player configuration
        player = new YT.Player('player', {
            height: '390',
            width: '640',
            videoId: videoId,
            playerVars: {
                'autoplay': 1,
                'modestbranding': 1, // This reduces YouTube branding
                'rel': 0,
                'showinfo': 0,
                'origin': window.location.origin
            },
            events: {
                'onReady': onPlayerReady
            }
        });

        // Fetch video details and related videos in parallel
        const [videoResponse, relatedVideosPromise] = await Promise.all([
            fetch(`https://www.googleapis.com/youtube/v3/videos?key=${API_KEY}&id=${videoId}&part=snippet,statistics`),
            fetchRelatedVideos(videoId)
        ]);

        const videoData = await videoResponse.json();
        const video = videoData.items[0];

        // Get the highest quality thumbnail
        const thumbnailUrl = video.snippet.thumbnails.maxres?.url || 
                           video.snippet.thumbnails.high?.url ||
                           video.snippet.thumbnails.medium.url;

        // Update video information
        document.getElementById('video-title').textContent = video.snippet.title;
        document.getElementById('like-count').textContent = formatNumber(video.statistics.likeCount);
        updateVideoDescription(
            video.snippet.description,
            thumbnailUrl,
            video.snippet.title,
            videoId
        );

        // Fetch channel details
        const channelResponse = await fetch(
            `https://www.googleapis.com/youtube/v3/channels?key=${API_KEY}&id=${video.snippet.channelId}&part=snippet,statistics`
        );
        const channelData = await channelResponse.json();
        const channel = channelData.items[0];

        document.getElementById('channel-icon').src = channel.snippet.thumbnails.default.url;
        document.getElementById('channel-name').textContent = channel.snippet.title;
        document.getElementById('subscriber-count').textContent = 
            `${formatNumber(channel.statistics.subscriberCount)} subscribers`;

        // Fetch comments
        fetchComments(videoId);

    } catch (error) {
        console.error('Error opening video:', error);
    }
}

// Add this function to handle player ready event
function onPlayerReady(event) {
    // Add custom branding overlay
    const playerElement = document.querySelector('#player');
    const brandingOverlay = document.createElement('div');
    brandingOverlay.className = 'streamx-branding';
    brandingOverlay.innerHTML = `
        <div class="streamx-logo">
            <span class="brand-text">StreamX</span>
        </div>
    `;
    playerElement.appendChild(brandingOverlay);
}

async function fetchComments(videoId) {
    try {
        const response = await fetch(`https://www.googleapis.com/youtube/v3/commentThreads?key=${API_KEY}&videoId=${videoId}&part=snippet&maxResults=50`);
        const data = await response.json();
        displayComments(data.items);
    } catch (error) {
        console.error('Error fetching comments:', error);
    }
}

function displayComments(comments) {
    const commentsSection = document.getElementById('comments-section');
    commentsSection.innerHTML = '<h3>Comments</h3>';

    comments.forEach(comment => {
        const commentDiv = document.createElement('div');
        commentDiv.className = 'comment';
        commentDiv.innerHTML = `
            <img src="${comment.snippet.topLevelComment.snippet.authorProfileImageUrl}" alt="">
            <div>
                <h4>${comment.snippet.topLevelComment.snippet.authorDisplayName}</h4>
                <p>${comment.snippet.topLevelComment.snippet.textDisplay}</p>
            </div>
        `;
        commentsSection.appendChild(commentDiv);
    });
}

function formatNumber(num) {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
    }
    return num;
}

function formatDuration(duration) {
    const match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
    const hours = (match[1] || '').replace('H', '');
    const minutes = (match[2] || '').replace('M', '');
    const seconds = (match[3] || '').replace('S', '');
    
    let result = '';
    if (hours) result += `${hours}:`;
    result += `${minutes.padStart(2, '0')}:`;
    result += seconds.padStart(2, '0');
    return result;
}

function formatTimeAgo(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);
    
    const intervals = {
        year: 31536000,
        month: 2592000,
        week: 604800,
        day: 86400,
        hour: 3600,
        minute: 60
    };
    
    for (const [unit, secondsInUnit] of Object.entries(intervals)) {
        const interval = Math.floor(seconds / secondsInUnit);
        if (interval >= 1) {
            return `${interval} ${unit}${interval === 1 ? '' : 's'} ago`;
        }
    }
    return 'Just now';
}

// Initialize the app
function initApp() {
    // Check if API key is set
    if (API_KEY === 'YOUR_API_KEY') {
        document.getElementById('videos-container').innerHTML = `
            <div class="error-message">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Please set your YouTube API key in the script.js file</p>
            </div>
        `;
        return;
    }

    // Start fetching videos
    fetchVideos();
}

// Call initApp when document is ready
document.addEventListener('DOMContentLoaded', initApp);

// Add scroll event listener for infinite scroll
window.addEventListener('scroll', () => {
    const { scrollTop, scrollHeight, clientHeight } = document.documentElement;
    
    if (scrollTop + clientHeight >= scrollHeight - 500 && !isLoading && hasMoreVideos) {
        const searchInput = document.getElementById('search-input');
        fetchVideos(searchInput.value, true);
    }
});

// Update search event listeners
document.getElementById('search-btn').addEventListener('click', () => {
    const query = document.getElementById('search-input').value;
    nextPageToken = '';
    hasMoreVideos = true;
    fetchVideos(query);
});

document.getElementById('search-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        const query = e.target.value;
        nextPageToken = '';
        hasMoreVideos = true;
        fetchVideos(query);
    }
});

// Close modal when clicking outside
window.addEventListener('click', (e) => {
    const modal = document.getElementById('video-player-modal');
    if (e.target === modal) {
        modal.style.display = 'none';
        if (player) {
            player.destroy();
            player = null;
        }
    }
});

// Add these event listeners
document.addEventListener('DOMContentLoaded', initTheme);
document.getElementById('theme-toggle').addEventListener('click', toggleTheme);

// Add timestamp to notes
function addTimestamp(videoId) {
    const notesArea = document.getElementById(`notes-area-${videoId}`);
    const currentTime = player.getCurrentTime();
    const formattedTime = formatVideoTime(currentTime);
    
    // Get cursor position
    const cursorPos = notesArea.selectionStart;
    const textBefore = notesArea.value.substring(0, cursorPos);
    const textAfter = notesArea.value.substring(cursorPos);
    
    // Insert timestamp at cursor position
    const timestampText = `[${formattedTime}] `;
    notesArea.value = textBefore + timestampText + textAfter;
    
    // Move cursor after timestamp
    const newCursorPos = cursorPos + timestampText.length;
    notesArea.setSelectionRange(newCursorPos, newCursorPos);
    notesArea.focus();
    
    // Save notes automatically
    saveNotes(videoId);
}

// Format video time for timestamps
function formatVideoTime(seconds) {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hrs > 0) {
        return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Save notes to localStorage
function saveNotes(videoId) {
    const notesArea = document.getElementById(`notes-area-${videoId}`);
    const notes = notesArea.value;
    localStorage.setItem(`notes_${videoId}`, notes);
    
    // Show save confirmation
    const saveBtn = document.querySelector('.save-notes-btn');
    const originalText = saveBtn.innerHTML;
    saveBtn.innerHTML = '<i class="fas fa-check"></i> Saved!';
    setTimeout(() => {
        saveBtn.innerHTML = originalText;
    }, 2000);
}

// Export notes to a text file
function exportNotes(videoId, videoTitle) {
    const notes = localStorage.getItem(`notes_${videoId}`);
    if (!notes) {
        alert('No notes to export!');
        return;
    }

    // Format notes with video information
    const timestamp = new Date().toLocaleString();
    const formattedNotes = `Notes for: ${videoTitle}\nVideo ID: ${videoId}\nExported on: ${timestamp}\n\n${notes}`;
    
    // Create and trigger download
    const blob = new Blob([formattedNotes], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${videoTitle}_notes.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Add click handlers for timestamps in notes
function setupTimestampClickHandlers(videoId) {
    const notesArea = document.getElementById(`notes-area-${videoId}`);
    
    notesArea.addEventListener('click', (e) => {
        const text = notesArea.value;
        const cursorPos = notesArea.selectionStart;
        
        // Find timestamp at cursor position
        const timestampMatch = text.substring(0, cursorPos).match(/\[(\d+:)?(\d+:\d+)\]/g);
        if (timestampMatch) {
            const lastTimestamp = timestampMatch[timestampMatch.length - 1];
            const timeComponents = lastTimestamp.slice(1, -1).split(':');
            let seconds = 0;
            
            if (timeComponents.length === 3) {
                seconds = parseInt(timeComponents[0]) * 3600 + 
                         parseInt(timeComponents[1]) * 60 + 
                         parseInt(timeComponents[2]);
            } else {
                seconds = parseInt(timeComponents[0]) * 60 + 
                         parseInt(timeComponents[1]);
            }
            
            // Seek to timestamp in video
            player.seekTo(seconds, true);
        }
    });
}

// Sketch Feature
function toggleSketchPanel(videoId, videoTitle) {
    const sketchPanel = document.getElementById(`sketch-panel-${videoId}`);
    const isHidden = sketchPanel.classList.contains('hidden');
    
    sketchPanel.classList.toggle('hidden');
    
    if (isHidden) {
        setupSketch(videoId);
    }
}

function setupSketch(videoId) {
    const canvas = document.getElementById(`sketch-canvas-${videoId}`);
    const context = canvas.getContext('2d');
    currentCanvas = canvas;
    currentContext = context;

    // Set canvas size
    const videoElement = document.getElementById('player');
    canvas.width = videoElement.offsetWidth;
    canvas.height = videoElement.offsetHeight;

    // Setup event listeners
    setupSketchEventListeners(canvas, context);
    setupSketchTools(videoId);

    // Capture current frame
    captureVideoFrame();
}

function setupSketchEventListeners(canvas, context) {
    // Mouse events
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseout', stopDrawing);

    // Touch events
    canvas.addEventListener('touchstart', handleTouchStart);
    canvas.addEventListener('touchmove', handleTouchMove);
    canvas.addEventListener('touchend', stopDrawing);
}

function setupSketchTools(videoId) {
    const sketchPanel = document.getElementById(`sketch-panel-${videoId}`);
    
    // Color buttons
    const colorBtns = sketchPanel.querySelectorAll('.color-btn');
    colorBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            currentColor = btn.dataset.color;
            colorBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });

    // Brush size
    const brushSize = sketchPanel.querySelector('#brush-size');
    brushSize.addEventListener('input', (e) => {
        currentSize = e.target.value;
    });

    // Clear button
    const clearBtn = sketchPanel.querySelector('.clear-btn');
    clearBtn.addEventListener('click', () => {
        clearCanvas();
        captureVideoFrame();
    });

    // Capture button
    const captureBtn = sketchPanel.querySelector('.capture-btn');
    captureBtn.addEventListener('click', captureVideoFrame);

    // Close button
    const closeBtn = sketchPanel.querySelector('.close-sketch');
    closeBtn.addEventListener('click', () => {
        sketchPanel.classList.add('hidden');
    });
}

function startDrawing(e) {
    isDrawing = true;
    draw(e);
}

function draw(e) {
    if (!isDrawing) return;

    const rect = currentCanvas.getBoundingClientRect();
    const x = (e.clientX || e.touches[0].clientX) - rect.left;
    const y = (e.clientY || e.touches[0].clientY) - rect.top;

    currentContext.lineWidth = currentSize;
    currentContext.lineCap = 'round';
    currentContext.strokeStyle = currentColor;

    currentContext.lineTo(x, y);
    currentContext.stroke();
    currentContext.beginPath();
    currentContext.moveTo(x, y);
}

function stopDrawing() {
    isDrawing = false;
    currentContext.beginPath();
}

function handleTouchStart(e) {
    e.preventDefault();
    startDrawing(e.touches[0]);
}

function handleTouchMove(e) {
    e.preventDefault();
    draw(e.touches[0]);
}

function clearCanvas() {
    currentContext.clearRect(0, 0, currentCanvas.width, currentCanvas.height);
}

function captureVideoFrame() {
    if (!player) return;

    // Create temporary canvas to capture video frame
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = currentCanvas.width;
    tempCanvas.height = currentCanvas.height;
    const tempContext = tempCanvas.getContext('2d');

    // Get video element and draw it to temp canvas
    const videoElement = document.getElementById('player');
    tempContext.drawImage(videoElement, 0, 0, tempCanvas.width, tempCanvas.height);

    // Draw temp canvas to main canvas
    clearCanvas();
    currentContext.drawImage(tempCanvas, 0, 0);
}

function exportSketch(videoId, videoTitle) {
    const canvas = document.getElementById(`sketch-canvas-${videoId}`);
    const timestamp = formatVideoTime(player.getCurrentTime());
    
    // Create download link
    const link = document.createElement('a');
    link.download = `${videoTitle}_sketch_${timestamp}.png`;
    link.href = canvas.toDataURL('image/png');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Helper function to get category-specific API parameters
function getCategoryParams(category) {
    // Base parameters for quality and safe content
    const baseParams = 'type=video&videoDuration=medium&safeSearch=moderate';
    
    switch (category) {
        case 'gaming':
            return `${baseParams}&q=(gaming OR gameplay OR "live gaming" OR "game stream")&videoCategoryId=20&relevanceLanguage=en&order=relevance&regionCode=US&maxResults=50&eventType=completed`;
            
        case 'trending':
            return 'chart=mostPopular&regionCode=US&maxResults=20';
            
        case 'sports':
            return `${baseParams}&q=sports|highlights|match|tournament|league|NBA|NFL|football|cricket&videoCategoryId=17&relevanceLanguage=en&order=date`;
            
        case 'music':
            return `${baseParams}&q=official music video|song|music|album|concert&videoCategoryId=10&relevanceLanguage=en&order=rating`;
            
        case 'education':
            return `${baseParams}&q=educational|tutorial|course|learning|study|lecture&videoCategoryId=27&relevanceLanguage=en&order=rating`;
            
        case 'technology':
            return `${baseParams}&q=tech review|technology news|gadgets|smartphones|computers&videoCategoryId=28&relevanceLanguage=en&order=date`;
            
        case 'science':
            return `${baseParams}&q=science|physics|chemistry|biology|space|astronomy|experiment&videoCategoryId=28&relevanceLanguage=en&order=rating`;
            
        case 'productivity':
            return `${baseParams}&q=productivity tips|time management|work efficiency|organization|self improvement&relevanceLanguage=en&order=rating`;
            
        case 'cooking':
            return `${baseParams}&q=cooking recipe|food tutorial|chef|cooking guide|baking|kitchen&videoCategoryId=26&relevanceLanguage=en&order=rating`;
            
        case 'fitness':
            return `${baseParams}&q=workout|fitness training|exercise tutorial|gym|bodybuilding|yoga&videoCategoryId=17&relevanceLanguage=en&order=rating`;
            
        default:
            return 'chart=mostPopular&regionCode=US&maxResults=20';
    }
}

// Helper function to check if a video is restricted or unavailable
function isVideoRestricted(video) {
    if (!video || !video.snippet) return true;
    
    // Check for age restrictions or content warnings
    const restrictedKeywords = ['age-restricted', 'content warning', 'nsfw', 'adult'];
    const title = video.snippet.title.toLowerCase();
    const description = video.snippet.description.toLowerCase();
    
    return restrictedKeywords.some(keyword => 
        title.includes(keyword) || description.includes(keyword)
    );
}

// Add category click handlers
document.querySelectorAll('.category-item').forEach(item => {
    item.addEventListener('click', () => {
        // Update active state
        document.querySelectorAll('.category-item').forEach(btn => btn.classList.remove('active'));
        item.classList.add('active');

        // Update category and fetch videos
        currentCategory = item.dataset.category;
        nextPageToken = '';
        hasMoreVideos = true;

        // Show loading state
        const container = document.getElementById('videos-container');
        container.innerHTML = `
            <div class="loading-message">
                <i class="fas fa-spinner fa-spin"></i>
                <p>Loading ${currentCategory} videos...</p>
            </div>
        `;

        fetchVideos();
    });
});

// Add function to check for quality content
function isQualityContent(video) {
    if (!video || !video.snippet) return false;

    // Check if video is available and has required data
    if (video.id && typeof video.id === 'object') {
        video.id = video.id.videoId;
    }

    // Filter out low-quality or spam content
    const spamKeywords = ['spam', 'click here', 'win prize', 'get rich', 'scam'];
    const title = video.snippet.title.toLowerCase();
    const description = video.snippet.description.toLowerCase();

    // Check for spam keywords
    if (spamKeywords.some(keyword => title.includes(keyword) || description.includes(keyword))) {
        return false;
    }

    // Check title length and format
    if (title.length < 5 || title === title.toUpperCase()) {
        return false;
    }

    // Check if thumbnail is available
    if (!video.snippet.thumbnails || !video.snippet.thumbnails.high) {
        return false;
    }

    return true;
}

// Add new function to check if content is gaming-related
function isGamingContent(video) {
    if (!video || !video.snippet) return false;

    const title = video.snippet.title.toLowerCase();
    const description = video.snippet.description.toLowerCase();
    const gamingKeywords = [
        'gameplay', 'gaming', 'playthrough', 'walkthrough',
        'game', 'live stream', 'stream', 'playing',
        'clash of clans', 'valorant', 'pubg', 'call of duty',
        'cod', 'minecraft', 'fortnite', 'gta', 'game stream',
        'gaming live', 'gamer', 'gaming channel'
    ];

    // Check if title or description contains gaming keywords
    return gamingKeywords.some(keyword => 
        title.includes(keyword) || description.includes(keyword)
    );
}

// Add new function to display channels
async function displayChannels(channels) {
    const container = document.getElementById('videos-container');
    
    const channelsSection = document.createElement('div');
    channelsSection.className = 'channels-section';
    channelsSection.innerHTML = '<h3>Channels</h3>';
    
    const channelsGrid = document.createElement('div');
    channelsGrid.className = 'channels-grid';

    for (const channel of channels) {
        try {
            // Get detailed channel information
            const response = await fetch(
                `https://www.googleapis.com/youtube/v3/channels?key=${API_KEY}&id=${channel.snippet.channelId}&part=snippet,statistics`
            );
            const data = await response.json();
            const channelDetails = data.items[0];

            // Get the best quality channel thumbnail
            const thumbnailUrl = channelDetails.snippet.thumbnails.high?.url || 
                               channelDetails.snippet.thumbnails.medium?.url ||
                               channelDetails.snippet.thumbnails.default?.url;

            const channelCard = document.createElement('div');
            channelCard.className = 'channel-card';
            channelCard.innerHTML = `
                <div class="channel-thumbnail">
                    <img src="${thumbnailUrl}" alt="${channelDetails.snippet.title}" onerror="this.src='https://via.placeholder.com/80'">
                </div>
                <div class="channel-info">
                    <h4>${channelDetails.snippet.title}</h4>
                    <p>${formatNumber(channelDetails.statistics.subscriberCount)} subscribers</p>
                    <p>${channelDetails.statistics.videoCount} videos</p>
                </div>
                <button class="subscribe-btn">Subscribe</button>
            `;
            
            // Add click event to visit channel
            channelCard.addEventListener('click', (e) => {
                if (!e.target.classList.contains('subscribe-btn')) {
                    window.open(`https://www.youtube.com/channel/${channel.snippet.channelId}`, '_blank');
                }
            });

            channelsGrid.appendChild(channelCard);
        } catch (error) {
            console.error('Error displaying channel:', error);
        }
    }

    channelsSection.appendChild(channelsGrid);
    container.insertBefore(channelsSection, container.firstChild);
}

// Add these styles dynamically
const style = document.createElement('style');
style.textContent = `
    .channels-section {
        margin-bottom: 24px;
        padding: 16px;
        background: var(--bg-primary);
        border-radius: 12px;
        box-shadow: 0 2px 8px var(--shadow-color);
    }

    .channels-section h3 {
        margin-bottom: 16px;
        color: var(--text-primary);
        font-size: 18px;
    }

    .channels-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
        gap: 16px;
    }

    .channel-card {
        background: var(--bg-secondary);
        border-radius: 12px;
        overflow: hidden;
        transition: transform 0.3s ease;
        cursor: pointer;
        padding: 16px;
        text-align: center;
    }

    .channel-card:hover {
        transform: translateY(-4px);
    }

    .channel-thumbnail {
        width: 80px;
        height: 80px;
        margin: 0 auto 12px;
    }

    .channel-thumbnail img {
        width: 100%;
        height: 100%;
        border-radius: 50%;
        object-fit: cover;
    }

    .channel-info h4 {
        font-size: 16px;
        margin-bottom: 8px;
        color: var(--text-primary);
    }

    .channel-info p {
        font-size: 13px;
        color: var(--text-secondary);
        margin-bottom: 4px;
    }

    .subscribe-btn {
        margin-top: 12px;
        padding: 8px 16px;
        border: none;
        border-radius: 20px;
        background: var(--brand-gradient);
        color: white;
        font-size: 14px;
        cursor: pointer;
        transition: opacity 0.2s;
    }

    .subscribe-btn:hover {
        opacity: 0.9;
    }

    @media (max-width: 768px) {
        .channels-section {
            padding: 12px;
            margin-bottom: 16px;
        }

        .channels-grid {
            grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
            gap: 12px;
        }

        .channel-thumbnail {
            width: 60px;
            height: 60px;
        }

        .channel-info h4 {
            font-size: 14px;
        }

        .channel-info p {
            font-size: 12px;
        }

        .subscribe-btn {
            padding: 6px 12px;
            font-size: 12px;
        }
    }

    @media (max-width: 480px) {
        .channels-grid {
            grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
            gap: 8px;
        }

        .channel-card {
            padding: 12px;
        }

        .channel-thumbnail {
            width: 50px;
            height: 50px;
            margin-bottom: 8px;
        }
    }
`;

document.head.appendChild(style);

// Add back button click handler
document.getElementById('modal-back-btn').addEventListener('click', () => {
    const modal = document.getElementById('video-player-modal');
    modal.style.display = 'none';
    if (player) {
        player.destroy();
        player = null;
    }
});
