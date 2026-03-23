const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

// Data storage
let users = [];
let posts = [];
let notifications = [];

// Load data from files
try {
    const usersData = fs.readFileSync('./users.json', 'utf8');
    users = JSON.parse(usersData);
} catch (err) {
    users = [];
}

// Sample data for demo
if (users.length === 0) {
    users = [
        {
            id: 1,
            username: 'john_doe',
            email: 'john@example.com',
            password: 'password123',
            fullName: 'John Doe',
            bio: 'Software developer and tech enthusiast',
            profilePic: 'https://randomuser.me/api/portraits/men/1.jpg',
            coverPic: 'https://picsum.photos/800/200?random=1',
            friends: [2, 3],
            friendRequests: [],
            privacy: 'public', // public, friends, private
            createdAt: new Date().toISOString()
        },
        {
            id: 2,
            username: 'jane_smith',
            email: 'jane@example.com',
            password: 'password123',
            fullName: 'Jane Smith',
            bio: 'Travel blogger and photographer',
            profilePic: 'https://randomuser.me/api/portraits/women/2.jpg',
            coverPic: 'https://picsum.photos/800/200?random=2',
            friends: [1],
            friendRequests: [],
            privacy: 'public',
            createdAt: new Date().toISOString()
        },
        {
            id: 3,
            username: 'mike_wilson',
            email: 'mike@example.com',
            password: 'password123',
            fullName: 'Mike Wilson',
            bio: 'Music producer and DJ',
            profilePic: 'https://randomuser.me/api/portraits/men/3.jpg',
            coverPic: 'https://picsum.photos/800/200?random=3',
            friends: [1],
            friendRequests: [],
            privacy: 'friends',
            createdAt: new Date().toISOString()
        }
    ];
}

// Sample posts
posts = [
    {
        id: 1,
        userId: 1,
        content: 'Just launched my new portfolio website! Check it out! 🚀',
        media: null,
        likes: [2, 3],
        comments: [
            {
                id: 1,
                userId: 2,
                content: 'Looks amazing! Great work!',
                createdAt: new Date(Date.now() - 3600000).toISOString()
            },
            {
                id: 2,
                userId: 3,
                content: 'Congrats! Very impressive.',
                createdAt: new Date(Date.now() - 1800000).toISOString()
            }
        ],
        createdAt: new Date(Date.now() - 7200000).toISOString()
    },
    {
        id: 2,
        userId: 2,
        content: 'Beautiful sunset at the beach today! 🌅',
        media: 'https://picsum.photos/600/400?random=4',
        likes: [1],
        comments: [],
        createdAt: new Date(Date.now() - 86400000).toISOString()
    },
    {
        id: 3,
        userId: 3,
        content: 'New track dropping next week! Stay tuned 🎵',
        media: null,
        likes: [],
        comments: [],
        createdAt: new Date(Date.now() - 172800000).toISOString()
    }
];

// Save data function
function saveUsers() {
    fs.writeFileSync('./users.json', JSON.stringify(users, null, 2));
}

