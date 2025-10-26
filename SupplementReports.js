const express = require('express');
const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
const router = express.Router();

// In-memory storage
let supplementReports = [];
let analyticsData = [];

// GET - Get supplement report
router.get('/:userId/reports', (req, res) => {
    try {
        const { userId } = req.params;
        const { period = '30d', type = 'compliance' } = req.query;

        const report = generateSupplementReport(userId, period, type);

        res.json({
            userId,
            period,
            type,
            report,
            generatedAt: new Date().toISOString(),
            summary: generateReportSummary(report)
        });

    } catch (error) {
        console.error('Error generating supplement report:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET - Get compliance analytics
router.get('/:userId/analytics', (req, res) => {
    try {
        const { userId } = req.params;
        const { startDate, endDate } = req.query;

        const analytics = generateComplianceAnalytics(userId, startDate, endDate);

        res.json({
            userId,
            period: {
                start: startDate || moment().subtract(30, 'days').format('YYYY-MM-DD'),
                end: endDate || moment().format('YYYY-MM-DD')
            },
            analytics,
            insights: generateAnalyticsInsights(analytics)
        });

    } catch (error) {
        console.error('Error generating analytics:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST - Generate custom report
router.post('/:userId/custom-report', (req, res) => {
    try {
        const { userId } = req.params;
        const { metrics, timeframe, comparison } = req.body;

        const customReport = generateCustomReport(userId, metrics, timeframe, comparison);

        // Store the generated report
        const report = {
            id: uuidv4(),
            userId,
            type: 'custom',
            metrics,
            timeframe,
            data: customReport,
            generatedAt: new Date().toISOString()
        };

        supplementReports.push(report);

        res.json({
            message: 'Custom report generated successfully',
            report,
            downloadUrl: `/api/supplement-reports/download/${report.id}`
        });

    } catch (error) {
        console.error('Error generating custom report:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET - Download report
router.get('/download/:reportId', (req, res) => {
    try {
        const { reportId } = req.params;

        const report = supplementReports.find(r => r.id === reportId);
        if (!report) {
            return res.status(404).json({ error: 'Report not found' });
        }

        // Generate downloadable content (simplified)
        const downloadContent = generateDownloadableContent(report);

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename=supplement-report-${reportId}.json`);
        res.send(JSON.stringify(downloadContent, null, 2));

    } catch (error) {
        console.error('Error downloading report:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET - Get trends and patterns
router.get('/:userId/trends', (req, res) => {
    try {
        const { userId } = req.params;
        const { supplementId } = req.query;

        const trends = analyzeSupplementTrends(userId, supplementId);

        res.json({
            userId,
            supplementId,
            trends,
            patterns: identifyPatterns(trends),
            recommendations: generateTrendRecommendations(trends)
        });

    } catch (error) {
        console.error('Error analyzing trends:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Utility Functions
function generateSupplementReport(userId, period, type) {
    const endDate = moment();
    const startDate = getStartDate(period, endDate);
    
    // Get supplement logs for the period
    const supplementLogs = getSupplementLogsForPeriod(userId, startDate, endDate);
    
    switch (type) {
        case 'compliance':
            return generateComplianceReport(supplementLogs, startDate, endDate);
        case 'effectiveness':
            return generateEffectivenessReport(userId, supplementLogs, startDate, endDate);
        case 'timing':
            return generateTimingReport(supplementLogs);
        default:
            return generateComprehensiveReport(userId, supplementLogs, startDate, endDate);
    }
}

function generateComplianceReport(logs, startDate, endDate) {
    const supplements = [...new Set(logs.map(log => log.supplement))];
    
    const complianceBySupplement = supplements.map(supplement => {
        const supplementLogs = logs.filter(log => log.supplement === supplement);
        const totalScheduled = supplementLogs.length;
        const totalTaken = supplementLogs.filter(log => log.taken).length;
        const complianceRate = totalScheduled > 0 ? (totalTaken / totalScheduled) * 100 : 0;

        return {
            supplement,
            totalScheduled,
            totalTaken,
            complianceRate: Math.round(complianceRate),
            currentStreak: calculateCurrentStreak(supplementLogs),
            bestStreak: calculateBestStreak(supplementLogs),
            missedDays: getMissedDays(supplementLogs, startDate, endDate)
        };
    });

    const overallCompliance = {
        totalScheduled: logs.length,
        totalTaken: logs.filter(log => log.taken).length,
        overallRate: logs.length > 0 ? Math.round((logs.filter(log => log.taken).length / logs.length) * 100) : 0,
        averageStreak: Math.round(complianceBySupplement.reduce((sum, s) => sum + s.currentStreak, 0) / complianceBySupplement.length)
    };

    return {
        type: 'compliance',
        period: {
            start: startDate.format('YYYY-MM-DD'),
            end: endDate.format('YYYY-MM-DD'),
            days: endDate.diff(startDate, 'days') + 1
        },
        overall: overallCompliance,
        bySupplement: complianceBySupplement,
        dailyBreakdown: getDailyComplianceBreakdown(logs, startDate, endDate)
    };
}

function generateEffectivenessReport(userId, logs, startDate, endDate) {
    // This would integrate with health data to measure effectiveness
    // For now, we'll provide a simulated report
    
    const effectivenessData = logs
        .filter(log => log.taken)
        .map(log => ({
            date: moment(log.takenAt).format('YYYY-MM-DD'),
            supplement: log.supplement,
            perceivedEffectiveness: Math.floor(Math.random() * 40) + 60, // Simulated 60-100%
            energyLevel: Math.floor(Math.random() * 3) + 3, // 3-5 scale
            sleepQuality: Math.floor(Math.random() * 3) + 3, // 3-5 scale
            notes: log.notes
        }));

    return {
        type: 'effectiveness',
        period: {
            start: startDate.format('YYYY-MM-DD'),
            end: endDate.format('YYYY-MM-DD')
        },
        effectivenessBySupplement: calculateEffectivenessBySupplement(effectivenessData),
        correlationAnalysis: performCorrelationAnalysis(effectivenessData),
        userFeedback: extractUserFeedback(logs)
    };
}

function generateTimingReport(logs) {
    const takenLogs = logs.filter(log => log.taken && log.takenAt);
    
    const timingAnalysis = takenLogs.map(log => ({
        supplement: log.supplement,
        scheduledTime: moment(log.scheduledTime).format('HH:mm'),
        actualTime: moment(log.takenAt).format('HH:mm'),
        delayMinutes: moment(log.takenAt).diff(moment(log.scheduledTime), 'minutes'),
        dayOfWeek: moment(log.takenAt).format('dddd')
    }));

    const averageDelays = timingAnalysis.reduce((acc, analysis) => {
        if (!acc[analysis.supplement]) {
            acc[analysis.supplement] = { totalDelay: 0, count: 0 };
        }
        acc[analysis.supplement].totalDelay += Math.max(0, analysis.delayMinutes);
        acc[analysis.supplement].count += 1;
        return acc;
    }, {});

    Object.keys(averageDelays).forEach(supplement => {
        averageDelays[supplement].averageDelay = Math.round(
            averageDelays[supplement].totalDelay / averageDelays[supplement].count
        );
    });

    return {
        type: 'timing',
        timingAnalysis,
        averageDelays,
        bestTimeSlots: identifyBestTimeSlots(timingAnalysis),
        recommendations: generateTimingRecommendations(averageDelays)
    };
}

function generateComprehensiveReport(userId, logs, startDate, endDate) {
    const complianceReport = generateComplianceReport(logs, startDate, endDate);
    const effectivenessReport = generateEffectivenessReport(userId, logs, startDate, endDate);
    const timingReport = generateTimingReport(logs);

    return {
        type: 'comprehensive',
        period: {
            start: startDate.format('YYYY-MM-DD'),
            end: endDate.format('YYYY-MM-DD')
        },
        executiveSummary: generateExecutiveSummary(complianceReport, effectivenessReport),
        compliance: complianceReport,
        effectiveness: effectivenessReport,
        timing: timingReport,
        keyInsights: generateKeyInsights(complianceReport, effectivenessReport, timingReport),
        actionItems: generateActionItems(complianceReport, effectivenessReport, timingReport)
    };
}

function generateComplianceAnalytics(userId, startDate, endDate) {
    const start = startDate ? moment(startDate) : moment().subtract(30, 'days');
    const end = endDate ? moment(endDate) : moment();
    
    const logs = getSupplementLogsForPeriod(userId, start, end);
    
    // Weekly compliance trends
    const weeklyTrends = [];
    let currentWeek = start.clone().startOf('week');
    
    while (currentWeek.isBefore(end)) {
        const weekEnd = currentWeek.clone().endOf('week');
        const weekLogs = logs.filter(log => 
            moment(log.scheduledTime).isBetween(currentWeek, weekEnd, null, '[]')
        );
        
        const weekCompliance = weekLogs.length > 0 ? 
            (weekLogs.filter(log => log.taken).length / weekLogs.length) * 100 : 0;
        
        weeklyTrends.push({
            week: currentWeek.format('YYYY-MM-DD'),
            complianceRate: Math.round(weekCompliance),
            totalLogs: weekLogs.length,
            takenLogs: weekLogs.filter(log => log.taken).length
        });
        
        currentWeek.add(1, 'week');
    }

    // Supplement-specific analytics
    const supplements = [...new Set(logs.map(log => log.supplement))];
    const supplementAnalytics = supplements.map(supplement => {
        const supplementLogs = logs.filter(log => log.supplement === supplement);
        return analyzeSupplementPerformance(supplement, supplementLogs, start, end);
    });

    return {
        weeklyTrends,
        supplementAnalytics,
        overallMetrics: calculateOverallMetrics(logs),
        improvementAreas: identifyImprovementAreas(weeklyTrends, supplementAnalytics)
    };
}

// Helper functions
function getStartDate(period, endDate) {
    const periods = {
        '7d': () => endDate.clone().subtract(7, 'days'),
        '30d': () => endDate.clone().subtract(30, 'days'),
        '90d': () => endDate.clone().subtract(90, 'days'),
        '1y': () => endDate.clone().subtract(1, 'year')
    };
    
    return periods[period] ? periods[period]() : endDate.clone().subtract(30, 'days');
}

function getSupplementLogsForPeriod(userId, startDate, endDate) {
    // This would query the actual database
    // For now, return empty array as this is a simulation
    return [];
}

function calculateCurrentStreak(logs) {
    // Implementation from previous module
    return 0;
}

function calculateBestStreak(logs) {
    // Implementation for best streak calculation
    return 0;
}

// Additional helper functions would be implemented here...

module.exports = router;