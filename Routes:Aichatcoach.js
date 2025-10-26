const express = require('express');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();

// In-memory storage for chat sessions
let chatSessions = [];
let conversationHistory = [];

// Knowledge base for AI responses
const KNOWLEDGE_BASE = {
    supplements: {
        'vitamin d': {
            benefits: ['Immune function', 'Bone health', 'Mood regulation'],
            dosage: '1000-4000 IU daily',
            timing: 'With meals for better absorption',
            sources: ['Sunlight', 'Fatty fish', 'Fortified foods'],
            interactions: ['Take with magnesium for better utilization']
        },
        'omega-3': {
            benefits: ['Heart health', 'Brain function', 'Reduced inflammation'],
            dosage: '1000-2000 mg daily',
            timing: 'With meals',
            sources: ['Fish oil', 'Algal oil', 'Flaxseeds'],
            interactions: ['May thin blood, consult if on blood thinners']
        },
        'magnesium': {
            benefits: ['Muscle function', 'Sleep quality', 'Stress reduction'],
            dosage: '200-400 mg daily',
            timing: 'Evening for better sleep',
            sources: ['Nuts', 'Seeds', 'Leafy greens', 'Dark chocolate'],
            interactions: ['Can cause loose stools at high doses']
        }
    },
    nutrition: {
        'weight loss': {
            approach: 'Calorie deficit with nutrient density',
            recommendations: ['Protein with each meal', 'Fiber-rich vegetables', 'Healthy fats', 'Limit processed foods'],
            timing: 'Regular meals every 3-4 hours',
            tips: ['Stay hydrated', 'Mindful eating', 'Adequate protein']
        },
        'muscle gain': {
            approach: 'Calorie surplus with strength training',
            recommendations: ['High protein intake', 'Complex carbohydrates', 'Adequate calories', 'Post-workout nutrition'],
            timing: 'Protein every 3-4 hours, carbs around workouts',
            tips: ['Progressive overload', 'Adequate rest', 'Consistent training']
        }
    },
    conditions: {
        'high blood pressure': {
            dietary: ['Reduce sodium', 'Increase potassium', 'Magnesium-rich foods', 'Omega-3 fats'],
            lifestyle: ['Regular exercise', 'Stress management', 'Weight management', 'Limit alcohol'],
            supplements: ['Magnesium', 'Omega-3', 'CoQ10', 'Garlic extract'],
            monitoring: ['Regular BP checks', 'Track sodium intake', 'Monitor progress']
        },
        'digestive issues': {
            dietary: ['Fiber gradually', 'Probiotic foods', 'Hydration', 'Identify triggers'],
            lifestyle: ['Stress reduction', 'Regular meals', 'Thorough chewing', 'Exercise'],
            supplements: ['Probiotics', 'Digestive enzymes', 'L-glutamine', 'Peppermint oil'],
            monitoring: ['Food diary', 'Symptom tracking', 'Progress evaluation']
        }
    }
};

