const express = require('express');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();

// In-memory storage for forum data
let forumCategories = [
    {
        id: 'general',
        name: 'General Discussion',
        description: 'General health and wellness discussions',
        icon: '💬',
        color: 'blue',
        postCount: 0
    },
    {
        id: 'nutrition',
        name: 'Nutrition & Diet',
        description: 'Share recipes and nutrition tips',
        icon: '🥗',
        color: 'green',
        postCount: 0
    },
    {
        id: 'fitness',
        name: 'Fitness & Exercise',
        description: 'Workout routines and fitness challenges',
        icon: '💪',
        color: 'red',
        postCount: 0
    },
    {
        id: 'supplements',
        name: 'Supplements',
        description: 'Discuss supplements and their effects',
        icon: '💊',
        color: 'purple',
        postCount: 0
    },
    {
        id: 'success-stories',
        name: 'Success Stories',
        description: 'Share your health journey and achievements',
        icon: '🏆',
        color: 'yellow',
        postCount: 0
    },
    {
        id: 'questions',
        name: 'Q&A',
        description: 'Ask questions and get answers from community',
        icon: '❓',
        color: 'indigo',
        postCount: 0
    }
];

let forumPosts = [];
let forumComments = [];
let userProfiles = [];

// User roles
const USER_ROLES = {
    MEMBER: 'member',
    MODERATOR: 'moderator',
    ADMIN: 'admin'
};

