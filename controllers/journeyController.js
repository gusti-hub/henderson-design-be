// controllers/journeyController.js
// Complete Journey Controller untuk Backend

const Journey = require('../models/Journey');
const User = require('../models/User');

// Import all 65 steps from data file
const JOURNEY_STEPS = require('../data/journeySteps');

// ===== GET CLIENT JOURNEY =====
const getClientJourney = async (req, res) => {
  try {
    const { clientId } = req.params;
    
    // Verify client exists
    const client = await User.findById(clientId);
    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }

    // Find journey
    let journey = await Journey.findOne({ clientId })
      .populate('steps.updatedBy', 'name email')
      .populate('clientId', 'name email clientCode unitNumber floorPlan');
    
    if (!journey) {
      return res.status(404).json({ message: 'Journey not found for this client' });
    }
    
    res.json(journey);
  } catch (error) {
    console.error('Error fetching journey:', error);
    res.status(500).json({ message: 'Error fetching journey', error: error.message });
  }
};

// ===== CREATE CLIENT JOURNEY =====
const createClientJourney = async (req, res) => {
  try {
    const { clientId } = req.params;
    
    // Check if journey already exists
    const existingJourney = await Journey.findOne({ clientId });
    if (existingJourney) {
      return res.status(400).json({ 
        message: 'Journey already exists for this client',
        journeyId: existingJourney._id
      });
    }
    
    // Verify client exists and has paid
    const client = await User.findById(clientId);
    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }

    // Optional: Check if client has paid
    if (client.paymentInfo && client.paymentInfo.downPaymentStatus !== 'paid') {
      return res.status(400).json({ 
        message: 'Client must complete down payment before journey can be initialized' 
      });
    }
    
    // Create journey with all 65 steps from data file
    const journey = await Journey.create({
      clientId,
      steps: JOURNEY_STEPS.map(step => ({
        ...step,
        status: 'not-started',
        estimatedDate: null,
        actualDate: null,
        notes: '',
        updatedBy: req.user.id,
        updatedAt: new Date()
      }))
    });
    
    // Populate for response
    await journey.populate('clientId', 'name email clientCode unitNumber');
    
    res.status(201).json({
      message: 'Journey created successfully',
      journey
    });
  } catch (error) {
    console.error('Error creating journey:', error);
    res.status(500).json({ message: 'Error creating journey', error: error.message });
  }
};

// ===== UPDATE JOURNEY STEP =====
const updateJourneyStep = async (req, res) => {
  try {
    const { clientId, stepNumber } = req.params;
    const { status, estimatedDate, actualDate, notes } = req.body;
    
    // Find journey
    const journey = await Journey.findOne({ clientId });
    if (!journey) {
      return res.status(404).json({ message: 'Journey not found' });
    }
    
    // Find step by stepNumber
    const stepIndex = journey.steps.findIndex(
      s => s.stepNumber === parseFloat(stepNumber)
    );
    
    if (stepIndex === -1) {
      return res.status(404).json({ message: `Step ${stepNumber} not found` });
    }
    
    // Update step fields
    if (status) {
      const validStatuses = ['not-started', 'pending', 'in-progress', 'completed'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ message: 'Invalid status' });
      }
      journey.steps[stepIndex].status = status;
      
      // If marking as completed, set actualDate
      if (status === 'completed' && !journey.steps[stepIndex].actualDate) {
        journey.steps[stepIndex].actualDate = new Date();
      }
    }
    
    if (estimatedDate !== undefined) {
      journey.steps[stepIndex].estimatedDate = estimatedDate || null;
    }
    
    if (actualDate !== undefined) {
      journey.steps[stepIndex].actualDate = actualDate || null;
    }
    
    if (notes !== undefined) {
      journey.steps[stepIndex].notes = notes;
    }
    
    // Update metadata
    journey.steps[stepIndex].updatedBy = req.user.id;
    journey.steps[stepIndex].updatedAt = new Date();
    
    // Save journey
    await journey.save();
    
    // Populate for response
    await journey.populate('steps.updatedBy', 'name email');
    
    res.json({
      message: 'Step updated successfully',
      step: journey.steps[stepIndex]
    });
  } catch (error) {
    console.error('Error updating step:', error);
    res.status(500).json({ message: 'Error updating step', error: error.message });
  }
};

// ===== COMPLETE JOURNEY STEP =====
const completeJourneyStep = async (req, res) => {
  try {
    const { clientId, stepNumber } = req.params;
    const { notes } = req.body;
    
    // Find journey
    const journey = await Journey.findOne({ clientId });
    if (!journey) {
      return res.status(404).json({ message: 'Journey not found' });
    }
    
    // Find step
    const stepIndex = journey.steps.findIndex(
      s => s.stepNumber === parseFloat(stepNumber)
    );
    
    if (stepIndex === -1) {
      return res.status(404).json({ message: `Step ${stepNumber} not found` });
    }
    
    // Mark as completed
    journey.steps[stepIndex].status = 'completed';
    journey.steps[stepIndex].actualDate = new Date();
    if (notes) {
      journey.steps[stepIndex].notes = notes;
    }
    journey.steps[stepIndex].updatedBy = req.user.id;
    journey.steps[stepIndex].updatedAt = new Date();
    
    // Save
    await journey.save();
    
    // Populate for response
    await journey.populate('steps.updatedBy', 'name email');
    
    res.json({
      message: 'Step marked as complete',
      step: journey.steps[stepIndex]
    });
  } catch (error) {
    console.error('Error completing step:', error);
    res.status(500).json({ message: 'Error completing step', error: error.message });
  }
};

// ===== GET ALL JOURNEYS (Admin only) =====
const getAllJourneys = async (req, res) => {
  try {
    const journeys = await Journey.find()
      .populate('clientId', 'name email clientCode unitNumber')
      .sort({ updatedAt: -1 });
    
    res.json({
      count: journeys.length,
      journeys
    });
  } catch (error) {
    console.error('Error fetching all journeys:', error);
    res.status(500).json({ message: 'Error fetching journeys', error: error.message });
  }
};

// ===== DELETE JOURNEY (Admin only - use with caution) =====
const deleteJourney = async (req, res) => {
  try {
    const { clientId } = req.params;
    
    const journey = await Journey.findOneAndDelete({ clientId });
    
    if (!journey) {
      return res.status(404).json({ message: 'Journey not found' });
    }
    
    res.json({ message: 'Journey deleted successfully' });
  } catch (error) {
    console.error('Error deleting journey:', error);
    res.status(500).json({ message: 'Error deleting journey', error: error.message });
  }
};

module.exports = {
  getClientJourney,
  createClientJourney,
  updateJourneyStep,
  completeJourneyStep,
  getAllJourneys,
  deleteJourney
};