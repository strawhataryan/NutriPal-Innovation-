const express = require('express');
const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
const router = express.Router();

// In-memory storage
let userStreaks = [];
let userBadges = [];
let rewardHistory = [];
let dailyHabits = [];

// Available badges
const BADGES = {
    CONSISTENCY: {
        '7-day-streak': { name: '7-Day Champion', description: 'Maintained a 7-day streak', points: 50 },
        '30-day-streak': { name: 'Monthly Warrior', description: 'Maintained a 30-day streak', points: 200 },
        '90-day-streak': { name: 'Quarterly Legend', description: 'Maintained a 90-day streak', points: 500 }
    },
    NUTRITION: {
        'healthy-eating': { name: 'Healthy Eater', description: 'Logged healthy meals for 7 days', points: 75 },
        'supplement-consistency': { name: 'Supplement Pro', description: 'Taken supplements consistently for 14 days', points: 100 },
        'hydration': { name: 'Hydration Hero', description: 'Met water goals for 7 days', points: 60 }
    },
    FITNESS: {
        'workout-consistency': { name: 'Fitness Fanatic', description: 'Completed workouts for 7 days', points: 80 },
        'step-master': { name: 'Step Master', description: 'Achieved step goal for 7 days', points: 70 },
        'active-lifestyle': { name: 'Active Lifestyle', description: 'Maintained activity for 30 days', points: 150 }
    },
    MILESTONES: {
        'first-week': { name: 'First Week', description: 'Completed your first week', points: 25 },
        'first-month': { name: 'First Month', description: 'Completed your first month', points: 100 },
        'weight-goal': { name: 'Weight Goal', description: 'Reached your weight goal', points: 200 }
    }
};