// POST - Create new user profile
router.post('/users', (req, res) => {
    try {
        const { username, email, avatar, healthGoals } = req.body;

        // Check if user already exists
        const existingUser = userProfiles.find(user => user.email === email);
        if (existingUser) {
            return res.json({
                message: 'User profile already exists',
                user: existingUser
            });
        }

        const userProfile = {
            id: uuidv4(),
            username,
            email,
            avatar: avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=10b981&color=fff`,
            healthGoals: healthGoals || [],
            joinDate: new Date().toISOString(),
            role: USER_ROLES.MEMBER,
            stats: {
                posts: 0,
                comments: 0,
                likes: 0,
                helpful: 0
            },
            badges: ['new-member'],
            isOnline: true
        };

        userProfiles.push(userProfile);

        res.status(201).json({
            message: 'User profile created successfully',
            user: userProfile
        });

    } catch (error) {
        console.error('Error creating user profile:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET - Get forum categories
router.get('/categories', (req, res) => {
    res.json({
        categories: forumCategories,
        totalCategories: forumCategories.length
    });
});

// POST - Create new forum post
router.post('/posts', (req, res) => {
    try {
        const { title, content, category, tags, authorId } = req.body;

        if (!title || !content || !category || !authorId) {
            return res.status(400).json({
                error: 'Missing required fields: title, content, category, authorId'
            });
        }

        // Validate category
        const categoryObj = forumCategories.find(cat => cat.id === category);
        if (!categoryObj) {
            return res.status(400).json({
                error: 'Invalid category',
                availableCategories: forumCategories.map(cat => cat.id)
            });
        }

        // Validate author
        const author = userProfiles.find(user => user.id === authorId);
        if (!author) {
            return res.status(400).json({ error: 'Author not found' });
        }

        const post = {
            id: uuidv4(),
            title,
            content,
            category,
            tags: tags || [],
            author: {
                id: author.id,
                username: author.username,
                avatar: author.avatar,
                role: author.role
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            stats: {
                views: 0,
                likes: 0,
                comments: 0,
                shares: 0
            },
            isPinned: false,
            isLocked: false,
            status: 'published'
        };

        forumPosts.push(post);

        // Update category post count
        categoryObj.postCount += 1;

        // Update user stats
        author.stats.posts += 1;

        res.status(201).json({
            message: 'Post created successfully',
            post
        });

    } catch (error) {
        console.error('Error creating post:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET - Get forum posts with filters
router.get('/posts', (req, res) => {
    try {
        const { category, author, sort = 'newest', page = 1, limit = 20, search } = req.query;
        
        let filteredPosts = [...forumPosts];

        // Filter by category
        if (category) {
            filteredPosts = filteredPosts.filter(post => post.category === category);
        }

        // Filter by author
        if (author) {
            filteredPosts = filteredPosts.filter(post => post.author.id === author);
        }

        // Search in title and content
        if (search) {
            const searchLower = search.toLowerCase();
            filteredPosts = filteredPosts.filter(post => 
                post.title.toLowerCase().includes(searchLower) ||
                post.content.toLowerCase().includes(searchLower)
            );
        }

        // Sort posts
        switch (sort) {
            case 'newest':
                filteredPosts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
                break;
            case 'oldest':
                filteredPosts.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
                break;
            case 'popular':
                filteredPosts.sort((a, b) => b.stats.likes - a.stats.likes);
                break;
            case 'commented':
                filteredPosts.sort((a, b) => b.stats.comments - a.stats.comments);
                break;
        }

        // Pagination
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + parseInt(limit);
        const paginatedPosts = filteredPosts.slice(startIndex, endIndex);

        res.json({
            posts: paginatedPosts,
            pagination: {
                current: parseInt(page),
                total: Math.ceil(filteredPosts.length / limit),
                hasNext: endIndex < filteredPosts.length,
                hasPrev: page > 1,
                totalPosts: filteredPosts.length
            },
            filters: {
                category,
                author,
                sort,
                search
            }
        });

    } catch (error) {
        console.error('Error fetching posts:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET - Get single post by ID
router.get('/posts/:postId', (req, res) => {
    try {
        const { postId } = req.params;

        const post = forumPosts.find(p => p.id === postId);
        if (!post) {
            return res.status(404).json({ error: 'Post not found' });
        }

        // Increment view count
        post.stats.views += 1;

        // Get comments for this post
        const comments = forumComments.filter(comment => comment.postId === postId);

        res.json({
            post,
            comments: {
                items: comments,
                total: comments.length
            }
        });

    } catch (error) {
        console.error('Error fetching post:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST - Add comment to post
router.post('/posts/:postId/comments', (req, res) => {
    try {
        const { postId } = req.params;
        const { content, authorId, parentCommentId } = req.body;

        if (!content || !authorId) {
            return res.status(400).json({
                error: 'Missing required fields: content, authorId'
            });
        }

        // Validate post exists
        const post = forumPosts.find(p => p.id === postId);
        if (!post) {
            return res.status(404).json({ error: 'Post not found' });
        }

        // Validate author
        const author = userProfiles.find(user => user.id === authorId);
        if (!author) {
            return res.status(400).json({ error: 'Author not found' });
        }

        const comment = {
            id: uuidv4(),
            postId,
            content,
            parentCommentId: parentCommentId || null,
            author: {
                id: author.id,
                username: author.username,
                avatar: author.avatar,
                role: author.role
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            stats: {
                likes: 0,
                replies: 0
            },
            status: 'published'
        };

        forumComments.push(comment);

        // Update post comment count
        post.stats.comments += 1;

        // Update user stats
        author.stats.comments += 1;

        // If this is a reply, update parent comment reply count
        if (parentCommentId) {
            const parentComment = forumComments.find(c => c.id === parentCommentId);
            if (parentComment) {
                parentComment.stats.replies += 1;
            }
        }

        res.status(201).json({
            message: 'Comment added successfully',
            comment
        });

    } catch (error) {
        console.error('Error adding comment:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST - Like/unlike post
router.post('/posts/:postId/like', (req, res) => {
    try {
        const { postId } = req.params;
        const { userId } = req.body;

        const post = forumPosts.find(p => p.id === postId);
        if (!post) {
            return res.status(404).json({ error: 'Post not found' });
        }

        // Toggle like (in real app, you'd have a separate likes table)
        // For simplicity, we're just incrementing/decrementing
        const user = userProfiles.find(u => u.id === userId);
        if (user) {
            // Simple toggle logic
            post.stats.likes += 1;
            user.stats.likes += 1;
        }

        res.json({
            message: 'Post liked successfully',
            likes: post.stats.likes
        });

    } catch (error) {
        console.error('Error liking post:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET - Get user profile
router.get('/users/:userId', (req, res) => {
    try {
        const { userId } = req.params;

        const user = userProfiles.find(u => u.id === userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Get user's posts
        const userPosts = forumPosts.filter(post => post.author.id === userId);
        
        // Get user's comments
        const userComments = forumComments.filter(comment => comment.author.id === userId);

        res.json({
            user: {
                ...user,
                activity: {
                    posts: userPosts.length,
                    comments: userComments.length,
                    recentPosts: userPosts.slice(0, 5),
                    recentComments: userComments.slice(0, 5)
                }
            }
        });

    } catch (error) {
        console.error('Error fetching user profile:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET - Get forum statistics
router.get('/stats', (req, res) => {
    const stats = {
        totalPosts: forumPosts.length,
        totalComments: forumComments.length,
        totalUsers: userProfiles.length,
        onlineUsers: userProfiles.filter(user => user.isOnline).length,
        categories: forumCategories.map(cat => ({
            name: cat.name,
            postCount: cat.postCount
        })),
        recentActivity: {
            newPosts: forumPosts.slice(-5).reverse(),
            newUsers: userProfiles.slice(-3).reverse()
        }
    };

    res.json(stats);
});

// POST - Mark comment as helpful
router.post('/comments/:commentId/helpful', (req, res) => {
    try {
        const { commentId } = req.params;
        const { userId } = req.body;

        const comment = forumComments.find(c => c.id === commentId);
        if (!comment) {
            return res.status(404).json({ error: 'Comment not found' });
        }

        const user = userProfiles.find(u => u.id === userId);
        if (user) {
            comment.stats.likes += 1;
            user.stats.helpful += 1;
        }

        res.json({
            message: 'Comment marked as helpful',
            helpfulCount: comment.stats.likes
        });

    } catch (error) {
        console.error('Error marking comment as helpful:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET - Search forum content
router.get('/search', (req, res) => {
    try {
        const { q, type = 'all', category } = req.query;

        if (!q) {
            return res.status(400).json({ error: 'Search query required' });
        }

        const searchLower = q.toLowerCase();
        let results = [];

        if (type === 'all' || type === 'posts') {
            const postResults = forumPosts.filter(post => 
                post.title.toLowerCase().includes(searchLower) ||
                post.content.toLowerCase().includes(searchLower)
            ).map(post => ({
                type: 'post',
                id: post.id,
                title: post.title,
                content: post.content.substring(0, 200) + '...',
                category: post.category,
                author: post.author,
                createdAt: post.createdAt
            }));

            results = results.concat(postResults);
        }

        if (type === 'all' || type === 'comments') {
            const commentResults = forumComments.filter(comment => 
                comment.content.toLowerCase().includes(searchLower)
            ).map(comment => ({
                type: 'comment',
                id: comment.id,
                content: comment.content.substring(0, 200) + '...',
                postId: comment.postId,
                author: comment.author,
                createdAt: comment.createdAt
            }));

            results = results.concat(commentResults);
        }

        // Filter by category if specified
        if (category) {
            results = results.filter(result => result.category === category);
        }

        res.json({
            query: q,
            type,
            category,
            results,
            total: results.length
        });

    } catch (error) {
        console.error('Error searching forum:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;