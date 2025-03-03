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

// Fetch videos function with trending videos as default
async function fetchVideos(query = '', loadMore = false) {
    if (isLoading || (!loadMore && !hasMoreVideos)) return;
    
    isLoading = true;
    document.getElementById('loader').style.display = 'block';

    try {
        const pageToken = loadMore ? `&pageToken=${nextPageToken}` : '';
        let apiUrl;

        if (query) {
            // Search query videos
            apiUrl = `https://www.googleapis.com/youtube/v3/search?key=${API_KEY}&part=snippet&type=video&maxResults=20&q=${encodeURIComponent(query)}${pageToken}`;
        } else {
            // Trending videos (when no search query)
            apiUrl = `https://www.googleapis.com/youtube/v3/videos?key=${API_KEY}&part=snippet,statistics,contentDetails&chart=mostPopular&maxResults=20&regionCode=US${pageToken}`;
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

        // Handle different response structures for search vs trending
        const videos = query ? data.items.map(item => ({
            id: item.id.videoId,
            snippet: item.snippet
        })) : data.items;

        await displayVideos(videos, loadMore);

    } catch (error) {
        console.error('Error fetching videos:', error);
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

// Update the updateVideoDescription function
function updateVideoDescription(description, thumbnailUrl, videoTitle) {
    const descriptionContainer = document.getElementById('video-description');
    const shortDescription = description.slice(0, 200);
    const isLongDescription = description.length > 200;

    descriptionContainer.innerHTML = `
        <div class="description-header">
            <div class="thumbnail-download">
                <button class="download-btn" onclick="downloadThumbnail('${thumbnailUrl}', '${videoTitle.replace(/'/g, "\\'")}')">
                    <i class="fas fa-download"></i>
                    Download Thumbnail
                </button>
            </div>
        </div>
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
            video.snippet.title
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
        player.destroy();
    }
});

// Add these event listeners
document.addEventListener('DOMContentLoaded', initTheme);
document.getElementById('theme-toggle').addEventListener('click', toggleTheme);