// POST - Log daily activity
router.post('/log-activity', (req, res) => {
    try {
        const { userId, activityType, completed, metrics } = req.body;

        if (!userId || !activityType) {
            return res.status(400).json({
                error: 'Missing required fields: userId, activityType'
            });
        }

        const today = moment().format('YYYY-MM-DD');
        
        // Check if activity already logged today
        const existingLog = dailyHabits.find(log => 
            log.userId === userId && 
            log.activityType === activityType && 
            log.date === today
        );

        if (existingLog) {
            return res.status(400).json({
                error: 'Activity already logged for today'
            });
        }

        const activityLog = {
            id: uuidv4(),
            userId,
            activityType,
            date: today,
            completed: completed !== false,
            metrics: metrics || {},
            loggedAt: new Date().toISOString()
        };

        dailyHabits.push(activityLog);

        // Update streaks
        const streakUpdate = updateStreak(userId, activityType, completed !== false);
        
        // Check for new badges
        const newBadges = checkForNewBadges(userId);
        
        // Award points
        const pointsAwarded = awardPoints(userId, activityType, completed);

        res.json({
            message: 'Activity logged successfully',
            log: activityLog,
            streakUpdate,
            newBadges,
            pointsAwarded
        });

    } catch (error) {
        console.error('Error logging activity:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET - Get user streaks
router.get('/:userId/streaks', (req, res) => {
    try {
        const { userId } = req.params;

        const userStreak = userStreaks.find(streak => streak.userId === userId) || 
                          initializeUserStreak(userId);

        const todayActivities = dailyHabits.filter(log => 
            log.userId === userId && 
            log.date === moment().format('YYYY-MM-DD')
        );

        res.json({
            userId,
            currentStreaks: userStreak.streaks,
            longestStreaks: userStreak.longestStreaks,
            todayProgress: calculateTodayProgress(todayActivities),
            weeklyProgress: calculateWeeklyProgress(userId),
            motivation: generateMotivationalMessage(userStreak)
        });

    } catch (error) {
        console.error('Error fetching streaks:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET - Get user badges
router.get('/:userId/badges', (req, res) => {
    try {
        const { userId } = req.params;

        const userBadgeList = userBadges.filter(badge => badge.userId === userId);
        const availableBadges = getAvailableBadges(userId);

        res.json({
            userId,
            earnedBadges: userBadgeList,
            availableBadges,
            totalPoints: calculateTotalPoints(userId),
            badgeProgress: calculateBadgeProgress(userId)
        });

    } catch (error) {
        console.error('Error fetching badges:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST - Redeem rewards
router.post('/:userId/redeem', (req, res) => {
    try {
        const { userId } = req.params;
        const { rewardId } = req.body;

        const userPoints = calculateTotalPoints(userId);
        const reward = getRewardById(rewardId);

        if (!reward) {
            return res.status(404).json({ error: 'Reward not found' });
        }

        if (userPoints < reward.pointsRequired) {
            return res.status(400).json({
                error: 'Insufficient points',
                required: reward.pointsRequired,
                current: userPoints
            });
        }

        const redemption = {
            id: uuidv4(),
            userId,
            rewardId,
            rewardName: reward.name,
            pointsUsed: reward.pointsRequired,
            redeemedAt: new Date().toISOString(),
            status: 'claimed'
        };

        rewardHistory.push(redemption);

        res.json({
            message: 'Reward redeemed successfully',
            redemption,
            remainingPoints: userPoints - reward.pointsRequired
        });

    } catch (error) {
        console.error('Error redeeming reward:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET - Get leaderboard
router.get('/leaderboard', (req, res) => {
    try {
        const { type = 'points', limit = 10 } = req.query;

        const leaderboard = generateLeaderboard(type, parseInt(limit));

        res.json({
            type,
            leaderboard,
            updatedAt: new Date().toISOString()
        });

    } catch (error) {
        console.error('Error fetching leaderboard:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Utility Functions
function initializeUserStreak(userId) {
    const newStreak = {
        userId,
        streaks: {
            nutrition: 0,
            fitness: 0,
            supplements: 0,
            hydration: 0,
            sleep: 0
        },
        longestStreaks: {
            nutrition: 0,
            fitness: 0,
            supplements: 0,
            hydration: 0,
            sleep: 0
        },
        lastUpdated: new Date().toISOString()
    };

    userStreaks.push(newStreak);
    return newStreak;
}

function updateStreak(userId, activityType, completed) {
    let userStreak = userStreaks.find(streak => streak.userId === userId);
    if (!userStreak) {
        userStreak = initializeUserStreak(userId);
    }

    const today = moment().format('YYYY-MM-DD');
    const yesterday = moment().subtract(1, 'day').format('YYYY-MM-DD');

    // Get yesterday's activities for this type
    const yesterdayActivity = dailyHabits.find(log => 
        log.userId === userId && 
        log.activityType === activityType && 
        log.date === yesterday
    );

    if (completed) {
        if (yesterdayActivity && yesterdayActivity.completed) {
            // Continue streak
            userStreak.streaks[activityType] += 1;
        } else {
            // Start new streak
            userStreak.streaks[activityType] = 1;
        }

        // Update longest streak if current is longer
        if (userStreak.streaks[activityType] > userStreak.longestStreaks[activityType]) {
            userStreak.longestStreaks[activityType] = userStreak.streaks[activityType];
        }
    } else {
        // Reset streak
        userStreak.streaks[activityType] = 0;
    }

    userStreak.lastUpdated = new Date().toISOString();

    return {
        activityType,
        currentStreak: userStreak.streaks[activityType],
        longestStreak: userStreak.longestStreaks[activityType]
    };
}

function checkForNewBadges(userId) {
    const userStreak = userStreaks.find(streak => streak.userId === userId);
    const earnedBadges = userBadges.filter(badge => badge.userId === userId);
    const newBadges = [];

    // Check streak badges
    Object.entries(userStreak.streaks).forEach(([type, streak]) => {
        if (streak >= 7 && !earnedBadges.find(b => b.badgeId === '7-day-streak')) {
            newBadges.push(awardBadge(userId, '7-day-streak'));
        }
        if (streak >= 30 && !earnedBadges.find(b => b.badgeId === '30-day-streak')) {
            newBadges.push(awardBadge(userId, '30-day-streak'));
        }
    });

    // Check nutrition badges
    const nutritionActivities = dailyHabits.filter(log => 
        log.userId === userId && 
        ['healthy-eating', 'supplement-consistency'].includes(log.activityType)
    );

    if (nutritionActivities.length >= 7) {
        newBadges.push(awardBadge(userId, 'healthy-eating'));
    }

    return newBadges;
}

function awardBadge(userId, badgeId) {
    const badge = Object.values(BADGES).flatMap(category => 
        Object.entries(category).find(([id, _]) => id === badgeId)
    ).find(b => b)?.[1];

    if (!badge) return null;

    const userBadge = {
        id: uuidv4(),
        userId,
        badgeId,
        badgeName: badge.name,
        badgeDescription: badge.description,
        points: badge.points,
        awardedAt: new Date().toISOString()
    };

    userBadges.push(userBadge);
    return userBadge;
}

function awardPoints(userId, activityType, completed) {
    if (!completed) return 0;

    const points = {
        'healthy-eating': 10,
        'supplement-consistency': 15,
        'workout': 20,
        'hydration': 5,
        'sleep': 8,
        'meditation': 12
    };

    const pointsEarned = points[activityType] || 5;

    // Add to reward history
    rewardHistory.push({
        id: uuidv4(),
        userId,
        activityType,
        points: pointsEarned,
        awardedAt: new Date().toISOString()
    });

    return pointsEarned;
}

function calculateTotalPoints(userId) {
    return rewardHistory
        .filter(reward => reward.userId === userId)
        .reduce((total, reward) => total + (reward.points || 0), 0);
}

function calculateTodayProgress(todayActivities) {
    const totalActivities = 5; // Example: 5 daily goals
    const completedActivities = todayActivities.filter(activity => activity.completed).length;
    
    return {
        completed: completedActivities,
        total: totalActivities,
        percentage: Math.round((completedActivities / totalActivities) * 100)
    };
}

function calculateWeeklyProgress(userId) {
    const weekStart = moment().startOf('week').format('YYYY-MM-DD');
    const weekActivities = dailyHabits.filter(log => 
        log.userId === userId && 
        log.date >= weekStart
    );

    const completedCount = weekActivities.filter(activity => activity.completed).length;
    const totalPossible = 5 * 7; // 5 activities per day for 7 days

    return {
        completed: completedCount,
        total: totalPossible,
        percentage: Math.round((completedCount / totalPossible) * 100)
    };
}

function generateMotivationalMessage(userStreak) {
    const currentStreak = Math.max(...Object.values(userStreak.streaks));
    
    if (currentStreak === 0) {
        return "Every journey begins with a single step! Start your health streak today!";
    } else if (currentStreak < 7) {
        return `Great start! You're on a ${currentStreak}-day streak. Keep going!`;
    } else if (currentStreak < 30) {
        return `Amazing! ${currentStreak} days strong! You're building great habits.`;
    } else {
        return `Incredible! ${currentStreak} days of consistency! You're an inspiration!`;
    }
}

function generateLeaderboard(type, limit) {
    // Simple leaderboard implementation
    const userPoints = {};
    
    rewardHistory.forEach(reward => {
        if (!userPoints[reward.userId]) {
            userPoints[reward.userId] = 0;
        }
        userPoints[reward.userId] += reward.points || 0;
    });

    return Object.entries(userPoints)
        .sort(([,a], [,b]) => b - a)
        .slice(0, limit)
        .map(([userId, points], index) => ({
            rank: index + 1,
            userId,
            points,
            badges: userBadges.filter(badge => badge.userId === userId).length
        }));
}

module.exports = router;