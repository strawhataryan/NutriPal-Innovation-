const express = require('express');
const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
const router = express.Router();

// In-memory storage
let notifications = [];
let notificationSettings = [];

// POST - Create notification
router.post('/', (req, res) => {
    try {
        const { userId, type, title, message, data, priority = 'medium' } = req.body;

        if (!userId || !type || !title || !message) {
            return res.status(400).json({
                error: 'Missing required fields: userId, type, title, message'
            });
        }

        const notification = {
            id: uuidv4(),
            userId,
            type,
            title,
            message,
            data: data || {},
            priority,
            status: 'unread',
            createdAt: new Date().toISOString(),
            expiresAt: moment().add(7, 'days').toISOString()
        };

        notifications.push(notification);

        res.status(201).json({
            message: 'Notification created successfully',
            notification
        });

    } catch (error) {
        console.error('Error creating notification:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET - Get user notifications
router.get('/:userId', (req, res) => {
    try {
        const { userId } = req.params;
        const { unreadOnly, type, limit } = req.query;

        let userNotifications = notifications.filter(notif => notif.userId === userId);

        if (unreadOnly === 'true') {
            userNotifications = userNotifications.filter(notif => notif.status === 'unread');
        }

        if (type) {
            userNotifications = userNotifications.filter(notif => notif.type === type);
        }

        // Sort by creation date (newest first)
        userNotifications.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        // Apply limit
        if (limit) {
            userNotifications = userNotifications.slice(0, parseInt(limit));
        }

        res.json({
            userId,
            notifications: userNotifications,
            total: userNotifications.length,
            unread: userNotifications.filter(notif => notif.status === 'unread').length
        });

    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// PUT - Mark notification as read
router.put('/:notificationId/read', (req, res) => {
    try {
        const { notificationId } = req.params;

        const notification = notifications.find(notif => notif.id === notificationId);
        if (!notification) {
            return res.status(404).json({ error: 'Notification not found' });
        }

        notification.status = 'read';
        notification.readAt = new Date().toISOString();

        res.json({
            message: 'Notification marked as read',
            notification
        });

    } catch (error) {
        console.error('Error marking notification as read:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST - Mark all as read
router.post('/:userId/read-all', (req, res) => {
    try {
        const { userId } = req.params;

        const userNotifications = notifications.filter(notif => 
            notif.userId === userId && notif.status === 'unread'
        );

        userNotifications.forEach(notif => {
            notif.status = 'read';
            notif.readAt = new Date().toISOString();
        });

        res.json({
            message: 'All notifications marked as read',
            updatedCount: userNotifications.length
        });

    } catch (error) {
        console.error('Error marking all notifications as read:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET - Get notification settings
router.get('/:userId/settings', (req, res) => {
    try {
        const { userId } = req.params;

        let settings = notificationSettings.find(s => s.userId === userId);
        
        if (!settings) {
            settings = {
                id: uuidv4(),
                userId,
                email: true,
                push: true,
                sms: false,
                categories: {
                    supplements: true,
                    streaks: true,
                    appointments: true,
                    reminders: true,
                    general: true
                },
                quietHours: {
                    enabled: false,
                    start: '22:00',
                    end: '08:00'
                },
                createdAt: new Date().toISOString()
            };
            notificationSettings.push(settings);
        }

        res.json({
            userId,
            settings
        });

    } catch (error) {
        console.error('Error fetching notification settings:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// PUT - Update notification settings
router.put('/:userId/settings', (req, res) => {
    try {
        const { userId } = req.params;
        const { settings } = req.body;

        let userSettings = notificationSettings.find(s => s.userId === userId);
        
        if (!userSettings) {
            userSettings = {
                id: uuidv4(),
                userId,
                ...settings,
                createdAt: new Date().toISOString()
            };
            notificationSettings.push(userSettings);
        } else {
            Object.assign(userSettings, settings);
            userSettings.updatedAt = new Date().toISOString();
        }

        res.json({
            message: 'Notification settings updated successfully',
            settings: userSettings
        });

    } catch (error) {
        console.error('Error updating notification settings:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Utility function to create supplement reminders
function createSupplementReminder(userId, supplement, scheduledTime) {
    const notification = {
        id: uuidv4(),
        userId,
        type: 'supplement_reminder',
        title: 'Supplement Reminder',
        message: `Time to take your ${supplement}`,
        data: {
            supplement,
            scheduledTime,
            action: 'log_intake'
        },
        priority: 'high',
        status: 'unread',
        createdAt: new Date().toISOString()
    };

    notifications.push(notification);
    return notification;
}

// Utility function to create streak notifications
function createStreakNotification(userId, streakType, currentStreak, milestone) {
    const messages = {
        '7-day': `Amazing! You've maintained a ${currentStreak}-day ${streakType} streak! 🎉`,
        '30-day': `Incredible! ${currentStreak} days of ${streakType} consistency! You're a champion! 🏆`,
        'milestone': `Congratulations! You've reached a new ${streakType} milestone! 🎊`
    };

    const notification = {
        id: uuidv4(),
        userId,
        type: 'streak_milestone',
        title: 'Streak Milestone!',
        message: messages[milestone] || `Great job on your ${currentStreak}-day ${streakType} streak!`,
        data: {
            streakType,
            currentStreak,
            milestone
        },
        priority: 'medium',
        status: 'unread',
        createdAt: new Date().toISOString()
    };

    notifications.push(notification);
    return notification;
}

module.exports = {
    router,
    createSupplementReminder,
    createStreakNotification
};