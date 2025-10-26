const express = require('express');
const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
const router = express.Router();

// In-memory storage
let supplementSchedules = [];
let reminderHistory = [];
let userSettings = [];

// POST - Create supplement schedule
router.post('/schedules', (req, res) => {
    try {
        const { userId, supplement, dosage, timing, frequency, days } = req.body;

        if (!userId || !supplement || !dosage || !timing) {
            return res.status(400).json({
                error: 'Missing required fields: userId, supplement, dosage, timing'
            });
        }

        const schedule = {
            id: uuidv4(),
            userId,
            supplement,
            dosage,
            timing: Array.isArray(timing) ? timing : [timing],
            frequency: frequency || 'daily',
            days: days || ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
            enabled: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        supplementSchedules.push(schedule);

        // Generate initial reminders
        const reminders = generateRemindersFromSchedule(schedule);
        reminderHistory.push(...reminders);

        res.status(201).json({
            message: 'Supplement schedule created successfully',
            schedule,
            reminders: reminders.slice(0, 3) // Return next 3 reminders
        });

    } catch (error) {
        console.error('Error creating supplement schedule:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET - Get user's supplement schedules
router.get('/:userId/schedules', (req, res) => {
    try {
        const { userId } = req.params;

        const schedules = supplementSchedules.filter(schedule => schedule.userId === userId);
        const upcomingReminders = getUpcomingReminders(userId);

        res.json({
            userId,
            schedules: schedules.filter(s => s.enabled),
            upcomingReminders,
            settings: getUserSettings(userId)
        });

    } catch (error) {
        console.error('Error fetching supplement schedules:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST - Log supplement intake
router.post('/log-intake', (req, res) => {
    try {
        const { userId, supplementId, taken, takenAt, notes } = req.body;

        if (!userId || !supplementId) {
            return res.status(400).json({
                error: 'Missing required fields: userId, supplementId'
            });
        }

        const schedule = supplementSchedules.find(s => s.id === supplementId && s.userId === userId);
        if (!schedule) {
            return res.status(404).json({ error: 'Supplement schedule not found' });
        }

        const intakeLog = {
            id: uuidv4(),
            userId,
            supplementId,
            supplement: schedule.supplement,
            dosage: schedule.dosage,
            taken: taken !== false,
            scheduledTime: getNextScheduledTime(schedule),
            takenAt: takenAt || (taken !== false ? new Date().toISOString() : null),
            notes: notes || '',
            loggedAt: new Date().toISOString()
        };

        reminderHistory.push(intakeLog);

        // Update compliance statistics
        updateComplianceStats(userId, supplementId, taken !== false);

        res.json({
            message: 'Supplement intake logged successfully',
            log: intakeLog,
            compliance: getComplianceStats(userId, supplementId)
        });

    } catch (error) {
        console.error('Error logging supplement intake:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET - Get upcoming reminders
router.get('/:userId/reminders', (req, res) => {
    try {
        const { userId } = req.params;
        const { date } = req.query;

        const targetDate = date ? moment(date) : moment();
        const reminders = getRemindersForDate(userId, targetDate);

        res.json({
            userId,
            date: targetDate.format('YYYY-MM-DD'),
            reminders,
            summary: generateRemindersSummary(reminders)
        });

    } catch (error) {
        console.error('Error fetching reminders:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// PUT - Update reminder settings
router.put('/:userId/settings', (req, res) => {
    try {
        const { userId } = req.params;
        const { settings } = req.body;

        let userSetting = userSettings.find(s => s.userId === userId);
        
        if (!userSetting) {
            userSetting = {
                id: uuidv4(),
                userId,
                notifications: true,
                reminderTimes: ['08:00', '13:00', '20:00'],
                snoozeDuration: 15, // minutes
                soundEnabled: true,
                vibration: true,
                createdAt: new Date().toISOString()
            };
            userSettings.push(userSetting);
        }

        // Update settings
        Object.assign(userSetting, settings);
        userSetting.updatedAt = new Date().toISOString();

        res.json({
            message: 'Reminder settings updated successfully',
            settings: userSetting
        });

    } catch (error) {
        console.error('Error updating reminder settings:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST - Snooze reminder
router.post('/reminders/:reminderId/snooze', (req, res) => {
    try {
        const { reminderId } = req.params;
        const { duration } = req.body;

        const reminder = reminderHistory.find(r => r.id === reminderId);
        if (!reminder) {
            return res.status(404).json({ error: 'Reminder not found' });
        }

        const snoozedUntil = moment().add(duration || 15, 'minutes').toISOString();

        // Create snoozed reminder
        const snoozedReminder = {
            ...reminder,
            id: uuidv4(),
            originalReminderId: reminderId,
            snoozedUntil,
            status: 'snoozed'
        };

        reminderHistory.push(snoozedReminder);

        res.json({
            message: 'Reminder snoozed successfully',
            reminder: snoozedReminder,
            snoozedUntil
        });

    } catch (error) {
        console.error('Error snoozing reminder:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Utility Functions
function generateRemindersFromSchedule(schedule) {
    const reminders = [];
    const startDate = moment();
    
    // Generate reminders for next 7 days
    for (let i = 0; i < 7; i++) {
        const date = startDate.clone().add(i, 'days');
        const dayName = date.format('dddd').toLowerCase();

        if (schedule.days.includes(dayName)) {
            schedule.timing.forEach(time => {
                const reminderTime = moment(`${date.format('YYYY-MM-DD')} ${time}`);
                
                reminders.push({
                    id: uuidv4(),
                    userId: schedule.userId,
                    supplementId: schedule.id,
                    supplement: schedule.supplement,
                    dosage: schedule.dosage,
                    scheduledTime: reminderTime.toISOString(),
                    status: 'scheduled',
                    createdAt: new Date().toISOString()
                });
            });
        }
    }

    return reminders;
}

function getUpcomingReminders(userId) {
    const now = moment();
    return reminderHistory
        .filter(reminder => 
            reminder.userId === userId &&
            reminder.status === 'scheduled' &&
            moment(reminder.scheduledTime).isAfter(now)
        )
        .sort((a, b) => moment(a.scheduledTime) - moment(b.scheduledTime))
        .slice(0, 10); // Return next 10 reminders
}

function getRemindersForDate(userId, date) {
    const dateStr = date.format('YYYY-MM-DD');
    return reminderHistory.filter(reminder => 
        reminder.userId === userId &&
        moment(reminder.scheduledTime).format('YYYY-MM-DD') === dateStr
    ).sort((a, b) => moment(a.scheduledTime) - moment(b.scheduledTime));
}

function getNextScheduledTime(schedule) {
    const now = moment();
    const today = now.format('dddd').toLowerCase();
    
    if (schedule.days.includes(today)) {
        const futureTimes = schedule.timing
            .map(time => moment(`${now.format('YYYY-MM-DD')} ${time}`))
            .filter(time => time.isAfter(now))
            .sort((a, b) => a - b);
        
        if (futureTimes.length > 0) {
            return futureTimes[0].toISOString();
        }
    }

    // Find next available day and time
    for (let i = 1; i <= 7; i++) {
        const futureDate = now.clone().add(i, 'days');
        const futureDay = futureDate.format('dddd').toLowerCase();
        
        if (schedule.days.includes(futureDay)) {
            const time = schedule.timing[0]; // Use first time of the day
            return futureDate.clone().set({
                hour: moment(time, 'HH:mm').hour(),
                minute: moment(time, 'HH:mm').minute(),
                second: 0
            }).toISOString();
        }
    }

    return null;
}

function updateComplianceStats(userId, supplementId, taken) {
    // This would update compliance statistics in a real database
    console.log(`Updating compliance for user ${userId}, supplement ${supplementId}: ${taken}`);
}

function getComplianceStats(userId, supplementId) {
    const supplementLogs = reminderHistory.filter(log => 
        log.userId === userId && 
        log.supplementId === supplementId
    );

    const totalScheduled = supplementLogs.length;
    const totalTaken = supplementLogs.filter(log => log.taken).length;
    
    return {
        totalScheduled,
        totalTaken,
        complianceRate: totalScheduled > 0 ? Math.round((totalTaken / totalScheduled) * 100) : 0,
        streak: calculateCurrentStreak(supplementLogs)
    };
}

function calculateCurrentStreak(logs) {
    let streak = 0;
    const sortedLogs = logs.sort((a, b) => moment(b.scheduledTime) - moment(a.scheduledTime));
    
    for (const log of sortedLogs) {
        if (log.taken) {
            streak++;
        } else {
            break;
        }
    }
    
    return streak;
}

function getUserSettings(userId) {
    return userSettings.find(s => s.userId === userId) || {
        userId,
        notifications: true,
        reminderTimes: ['08:00', '13:00', '20:00'],
        snoozeDuration: 15
    };
}

function generateRemindersSummary(reminders) {
    const total = reminders.length;
    const taken = reminders.filter(r => r.taken).length;
    const missed = reminders.filter(r => !r.taken && moment(r.scheduledTime).isBefore(moment())).length;
    const upcoming = reminders.filter(r => !r.taken && moment(r.scheduledTime).isAfter(moment())).length;

    return {
        total,
        taken,
        missed,
        upcoming,
        completionRate: total > 0 ? Math.round((taken / total) * 100) : 0
    };
}

module.exports = router;