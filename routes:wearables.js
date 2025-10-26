const express = require('express');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();

// In-memory storage for wearable data
let wearableData = [];
let connectedDevices = [];

// Supported wearable devices
const SUPPORTED_DEVICES = {
    'apple-watch': {
        name: 'Apple Watch',
        metrics: ['heartRate', 'bloodOxygen', 'ecg', 'steps', 'calories', 'sleep']
    },
    'fitbit': {
        name: 'Fitbit',
        metrics: ['heartRate', 'steps', 'calories', 'sleepQuality', 'floors']
    },
    'samsung-health': {
        name: 'Samsung Health',
        metrics: ['heartRate', 'steps', 'calories', 'stressLevel', 'bloodGlucose']
    },
    'generic': {
        name: 'Generic Fitness Tracker',
        metrics: ['heartRate', 'steps', 'calories', 'activityType']
    }
};

// POST - Connect wearable device
router.post('/connect', (req, res) => {
    try {
        const { deviceType, deviceName, userId } = req.body;

        if (!SUPPORTED_DEVICES[deviceType]) {
            return res.status(400).json({
                error: 'Unsupported device type',
                supportedDevices: Object.keys(SUPPORTED_DEVICES)
            });
        }

        const device = {
            id: uuidv4(),
            deviceType,
            deviceName: deviceName || SUPPORTED_DEVICES[deviceType].name,
            userId: userId || 'anonymous',
            connectedAt: new Date().toISOString(),
            status: 'connected',
            lastSync: new Date().toISOString()
        };

        connectedDevices.push(device);

        res.json({
            message: 'Device connected successfully',
            device,
            availableMetrics: SUPPORTED_DEVICES[deviceType].metrics
        });

    } catch (error) {
        console.error('Error connecting device:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST - Sync wearable data
router.post('/sync', (req, res) => {
    try {
        const { deviceId, data } = req.body;

        const device = connectedDevices.find(d => d.id === deviceId);
        if (!device) {
            return res.status(404).json({ error: 'Device not found or disconnected' });
        }

        // Validate data structure
        const requiredFields = ['heartRate', 'timestamp'];
        const missingFields = requiredFields.filter(field => !data[field]);
        
        if (missingFields.length > 0) {
            return res.status(400).json({
                error: `Missing required fields: ${missingFields.join(', ')}`
            });
        }

        // Process and store data
        const wearableRecord = {
            id: uuidv4(),
            deviceId,
            timestamp: data.timestamp,
            data: {
                heartRate: data.heartRate,
                steps: data.steps || 0,
                calories: data.calories || 0,
                bloodOxygen: data.bloodOxygen,
                bloodPressure: data.bloodPressure,
                bloodGlucose: data.bloodGlucose,
                sleep: data.sleep,
                stressLevel: data.stressLevel,
                activityType: data.activityType,
                ecg: data.ecg
            },
            processed: false
        };

        wearableData.push(wearableRecord);

        // Update device last sync
        device.lastSync = new Date().toISOString();

        // Process health insights
        const insights = processHealthInsights(wearableRecord);

        res.json({
            message: 'Data synced successfully',
            recordId: wearableRecord.id,
            insights,
            nextSync: new Date(Date.now() + 5 * 60 * 1000).toISOString() // 5 minutes later
        });

    } catch (error) {
        console.error('Error syncing data:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET - Get wearable data for user
router.get('/data/:userId', (req, res) => {
    try {
        const { userId } = req.params;
        const { startDate, endDate, metric } = req.query;

        let userData = wearableData.filter(record => {
            const device = connectedDevices.find(d => d.id === record.deviceId);
            return device && device.userId === userId;
        });

        // Filter by date range
        if (startDate) {
            userData = userData.filter(record => new Date(record.timestamp) >= new Date(startDate));
        }
        if (endDate) {
            userData = userData.filter(record => new Date(record.timestamp) <= new Date(endDate));
        }

        // Filter by specific metric
        if (metric) {
            userData = userData.map(record => ({
                ...record,
                data: { [metric]: record.data[metric] }
            }));
        }

        // Calculate statistics
        const stats = calculateHealthStatistics(userData);

        res.json({
            userId,
            totalRecords: userData.length,
            timeRange: {
                start: startDate || 'all',
                end: endDate || 'all'
            },
            statistics: stats,
            data: userData.slice(-50) // Return last 50 records
        });

    } catch (error) {
        console.error('Error fetching wearable data:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET - Get connected devices
router.get('/devices/:userId', (req, res) => {
    try {
        const { userId } = req.params;
        const userDevices = connectedDevices.filter(device => device.userId === userId);

        res.json({
            userId,
            connectedDevices: userDevices,
            totalConnected: userDevices.length
        });

    } catch (error) {
        console.error('Error fetching devices:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// DELETE - Disconnect device
router.delete('/disconnect/:deviceId', (req, res) => {
    try {
        const { deviceId } = req.params;
        const index = connectedDevices.findIndex(d => d.id === deviceId);

        if (index === -1) {
            return res.status(404).json({ error: 'Device not found' });
        }

        connectedDevices.splice(index, 1);

        res.json({ message: 'Device disconnected successfully' });

    } catch (error) {
        console.error('Error disconnecting device:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET - Supported devices
router.get('/supported-devices', (req, res) => {
    res.json({
        supportedDevices: SUPPORTED_DEVICES,
        totalSupported: Object.keys(SUPPORTED_DEVICES).length
    });
});

// Process health insights from wearable data
function processHealthInsights(wearableRecord) {
    const insights = [];
    const data = wearableRecord.data;

    // Heart rate insights
    if (data.heartRate) {
        if (data.heartRate > 100) {
            insights.push({
                type: 'warning',
                metric: 'heartRate',
                message: 'Elevated heart rate detected',
                recommendation: 'Consider resting and deep breathing exercises'
            });
        } else if (data.heartRate < 60) {
            insights.push({
                type: 'info',
                metric: 'heartRate',
                message: 'Low resting heart rate',
                recommendation: 'Athletic heart rate range detected'
            });
        }
    }

    // Blood oxygen insights
    if (data.bloodOxygen && data.bloodOxygen < 95) {
        insights.push({
            type: 'warning',
            metric: 'bloodOxygen',
            message: 'Low blood oxygen level',
            recommendation: 'Consult healthcare provider if persistent'
        });
    }

    // Activity insights
    if (data.steps && data.steps < 1000) {
        insights.push({
            type: 'info',
            metric: 'activity',
            message: 'Low activity level',
            recommendation: 'Try to reach 10,000 steps daily'
        });
    }

    return insights;
}

// Calculate health statistics
function calculateHealthStatistics(data) {
    if (data.length === 0) return {};

    const stats = {
        heartRate: { min: Infinity, max: -Infinity, avg: 0 },
        steps: { total: 0, avg: 0 },
        calories: { total: 0, avg: 0 }
    };

    let heartRateSum = 0;
    let stepsSum = 0;
    let caloriesSum = 0;
    let heartRateCount = 0;

    data.forEach(record => {
        const hr = record.data.heartRate;
        if (hr) {
            stats.heartRate.min = Math.min(stats.heartRate.min, hr);
            stats.heartRate.max = Math.max(stats.heartRate.max, hr);
            heartRateSum += hr;
            heartRateCount++;
        }

        const steps = record.data.steps || 0;
        stats.steps.total += steps;
        stepsSum += steps;

        const calories = record.data.calories || 0;
        stats.calories.total += calories;
        caloriesSum += calories;
    });

    if (heartRateCount > 0) {
        stats.heartRate.avg = Math.round(heartRateSum / heartRateCount);
    }
    if (data.length > 0) {
        stats.steps.avg = Math.round(stepsSum / data.length);
        stats.calories.avg = Math.round(caloriesSum / data.length);
    }

    return stats;
}

module.exports = router;