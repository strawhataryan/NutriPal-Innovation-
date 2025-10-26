// Community Forum Frontend JavaScript
class CommunityForum {
    constructor() {
        this.socket = io();
        this.currentUser = null;
        this.currentTab = 'recent';
        this.categories = [];
        this.posts = [];
        this.onlineUsers = new Set();
        
        this.initializeEventListeners();
        this.initializeUser();
        this.loadForumData();
    }

    initializeEventListeners() {
        // Tab navigation
        document.getElementById('tab-recent').addEventListener('click', () => this.switchTab('recent'));
        document.getElementById('tab-popular').addEventListener('click', () => this.switchTab('popular'));
        document.getElementById('tab-unanswered').addEventListener('click', () => this.switchTab('unanswered'));

        // New post modal
        document.getElementById('newPostBtn').addEventListener('click', () => this.showNewPostModal());
        document.getElementById('closeModalBtn').addEventListener('click', () => this.hideNewPostModal());
        document.getElementById('cancelPostBtn').addEventListener('click', () => this.hideNewPostModal());
        document.getElementById('newPostForm').addEventListener('submit', (e) => this.createNewPost(e));

        // Refresh button
        document.getElementById('refreshBtn').addEventListener('click', () => this.loadForumData());

        // Socket events
        this.socket.on('userJoined', (data) => this.handleUserJoined(data));
        this.socket.on('userLeft', (data) => this.handleUserLeft(data));
        this.socket.on('postCreated', (data) => this.handleNewPost(data));
        this.socket.on('commentAdded', (data) => this.handleNewComment(data));
        this.socket.on('postLiked', (data) => this.handlePostLiked(data));
        this.socket.on('userTyping', (data) => this.handleUserTyping(data));
    }

    async initializeUser() {
        // Check if user exists in localStorage
        let userData = localStorage.getItem('nutripalForumUser');
        
        if (!userData) {
            // Create new user
            const username = `User${Math.floor(Math.random() * 10000)}`;
            const healthGoals = ['generalWellness'];
            
            try {
                const response = await fetch('/api/forum/users', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        username,
                        email: `${username.toLowerCase()}@example.com`,
                        healthGoals
                    })
                });

