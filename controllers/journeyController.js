// controllers/journeyController.js
// Complete Journey Controller untuk Backend

const Journey = require('../models/Journey');
const User = require('../models/User');
const sendEmail = require('../utils/sendEmail');
const { journeyStepEmailTemplate } = require('../utils/journeyEmailTemplates');

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

const createClientJourney = async (req, res) => {
  try {
    const { clientId } = req.params;
    
    const existingJourney = await Journey.findOne({ clientId });
    if (existingJourney) {
      return res.status(400).json({ 
        message: 'Journey already exists for this client',
        journeyId: existingJourney._id
      });
    }
    
    const client = await User.findById(clientId);
    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }

    if (client.paymentInfo && client.paymentInfo.downPaymentStatus !== 'paid') {
      return res.status(400).json({ 
        message: 'Client must complete down payment before journey can be initialized' 
      });
    }
    
    // Create journey with all 23 steps from data file
    const journey = await Journey.create({
      clientId,
      steps: JOURNEY_STEPS.map(stepData => ({
        step: stepData.step,
        title: stepData.title,
        description: stepData.description,
        phase: stepData.phase,
        status: 'not-started',
        email: stepData.email || false,
        clientAction: stepData.clientAction || false,
        subSteps: stepData.subSteps || [],
        estimatedDate: null,
        actualDate: null,
        notes: '',
        updatedBy: req.user.id,
        updatedAt: new Date()
      }))
    });
    
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

// Update updateJourneyStep to handle both main step and substep updates:
const updateJourneyStep = async (req, res) => {
  try {
    const { clientId, stepNumber } = req.params;
    const { status, estimatedDate, actualDate, notes, subStepIndex, subStepCompleted, sendEmailNotification } = req.body;
    
    const journey = await Journey.findOne({ clientId }).populate('clientId', 'name email unitNumber');
    if (!journey) {
      return res.status(404).json({ message: 'Journey not found' });
    }
    
    const stepIndex = journey.steps.findIndex(
      s => s.step === parseInt(stepNumber)
    );
    
    if (stepIndex === -1) {
      return res.status(404).json({ message: `Step ${stepNumber} not found` });
    }
    
    const step = journey.steps[stepIndex];
    const oldStatus = step.status;
    
    // Update substep if specified
    if (subStepIndex !== undefined) {
      if (step.subSteps[subStepIndex]) {
        step.subSteps[subStepIndex].completed = subStepCompleted;
        if (subStepCompleted) {
          step.subSteps[subStepIndex].completedAt = new Date();
        }
      }
    }
    
    // Update main step
    if (status) {
      const validStatuses = ['not-started', 'pending', 'in-progress', 'completed'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ message: 'Invalid status' });
      }
      step.status = status;
      
      if (status === 'completed' && !step.actualDate) {
        step.actualDate = new Date();
      }
    }
    
    if (estimatedDate !== undefined) {
      step.estimatedDate = estimatedDate || null;
    }
    
    if (actualDate !== undefined) {
      step.actualDate = actualDate || null;
    }
    
    if (notes !== undefined) {
      step.notes = notes;
    }
    
    step.updatedBy = req.user.id;
    step.updatedAt = new Date();
    
    await journey.save();
    await journey.populate('steps.updatedBy', 'name email');
    
    // Send email notification if requested and status changed
    if (sendEmailNotification && oldStatus !== step.status) {
      try {
        const actionRequired = step.status === 'pending' || step.clientAction;
        
        await sendEmail({
          to: journey.clientId.email,
          toName: journey.clientId.name,
          subject: `Journey Update: Step ${step.step} - ${step.title}`,
          htmlContent: journeyStepEmailTemplate({
            clientName: journey.clientId.name,
            stepNumber: step.step,
            stepTitle: step.title,
            stepDescription: step.description,
            adminMessage: notes,
            estimatedDate: estimatedDate,
            actionRequired
          })
        });
        
        console.log(`✅ Email notification sent to ${journey.clientId.email}`);
      } catch (emailError) {
        console.error('❌ Error sending email notification:', emailError);
        // Don't fail the request if email fails
      }
    }
    
    res.json({
      message: 'Step updated successfully',
      step: journey.steps[stepIndex]
    });
  } catch (error) {
    console.error('Error updating step:', error);
    res.status(500).json({ message: 'Error updating step', error: error.message });
  }
};

// Update completeJourneyStep:
const completeJourneyStep = async (req, res) => {
  try {
    const { clientId, stepNumber } = req.params;
    const { notes } = req.body;
    
    const journey = await Journey.findOne({ clientId });
    if (!journey) {
      return res.status(404).json({ message: 'Journey not found' });
    }
    
    const stepIndex = journey.steps.findIndex(
      s => s.step === parseInt(stepNumber)
    );
    
    if (stepIndex === -1) {
      return res.status(404).json({ message: `Step ${stepNumber} not found` });
    }
    
    // Mark all substeps as completed
    if (journey.steps[stepIndex].subSteps) {
      journey.steps[stepIndex].subSteps.forEach(subStep => {
        subStep.completed = true;
        subStep.completedAt = new Date();
      });
    }
    
    journey.steps[stepIndex].status = 'completed';
    journey.steps[stepIndex].actualDate = new Date();
    if (notes) {
      journey.steps[stepIndex].notes = notes;
    }
    journey.steps[stepIndex].updatedBy = req.user.id;
    journey.steps[stepIndex].updatedAt = new Date();
    
    await journey.save();
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