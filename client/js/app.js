// API Configuration
const API_URL = 'http://localhost:3000/api';
let currentUser = null;
let ws = null;
let posts = [];
let users = [];

// DOM Elements
const app = document.getElementById('app');
const authModal = document.getElementById('authModal');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const tabBtns = document.querySelectorAll('.tab-btn');
const postsContainer = document.getElementById('postsContainer');
const friendRequestsList = document.getElementById('friendRequestsList');
const suggestionsList = document.getElementById('suggestionsList');
const friendsList = document.getElementById('friendsList');
const searchUsers = document.getElementById('searchUsers');
const profilePic = document.getElementById('profilePic');
const navProfilePic = document.getElementById('navProfilePic');
const userName = document.getElementById('userName');
const userBio = document.getElementById('userBio');
const postProfilePic = document.getElementById('postProfilePic');
const friendsCount = document.getElementById('friendsCount');
const coverPhoto = document.getElementById('coverPhoto');
const notificationBadge = document.getElementById('notificationBadge');
const notificationList = document.getElementById('notificationList');
const logoutBtn = document.getElementById('logoutBtn');
const viewProfileBtn = document.getElementById('viewProfileBtn');
const settingsBtn = document.getElementById('settingsBtn');
const submitPostBtn = document.getElementById('submitPostBtn');
const postContent = document.getElementById('postContent');
const addMediaBtn = document.getElementById('addMediaBtn');
const mediaInput = document.getElementById('mediaInput');
const saveSettingsBtn = document.getElementById('saveSettingsBtn');
const privacySetting = document.getElementById('privacySetting');

// Auth Tab Switching
tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        const tab = btn.dataset.tab;
        document.querySelectorAll('.auth-form').forEach(form => {
            form.classList.remove('active');
        });
        document.getElementById(`${tab}Form`).classList.add('active');
    });
});

// Login
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = loginForm.querySelector('input[type="email"]').value;
    const password = loginForm.querySelector('input[type="password"]').value;
    
    const response = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    });
    
    const data = await response.json();
    if (data.success) {
        currentUser = data.user;
        localStorage.setItem('user', JSON.stringify(currentUser));
        initApp();
    } else {
        alert('Invalid credentials');
    }
});

