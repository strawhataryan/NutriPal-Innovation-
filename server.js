const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');
const cron = require('node-cron');
const moment = require('moment');

const healthStreaksRoutes = require('./routes/healthStreaks');
const supplementRemindersRoutes = require('./routes/supplementReminders');
const supplementReportsRoutes = require('./routes/supplementReports');
const expertConsultationRoutes = require('./routes/expertConsultation');
const notificationsRoutes = require('./routes/notifications');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// Routes
app.use('/api/health-streaks', healthStreaksRoutes);
app.use('/api/supplement-reminders', supplementRemindersRoutes);
app.use('/api/supplement-reports', supplementReportsRoutes);
app.use('/api/expert-consultation', expertConsultationRoutes);
app.use('/api/notifications', notificationsRoutes);

// Serve frontend
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/health-streaks', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'health-streaks.html'));
});

app.get('/supplement-reminders', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'supplement-reminders.html'));
});

app.get('/supplement-reports', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'supplement-reports.html'));
});

app.get('/expert-consultation', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'expert-consultation.html'));
});

// Socket.io for real-time notifications
io.on('connection', (socket) => {
    console.log('User connected to motivation system:', socket.id);

    // Health streak updates
    socket.on('subscribeToStreaks', (userId) => {
        socket.join(`streaks-${userId}`);
        console.log(`User ${userId} subscribed to streak updates`);
    });

    // Supplement reminders
    socket.on('subscribeToReminders', (userId) => {
        socket.join(`reminders-${userId}`);
        console.log(`User ${userId} subscribed to reminder updates`);
    });

    // Real-time notification testing
    socket.on('testNotification', (data) => {
        socket.emit('notification', {
            type: 'test',
            title: 'Test Notification',
            message: 'This is a test notification from the server',
            timestamp: new Date().toISOString(),
            data: data
        });
    });

    socket.on('disconnect', () => {
        console.log('User disconnected from motivation system:', socket.id);
    });
});

// Cron jobs for automated reminders
cron.schedule('0 8 * * *', () => { // 8 AM daily
    console.log('Running morning supplement reminders...');
    // This would trigger morning supplement reminders
});

cron.schedule('0 12 * * *', () => { // 12 PM daily
    console.log('Running afternoon supplement reminders...');
    // This would trigger afternoon supplement reminders
});

cron.schedule('0 18 * * *', () => { // 6 PM daily
    console.log('Running evening supplement reminders...');
    // This would trigger evening supplement reminders
});

cron.schedule('0 9 * * 1', () => { // 9 AM every Monday
    console.log('Running weekly progress reports...');
    // This would generate weekly progress reports
});

// Start server
server.listen(PORT, () => {
    console.log(`NutriPal+ Motivation System running on port ${PORT}`);
    console.log(`Frontend: http://localhost:${PORT}`);
    console.log(`Health Streaks: http://localhost:${PORT}/health-streaks`);
    console.log(`Supplement Reminders: http://localhost:${PORT}/supplement-reminders`);
    console.log(`Supplement Reports: http://localhost:${PORT}/supplement-reports`);
    console.log(`Expert Consultation: http://localhost:${PORT}/expert-consultation`);
});