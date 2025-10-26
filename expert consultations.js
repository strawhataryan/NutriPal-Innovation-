const express = require('express');
const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
const router = express.Router();

// In-memory storage
let experts = [];
let appointments = [];
let consultations = [];
let messages = [];

// Initialize with sample experts
function initializeExperts() {
    if (experts.length === 0) {
        experts = [
            {
                id: 'expert-1',
                name: 'Dr. Sarah Chen',
                specialization: 'Clinical Nutrition',
                credentials: ['RD', 'CDN', 'MS'],
                experience: '8 years',
                rating: 4.9,
                reviews: 127,
                availability: ['monday', 'tuesday', 'wednesday', 'thursday'],
                languages: ['English', 'Mandarin'],
                bio: 'Specialized in sports nutrition and weight management',
                image: '/images/experts/dr-chen.jpg',
                consultationFee: 99,
                nextAvailable: moment().add(2, 'days').toISOString()
            },
            {
                id: 'expert-2',
                name: 'Dr. Michael Rodriguez',
                specialization: 'Functional Medicine',
                credentials: ['MD', 'IFMCP'],
                experience: '12 years',
                rating: 4.8,
                reviews: 89,
                availability: ['tuesday', 'wednesday', 'friday', 'saturday'],
                languages: ['English', 'Spanish'],
                bio: 'Focus on root cause analysis and personalized treatment plans',
                image: '/images/experts/dr-rodriguez.jpg',
                consultationFee: 149,
                nextAvailable: moment().add(1, 'day').toISOString()
            },
            {
                id: 'expert-3',
                name: 'Emily Watson, RDN',
                specialization: 'Plant-Based Nutrition',
                credentials: ['RDN', 'LDN', 'CPT'],
                experience: '6 years',
                rating: 4.7,
                reviews: 64,
                availability: ['monday', 'wednesday', 'friday'],
                languages: ['English'],
                bio: 'Expert in vegan and vegetarian nutrition for optimal health',
                image: '/images/experts/emily-watson.jpg',
                consultationFee: 79,
                nextAvailable: moment().add(3, 'days').toISOString()
            }
        ];
    }
}

