// controllers/journeyController.js
const Journey = require('../models/Journey');
const User = require('../models/User');
const sendEmail = require('../utils/sendEmail');
const EMAIL_TEMPLATES = require('../utils/journeyEmailTemplates');
const { generateContractPDF, generateProposalPDF } = require('../utils/contractGenerator');

// Import all 67 steps from data file
const JOURNEY_STEPS = require('../data/journeySteps');

// ===== GET CLIENT JOURNEY =====
const getClientJourney = async (req, res) => {
  try {
    const { clientId } = req.params;
    
    const client = await User.findById(clientId);
    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }

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

    // Create journey with all 67 steps from data file
    const journey = await Journey.create({
      clientId,
      steps: JOURNEY_STEPS.map(stepData => ({
        step: stepData.step,
        csvStep: stepData.csvStep,
        title: stepData.title,
        description: stepData.description,
        phase: stepData.phase,
        status: 'not-started',
        email: stepData.email || false,
        clientAction: stepData.clientAction || false,
        actionBy: stepData.actionBy,
        emailTemplate: stepData.emailTemplate || null,
        autoTrigger: stepData.autoTrigger || false,
        autoGenerate: stepData.autoGenerate || null,
        autoCheck: stepData.autoCheck || false,
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

// ===== UPDATE JOURNEY STEP =====
const updateJourneyStep = async (req, res) => {
  try {
    const { clientId, stepNumber } = req.params;
    const { 
      status, 
      estimatedDate, 
      actualDate, 
      notes, 
      sendEmailNotification,
      contractAmount,
      downPaymentAmount,
      proposalAmount
    } = req.body;
    
    const journey = await Journey.findOne({ clientId })
      .populate('clientId', 'name email unitNumber floorPlan clientCode');
    
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
    
    // Update main step
    if (status) {
      const validStatuses = ['not-started', 'pending', 'in-progress', 'completed', 'blocked'];
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
    
    // ===== AUTO-GENERATION LOGIC =====
    if (step.autoGenerate && status === 'in-progress') {
      try {
        if (step.autoGenerate === 'contract') {
          // Generate Design Fee Contract
          const contractPDF = await generateContractPDF({
            clientName: journey.clientId.name,
            clientEmail: journey.clientId.email,
            unitNumber: journey.clientId.unitNumber,
            floorPlan: journey.clientId.floorPlan,
            clientCode: journey.clientId.clientCode,
            contractAmount: contractAmount || 0,
            downPaymentAmount: downPaymentAmount || 0,
            contractDate: new Date().toLocaleDateString(),
            contractType: 'Design Fee'
          });
          
          step.generatedDocuments.push({
            type: 'contract',
            filename: `Design_Contract_${journey.clientId.unitNumber}_${Date.now()}.pdf`,
            data: contractPDF,
            generatedAt: new Date()
          });
          
          // Store contract data
          if (!journey.contractData) journey.contractData = {};
          journey.contractData.designFeeContract = {
            amount: contractAmount,
            downPayment: downPaymentAmount,
            generatedAt: new Date()
          };
          
          console.log('✅ Design contract auto-generated');
          
        } else if (step.autoGenerate === 'proposalContract') {
          // Generate Production Contract
          const proposalPDF = await generateProposalPDF({
            clientName: journey.clientId.name,
            clientEmail: journey.clientId.email,
            unitNumber: journey.clientId.unitNumber,
            floorPlan: journey.clientId.floorPlan,
            clientCode: journey.clientId.clientCode,
            proposalAmount: proposalAmount || 0,
            proposalDate: new Date().toLocaleDateString(),
            itemizedList: [],
            specifications: notes || '',
            estimatedTimeline: estimatedDate ? `Estimated completion: ${new Date(estimatedDate).toLocaleDateString()}` : ''
          });
          
          step.generatedDocuments.push({
            type: 'proposal',
            filename: `Production_Proposal_${journey.clientId.unitNumber}_${Date.now()}.pdf`,
            data: proposalPDF,
            generatedAt: new Date()
          });
          
          // Store proposal data
          if (!journey.contractData) journey.contractData = {};
          journey.contractData.productionContract = {
            amount: proposalAmount,
            initialPayment: proposalAmount ? proposalAmount * 0.5 : 0,
            progressPayment: proposalAmount ? proposalAmount * 0.25 : 0,
            finalPayment: proposalAmount ? proposalAmount * 0.25 : 0,
            generatedAt: new Date()
          };
          
          console.log('✅ Production proposal auto-generated');
        }
      } catch (genError) {
        console.error('❌ Auto-generation error:', genError);
        // Don't fail the request, just log the error
      }
    }
    
    await journey.save();
    await journey.populate('steps.updatedBy', 'name email');
    
    // ===== EMAIL NOTIFICATION LOGIC =====
    if (sendEmailNotification && step.email && step.emailTemplate) {
      try {
        const emailTemplate = EMAIL_TEMPLATES[step.emailTemplate];
        
        if (emailTemplate) {
          const emailData = {
            clientName: journey.clientId.name,
            unitNumber: journey.clientId.unitNumber,
            floorPlan: journey.clientId.floorPlan,
            estimatedDate: estimatedDate,
            notes: notes,
            contractAmount: contractAmount,
            downPaymentAmount: downPaymentAmount,
            proposalAmount: proposalAmount,
            amount: contractAmount || proposalAmount || downPaymentAmount
          };
          
          const htmlContent = emailTemplate(emailData);
          
          await sendEmail({
            to: journey.clientId.email,
            toName: journey.clientId.name,
            subject: `Journey Update: ${step.title}`,
            htmlContent
          });
          
          console.log(`✅ Email sent: ${step.emailTemplate} to ${journey.clientId.email}`);
        } else {
          console.warn(`⚠️ Email template not found: ${step.emailTemplate}`);
        }
      } catch (emailError) {
        console.error('❌ Email sending error:', emailError);
        // Don't fail the request if email fails
      }
    }
    
    // ===== AUTO-TRIGGER NEXT STEP =====
    if (status === 'completed' && step.autoTrigger) {
      const nextStepIndex = stepIndex + 1;
      if (nextStepIndex < journey.steps.length) {
        const nextStep = journey.steps[nextStepIndex];
        if (nextStep.status === 'not-started') {
          nextStep.status = 'pending';
          nextStep.updatedAt = new Date();
          await journey.save();
          console.log(`✅ Auto-triggered next step: ${nextStep.step}`);
        }
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

// ===== COMPLETE JOURNEY STEP =====
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

// ===== DELETE JOURNEY (Admin only) =====
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

// ===== GET STEP DOCUMENT =====
const getStepDocument = async (req, res) => {
  try {
    const { clientId, stepNumber, documentIndex } = req.params;
    
    const journey = await Journey.findOne({ clientId });
    if (!journey) {
      return res.status(404).json({ message: 'Journey not found' });
    }
    
    const step = journey.steps.find(s => s.step === parseInt(stepNumber));
    if (!step) {
      return res.status(404).json({ message: 'Step not found' });
    }
    
    const document = step.generatedDocuments[parseInt(documentIndex)];
    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${document.filename}"`);
    res.send(document.data);
    
  } catch (error) {
    console.error('Error fetching document:', error);
    res.status(500).json({ message: 'Error fetching document', error: error.message });
  }
};

// ===== GET PENDING CLIENT ACTIONS =====
const getPendingClientActions = async (req, res) => {
  try {
    const { clientId } = req.params;
    
    const journey = await Journey.findOne({ clientId })
      .populate('clientId', 'name email unitNumber');
    
    if (!journey) {
      return res.status(404).json({ message: 'Journey not found' });
    }
    
    const pendingActions = journey.getPendingClientActions();
    
    res.json({
      count: pendingActions.length,
      actions: pendingActions
    });
  } catch (error) {
    console.error('Error fetching pending actions:', error);
    res.status(500).json({ message: 'Error fetching pending actions', error: error.message });
  }
};

module.exports = {
  getClientJourney,
  createClientJourney,
  updateJourneyStep,
  completeJourneyStep,
  getAllJourneys,
  deleteJourney,
  getStepDocument,
  getPendingClientActions
};