                const result = await response.json();
                this.currentUser = result.user;
                localStorage.setItem('nutripalForumUser', JSON.stringify(this.currentUser));
            } catch (error) {
                console.error('Error creating user:', error);
                // Fallback user
                this.currentUser = {
                    id: 'temp-user',
                    username: 'Guest',
                    avatar: 'https://ui-avatars.com/api/?name=Guest&background=gray&color=fff',
                    role: 'member',
                    stats: { posts: 0, comments: 0, likes: 0, helpful: 0 }
                };
            }
        } else {
            this.currentUser = JSON.parse(userData);
        }

        // Update UI with user data
        this.updateUserProfile();
        
        // Join forum room
        this.socket.emit('joinForum', this.currentUser);
    }

    updateUserProfile() {
        if (!this.currentUser) return;

        document.getElementById('userAvatar').src = this.currentUser.avatar;
        document.getElementById('userName').textContent = this.currentUser.username;
        document.getElementById('userRole').textContent = this.currentUser.role.charAt(0).toUpperCase() + this.currentUser.role.slice(1);
        document.getElementById('userPosts').textContent = this.currentUser.stats.posts;
        document.getElementById('userComments').textContent = this.currentUser.stats.comments;
    }

    async loadForumData() {
        await this.loadCategories();
        await this.loadPosts();
        await this.loadForumStats();
    }

    async loadCategories() {
        try {
            const response = await fetch('/api/forum/categories');
            const data = await response.json();
            this.categories = data.categories;
            this.renderCategories();
            this.populateCategoryDropdown();
        } catch (error) {
            console.error('Error loading categories:', error);
        }
    }

    async loadPosts() {
        try {
            const sort = this.currentTab === 'recent' ? 'newest' : 
                        this.currentTab === 'popular' ? 'popular' : 'newest';
            
            const response = await fetch(`/api/forum/posts?sort=${sort}&limit=20`);
            const data = await response.json();
            this.posts = data.posts;
            this.renderPosts();
        } catch (error) {
            console.error('Error loading posts:', error);
        }
    }

    async loadForumStats() {
        try {
            const response = await fetch('/api/forum/stats');
            const data = await response.json();
            
            document.getElementById('totalMembers').textContent = data.totalUsers;
            document.getElementById('onlineMembers').textContent = data.onlineUsers;
            document.getElementById('totalPosts').textContent = data.totalPosts;
            document.getElementById('totalComments').textContent = data.totalComments;
            
            this.updateOnlineUsers(data.recentActivity.newUsers);
        } catch (error) {
            console.error('Error loading forum stats:', error);
        }
    }

    renderCategories() {
        const container = document.querySelector('.grid.grid-cols-1.md\\:grid-cols-2.lg\\:grid-cols-3.gap-4');
        if (!container) return;

        container.innerHTML = this.categories.map(category => `
            <div class="category-card bg-white rounded-xl shadow-lg p-6 cursor-pointer hover:shadow-xl border-l-4 ${this.getCategoryColor(category.color)}" data-category="${category.id}">
                <div class="flex items-start justify-between mb-3">
                    <div class="text-2xl">${category.icon}</div>
                    <span class="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded-full">${category.postCount} posts</span>
                </div>
                <h3 class="font-bold text-gray-800 text-lg mb-2">${category.name}</h3>
                <p class="text-gray-600 text-sm">${category.description}</p>
            </div>
        `).join('');

        // Add click event to categories
        container.querySelectorAll('.category-card').forEach(card => {
            card.addEventListener('click', () => {
                const category = card.dataset.category;
                this.filterByCategory(category);
            });
        });
    }

    renderPosts() {
        const container = document.getElementById('postsContainer');
        if (!container) return;

        if (this.posts.length === 0) {
            container.innerHTML = `
                <div class="text-center py-12">
                    <div class="text-6xl mb-4">📝</div>
                    <h3 class="text-xl font-bold text-gray-800 mb-2">No posts yet</h3>
                    <p class="text-gray-600 mb-4">Be the first to start a discussion in this category!</p>
                    <button class="bg-green-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-green-700 transition-colors" onclick="forum.showNewPostModal()">
                        Create First Post
                    </button>
                </div>
            `;
            return;
        }

        container.innerHTML = this.posts.map(post => `
            <div class="border-b border-gray-200 pb-6 mb-6 last:border-b-0 last:mb-0" data-post-id="${post.id}">
                <div class="flex items-start justify-between mb-3">
                    <div class="flex items-center space-x-3">
                        <img src="${post.author.avatar}" alt="${post.author.username}" class="w-10 h-10 rounded-full">
                        <div>
                            <div class="font-medium text-gray-800">${post.author.username}</div>
                            <div class="text-sm text-gray-500">
                                ${this.formatDate(post.createdAt)} • 
                                <span class="inline-flex items-center px-2 py-1 rounded-full text-xs ${this.getCategoryColor(this.getCategoryById(post.category)?.color)} bg-opacity-10">
                                    ${this.getCategoryById(post.category)?.icon} ${this.getCategoryById(post.category)?.name}
                                </span>
                            </div>
                        </div>
                    </div>
                    <div class="flex items-center space-x-4 text-sm text-gray-500">
                        <div class="flex items-center space-x-1">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                            </svg>
                            <span>${post.stats.views}</span>
                        </div>
                        <div class="flex items-center space-x-1">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
                            </svg>
                            <span>${post.stats.likes}</span>
                        </div>
                        <div class="flex items-center space-x-1">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
                            </svg>
                            <span>${post.stats.comments}</span>
                        </div>
                    </div>
                </div>
                
                <h3 class="text-xl font-bold text-gray-800 mb-3 hover:text-green-600 cursor-pointer" onclick="forum.viewPost('${post.id}')">
                    ${post.title}
                </h3>
                
                <p class="text-gray-600 mb-4 line-clamp-3">${post.content}</p>
                
                <div class="flex items-center justify-between">
                    <div class="flex space-x-2">
                        ${post.tags.map(tag => `
                            <span class="inline-block bg-gray-100 text-gray-700 px-2 py-1 rounded-full text-xs">#${tag}</span>
                        `).join('')}
                    </div>
                    <div class="flex space-x-2">
                        <button class="text-gray-500 hover:text-green-600 p-2 rounded-lg transition-colors" onclick="forum.likePost('${post.id}')">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
                            </svg>
                        </button>
                        <button class="text-gray-500 hover:text-blue-600 p-2 rounded-lg transition-colors" onclick="forum.viewPost('${post.id}')">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
    }

    populateCategoryDropdown() {
        const dropdown = document.getElementById('postCategory');
        if (!dropdown) return;

        dropdown.innerHTML = '<option value="">Select a category</option>' +
            this.categories.map(category => `
                <option value="${category.id}">${category.icon} ${category.name}</option>
            `).join('');
    }

    switchTab(tab) {
        this.currentTab = tab;
        
        // Update active tab styling
        document.querySelectorAll('.tab-button').forEach(button => {
            button.classList.remove('border-green-500', 'text-green-600');
            button.classList.add('border-transparent', 'text-gray-500');
        });
        
        document.getElementById(`tab-${tab}`).classList.add('border-green-500', 'text-green-600');
        document.getElementById(`tab-${tab}`).classList.remove('border-transparent', 'text-gray-500');
        
        this.loadPosts();
    }

    showNewPostModal() {
        if (!this.currentUser) {
            this.showToast('Please wait while we set up your account...', 'info');
            return;
        }
        
        document.getElementById('newPostModal').classList.remove('hidden');
        document.getElementById('postTitle').focus();
    }

    hideNewPostModal() {
        document.getElementById('newPostModal').classList.add('hidden');
        document.getElementById('newPostForm').reset();
    }

    async createNewPost(event) {
        event.preventDefault();
        
        if (!this.currentUser) {
            this.showToast('Please wait while we set up your account...', 'error');
            return;
        }

        const formData = new FormData(event.target);
        const postData = {
            title: formData.get('title'),
            content: formData.get('content'),
            category: formData.get('category'),
            tags: formData.get('tags') ? formData.get('tags').split(',').map(tag => tag.trim()) : [],
            authorId: this.currentUser.id
        };

        try {
            const response = await fetch('/api/forum/posts', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(postData)
            });

            if (response.ok) {
                const result = await response.json();
                this.showToast('Post created successfully!');
                this.hideNewPostModal();
                
                // Emit socket event for real-time update
                this.socket.emit('newPost', result.post);
                
                // Reload posts
                this.loadPosts();
            } else {
                const error = await response.json();
                this.showToast(error.error || 'Failed to create post', 'error');
            }
        } catch (error) {
            console.error('Error creating post:', error);
            this.showToast('Failed to create post', 'error');
        }
    }

    async viewPost(postId) {
        // In a real application, this would navigate to a post detail page
        // For now, we'll show an alert with a mock implementation
        alert(`Viewing post ${postId}\n\nIn a full implementation, this would open a detailed post view with comments and interactions.`);
    }

    async likePost(postId) {
        if (!this.currentUser) {
            this.showToast('Please wait while we set up your account...', 'error');
            return;
        }

        try {
            const response = await fetch(`/api/forum/posts/${postId}/like`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    userId: this.currentUser.id
                })
            });

            if (response.ok) {
                const result = await response.json();
                this.showToast('Post liked!');
                
                // Emit socket event for real-time update
                this.socket.emit('toggleLike', {
                    postId,
                    likes: result.likes
                });
            }
        } catch (error) {
            console.error('Error liking post:', error);
        }
    }

    filterByCategory(categoryId) {
        // Implementation for filtering posts by category
        this.showToast(`Filtering by category: ${this.getCategoryById(categoryId)?.name}`, 'info');
        // In full implementation, this would filter the posts list
    }

    // Socket event handlers
    handleUserJoined(data) {
        this.onlineUsers.add(data.username);
        this.updateOnlineUsersList();
        this.showToast(`${data.username} joined the community`, 'info');
    }

    handleUserLeft(data) {
        this.onlineUsers.delete(data.username);
        this.updateOnlineUsersList();
    }

    handleNewPost(post) {
        // Add new post to the beginning of the list
        this.posts.unshift(post);
        this.renderPosts();
        
        if (post.author.username !== this.currentUser.username) {
            this.showToast(`New post by ${post.author.username}: ${post.title}`, 'info');
        }
    }

    handleNewComment(comment) {
        // Implementation for handling new comments
        this.showToast(`New comment by ${comment.author.username}`, 'info');
    }

    handlePostLiked(data) {
        // Update like count in UI
        const postElement = document.querySelector(`[data-post-id="${data.postId}"]`);
        if (postElement) {
            const likeCount = postElement.querySelector('.flex.items-center.space-x-1:nth-child(2) span');
            if (likeCount) {
                likeCount.textContent = data.likes;
            }
        }
    }

    handleUserTyping(data) {
        // Implementation for typing indicators
        // This would show/hide typing indicators in the UI
    }

    updateOnlineUsersList() {
        const container = document.getElementById('onlineUsersList');
        if (!container) return;

        if (this.onlineUsers.size === 0) {
            container.innerHTML = '<div class="text-center text-gray-500 py-4"><p>No users online</p></div>';
            return;
        }

        container.innerHTML = Array.from(this.onlineUsers).map(username => `
            <div class="flex items-center space-x-3 py-2">
                <div class="w-3 h-3 bg-green-500 rounded-full online-indicator"></div>
                <span class="text-gray-700 font-medium">${username}</span>
            </div>
        `).join('');
    }

    // Utility methods
    getCategoryById(categoryId) {
        return this.categories.find(cat => cat.id === categoryId);
    }

    getCategoryColor(color) {
        const colorMap = {
            blue: 'border-blue-500 text-blue-600',
            green: 'border-green-500 text-green-600',
            red: 'border-red-500 text-red-600',
            purple: 'border-purple-500 text-purple-600',
            yellow: 'border-yellow-500 text-yellow-600',
            indigo: 'border-indigo-500 text-indigo-600'
        };
        return colorMap[color] || 'border-gray-500 text-gray-600';
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diffInHours = (now - date) / (1000 * 60 * 60);
        
        if (diffInHours < 1) {
            return 'Just now';
        } else if (diffInHours < 24) {
            return `${Math.floor(diffInHours)} hours ago`;
        } else if (diffInHours < 168) {
            return `${Math.floor(diffInHours / 24)} days ago`;
        } else {
            return date.toLocaleDateString();
        }
    }

    showToast(message, type = 'success') {
        const toast = document.getElementById('toast');
        const toastMessage = document.getElementById('toastMessage');
        
        const bgColor = type === 'error' ? 'bg-red-600' : 
                       type === 'info' ? 'bg-blue-600' : 'bg-green-600';
        
        toast.className = `fixed bottom-4 right-4 ${bgColor} text-white px-6 py-3 rounded-lg shadow-lg transform translate-y-16 transition-transform duration-300 flex items-center`;
        toastMessage.textContent = message;
        
        toast.classList.remove('hidden', 'translate-y-16');
        toast.classList.add('translate-y-0');
        
        setTimeout(() => {
            toast.classList.remove('translate-y-0');
            toast.classList.add('translate-y-16');
            setTimeout(() => {
                toast.classList.add('hidden');
            }, 300);
        }, 3000);
    }
}

// Initialize the forum when page loads
let forum;
document.addEventListener('DOMContentLoaded', () => {
    forum = new CommunityForum();
});