// GET - Get available experts
router.get('/experts', (req, res) => {
    try {
        initializeExperts();
        
        const { specialization, availability, maxFee } = req.query;
        
        let filteredExperts = [...experts];
        
        if (specialization) {
            filteredExperts = filteredExperts.filter(expert => 
                expert.specialization.toLowerCase().includes(specialization.toLowerCase())
            );
        }
        
        if (availability) {
            filteredExperts = filteredExperts.filter(expert =>
                expert.availability.includes(availability.toLowerCase())
            );
        }
        
        if (maxFee) {
            filteredExperts = filteredExperts.filter(expert =>
                expert.consultationFee <= parseInt(maxFee)
            );
        }

        res.json({
            experts: filteredExperts,
            total: filteredExperts.length,
            filters: {
                specialization,
                availability,
                maxFee
            }
        });

    } catch (error) {
        console.error('Error fetching experts:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET - Get expert details
router.get('/experts/:expertId', (req, res) => {
    try {
        const { expertId } = req.params;
        
        initializeExperts();
        const expert = experts.find(e => e.id === expertId);
        
        if (!expert) {
            return res.status(404).json({ error: 'Expert not found' });
        }

        // Get expert's available slots
        const availableSlots = generateAvailableSlots(expert);

        res.json({
            expert,
            availableSlots,
            reviews: getExpertReviews(expertId),
            similarExperts: getSimilarExperts(expertId)
        });

    } catch (error) {
        console.error('Error fetching expert details:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST - Book appointment
router.post('/appointments', (req, res) => {
    try {
        const { userId, expertId, slot, notes, healthData } = req.body;

        if (!userId || !expertId || !slot) {
            return res.status(400).json({
                error: 'Missing required fields: userId, expertId, slot'
            });
        }

        const expert = experts.find(e => e.id === expertId);
        if (!expert) {
            return res.status(404).json({ error: 'Expert not found' });
        }

        // Check if slot is available
        const conflictingAppointment = appointments.find(apt => 
            apt.expertId === expertId && 
            apt.slot === slot && 
            apt.status !== 'cancelled'
        );

        if (conflictingAppointment) {
            return res.status(400).json({ error: 'Selected slot is no longer available' });
        }

        const appointment = {
            id: uuidv4(),
            userId,
            expertId,
            expertName: expert.name,
            slot,
            duration: 60, // minutes
            status: 'confirmed',
            notes: notes || '',
            healthData: healthData || {},
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        appointments.push(appointment);

        // Create initial consultation record
        const consultation = {
            id: uuidv4(),
            appointmentId: appointment.id,
            userId,
            expertId,
            status: 'scheduled',
            type: 'initial',
            createdAt: new Date().toISOString()
        };

        consultations.push(consultation);

        res.status(201).json({
            message: 'Appointment booked successfully',
            appointment,
            consultation,
            nextSteps: [
                'Complete your health profile before the consultation',
                'Prepare any questions you want to discuss',
                'Join the video call 5 minutes early'
            ]
        });

    } catch (error) {
        console.error('Error booking appointment:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET - Get user appointments
router.get('/:userId/appointments', (req, res) => {
    try {
        const { userId } = req.params;
        const { status, upcoming } = req.query;

        let userAppointments = appointments.filter(apt => apt.userId === userId);

        if (status) {
            userAppointments = userAppointments.filter(apt => apt.status === status);
        }

        if (upcoming === 'true') {
            const now = new Date();
            userAppointments = userAppointments.filter(apt => 
                new Date(apt.slot) > now && apt.status === 'confirmed'
            );
        }

        // Sort by date
        userAppointments.sort((a, b) => new Date(a.slot) - new Date(b.slot));

        res.json({
            userId,
            appointments: userAppointments,
            total: userAppointments.length,
            upcoming: userAppointments.filter(apt => 
                new Date(apt.slot) > new Date() && apt.status === 'confirmed'
            ).length
        });

    } catch (error) {
        console.error('Error fetching appointments:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST - Send message to expert
router.post('/:userId/messages', (req, res) => {
    try {
        const { userId } = req.params;
        const { expertId, message, appointmentId } = req.body;

        if (!expertId || !message) {
            return res.status(400).json({
                error: 'Missing required fields: expertId, message'
            });
        }

        const messageObj = {
            id: uuidv4(),
            userId,
            expertId,
            appointmentId: appointmentId || null,
            message,
            direction: 'user_to_expert',
            timestamp: new Date().toISOString(),
            status: 'sent'
        };

        messages.push(messageObj);

        // Simulate expert response (in real app, this would be handled by the expert)
        setTimeout(() => {
            const expertResponse = {
                id: uuidv4(),
                userId,
                expertId,
                appointmentId: appointmentId || null,
                message: generateExpertResponse(message),
                direction: 'expert_to_user',
                timestamp: new Date().toISOString(),
                status: 'sent'
            };
            messages.push(expertResponse);
        }, 5000); // 5 second delay for simulation

        res.json({
            message: 'Message sent successfully',
            message: messageObj,
            expectedResponse: 'Expert typically responds within 24 hours'
        });

    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET - Get message history
router.get('/:userId/messages', (req, res) => {
    try {
        const { userId } = req.params;
        const { expertId, appointmentId } = req.query;

        let userMessages = messages.filter(msg => msg.userId === userId);

        if (expertId) {
            userMessages = userMessages.filter(msg => msg.expertId === expertId);
        }

        if (appointmentId) {
            userMessages = userMessages.filter(msg => msg.appointmentId === appointmentId);
        }

        // Sort by timestamp
        userMessages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

        res.json({
            userId,
            messages: userMessages,
            total: userMessages.length,
            unread: userMessages.filter(msg => 
                msg.direction === 'expert_to_user' && msg.status === 'sent'
            ).length
        });

    } catch (error) {
        console.error('Error fetching messages:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST - Cancel appointment
router.post('/appointments/:appointmentId/cancel', (req, res) => {
    try {
        const { appointmentId } = req.params;
        const { reason } = req.body;

        const appointment = appointments.find(apt => apt.id === appointmentId);
        if (!appointment) {
            return res.status(404).json({ error: 'Appointment not found' });
        }

        // Check if cancellation is allowed (e.g., not too close to appointment time)
        const appointmentTime = new Date(appointment.slot);
        const now = new Date();
        const hoursUntilAppointment = (appointmentTime - now) / (1000 * 60 * 60);

        if (hoursUntilAppointment < 24) {
            return res.status(400).json({
                error: 'Appointments can only be cancelled 24 hours in advance',
                cancellationPolicy: '24-hour cancellation policy applies'
            });
        }

        appointment.status = 'cancelled';
        appointment.cancellationReason = reason;
        appointment.updatedAt = new Date().toISOString();

        // Update related consultation
        const consultation = consultations.find(cons => cons.appointmentId === appointmentId);
        if (consultation) {
            consultation.status = 'cancelled';
        }

        res.json({
            message: 'Appointment cancelled successfully',
            appointment,
            refund: {
                eligible: true,
                amount: appointment.expert.consultationFee,
                processingTime: '5-7 business days'
            }
        });

    } catch (error) {
        console.error('Error cancelling appointment:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Utility Functions
function generateAvailableSlots(expert) {
    const slots = [];
    const startDate = moment().add(1, 'day'); // Start from tomorrow
    const endDate = moment().add(14, 'days'); // Two weeks ahead

    for (let date = startDate.clone(); date.isBefore(endDate); date.add(1, 'day')) {
        const dayName = date.format('dddd').toLowerCase();
        
        if (expert.availability.includes(dayName)) {
            // Generate time slots for this day
            const timeSlots = [
                '09:00', '10:00', '11:00', '14:00', '15:00', '16:00'
            ];

            timeSlots.forEach(time => {
                const slotDateTime = date.clone().set({
                    hour: parseInt(time.split(':')[0]),
                    minute: parseInt(time.split(':')[1]),
                    second: 0
                });

                // Check if slot is not booked
                const isBooked = appointments.some(apt => 
                    apt.expertId === expert.id &&
                    apt.slot === slotDateTime.toISOString() &&
                    apt.status !== 'cancelled'
                );

                if (!isBooked) {
                    slots.push({
                        datetime: slotDateTime.toISOString(),
                        display: slotDateTime.format('ddd, MMM D [at] h:mm A'),
                        available: true
                    });
                }
            });
        }
    }

    return slots.slice(0, 20); // Return first 20 available slots
}

function generateExpertResponse(userMessage) {
    const responses = [
        "Thank you for your message. I'd be happy to help you with that during our consultation.",
        "That's a great question. Let's discuss this in more detail during our scheduled appointment.",
        "I understand your concern. Based on what you've shared, I have some initial thoughts we can explore.",
        "I recommend bringing any recent lab results or health data to our consultation for comprehensive analysis.",
        "That's an important topic to address. I've helped many clients with similar situations successfully."
    ];

    return responses[Math.floor(Math.random() * responses.length)];
}

function getExpertReviews(expertId) {
    // Simulated reviews
    return [
        {
            id: 1,
            rating: 5,
            comment: 'Dr. Chen provided excellent guidance for my nutritional needs.',
            author: 'John D.',
            date: '2024-01-15'
        },
        {
            id: 2,
            rating: 4,
            comment: 'Very knowledgeable and took time to understand my specific situation.',
            author: 'Sarah M.',
            date: '2024-01-10'
        }
    ];
}

function getSimilarExperts(expertId) {
    const currentExpert = experts.find(e => e.id === expertId);
    if (!currentExpert) return [];

    return experts
        .filter(e => e.id !== expertId && e.specialization === currentExpert.specialization)
        .slice(0, 2);
}

module.exports = router;