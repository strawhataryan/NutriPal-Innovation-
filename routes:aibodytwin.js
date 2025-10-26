const express = require('express');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();

// In-memory storage for AI Body Twin data
let bodyTwinProfiles = [];
let healthPredictions = [];
let supplementRecommendations = [];

// POST - Create AI Body Twin profile
router.post('/profiles', (req, res) => {
    try {
        const { userId, healthData, wearableData, goals } = req.body;

        if (!userId || !healthData) {
            return res.status(400).json({
                error: 'Missing required fields: userId, healthData'
            });
        }

        // Check if profile already exists
        const existingProfile = bodyTwinProfiles.find(profile => profile.userId === userId);
        if (existingProfile) {
            return res.json({
                message: 'Body Twin profile already exists',
                profile: existingProfile
            });
        }

        const bodyTwinProfile = {
            id: uuidv4(),
            userId,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            healthData: {
                personal: healthData.personal || {},
                biometrics: healthData.biometrics || {},
                lifestyle: healthData.lifestyle || {},
                medical: healthData.medical || {}
            },
            wearableData: wearableData || {},
            goals: goals || {},
            metabolicProfile: generateMetabolicProfile(healthData),
            nutrientAnalysis: generateNutrientAnalysis(healthData),
            predictions: generateInitialPredictions(healthData),
            status: 'active'
        };

        bodyTwinProfiles.push(bodyTwinProfile);

        // Generate initial recommendations
        const recommendations = generateSupplementRecommendations(bodyTwinProfile);
        supplementRecommendations.push(...recommendations);

        res.status(201).json({
            message: 'AI Body Twin profile created successfully',
            profile: bodyTwinProfile,
            initialRecommendations: recommendations
        });

    } catch (error) {
        console.error('Error creating body twin profile:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET - Get body twin profile
router.get('/profiles/:userId', (req, res) => {
    try {
        const { userId } = req.params;

        const profile = bodyTwinProfiles.find(p => p.userId === userId);
        if (!profile) {
            return res.status(404).json({ error: 'Body Twin profile not found' });
        }

        // Get latest predictions and recommendations
        const latestPredictions = healthPredictions
            .filter(p => p.userId === userId)
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];

        const latestRecommendations = supplementRecommendations
            .filter(r => r.userId === userId && r.status === 'active');

        res.json({
            profile,
            latestPredictions,
            recommendations: latestRecommendations,
            insights: generateHealthInsights(profile)
        });

    } catch (error) {
        console.error('Error fetching body twin profile:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST - Update body twin with new data
router.post('/profiles/:userId/update', (req, res) => {
    try {
        const { userId } = req.params;
        const { newData, dataType } = req.body;

        const profile = bodyTwinProfiles.find(p => p.userId === userId);
        if (!profile) {
            return res.status(404).json({ error: 'Body Twin profile not found' });
        }

        // Update profile data
        if (dataType === 'health') {
            profile.healthData = { ...profile.healthData, ...newData };
        } else if (dataType === 'wearable') {
            profile.wearableData = { ...profile.wearableData, ...newData };
        } else if (dataType === 'goals') {
            profile.goals = { ...profile.goals, ...newData };
        }

        profile.updatedAt = new Date().toISOString();

        // Recalculate predictions
        const updatedPredictions = updatePredictions(profile);
        healthPredictions.push(updatedPredictions);

        // Update recommendations
        const updatedRecommendations = updateSupplementRecommendations(profile);
        supplementRecommendations.push(...updatedRecommendations);

        res.json({
            message: 'Body Twin updated successfully',
            profile,
            newPredictions: updatedPredictions,
            updatedRecommendations
        });

    } catch (error) {
        console.error('Error updating body twin:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST - Generate supplement predictions
router.post('/predictions/supplements', (req, res) => {
    try {
        const { userId, timeframe = '3months' } = req.body;

        const profile = bodyTwinProfiles.find(p => p.userId === userId);
        if (!profile) {
            return res.status(404).json({ error: 'Body Twin profile not found' });
        }

        const predictions = generateSupplementPredictions(profile, timeframe);

        res.json({
            userId,
            timeframe,
            predictions,
            generatedAt: new Date().toISOString(),
            confidence: calculatePredictionConfidence(profile)
        });

    } catch (error) {
        console.error('Error generating supplement predictions:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST - Disease risk assessment
router.post('/predictions/disease-risk', (req, res) => {
    try {
        const { userId } = req.body;

        const profile = bodyTwinProfiles.find(p => p.userId === userId);
        if (!profile) {
            return res.status(404).json({ error: 'Body Twin profile not found' });
        }

        const riskAssessment = generateDiseaseRiskAssessment(profile);

        res.json({
            userId,
            assessment: riskAssessment,
            generatedAt: new Date().toISOString(),
            recommendations: generatePreventionRecommendations(riskAssessment)
        });

    } catch (error) {
        console.error('Error generating disease risk assessment:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST - Progress projection
router.post('/predictions/progress', (req, res) => {
    try {
        const { userId, goals, timeframe = '12weeks' } = req.body;

        const profile = bodyTwinProfiles.find(p => p.userId === userId);
        if (!profile) {
            return res.status(404).json({ error: 'Body Twin profile not found' });
        }

        const projection = generateProgressProjection(profile, goals, timeframe);

        res.json({
            userId,
            timeframe,
            projection,
            assumptions: getProgressAssumptions(profile, goals),
            confidence: calculateProgressConfidence(profile, goals)
        });

    } catch (error) {
        console.error('Error generating progress projection:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET - Health insights
router.get('/insights/:userId', (req, res) => {
    try {
        const { userId } = req.params;

        const profile = bodyTwinProfiles.find(p => p.userId === userId);
        if (!profile) {
            return res.status(404).json({ error: 'Body Twin profile not found' });
        }

        const insights = generateHealthInsights(profile);

        res.json({
            userId,
            insights,
            generatedAt: new Date().toISOString(),
            priority: insights.filter(insight => insight.priority === 'high')
        });

    } catch (error) {
        console.error('Error generating health insights:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Utility Functions
function generateMetabolicProfile(healthData) {
    const bmi = healthData.biometrics?.bmi || 22;
    const activity = healthData.lifestyle?.activityLevel || 'moderate';
    
    let metabolicType = 'balanced';
    let metabolicRate = 'normal';
    
    if (bmi > 25 && activity === 'sedentary') {
        metabolicType = 'slow';
        metabolicRate = 'low';
    } else if (bmi < 18.5) {
        metabolicType = 'fast';
        metabolicRate = 'high';
    }

    return {
        type: metabolicType,
        rate: metabolicRate,
        score: calculateMetabolicScore(healthData),
        factors: ['BMI', 'Activity Level', 'Age', 'Body Composition']
    };
}

function generateNutrientAnalysis(healthData) {
    const deficiencies = [];
    const optimal = ['Vitamin B12', 'Iron'];
    
    // Simulate nutrient analysis based on health data
    if (healthData.lifestyle?.diet === 'vegetarian') {
        deficiencies.push('Vitamin B12', 'Iron');
    }
    if (healthData.biometrics?.sunExposure === 'low') {
        deficiencies.push('Vitamin D');
    }
    if (healthData.lifestyle?.stress === 'high') {
        deficiencies.push('Magnesium');
    }

    return {
        deficiencies,
        optimal,
        needsAttention: deficiencies.length > 0,
        recommendations: generateNutrientRecommendations(deficiencies)
    };
}

function generateSupplementPredictions(profile, timeframe) {
    const baseSupplements = [
        {
            name: 'Vitamin D3',
            predictedEffectiveness: 85,
            timeline: '4-6 weeks',
            expectedBenefits: ['Immune support', 'Bone health', 'Mood improvement'],
            dosage: '2000 IU',
            rationale: 'Based on limited sun exposure and current levels'
        },
        {
            name: 'Omega-3',
            predictedEffectiveness: 78,
            timeline: '8-12 weeks',
            expectedBenefits: ['Reduced inflammation', 'Brain health', 'Heart support'],
            dosage: '1000 mg',
            rationale: 'General health maintenance and inflammation control'
        }
    ];

    // Add personalized supplements based on profile
    if (profile.healthData.lifestyle?.stress === 'high') {
        baseSupplements.push({
            name: 'Ashwagandha',
            predictedEffectiveness: 72,
            timeline: '2-4 weeks',
            expectedBenefits: ['Stress reduction', 'Better sleep', 'Improved focus'],
            dosage: '500 mg',
            rationale: 'Stress management and adrenal support'
        });
    }

    if (profile.nutrientAnalysis.deficiencies.includes('Magnesium')) {
        baseSupplements.push({
            name: 'Magnesium Glycinate',
            predictedEffectiveness: 80,
            timeline: '2-3 weeks',
            expectedBenefits: ['Better sleep', 'Muscle relaxation', 'Stress relief'],
            dosage: '400 mg',
            rationale: 'Addressing deficiency and supporting nervous system'
        });
    }

    return baseSupplements;
}

function generateDiseaseRiskAssessment(profile) {
    const risks = [];
    const healthData = profile.healthData;

    // Diabetes risk
    if (healthData.biometrics?.bmi > 25 && healthData.biometrics?.bloodSugar > 100) {
        risks.push({
            condition: 'Type 2 Diabetes',
            riskLevel: 'moderate',
            probability: 35,
            timeframe: '5-10 years',
            factors: ['Elevated BMI', 'Blood sugar levels', 'Family history'],
            prevention: ['Weight management', 'Diet modification', 'Regular exercise']
        });
    }

    // Cardiovascular risk
    if (healthData.biometrics?.bloodPressure === 'high' || healthData.biometrics?.cholesterol === 'high') {
        risks.push({
            condition: 'Cardiovascular Disease',
            riskLevel: 'elevated',
            probability: 42,
            timeframe: '3-7 years',
            factors: ['Blood pressure', 'Cholesterol', 'Stress levels'],
            prevention: ['BP management', 'Diet changes', 'Stress reduction']
        });
    }

    // Osteoporosis risk
    if (healthData.biometrics?.age > 50 && profile.nutrientAnalysis.deficiencies.includes('Vitamin D')) {
        risks.push({
            condition: 'Osteoporosis',
            riskLevel: 'moderate',
            probability: 28,
            timeframe: '10-15 years',
            factors: ['Age', 'Vitamin D deficiency', 'Calcium intake'],
            prevention: ['Weight-bearing exercise', 'Calcium & Vitamin D', 'Bone density monitoring']
        });
    }

    return risks;
}

function generateProgressProjection(profile, goals, timeframe) {
    const currentMetrics = {
        weight: profile.healthData.biometrics?.weight || 70,
        energy: 65,
        sleep: 70,
        mood: 72,
        fitness: 60
    };

    const projections = {
        current: currentMetrics,
        milestones: []
    };

    // Generate projections based on goals and timeframe
    if (timeframe === '12weeks') {
        projections.week4 = {
            weight: currentMetrics.weight - 2,
            energy: 75,
            sleep: 78,
            mood: 79,
            fitness: 68
        };
        projections.week8 = {
            weight: currentMetrics.weight - 4,
            energy: 82,
            sleep: 85,
            mood: 84,
            fitness: 75
        };
        projections.week12 = {
            weight: currentMetrics.weight - 6,
            energy: 88,
            sleep: 90,
            mood: 89,
            fitness: 82
        };

        projections.milestones = [
            'Week 2: Initial energy improvement',
            'Week 6: Better sleep patterns',
            'Week 10: Consistent mood elevation',
            'Week 12: Sustainable habit formation'
        ];
    }

    return projections;
}

function generateHealthInsights(profile) {
    const insights = [];

    if (profile.nutrientAnalysis.deficiencies.length > 0) {
        insights.push({
            type: 'nutrient',
            priority: 'high',
            message: `Address ${profile.nutrientAnalysis.deficiencies.length} nutrient deficiencies`,
            recommendation: 'Consider targeted supplementation',
            impact: 'High'
        });
    }

    if (profile.healthData.biometrics?.bmi > 25) {
        insights.push({
            type: 'weight',
            priority: 'medium',
            message: 'Weight management could improve metabolic health',
            recommendation: 'Focus on sustainable weight loss strategies',
            impact: 'Medium'
        });
    }

    if (profile.healthData.lifestyle?.stress === 'high') {
        insights.push({
            type: 'lifestyle',
            priority: 'high',
            message: 'High stress levels affecting overall health',
            recommendation: 'Implement stress management techniques',
            impact: 'High'
        });
    }

    return insights;
}

// Additional helper functions
function calculateMetabolicScore(healthData) {
    let score = 75; // Base score
    
    // Adjust based on various factors
    if (healthData.biometrics?.bmi > 25) score -= 10;
    if (healthData.lifestyle?.activityLevel === 'active') score += 15;
    if (healthData.lifestyle?.sleep >= 7) score += 10;
    if (healthData.lifestyle?.stress === 'high') score -= 8;
    
    return Math.max(0, Math.min(100, score));
}

function generateNutrientRecommendations(deficiencies) {
    const recommendations = [];
    
    deficiencies.forEach(deficiency => {
        switch(deficiency) {
            case 'Vitamin D':
                recommendations.push('Increase sun exposure or supplement with Vitamin D3');
                break;
            case 'Magnesium':
                recommendations.push('Add magnesium-rich foods or consider supplementation');
                break;
            case 'Iron':
                recommendations.push('Include iron-rich foods and pair with Vitamin C for absorption');
                break;
            case 'Vitamin B12':
                recommendations.push('Consider B12 supplementation, especially if vegetarian');
                break;
        }
    });
    
    return recommendations;
}

function calculatePredictionConfidence(profile) {
    // Calculate confidence based on data completeness and quality
    let confidence = 70; // Base confidence
    
    if (profile.healthData.biometrics) confidence += 10;
    if (profile.wearableData) confidence += 10;
    if (profile.healthData.lifestyle) confidence += 5;
    
    return Math.min(95, confidence);
}

module.exports = router;