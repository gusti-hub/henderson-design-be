const jwt = require('jsonwebtoken');
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const ActivityLog = require('../models/ActivityLog');
const { generateClientCode } = require('../utils/clientCodeGenerator');

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
      status: 'approved'
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
      propertyType, // ✅ NEW FIELD
      questionnaire 
    } = req.body;

    // ✅ Validate required fields including propertyType
    if (!name || !email || !password || !unitNumber || !phoneNumber || !propertyType) {
      return res.status(400).json({ 
        message: 'Please provide all required fields: name, email, password, unit number, phone number, and property type' 
      });
    }

    // ✅ Validate propertyType value
    const validPropertyTypes = ['Lock 2025 Pricing', 'Design Hold Fee'];
    if (!validPropertyTypes.includes(propertyType)) {
      return res.status(400).json({ 
        message: 'Invalid property type. Must be either "Lock 2025 Pricing" or "Design Hold Fee"' 
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

    // ✅ Create user with propertyType
    const user = await User.create({
      name,
      email,
      password,
      unitNumber,
      phoneNumber,
      propertyType, // ✅ NEW FIELD
      questionnaire,
      role: 'user',
      registrationType: 'self-registered',
      status: 'pending'
    });

    // Send confirmation email to user
    await sendRegistrationConfirmationEmail(user);

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

// ============================================
// EMAIL HELPER FUNCTIONS USING BREVO
// ============================================

// Send registration confirmation email (after user registers)
const sendRegistrationConfirmationEmail = async (user) => {
  try {
    const { registrationConfirmationTemplate } = require('../utils/emailTemplates');
    const sendEmail = require('../utils/sendEmail');

    const htmlContent = registrationConfirmationTemplate({
      userName: user.name,
      userEmail: user.email,
      unitNumber: user.unitNumber,
      propertyType: user.propertyType || 'Not specified'
    });

    await sendEmail({
      to: user.email,
      toName: user.name,
      subject: '✉️ Registration Received - Henderson Design Group',
      htmlContent: htmlContent
    });

    console.log('✅ Registration confirmation email sent successfully');
  } catch (error) {
    console.error('❌ Error sending registration confirmation email:', error);
    // Don't throw - this is non-blocking
  }
};

// Send admin notification email (when new user registers)
const sendAdminNotificationEmail = async (user) => {
  try {
    const { adminRegistrationNotificationTemplate } = require('../utils/emailTemplates');
    const sendEmail = require('../utils/sendEmail');

    const adminEmails = (process.env.ADMIN_EMAIL || 
      'gustianggara@henderson.house;almer@henderson.house;madeline@henderson.house')
      .split(/[;,]+/)
      .map(e => e.trim())
      .filter(e => e.length > 0);

    const htmlContent = adminRegistrationNotificationTemplate({
      userName: user.name,
      userEmail: user.email,
      unitNumber: user.unitNumber,
      phoneNumber: user.phoneNumber || 'Not provided',
      propertyType: user.propertyType || 'Not specified',
      questionnaire: user.questionnaire || {},
      registrationDate: new Date(user.createdAt).toLocaleString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    });

    for (const adminEmail of adminEmails) {
      try {
        await sendEmail({
          to: adminEmail,
          toName: 'Henderson Admin',
          subject: `🆕 New Client Registration: ${user.name} - Unit ${user.unitNumber}`,
          htmlContent: htmlContent
        });
        console.log(`✅ Admin notification email sent → ${adminEmail}`);
      } catch (err) {
        console.error(`⚠️ Failed to send admin email to ${adminEmail}:`, err.message);
      }
    }
  } catch (error) {
    console.error('❌ Error sending admin notification email:', error);
    // Don't throw - this is non-blocking
  }
};

// Send approval email with login credentials (when admin approves user)
const sendApprovalEmail = async (user, temporaryPassword) => {
  try {
    const { userApprovalTemplate } = require('../utils/emailTemplates');
    const sendEmail = require('../utils/sendEmail');

    const loginUrl = process.env.FRONTEND_URL || 'https://alia.henderson.house';

    const htmlContent = userApprovalTemplate({
      userName: user.name,
      userEmail: user.email,
      temporaryPassword: temporaryPassword,
      loginUrl: loginUrl,
      unitNumber: user.unitNumber,
      propertyType: user.propertyType || 'Not specified'
    });

    await sendEmail({
      to: user.email,
      toName: user.name,
      subject: '🎉 Welcome to Ālia Collections - Your Account is Approved!',
      htmlContent: htmlContent
    });

    console.log('✅ Approval email with credentials sent successfully');
  } catch (error) {
    console.error('❌ Error sending approval email:', error);
    throw error; // Throw here because this is critical
  }
};

// Send rejection email (when admin rejects user)
const sendRejectionEmail = async (userEmail, userName, reason) => {
  try {
    const sendEmail = require('../utils/sendEmail');

    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Registration Update - Henderson Design Group</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 600px; max-width: 100%; border-collapse: collapse; background-color: #ffffff; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <tr>
            <td style="padding: 40px 30px; background: linear-gradient(135deg, #dc3545 0%, #c82333 100%); text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold;">
                Registration Update
              </h1>
              <p style="margin: 10px 0 0 0; color: #ffffff; font-size: 14px;">
                Henderson Design Group
              </p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <p style="margin: 0 0 20px 0; color: #555555; line-height: 1.6; font-size: 16px;">
                Dear <strong>${userName}</strong>,
              </p>

              <p style="margin: 0 0 30px 0; color: #555555; line-height: 1.6;">
                Thank you for your interest in Henderson Design Group. After reviewing your registration, we are unable to approve your account at this time.
              </p>

              ${reason ? `
              <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f8d7da; border-left: 4px solid #dc3545; margin-bottom: 30px;">
                <tr>
                  <td style="padding: 20px;">
                    <p style="margin: 0; color: #721c24; line-height: 1.6;">
                      <strong>Reason:</strong><br>
                      ${reason}
                    </p>
                  </td>
                </tr>
              </table>
              ` : ''}

              <p style="margin: 0 0 20px 0; color: #555555; line-height: 1.6;">
                If you believe this is an error or would like to discuss your registration further, please contact us directly at <a href="mailto:aloha@henderson.house" style="color: #005670; text-decoration: none;">aloha@henderson.house</a> or call us at (808) 315-8782.
              </p>

              <p style="margin: 0; color: #555555; line-height: 1.6;">
                We appreciate your understanding.<br><br>
                <strong>Henderson Design Group Team</strong>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 30px; background-color: #f8f9fa; text-align: center; border-top: 1px solid #e0e0e0;">
              <p style="margin: 0 0 10px 0; color: #888888; font-size: 14px;">
                <strong>Henderson Design Group</strong><br>
                Ālia Collections | Hawaiian Luxury Furnishings
              </p>
              <p style="margin: 0 0 15px 0; color: #888888; font-size: 12px;">
                74-5518 Kaiwi Street Suite B, Kailua Kona, HI, 96740-3145
              </p>
              <p style="margin: 0; color: #888888; font-size: 12px;">
                <a href="mailto:aloha@henderson.house" style="color: #005670; text-decoration: none;">aloha@henderson.house</a> | 
                Phone: (808) 315-8782
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    await sendEmail({
      to: userEmail,
      toName: userName,
      subject: 'Registration Update - Henderson Design Group',
      htmlContent: htmlContent
    });

    console.log('✅ Rejection email sent successfully');
  } catch (error) {
    console.error('❌ Error sending rejection email:', error);
    // Don't throw - this is non-blocking
  }
};

module.exports = {
  register,
  registerClient,
  login,
  getMe,
  sendApprovalEmail,
  sendRejectionEmail
};