// Register
registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fullName = registerForm.querySelector('input[placeholder="Full Name"]').value;
    const username = registerForm.querySelector('input[placeholder="Username"]').value;
    const email = registerForm.querySelector('input[placeholder="Email"]').value;
    const password = registerForm.querySelector('input[placeholder="Password"]').value;
    
    const response = await fetch(`${API_URL}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, username, email, password })
    });
    
    const data = await response.json();
    if (data.success) {
        currentUser = data.user;
        localStorage.setItem('user', JSON.stringify(currentUser));
        initApp();
    } else {
        alert(data.message);
    }
});

// Initialize App
async function initApp() {
    authModal.style.display = 'none';
    app.style.display = 'block';
    
    // Update UI with user info
    profilePic.src = currentUser.profilePic;
    navProfilePic.src = currentUser.profilePic;
    postProfilePic.src = currentUser.profilePic;
    userName.textContent = currentUser.fullName;
    userBio.textContent = currentUser.bio || 'No bio yet';
    coverPhoto.style.background = `url(${currentUser.coverPic}) center/cover`;
    privacySetting.value = currentUser.privacy;
    
    // Load data
    await loadUsers();
    await loadPosts();
    await loadFriendRequests();
    await loadNotifications();
    updateFriendsList();
    
    // Connect WebSocket
    connectWebSocket();
    
    // Start polling for updates
    setInterval(loadNotifications, 5000);
}

// Connect WebSocket
function connectWebSocket() {
    ws = new WebSocket('ws://localhost:3000');
    
    ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'auth', userId: currentUser.id }));
    };
    
    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        if (data.type === 'newPost') {
            addPostToFeed(data.data);
        } else if (data.type === 'postUpdate') {
            updatePostInFeed(data.data);
        } else if (data.type === 'notification') {
            addNotification(data.data);
        } else if (data.type === 'userUpdate') {
            if (data.data.id === currentUser.id) {
                currentUser = data.data;
                updateFriendsList();
                loadFriendRequests();
            }
        } else if (data.type === 'typing') {
            showTypingIndicator(data.data);
        }
    };
}

// Load Users
async function loadUsers() {
    const response = await fetch(`${API_URL}/users`);
    users = await response.json();
    updateSuggestions();
}

// Load Posts
async function loadPosts() {
    const response = await fetch(`${API_URL}/posts`);
    posts = await response.json();
    renderPosts();
}

// Render Posts
function renderPosts() {
    postsContainer.innerHTML = '';
    posts.forEach(post => {
        if (canViewPost(post)) {
            postsContainer.appendChild(createPostElement(post));
        }
    });
}

// Create Post Element
function createPostElement(post) {
    const postDiv = document.createElement('div');
    postDiv.className = 'post';
    postDiv.dataset.id = post.id;
    
    const isLiked = post.likes.includes(currentUser.id);
    
    postDiv.innerHTML = `
        <div class="post-header">
            <img src="${post.user.profilePic}" alt="${post.user.fullName}">
            <div class="post-info">
                <h4>${post.user.fullName}</h4>
                <p>${new Date(post.createdAt).toLocaleString()}</p>
            </div>
        </div>
        <div class="post-content">${escapeHtml(post.content)}</div>
        ${post.media ? `<img src="${post.media}" class="post-media" alt="Post media">` : ''}
        <div class="post-stats">
            <button class="like-btn ${isLiked ? 'liked' : ''}" onclick="toggleLike(${post.id})">
                <i class="fas fa-heart"></i> ${post.likes.length}
            </button>
            <button onclick="toggleComments(${post.id})">
                <i class="fas fa-comment"></i> ${post.comments.length}
            </button>
        </div>
        <div class="comments-section" id="comments-${post.id}" style="display: none;">
            ${renderComments(post.comments)}
            <div class="add-comment">
                <input type="text" id="comment-input-${post.id}" placeholder="Write a comment...">
                <button onclick="addComment(${post.id})">Post</button>
            </div>
        </div>
    `;
    
    return postDiv;
}

// Render Comments
function renderComments(comments) {
    if (comments.length === 0) return '<p style="color:#999; text-align:center;">No comments yet</p>';
    
    return comments.map(comment => {
        const user = users.find(u => u.id === comment.userId);
        return `
            <div class="comment">
                <img src="${user?.profilePic}" alt="">
                <div class="comment-content">
                    <strong>${user?.fullName}</strong>
                    <p>${escapeHtml(comment.content)}</p>
                </div>
            </div>
        `;
    }).join('');
}

// Toggle Like
window.toggleLike = async (postId) => {
    const response = await fetch(`${API_URL}/posts/${postId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'like', userId: currentUser.id })
    });
    
    const data = await response.json();
    updatePostInFeed(data.post);
};

// Add Comment
window.addComment = async (postId) => {
    const input = document.getElementById(`comment-input-${postId}`);
    const content = input.value.trim();
    
    if (!content) return;
    
    const response = await fetch(`${API_URL}/posts/${postId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id, content })
    });
    
    const data = await response.json();
    if (data.success) {
        input.value = '';
        await loadPosts();
        
        // Send typing stop
        ws.send(JSON.stringify({
            type: 'typing',
            userId: currentUser.id,
            userName: currentUser.fullName,
            isTyping: false
        }));
    }
};

// Toggle Comments
window.toggleComments = (postId) => {
    const commentsSection = document.getElementById(`comments-${postId}`);
    commentsSection.style.display = commentsSection.style.display === 'none' ? 'block' : 'none';
};

// Update Post in Feed
function updatePostInFeed(updatedPost) {
    const index = posts.findIndex(p => p.id === updatedPost.id);
    if (index !== -1) {
        posts[index] = updatedPost;
        renderPosts();
    }
}

// Add Post to Feed
function addPostToFeed(newPost) {
    posts.unshift(newPost);
    renderPosts();
}

// Submit Post
submitPostBtn.addEventListener('click', async () => {
    const content = postContent.value.trim();
    if (!content) return;
    
    const response = await fetch(`${API_URL}/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            userId: currentUser.id,
            content: content,
            media: null
        })
    });
    
    const data = await response.json();
    if (data.success) {
        postContent.value = '';
        addPostToFeed(data.post);
    }
});

// Add Media
addMediaBtn.addEventListener('click', () => {
    mediaInput.click();
});

mediaInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            // In a real app, upload to server
            console.log('Media selected:', event.target.result);
        };
        reader.readAsDataURL(file);
    }
});

