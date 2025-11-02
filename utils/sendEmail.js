const SibApiV3Sdk = require('@getbrevo/brevo');

/**
 * Send email using Brevo (formerly Sendinblue)
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email address
 * @param {string} options.toName - Recipient name
 * @param {string} options.subject - Email subject
 * @param {string} options.htmlContent - Email HTML content
 * @param {Object} options.sender - Sender info (optional)
 */
const sendEmail = async (options) => {
  try {
    // Validate API Key
    if (!process.env.BREVO_API_KEY) {
      throw new Error('BREVO_API_KEY is not defined in environment variables');
    }

    console.log('📧 Preparing to send email via Brevo...');
    console.log('   To:', options.to);
    console.log('   Subject:', options.subject);

    // Configure API instance
    const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
    apiInstance.setApiKey(
      SibApiV3Sdk.TransactionalEmailsApiApiKeys.apiKey, 
      process.env.BREVO_API_KEY
    );

    // Prepare email
    const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();

    // Sender
    sendSmtpEmail.sender = options.sender || {
      name: process.env.EMAIL_FROM_NAME || 'Henderson Design Group',
      email: process.env.EMAIL_FROM || 'agustianggaraputra@gmail.com'
    };

    // Recipient
    sendSmtpEmail.to = [
      {
        email: options.to,
        name: options.toName || 'Valued Client'
      }
    ];

    // Email content
    sendSmtpEmail.subject = options.subject;
    sendSmtpEmail.htmlContent = options.htmlContent;

    // Optional: Add reply-to
    if (process.env.EMAIL_REPLY_TO) {
      sendSmtpEmail.replyTo = {
        email: process.env.EMAIL_REPLY_TO,
        name: process.env.EMAIL_FROM_NAME || 'Henderson Design Group'
      };
    }

    // Send email
    const data = await apiInstance.sendTransacEmail(sendSmtpEmail);

    console.log('✅ Email sent successfully via Brevo');
    console.log('   Message ID:', data.messageId);

    return data;

  } catch (error) {
    console.error('❌ Brevo email sending failed:', error);
    
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Error:', error.response.text);
    }
    
    throw new Error(`Email could not be sent: ${error.message}`);
  }
};

module.exports = sendEmail;