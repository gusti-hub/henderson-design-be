const User = require('../models/User');
const MeetingSchedule = require('../models/MeetingSchedule');
const Questionnaire = require('../models/ClientQuestionnaire');
const sendEmail = require('../utils/sendEmail');
const { 
  meetingRequestTemplate, 
  meetingConfirmationTemplate, 
  meetingCancellationTemplate,
  adminMeetingNotificationTemplate 
} = require('../utils/emailTemplates');

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'anggaraputra9552@gmail.com';

// ✅ UPDATED: Check down payment status
const verifyDownPayment = async (req, res) => {
  try {
    const { email, unitNumber } = req.body;

    if (!email || !unitNumber) {
      return res.status(400).json({ 
        message: 'Email and unit number are required' 
      });
    }

    const user = await User.findOne({ 
      email: email.toLowerCase(), 
      unitNumber
    });

    if (!user) {
      return res.status(404).json({ 
        message: 'No account found with this email and unit number' 
      });
    }

    // ✅ Check if user is approved
    if (user.status !== 'approved') {
      return res.status(403).json({
        success: false,
        message: 'Your account is not yet approved. Please wait for admin approval.',
        status: user.status
      });
    }

    // ✅ Check down payment status
    const hasDownPayment = user.paymentInfo?.downPaymentStatus === 'paid';
    const paymentSummary = user.getPaymentSummary();

    if (!hasDownPayment) {
      return res.status(403).json({
        success: false,
        message: 'Down payment has not been received. Please complete your down payment to access the portal.',
        downPaymentRequired: true,
        paymentInfo: {
          totalAmount: paymentSummary.totalAmount,
          requiredDownPayment: paymentSummary.requiredDownPayment,
          paidDownPayment: paymentSummary.paidDownPayment,
          remainingDownPayment: paymentSummary.remainingDownPayment,
          status: paymentSummary.status
        }
      });
    }

    // ✅ Success - user can access portal
    res.json({
      success: true,
      client: {
        name: user.name,
        email: email,
        unitNumber: unitNumber,
        clientCode: user.clientCode,
        floorPlan: user.floorPlan
      },
      paymentInfo: {
        status: 'paid',
        totalAmount: paymentSummary.totalAmount,
        paidDownPayment: paymentSummary.paidDownPayment,
        remainingBalance: paymentSummary.remainingBalance
      }
    });

  } catch (error) {
    console.error('Down payment verification error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Verification failed. Please try again.' 
    });
  }
};

