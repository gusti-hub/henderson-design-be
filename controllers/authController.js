const jwt = require('jsonwebtoken');
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const ActivityLog = require('../models/ActivityLog');
const nodemailer = require('nodemailer');

// Configure nodemailer transporter
const transporter = nodemailer.createTransport({
  service: 'gmail', // or your preferred service
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

// Generate JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE,
  });
};

// @desc    Register user (admin only)
// @route   POST /api/auth/register
// @access  Private (Admin)
const register = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    // Check if user exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Create user
    const user = await User.create({
      name,
      email,
      password,
      role,
      registrationType: 'admin-created',
      status: 'approved' // Admin-created users are automatically approved
    });

    if (user) {
      res.status(201).json({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        token: generateToken(user._id),
      });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Register client (public registration)
// @route   POST /api/auth/register-client
// @access  Public
const registerClient = async (req, res) => {
  try {
    const { 
      name, 
      email, 
      password, 
      unitNumber, 
      phoneNumber, 
      questionnaire 
    } = req.body;

    // Validate required fields
    if (!name || !email || !password || !unitNumber || !phoneNumber) {
      return res.status(400).json({ 
        message: 'Please provide all required fields: name, email, password, unit number, and phone number' 
      });
    }

    // Validate questionnaire required fields
    if (!questionnaire || 
        !questionnaire.designStyle || questionnaire.designStyle.length === 0 ||
        !questionnaire.colorPalette || questionnaire.colorPalette.length === 0 ||
        !questionnaire.patterns || questionnaire.patterns.length === 0 ||
        !questionnaire.personalTouches ||
        !questionnaire.primaryUse || questionnaire.primaryUse.length === 0 ||
        !questionnaire.budgetFlexibility) {
      return res.status(400).json({ 
        message: 'Please complete all required questionnaire fields' 
      });
    }

    // Check if user already exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'An account with this email already exists' });
    }

    // Check if unit number is already taken
    // const unitExists = await User.findOne({ unitNumber });
    // if (unitExists) {
    //   return res.status(400).json({ message: 'This unit number is already registered' });
    // }

    // Create user with pending status
    const user = await User.create({
      name,
      email,
      password,
      unitNumber,
      phoneNumber,
      questionnaire,
      role: 'user',
      registrationType: 'self-registered',
      status: 'pending'
    });

    // Send confirmation email to user
    await sendRegistrationConfirmationEmail(user.email, user.name);

    // Send notification email to admin
    await sendAdminNotificationEmail(user);

    res.status(201).json({
      message: 'Registration submitted successfully. Your account is under review and you will receive an email notification once approved.',
      userId: user._id
    });

  } catch (error) {
    console.error('Client registration error:', error);
    res.status(500).json({ message: 'Registration failed. Please try again.' });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email }).select('+password');

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check if user account is approved (only for self-registered users)
    if (user.registrationType === 'self-registered' && user.status !== 'approved') {
      let message = 'Your account is still under review. Please wait for admin approval.';
      if (user.status === 'rejected') {
        message = `Your account registration was rejected. ${user.rejectionReason ? 'Reason: ' + user.rejectionReason : 'Please contact support for more information.'}`;
      }
      return res.status(403).json({ message });
    }

    // Log activity
    await ActivityLog.create({
      userId: user._id,
      action: 'login',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      timestamp: new Date()
    });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1d' });

    // Track active session
    if (user.role === 'user') {
      await ActivityLog.create({
        userId: user._id,
        action: 'login',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });
    }

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Error logging in' });
  }
};

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// Email helper functions
const sendRegistrationConfirmationEmail = async (userEmail, userName) => {
  try {
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: userEmail,
      subject: 'Registration Received - Henderson Design Group',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #005670; color: white; padding: 20px; text-align: center;">
            <h1 style="margin: 0; font-weight: normal; letter-spacing: 2px;">HENDERSON</h1>
            <p style="margin: 5px 0 0 0; letter-spacing: 1px;">DESIGN GROUP</p>
          </div>
          
          <div style="padding: 30px; background-color: #f9f9f9;">
            <h2 style="color: #005670; margin-bottom: 20px;">Registration Received</h2>
            
            <p>Dear ${userName},</p>
            
            <p>Thank you for registering with Henderson Design Group! We have received your registration and questionnaire responses.</p>
            
            <div style="background-color: #e8f4f8; border-left: 4px solid #005670; padding: 15px; margin: 20px 0;">
              <p style="margin: 0;"><strong>What happens next:</strong></p>
              <ul style="margin: 10px 0 0 20px;">
                <li>Our admin team will review your registration</li>
                <li>We'll verify your information and questionnaire responses</li>
                <li>You'll receive an email notification once your account is approved</li>
                <li>After approval, you can log in and start exploring our design services</li>
              </ul>
            </div>
            
            <p>This review process typically takes 1-2 business days. We appreciate your patience!</p>
            
            <p>If you have any questions, please don't hesitate to contact us.</p>
            
            <p>Best regards,<br>The Henderson Design Group Team</p>
          </div>
          
          <div style="background-color: #005670; color: white; padding: 15px; text-align: center; font-size: 12px;">
            <p style="margin: 0;">Henderson Design Group | 74-5518 Kaiwi Street Suite B, Kailua Kona, HI, 96740-3145</p>
            <p style="margin: 5px 0 0 0;">Phone: (808) 315-8782</p>
          </div>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log('Registration confirmation email sent successfully');
  } catch (error) {
    console.error('Error sending registration confirmation email:', error);
  }
};