// HTTP Server
const server = http.createServer((req, res) => {
    const url = req.url;
    const method = req.method;
    
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }
    
    // API Routes
    if (url === '/api/login' && method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            const { email, password } = JSON.parse(body);
            const user = users.find(u => u.email === email && u.password === password);
            if (user) {
                const { password, ...userWithoutPassword } = user;
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, user: userWithoutPassword }));
            } else {
                res.writeHead(401, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: 'Invalid credentials' }));
            }
        });
    }
    
    else if (url === '/api/register' && method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            const { username, email, password, fullName } = JSON.parse(body);
            const existingUser = users.find(u => u.email === email || u.username === username);
            if (existingUser) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: 'User already exists' }));
                return;
            }
            
            const newUser = {
                id: users.length + 1,
                username,
                email,
                password,
                fullName,
                bio: '',
                profilePic: `https://randomuser.me/api/portraits/${Math.random() > 0.5 ? 'men' : 'women'}/${users.length + 1}.jpg`,
                coverPic: `https://picsum.photos/800/200?random=${users.length + 1}`,
                friends: [],
                friendRequests: [],
                privacy: 'public',
                createdAt: new Date().toISOString()
            };
            
            users.push(newUser);
            saveUsers();
            
            const { password: _, ...userWithoutPassword } = newUser;
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, user: userWithoutPassword }));
        });
    }
    
    else if (url === '/api/posts' && method === 'GET') {
        const postsWithUsers = posts.map(post => {
            const user = users.find(u => u.id === post.userId);
            return {
                ...post,
                user: {
                    id: user.id,
                    username: user.username,
                    fullName: user.fullName,
                    profilePic: user.profilePic
                }
            };
        }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(postsWithUsers));
    }
    
    else if (url === '/api/posts' && method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            const { userId, content, media } = JSON.parse(body);
            const newPost = {
                id: posts.length + 1,
                userId,
                content,
                media: media || null,
                likes: [],
                comments: [],
                createdAt: new Date().toISOString()
            };
            posts.unshift(newPost);
            
            // Broadcast to all connected clients
            broadcast('newPost', newPost);
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, post: newPost }));
        });
    }
    
    else if (url.startsWith('/api/posts/') && method === 'PUT') {
        const postId = parseInt(url.split('/')[3]);
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            const { action, userId } = JSON.parse(body);
            const post = posts.find(p => p.id === postId);
            
            if (action === 'like') {
                if (post.likes.includes(userId)) {
                    post.likes = post.likes.filter(id => id !== userId);
                } else {
                    post.likes.push(userId);
                    // Create notification
                    if (post.userId !== userId) {
                        createNotification(post.userId, 'like', userId, postId);
                    }
                }
                broadcast('postUpdate', post);
            }
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, post }));
        });
    }
    
    else if (url.startsWith('/api/posts/') && method === 'POST') {
        const postId = parseInt(url.split('/')[3]);
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            const { userId, content } = JSON.parse(body);
            const post = posts.find(p => p.id === postId);
            
            const newComment = {
                id: post.comments.length + 1,
                userId,
                content,
                createdAt: new Date().toISOString()
            };
            post.comments.push(newComment);
            
            // Create notification
            if (post.userId !== userId) {
                createNotification(post.userId, 'comment', userId, postId);
            }
            
            broadcast('postUpdate', post);
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, comment: newComment }));
        });
    }
    
    else if (url === '/api/users' && method === 'GET') {
        const usersList = users.map(u => {
            const { password, ...user } = u;
            return user;
        });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(usersList));
    }
    
    else if (url.startsWith('/api/friend-request') && method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            const { fromUserId, toUserId } = JSON.parse(body);
            const targetUser = users.find(u => u.id === toUserId);
            
            if (!targetUser.friendRequests.includes(fromUserId)) {
                targetUser.friendRequests.push(fromUserId);
                saveUsers();
                
                // Create notification
                createNotification(toUserId, 'friend_request', fromUserId);
                broadcast('userUpdate', targetUser);
            }
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true }));
        });
    }
    
    else if (url.startsWith('/api/friend-request') && method === 'PUT') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            const { userId, requesterId, action } = JSON.parse(body);
            const user = users.find(u => u.id === userId);
            const requester = users.find(u => u.id === requesterId);
            
            if (action === 'accept') {
                user.friendRequests = user.friendRequests.filter(id => id !== requesterId);
                user.friends.push(requesterId);
                requester.friends.push(userId);
                saveUsers();
                
                // Create notification
                createNotification(requesterId, 'friend_accept', userId);
                broadcast('userUpdate', user);
                broadcast('userUpdate', requester);
            } else if (action === 'reject') {
                user.friendRequests = user.friendRequests.filter(id => id !== requesterId);
                saveUsers();
                broadcast('userUpdate', user);
            }
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true }));
        });
    }
    
    else if (url === '/api/notifications' && method === 'GET') {
        const userId = parseInt(url.split('?')[1]?.split('=')[1]);
        const userNotifications = notifications.filter(n => n.userId === userId);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(userNotifications));
    }
    
    else {
        res.writeHead(404);
        res.end();
    }
});

// WebSocket Server
const wss = new WebSocket.Server({ server });
const clients = new Map();

function broadcast(type, data) {
    const message = JSON.stringify({ type, data });
    clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}

function createNotification(userId, type, fromUserId, postId = null) {
    const fromUser = users.find(u => u.id === fromUserId);
    const notification = {
        id: notifications.length + 1,
        userId,
        type,
        fromUserId,
        fromUserName: fromUser?.fullName,
        postId,
        read: false,
        createdAt: new Date().toISOString()
    };
    notifications.push(notification);
    
    // Keep only last 100 notifications
    if (notifications.length > 100) {
        notifications = notifications.slice(-100);
    }
    
    // Send real-time notification
    broadcast('notification', notification);
}

wss.on('connection', (ws, req) => {
    let userId = null;
    
    ws.on('message', (message) => {
        const data = JSON.parse(message);
        
        if (data.type === 'auth') {
            userId = data.userId;
            clients.set(userId, ws);
            console.log(`User ${userId} connected`);
        }
        
        if (data.type === 'typing') {
            broadcast('typing', {
                userId: data.userId,
                userName: data.userName,
                isTyping: data.isTyping
            });
        }
    });
    
    ws.on('close', () => {
        if (userId) {
            clients.delete(userId);
            console.log(`User ${userId} disconnected`);
        }
    });
});

// Start server
const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});