// Load Friend Requests
async function loadFriendRequests() {
    const user = users.find(u => u.id === currentUser.id);
    if (!user) return;
    
    const requests = user.friendRequests || [];
    friendRequestsList.innerHTML = '';
    
    if (requests.length === 0) {
        friendRequestsList.innerHTML = '<p style="color:#999;">No friend requests</p>';
        return;
    }
    
    requests.forEach(requesterId => {
        const requester = users.find(u => u.id === requesterId);
        if (requester) {
            const requestDiv = document.createElement('div');
            requestDiv.className = 'request-item';
            requestDiv.innerHTML = `
                <img src="${requester.profilePic}" alt="">
                <div class="friend-info">
                    <h4>${requester.fullName}</h4>
                    <p>@${requester.username}</p>
                </div>
                <div class="request-actions">
                    <button class="accept-btn" onclick="acceptFriendRequest(${requester.id})">Accept</button>
                    <button class="reject-btn" onclick="rejectFriendRequest(${requester.id})">Reject</button>
                </div>
            `;
            friendRequestsList.appendChild(requestDiv);
        }
    });
}

// Accept Friend Request
window.acceptFriendRequest = async (requesterId) => {
    const response = await fetch(`${API_URL}/friend-request`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            userId: currentUser.id,
            requesterId: requesterId,
            action: 'accept'
        })
    });
    
    const data = await response.json();
    if (data.success) {
        await loadUsers();
        await loadFriendRequests();
        updateFriendsList();
        updateSuggestions();
    }
};

// Reject Friend Request
window.rejectFriendRequest = async (requesterId) => {
    const response = await fetch(`${API_URL}/friend-request`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            userId: currentUser.id,
            requesterId: requesterId,
            action: 'reject'
        })
    });
    
    const data = await response.json();
    if (data.success) {
        await loadUsers();
        await loadFriendRequests();
    }
};

// Update Friends List
function updateFriendsList() {
    const user = users.find(u => u.id === currentUser.id);
    if (!user) return;
    
    const friends = user.friends || [];
    friendsCount.textContent = friends.length;
    
    friendsList.innerHTML = '';
    
    if (friends.length === 0) {
        friendsList.innerHTML = '<p style="color:#999;">No friends yet</p>';
        return;
    }
    
    friends.forEach(friendId => {
        const friend = users.find(u => u.id === friendId);
        if (friend) {
            const friendDiv = document.createElement('div');
            friendDiv.className = 'friend-item';
            friendDiv.innerHTML = `
                <img src="${friend.profilePic}" alt="">
                <div class="friend-info">
                    <h4>${friend.fullName}</h4>
                    <p>@${friend.username}</p>
                </div>
            `;
            friendsList.appendChild(friendDiv);
        }
    });
}

// Update Suggestions
function updateSuggestions() {
    const user = users.find(u => u.id === currentUser.id);
    if (!user) return;
    
    const friends = user.friends || [];
    const suggestions = users.filter(u => 
        u.id !== currentUser.id && 
        !friends.includes(u.id) &&
        !user.friendRequests?.includes(u.id)
    ).slice(0, 5);
    
    suggestionsList.innerHTML = '';
    
    if (suggestions.length === 0) {
        suggestionsList.innerHTML = '<p style="color:#999;">No suggestions</p>';
        return;
    }
    
    suggestions.forEach(suggestion => {
        const suggestionDiv = document.createElement('div');
        suggestionDiv.className = 'suggestion-item';
        suggestionDiv.innerHTML = `
            <img src="${suggestion.profilePic}" alt="">
            <div class="suggestion-info">
                <h4>${suggestion.fullName}</h4>
                <p>@${suggestion.username}</p>
            </div>
            <button class="add-friend-btn" onclick="sendFriendRequest(${suggestion.id})">Add</button>
        `;
        suggestionsList.appendChild(suggestionDiv);
    });
}