// ✅ FIXED: Remove unitNumber from query (not in MeetingSchedule schema)
const scheduleMeeting = async (req, res) => {
  try {
    const { 
      email, 
      unitNumber, 
      preferredDate, 
      preferredTime, 
      alternateDate, 
      alternateTime,
      meetingType,
      notes 
    } = req.body;

    if (!email || !unitNumber || !preferredDate || !preferredTime) {
      return res.status(400).json({ 
        message: 'All required fields must be provided' 
      });
    }

    const user = await User.findOne({ 
      email: email.toLowerCase(), 
      unitNumber
    });

    if (!user) {
      return res.status(404).json({ 
        message: 'User not found' 
      });
    }

    console.log('\n📅 ========================================');
    console.log('   NEW MEETING REQUEST');
    console.log('========================================');
    console.log('Client:', user.name);
    console.log('Email:', user.email);
    console.log('Unit:', unitNumber);

    // ✅ FIX: Only query by userId (unitNumber not in schema)
    const existingMeeting = await MeetingSchedule.findOne({
      userId: user._id,
      status: { $in: ['pending', 'confirmed'] }
    });

    let meetingSchedule;

    if (existingMeeting) {
      console.log('📝 Updating existing meeting:', existingMeeting._id);
      existingMeeting.preferredDate = new Date(preferredDate);
      existingMeeting.preferredTime = preferredTime;
      existingMeeting.alternateDate = new Date(alternateDate);
      existingMeeting.alternateTime = alternateTime;
      existingMeeting.meetingType = meetingType || 'in-person';
      existingMeeting.notes = notes || '';
      existingMeeting.status = 'pending';
      
      meetingSchedule = await existingMeeting.save();
    } else {
      console.log('✨ Creating new meeting...');
      meetingSchedule = await MeetingSchedule.create({
        userId: user._id,
        preferredDate: new Date(preferredDate),
        preferredTime,
        alternateDate: new Date(alternateDate),
        alternateTime,
        meetingType: meetingType || 'in-person',
        notes: notes || '',
        status: 'pending'
      });
    }

    console.log('✅ Meeting saved - ID:', meetingSchedule._id);

    // Get questionnaire
    let questionnaire = null;
    try {
      questionnaire = await Questionnaire.findOne({ 
        userId: user._id,
        status: { $in: ['draft', 'submitted'] }
      }).sort({ updatedAt: -1 }).limit(1);
      
      if (questionnaire) {
        console.log('✅ Questionnaire found');
      }
    } catch (err) {
      console.log('⚠️  No questionnaire');
    }

    // Send client email
    try {
      console.log('\n📧 Sending to client...');
      
      const formattedPreferredDate = new Date(preferredDate).toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
      });

      const formattedAlternateDate = new Date(alternateDate).toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
      });

      const clientEmailHTML = meetingRequestTemplate({
        clientName: user.name,
        unitNumber: unitNumber,
        preferredDate: formattedPreferredDate,
        preferredTime: preferredTime,
        alternateDate: formattedAlternateDate,
        alternateTime: alternateTime,
        meetingType: meetingType || 'in-person',
        notes: notes || ''
      });

      await sendEmail({
        to: user.email,
        toName: user.name,
        subject: `Meeting Request Confirmation - Unit ${unitNumber}`,
        htmlContent: clientEmailHTML
      });

      console.log('✅ Client email sent');

    } catch (emailError) {
      console.error('❌ Client email failed:', emailError.message);
    }

    // Send admin email
    try {
      console.log('\n📧 Sending to admin:', ADMIN_EMAIL);

      const adminEmailHTML = adminMeetingNotificationTemplate({
        clientName: user.name,
        clientEmail: user.email,
        unitNumber: unitNumber,
        preferredDate: new Date(preferredDate).toLocaleDateString('en-US', {
          weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        }),
        preferredTime: preferredTime,
        alternateDate: new Date(alternateDate).toLocaleDateString('en-US', {
          weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        }),
        alternateTime: alternateTime,
        meetingType: meetingType || 'in-person',
        meetingNotes: notes || '',
        questionnaire: questionnaire
      });

      await sendEmail({
        to: ADMIN_EMAIL,
        toName: 'Henderson Admin',
        subject: `🔔 New Meeting Request - ${user.name} (${unitNumber})`,
        htmlContent: adminEmailHTML
      });

      console.log('✅ Admin email sent');

    } catch (adminEmailError) {
      console.error('⚠️  Admin email failed:', adminEmailError.message);
    }

    console.log('========================================\n');

    res.json({
      success: true,
      message: existingMeeting 
        ? '✅ Meeting updated! Confirmation email sent.'
        : '✅ Meeting scheduled! Confirmation email sent.',
      meetingScheduleId: meetingSchedule._id,
      status: 'pending',
      isUpdate: !!existingMeeting
    });

  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to schedule meeting.',
      error: error.message 
    });
  }
};