// POST - Start new chat session
router.post('/sessions', (req, res) => {
    try {
        const { userId, context } = req.body;

        const session = {
            id: uuidv4(),
            userId,
            startedAt: new Date().toISOString(),
            context: context || {},
            status: 'active',
            messageCount: 0
        };

        chatSessions.push(session);

        // Generate welcome message
        const welcomeMessage = generateWelcomeMessage(context);

        res.status(201).json({
            message: 'Chat session started successfully',
            session,
            welcomeMessage
        });

    } catch (error) {
        console.error('Error starting chat session:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST - Send message to AI coach
router.post('/sessions/:sessionId/messages', (req, res) => {
    try {
        const { sessionId } = req.params;
        const { message, messageType = 'text' } = req.body;

        const session = chatSessions.find(s => s.id === sessionId);
        if (!session) {
            return res.status(404).json({ error: 'Chat session not found' });
        }

        // Process the message and generate AI response
        const aiResponse = processUserMessage(message, session);

        // Store conversation
        const conversationEntry = {
            id: uuidv4(),
            sessionId,
            userMessage: message,
            aiResponse,
            timestamp: new Date().toISOString()
        };

        conversationHistory.push(conversationEntry);
        session.messageCount += 1;

        res.json({
            message: 'Message processed successfully',
            response: aiResponse,
            session: {
                id: session.id,
                messageCount: session.messageCount
            }
        });

    } catch (error) {
        console.error('Error processing message:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET - Get chat history
router.get('/sessions/:sessionId/history', (req, res) => {
    try {
        const { sessionId } = req.params;

        const session = chatSessions.find(s => s.id === sessionId);
        if (!session) {
            return res.status(404).json({ error: 'Chat session not found' });
        }

        const history = conversationHistory.filter(entry => entry.sessionId === sessionId);

        res.json({
            session,
            history,
            totalMessages: history.length
        });

    } catch (error) {
        console.error('Error fetching chat history:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST - Analyze health data
router.post('/analyze', (req, res) => {
    try {
        const { healthData, goals, concerns } = req.body;

        const analysis = analyzeHealthData(healthData, goals, concerns);

        res.json({
            analysis,
            recommendations: generateActionableRecommendations(analysis),
            nextSteps: suggestNextSteps(analysis)
        });

    } catch (error) {
        console.error('Error analyzing health data:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET - Get quick answers
router.get('/qa/:topic', (req, res) => {
    try {
        const { topic } = req.params;
        const { subtopic } = req.query;

        const answer = getQuickAnswer(topic, subtopic);

        if (!answer) {
            return res.status(404).json({ error: 'Topic not found in knowledge base' });
        }

        res.json({
            topic,
            subtopic,
            answer,
            sources: ['Clinical studies', 'Nutritional guidelines', 'Expert consensus'],
            lastUpdated: new Date().toISOString()
        });

    } catch (error) {
        console.error('Error fetching quick answer:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Utility Functions
function generateWelcomeMessage(context) {
    let welcomeText = "Hello! I'm your AI Nutrition Coach. I'm here to help you with:\n\n";
    welcomeText += "• Personalized supplement recommendations\n";
    welcomeText += "• Nutrition and meal planning advice\n";
    welcomeText += "• Fitness and exercise guidance\n";
    welcomeText += "• Health data analysis and insights\n";
    welcomeText += "• Progress tracking and motivation\n\n";
    welcomeText += "What would you like to focus on today?";

    return {
        type: 'welcome',
        message: welcomeText,
        timestamp: new Date().toISOString(),
        suggestions: [
            "Analyze my health data",
            "Supplement recommendations",
            "Create a meal plan",
            "Fitness advice",
            "General health questions"
        ]
    };
}

function processUserMessage(message, session) {
    const lowerMessage = message.toLowerCase();
    let response = {
        type: 'response',
        message: '',
        suggestions: [],
        timestamp: new Date().toISOString(),
        confidence: 0.85
    };

    // Pattern matching for different types of queries
    if (lowerMessage.includes('supplement') || lowerMessage.includes('vitamin')) {
        response = handleSupplementQuery(lowerMessage, session);
    } else if (lowerMessage.includes('diet') || lowerMessage.includes('meal') || lowerMessage.includes('food')) {
        response = handleNutritionQuery(lowerMessage, session);
    } else if (lowerMessage.includes('exercise') || lowerMessage.includes('workout') || lowerMessage.includes('fitness')) {
        response = handleFitnessQuery(lowerMessage, session);
    } else if (lowerMessage.includes('analyze') || lowerMessage.includes('data')) {
        response = handleAnalysisQuery(lowerMessage, session);
    } else {
        response = handleGeneralQuery(lowerMessage, session);
    }

    return response;
}

function handleSupplementQuery(message, session) {
    let response = {
        type: 'supplement_advice',
        message: '',
        suggestions: [],
        timestamp: new Date().toISOString()
    };

    // Extract specific supplement from message
    const supplements = Object.keys(KNOWLEDGE_BASE.supplements);
    const mentionedSupplement = supplements.find(supp => message.includes(supp));
    
    if (mentionedSupplement) {
        const supplementInfo = KNOWLEDGE_BASE.supplements[mentionedSupplement];
        response.message = `Here's what I know about ${mentionedSupplement.toUpperCase()}:\n\n` +
            `**Benefits:** ${supplementInfo.benefits.join(', ')}\n` +
            `**Typical Dosage:** ${supplementInfo.dosage}\n` +
            `**Best Timing:** ${supplementInfo.timing}\n` +
            `**Food Sources:** ${supplementInfo.sources.join(', ')}\n` +
            `**Important Notes:** ${supplementInfo.interactions.join(' ')}\n\n` +
            `Would you like me to check if this fits your specific health profile?`;
        
        response.suggestions = [
            "Check compatibility with my profile",
            "Dosage recommendations for me",
            "Best brands to consider",
            "Potential side effects"
        ];
    } else {
        response.message = "I can help you with supplement advice! Based on general health principles, here are some key supplements many people benefit from:\n\n" +
            "• **Vitamin D3** - For immune and bone health\n" +
            "• **Omega-3** - For heart and brain health\n" +
            "• **Magnesium** - For sleep and stress\n" +
            "• **Probiotics** - For gut health\n\n" +
            "Which supplement would you like to know more about, or shall I analyze your specific needs?";
        
        response.suggestions = [
            "Vitamin D information",
            "Omega-3 benefits",
            "Magnesium for sleep",
            "Analyze my supplement needs"
        ];
    }

    return response;
}

function handleNutritionQuery(message, session) {
    let response = {
        type: 'nutrition_advice',
        message: '',
        suggestions: [],
        timestamp: new Date().toISOString()
    };

    if (message.includes('weight loss') || message.includes('lose weight')) {
        const plan = KNOWLEDGE_BASE.nutrition['weight loss'];
        response.message = `For weight loss, I recommend:\n\n` +
            `**Approach:** ${plan.approach}\n` +
            `**Key Strategies:** ${plan.recommendations.join(', ')}\n` +
            `**Meal Timing:** ${plan.timing}\n` +
            `**Pro Tips:** ${plan.tips.join(', ')}\n\n` +
            `Would you like a personalized meal plan?`;
        
        response.suggestions = [
            "Create meal plan",
            "Weight loss supplements",
            "Exercise recommendations",
            "Track progress"
        ];
    } else {
        response.message = "I can help you with various nutrition topics:\n\n" +
            "• **Weight Management** - Sustainable weight loss or gain\n" +
            "• **Meal Planning** - Balanced, nutritious meal ideas\n" +
            "• **Special Diets** - Vegetarian, gluten-free, etc.\n" +
            "• **Nutrient Timing** - When to eat for optimal results\n\n" +
            "What specific nutrition area interests you?";
        
        response.suggestions = [
            "Weight loss plan",
            "Muscle gain nutrition",
            "Healthy meal ideas",
            "Special diet guidance"
        ];
    }

    return response;
}

function handleFitnessQuery(message, session) {
    return {
        type: 'fitness_advice',
        message: "For fitness and exercise, I recommend a balanced approach:\n\n" +
            "• **Strength Training** - 2-3 times per week for muscle maintenance\n" +
            "• **Cardiovascular Exercise** - 150 minutes moderate or 75 minutes vigorous weekly\n" +
            "• **Flexibility & Mobility** - Daily stretching or yoga\n" +
            "• **Recovery** - Adequate sleep and rest days\n\n" +
            "The best exercise program depends on your goals, current fitness level, and available time. What are you looking to achieve?",
        suggestions: [
            "Beginner workout plan",
            "Home exercises",
            "Gym routine",
            "Recovery strategies"
        ],
        timestamp: new Date().toISOString()
    };
}

function handleAnalysisQuery(message, session) {
    return {
        type: 'analysis',
        message: "I can analyze various types of health data:\n\n" +
            "• **Blood tests** - Nutrient levels, metabolic markers\n" +
            "• **Wearable data** - Activity, sleep, heart rate\n" +
            "• **Body measurements** - Weight, BMI, body composition\n" +
            "• **Symptoms & concerns** - Energy, digestion, mood\n\n" +
            "Please share your health data, or let me know what specific analysis you need.",
        suggestions: [
            "Analyze blood test results",
            "Review wearable data",
            "Body composition analysis",
            "Symptom assessment"
        ],
        timestamp: new Date().toISOString()
    };
}

function handleGeneralQuery(message, session) {
    return {
        type: 'general',
        message: "I understand you're asking about: " + message + "\n\n" +
            "As your AI Nutrition Coach, I specialize in:\n" +
            "• Personalized supplement recommendations\n" +
            "• Evidence-based nutrition advice\n" +
            "• Fitness and exercise guidance\n" +
            "• Health data analysis\n" +
            "• Progress tracking and motivation\n\n" +
            "How can I specifically help you with your health and wellness goals today?",
        suggestions: [
            "Supplement advice",
            "Nutrition planning",
            "Fitness guidance",
            "Health analysis"
        ],
        timestamp: new Date().toISOString()
    };
}

function analyzeHealthData(healthData, goals, concerns) {
    const analysis = {
        overallHealthScore: calculateHealthScore(healthData),
        keyFindings: [],
        recommendations: [],
        riskFactors: [],
        opportunities: []
    };

    // Analyze biometrics
    if (healthData.biometrics) {
        if (healthData.biometrics.bmi > 25) {
            analysis.keyFindings.push("Elevated BMI suggests focus on weight management");
            analysis.recommendations.push("Consider calorie-controlled diet with regular exercise");
        }
        
        if (healthData.biometrics.bloodPressure === 'high') {
            analysis.keyFindings.push("Blood pressure monitoring recommended");
            analysis.recommendations.push("Reduce sodium intake, increase potassium-rich foods");
        }
    }

    // Analyze lifestyle
    if (healthData.lifestyle) {
        if (healthData.lifestyle.activityLevel === 'sedentary') {
            analysis.keyFindings.push("Low activity level detected");
            analysis.recommendations.push("Gradually increase daily movement and structured exercise");
        }
        
        if (healthData.lifestyle.sleep < 7) {
            analysis.keyFindings.push("Insufficient sleep may affect recovery and health");
            analysis.recommendations.push("Aim for 7-9 hours of quality sleep nightly");
        }
    }

    // Add goal-specific recommendations
    if (goals && goals.length > 0) {
        goals.forEach(goal => {
            analysis.opportunities.push(`Opportunity to work on: ${goal}`);
        });
    }

    return analysis;
}

function calculateHealthScore(healthData) {
    let score = 100;
    
    // Deduct points based on various factors
    if (healthData.biometrics?.bmi > 25) score -= 15;
    if (healthData.biometrics?.bloodPressure === 'high') score -= 10;
    if (healthData.lifestyle?.activityLevel === 'sedentary') score -= 10;
    if (healthData.lifestyle?.sleep < 7) score -= 8;
    if (healthData.lifestyle?.stress === 'high') score -= 7;
    
    return Math.max(0, score);
}

function generateActionableRecommendations(analysis) {
    const recommendations = [];
    
    analysis.keyFindings.forEach(finding => {
        if (finding.includes('BMI')) {
            recommendations.push({
                priority: 'high',
                action: 'Implement sustainable weight loss plan',
                timeline: '3-6 months',
                metrics: ['Weight', 'Waist circumference', 'Energy levels']
            });
        }
        
        if (finding.includes('Blood pressure')) {
            recommendations.push({
                priority: 'high',
                action: 'Blood pressure management strategy',
                timeline: 'Immediate',
                metrics: ['Blood pressure readings', 'Sodium intake']
            });
        }
    });
    
    return recommendations;
}

function getQuickAnswer(topic, subtopic) {
    const topicLower = topic.toLowerCase();
    
    if (KNOWLEDGE_BASE.supplements[topicLower]) {
        return KNOWLEDGE_BASE.supplements[topicLower];
    }
    
    if (KNOWLEDGE_BASE.nutrition[topicLower]) {
        return KNOWLEDGE_BASE.nutrition[topicLower];
    }
    
    if (KNOWLEDGE_BASE.conditions[topicLower]) {
        return KNOWLEDGE_BASE.conditions[topicLower];
    }
    
    return null;
}

module.exports = router;