// Send Friend Request
window.sendFriendRequest = async (toUserId) => {
    const response = await fetch(`${API_URL}/friend-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            fromUserId: currentUser.id,
            toUserId: toUserId
        })
    });
    
    const data = await response.json();
    if (data.success) {
        alert('Friend request sent!');
        updateSuggestions();
    }
};

// Search Users
searchUsers.addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    const filtered = users.filter(u => 
        u.id !== currentUser.id &&
        (u.fullName.toLowerCase().includes(searchTerm) ||
         u.username.toLowerCase().includes(searchTerm))
    );
    
    suggestionsList.innerHTML = '';
    filtered.slice(0, 5).forEach(user => {
        const suggestionDiv = document.createElement('div');
        suggestionDiv.className = 'suggestion-item';
        suggestionDiv.innerHTML = `
            <img src="${user.profilePic}" alt="">
            <div class="suggestion-info">
                <h4>${user.fullName}</h4>
                <p>@${user.username}</p>
            </div>
            <button class="add-friend-btn" onclick="sendFriendRequest(${user.id})">Add</button>
        `;
        suggestionsList.appendChild(suggestionDiv);
    });
});

// Load Notifications
async function loadNotifications() {
    const response = await fetch(`${API_URL}/notifications?userId=${currentUser.id}`);
    const notifications = await response.json();
    
    const unreadCount = notifications.filter(n => !n.read).length;
    notificationBadge.textContent = unreadCount;
    
    notificationList.innerHTML = '';
    
    if (notifications.length === 0) {
        notificationList.innerHTML = '<p style="padding:1rem; color:#999;">No notifications</p>';
        return;
    }
    
    notifications.slice(0, 10).forEach(notif => {
        const notifDiv = document.createElement('div');
        notifDiv.style.padding = '0.8rem';
        notifDiv.style.borderBottom = '1px solid #eee';
        
        let message = '';
        if (notif.type === 'like') message = `liked your post`;
        else if (notif.type === 'comment') message = `commented on your post`;
        else if (notif.type === 'friend_request') message = `sent you a friend request`;
        else if (notif.type === 'friend_accept') message = `accepted your friend request`;
        
        notifDiv.innerHTML = `
            <strong>${notif.fromUserName}</strong>
            <p style="font-size:0.8rem;">${message}</p>
            <small style="color:#999;">${new Date(notif.createdAt).toLocaleString()}</small>
        `;
        notificationList.appendChild(notifDiv);
    });
}

// Add Notification
function addNotification(notification) {
    if (notification.userId === currentUser.id) {
        loadNotifications();
    }
}

// Show Typing Indicator
function showTypingIndicator(data) {
    // Implementation for typing indicator
    console.log(`${data.userName} is typing...`);
}

// View Profile
viewProfileBtn.addEventListener('click', () => {
    const modal = document.getElementById('profileModal');
    const profileView = document.getElementById('profileView');
    
    profileView.innerHTML = `
        <div style="text-align: center;">
            <img src="${currentUser.profilePic}" style="width:150px; height:150px; border-radius:50%; margin-bottom:1rem;">
            <h2>${currentUser.fullName}</h2>
            <p>@${currentUser.username}</p>
            <p>${currentUser.bio || 'No bio yet'}</p>
            <p>Joined: ${new Date(currentUser.createdAt).toLocaleDateString()}</p>
            <p>Friends: ${currentUser.friends?.length || 0}</p>
        </div>
    `;
    
    modal.style.display = 'flex';
    
    modal.querySelector('.close').onclick = () => {
        modal.style.display = 'none';
    };
});

// Settings
settingsBtn.addEventListener('click', () => {
    const modal = document.getElementById('settingsModal');
    modal.style.display = 'flex';
    
    modal.querySelector('.close').onclick = () => {
        modal.style.display = 'none';
    };
});

saveSettingsBtn.addEventListener('click', async () => {
    currentUser.privacy = privacySetting.value;
    localStorage.setItem('user', JSON.stringify(currentUser));
    alert('Settings saved!');
    document.getElementById('settingsModal').style.display = 'none';
});

// Logout
logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('user');
    if (ws) ws.close();
    currentUser = null;
    authModal.style.display = 'flex';
    app.style.display = 'none';
});

// Check if user can view post
function canViewPost(post) {
    if (post.user.id === currentUser.id) return true;
    
    const user = users.find(u => u.id === post.userId);
    if (!user) return true;
    
    if (user.privacy === 'public') return true;
    if (user.privacy === 'friends') {
        return currentUser.friends?.includes(user.id);
    }
    return false;
}

// Helper function
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Check for saved user
const savedUser = localStorage.getItem('user');
if (savedUser) {
    currentUser = JSON.parse(savedUser);
    initApp();
} else {
    authModal.style.display = 'flex';
}