const updateMeeting = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const { newDate, newTime, meetingLink, notes, status } = req.body;

    const meetingSchedule = await MeetingSchedule.findById(meetingId)
      .populate('userId');

    if (!meetingSchedule) {
      return res.status(404).json({ message: 'Meeting not found' });
    }

    if (newDate) meetingSchedule.confirmedDate = new Date(newDate);
    if (newTime) meetingSchedule.confirmedTime = newTime;
    if (meetingLink) meetingSchedule.meetingLink = meetingLink;
    if (notes) meetingSchedule.designerNotes = notes;
    if (status) meetingSchedule.status = status;
    if (req.user) meetingSchedule.confirmedBy = req.user._id;

    await meetingSchedule.save();

    try {
      const formattedDate = new Date(meetingSchedule.confirmedDate).toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
      });

      const htmlContent = meetingConfirmationTemplate({
        clientName: meetingSchedule.userId.name,
        unitNumber: meetingSchedule.userId.unitNumber,
        confirmedDate: formattedDate,
        confirmedTime: meetingSchedule.confirmedTime,
        meetingType: meetingSchedule.meetingType || 'in-person',
        meetingLink: meetingLink || '',
        notes: notes || meetingSchedule.designerNotes || ''
      });

      const emailSubject = status === 'confirmed' 
        ? `Meeting Confirmed - Unit ${meetingSchedule.userId.unitNumber}`
        : `Meeting Updated - Unit ${meetingSchedule.userId.unitNumber}`;

      await sendEmail({
        to: meetingSchedule.userId.email,
        toName: meetingSchedule.userId.name,
        subject: emailSubject,
        htmlContent: htmlContent
      });

    } catch (emailError) {
      console.error('Email error:', emailError.message);
    }

    res.json({
      success: true,
      message: 'Meeting updated',
      meeting: {
        id: meetingSchedule._id,
        status: meetingSchedule.status,
        confirmedDate: meetingSchedule.confirmedDate,
        confirmedTime: meetingSchedule.confirmedTime
      }
    });

  } catch (error) {
    console.error('Update error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to update meeting' 
    });
  }
};

const cancelMeeting = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const { reason } = req.body;

    const meetingSchedule = await MeetingSchedule.findById(meetingId)
      .populate('userId');

    if (!meetingSchedule) {
      return res.status(404).json({ message: 'Meeting not found' });
    }

    meetingSchedule.status = 'cancelled';
    if (reason) meetingSchedule.designerNotes = reason;
    await meetingSchedule.save();

    try {
      const formattedDate = meetingSchedule.confirmedDate 
        ? new Date(meetingSchedule.confirmedDate).toLocaleDateString('en-US', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
          })
        : null;

      const htmlContent = meetingCancellationTemplate({
        clientName: meetingSchedule.userId.name,
        unitNumber: meetingSchedule.userId.unitNumber,
        cancelledDate: formattedDate,
        cancelledTime: meetingSchedule.confirmedTime,
        reason: reason || ''
      });

      await sendEmail({
        to: meetingSchedule.userId.email,
        toName: meetingSchedule.userId.name,
        subject: `Meeting Cancelled - Unit ${meetingSchedule.userId.unitNumber}`,
        htmlContent: htmlContent
      });

    } catch (emailError) {
      console.error('Email error:', emailError.message);
    }

    res.json({
      success: true,
      message: 'Meeting cancelled'
    });

  } catch (error) {
    console.error('Cancel error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to cancel meeting' 
    });
  }
};

const getMeeting = async (req, res) => {
  try {
    const { meetingId } = req.params;

    const meeting = await MeetingSchedule.findById(meetingId)
      .populate('userId', 'name email unitNumber');

    if (!meeting) {
      return res.status(404).json({ message: 'Meeting not found' });
    }

    res.json({
      success: true,
      meeting: {
        id: meeting._id,
        client: {
          name: meeting.userId.name,
          email: meeting.userId.email,
          unitNumber: meeting.userId.unitNumber
        },
        status: meeting.status,
        preferredDate: meeting.preferredDate,
        preferredTime: meeting.preferredTime,
        alternateDate: meeting.alternateDate,
        alternateTime: meeting.alternateTime,
        confirmedDate: meeting.confirmedDate,
        confirmedTime: meeting.confirmedTime,
        meetingType: meeting.meetingType,
        meetingLink: meeting.meetingLink,
        notes: meeting.notes,
        designerNotes: meeting.designerNotes,
        createdAt: meeting.createdAt
      }
    });

  } catch (error) {
    console.error('Get meeting error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to get meeting details' 
    });
  }
};

module.exports = {
  verifyDownPayment,
  scheduleMeeting,
  updateMeeting,
  cancelMeeting,
  getMeeting
};