const sendAdminNotificationEmail = async (user) => {
  try {
    const adminUsers = await User.find({ role: 'admin' });
    
    for (const admin of adminUsers) {
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: admin.email,
        subject: 'New Client Registration - Pending Approval',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #005670; color: white; padding: 20px; text-align: center;">
              <h1 style="margin: 0; font-weight: normal; letter-spacing: 2px;">HENDERSON</h1>
              <p style="margin: 5px 0 0 0; letter-spacing: 1px;">DESIGN GROUP</p>
            </div>
            
            <div style="padding: 30px; background-color: #f9f9f9;">
              <h2 style="color: #800000; margin-bottom: 20px;">New Client Registration</h2>
              
              <p>A new client has registered and is pending approval:</p>
              
              <div style="background-color: white; border: 1px solid #ddd; padding: 20px; margin: 20px 0;">
                <h3 style="color: #005670; margin-top: 0;">Client Information</h3>
                <p><strong>Name:</strong> ${user.name}</p>
                <p><strong>Email:</strong> ${user.email}</p>
                <p><strong>Unit Number:</strong> ${user.unitNumber}</p>
                <p><strong>Phone:</strong> ${user.phoneNumber}</p>
                <p><strong>Registration Date:</strong> ${new Date(user.createdAt).toLocaleDateString()}</p>
              </div>
              
              <div style="background-color: white; border: 1px solid #ddd; padding: 20px; margin: 20px 0;">
                <h3 style="color: #005670; margin-top: 0;">Questionnaire Responses</h3>
                
                <div style="margin-bottom: 15px;">
                  <h4 style="color: #333; margin: 10px 0 5px 0; font-size: 14px;">Design Style & Aesthetic:</h4>
                  ${user.questionnaire.designStyle && user.questionnaire.designStyle.length > 0 ? 
                    `<p><strong>Design Styles:</strong> ${user.questionnaire.designStyle.join(', ')}</p>` : ''}
                  ${user.questionnaire.colorPalette && user.questionnaire.colorPalette.length > 0 ? 
                    `<p><strong>Color Palette:</strong> ${user.questionnaire.colorPalette.join(', ')}</p>` : ''}
                  ${user.questionnaire.patterns && user.questionnaire.patterns.length > 0 ? 
                    `<p><strong>Patterns:</strong> ${user.questionnaire.patterns.join(', ')}</p>` : ''}
                  ${user.questionnaire.personalTouches ? 
                    `<p><strong>Personal Items:</strong> ${user.questionnaire.personalTouches}</p>` : ''}
                  ${user.questionnaire.personalArtworkDetails ? 
                    `<p><strong>Personal Items Details:</strong> ${user.questionnaire.personalArtworkDetails}</p>` : ''}
                </div>

                <div style="margin-bottom: 15px;">
                  <h4 style="color: #333; margin: 10px 0 5px 0; font-size: 14px;">Lifestyle & Functionality:</h4>
                  ${user.questionnaire.primaryUse && user.questionnaire.primaryUse.length > 0 ? 
                    `<p><strong>Primary Use:</strong> ${user.questionnaire.primaryUse.join(', ')}</p>` : ''}
                  ${user.questionnaire.occupants ? 
                    `<p><strong>Occupants:</strong> ${user.questionnaire.occupants}</p>` : ''}
                  ${user.questionnaire.lifestyleNeeds ? 
                    `<p><strong>Lifestyle Needs:</strong> ${user.questionnaire.lifestyleNeeds}</p>` : ''}
                </div>

                <div style="margin-bottom: 15px;">
                  <h4 style="color: #333; margin: 10px 0 5px 0; font-size: 14px;">Timeline & Budget:</h4>
                  ${user.questionnaire.desiredCompletionDate ? 
                    `<p><strong>Desired Completion:</strong> ${new Date(user.questionnaire.desiredCompletionDate).toLocaleDateString()}</p>` : ''}
                  ${user.questionnaire.budgetFlexibility ? 
                    `<p><strong>Budget Flexibility:</strong> ${user.questionnaire.budgetFlexibility}</p>` : ''}
                </div>

                <div>
                  <h4 style="color: #333; margin: 10px 0 5px 0; font-size: 14px;">Project Details:</h4>
                  ${user.questionnaire.technologyIntegration ? 
                    `<p><strong>Technology Features:</strong> ${user.questionnaire.technologyIntegration}</p>` : ''}
                  ${user.questionnaire.additionalThoughts ? 
                    `<p><strong>Additional Thoughts:</strong> ${user.questionnaire.additionalThoughts}</p>` : ''}
                </div>
              </div>
              
              <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; margin: 20px 0;">
                <p style="margin: 0;"><strong>Action Required:</strong> Please review this registration in the admin panel and approve or reject the account.</p>
              </div>
              
              <p>Please log in to the admin panel to review and approve this registration.</p>
            </div>
            
            <div style="background-color: #005670; color: white; padding: 15px; text-align: center; font-size: 12px;">
              <p style="margin: 0;">Henderson Design Group Admin System</p>
            </div>
          </div>
        `
      };

      await transporter.sendMail(mailOptions);
    }
    
    console.log('Admin notification emails sent successfully');
  } catch (error) {
    console.error('Error sending admin notification email:', error);
  }
};

const sendApprovalEmail = async (userEmail, userName) => {
  try {
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: userEmail,
      subject: 'Account Approved - Henderson Design Group',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #005670; color: white; padding: 20px; text-align: center;">
            <h1 style="margin: 0; font-weight: normal; letter-spacing: 2px;">HENDERSON</h1>
            <p style="margin: 5px 0 0 0; letter-spacing: 1px;">DESIGN GROUP</p>
          </div>
          
          <div style="padding: 30px; background-color: #f9f9f9;">
            <h2 style="color: #28a745; margin-bottom: 20px;">Account Approved! 🎉</h2>
            
            <p>Dear ${userName},</p>
            
            <p>Great news! Your Henderson Design Group account has been approved and is now active.</p>
            
            <div style="background-color: #d4edda; border-left: 4px solid #28a745; padding: 15px; margin: 20px 0;">
              <p style="margin: 0;"><strong>You can now:</strong></p>
              <ul style="margin: 10px 0 0 20px;">
                <li>Log in to your account using your email and password</li>
                <li>Access our design platform and services</li>
                <li>Start exploring furniture options for your unit</li>
                <li>Connect with our design team</li>
              </ul>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.FRONTEND_URL || 'https://your-site.com'}" 
                 style="background-color: #005670; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                Log In to Your Account
              </a>
            </div>
            
            <p>Welcome to Henderson Design Group! We're excited to help you create your perfect space.</p>
            
            <p>If you have any questions or need assistance, please don't hesitate to contact us.</p>
            
            <p>Best regards,<br>The Henderson Design Group Team</p>
          </div>
          
          <div style="background-color: #005670; color: white; padding: 15px; text-align: center; font-size: 12px;">
            <p style="margin: 0;">Henderson Design Group | 74-5518 Kaiwi Street Suite B, Kailua Kona, HI, 96740-3145</p>
            <p style="margin: 5px 0 0 0;">Phone: (808) 315-8782</p>
          </div>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log('Approval email sent successfully');
  } catch (error) {
    console.error('Error sending approval email:', error);
  }
};

const sendRejectionEmail = async (userEmail, userName, reason) => {
  try {
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: userEmail,
      subject: 'Registration Update - Henderson Design Group',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #005670; color: white; padding: 20px; text-align: center;">
            <h1 style="margin: 0; font-weight: normal; letter-spacing: 2px;">HENDERSON</h1>
            <p style="margin: 5px 0 0 0; letter-spacing: 1px;">DESIGN GROUP</p>
          </div>
          
          <div style="padding: 30px; background-color: #f9f9f9;">
            <h2 style="color: #dc3545; margin-bottom: 20px;">Registration Update</h2>
            
            <p>Dear ${userName},</p>
            
            <p>Thank you for your interest in Henderson Design Group. After reviewing your registration, we are unable to approve your account at this time.</p>
            
            ${reason ? `
              <div style="background-color: #f8d7da; border-left: 4px solid #dc3545; padding: 15px; margin: 20px 0;">
                <p style="margin: 0;"><strong>Reason:</strong> ${reason}</p>
              </div>
            ` : ''}
            
            <p>If you believe this is an error or would like to discuss your registration further, please contact us directly.</p>
            
            <p>We appreciate your understanding.</p>
            
            <p>Best regards,<br>The Henderson Design Group Team</p>
          </div>
          
          <div style="background-color: #005670; color: white; padding: 15px; text-align: center; font-size: 12px;">
            <p style="margin: 0;">Henderson Design Group | 74-5518 Kaiwi Street Suite B, Kailua Kona, HI, 96740-3145</p>
            <p style="margin: 5px 0 0 0;">Phone: (808) 315-8782</p>
          </div>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log('Rejection email sent successfully');
  } catch (error) {
    console.error('Error sending rejection email:', error);
  }
};

// Export email functions for use in client controller
module.exports = {
  register,
  registerClient,
  login,
  getMe,
  sendApprovalEmail,
  sendRejectionEmail
};