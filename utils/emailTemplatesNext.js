// Email templates for meeting scheduling

const meetingRequestTemplate = ({
  clientName,
  unitNumber,
  preferredDate,
  preferredTime,
  alternateDate,
  alternateTime,
  meetingType,
  notes
}) => {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333333;
      margin: 0;
      padding: 0;
      background-color: #f5f5f5;
    }
    .email-container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
    }
    .header {
      background: linear-gradient(135deg, #005670 0%, #007a9a 100%);
      padding: 40px 30px;
      text-align: center;
    }
    .header h1 {
      color: #ffffff;
      margin: 0;
      font-size: 28px;
      font-weight: 300;
      letter-spacing: 0.5px;
    }
    .content {
      padding: 40px 30px;
    }
    .greeting {
      font-size: 18px;
      margin-bottom: 20px;
      color: #004b5f;
    }
    .message {
      font-size: 15px;
      line-height: 1.8;
      color: #555555;
      margin-bottom: 30px;
    }
    .meeting-details {
      background-color: #f8f9fa;
      border-left: 4px solid #004b5f;
      padding: 20px;
      margin: 25px 0;
    }
    .meeting-details h3 {
      color: #004b5f;
      margin: 0 0 15px 0;
      font-size: 16px;
      font-weight: 600;
    }
    .detail-row {
      margin: 10px 0;
      font-size: 14px;
    }
    .detail-label {
      font-weight: 600;
      color: #004b5f;
      display: inline-block;
      width: 150px;
    }
    .detail-value {
      color: #333333;
    }
    .info-box {
      background-color: #e7f3f6;
      border-radius: 8px;
      padding: 20px;
      margin: 25px 0;
    }
    .info-box p {
      margin: 0;
      font-size: 14px;
      color: #004b5f;
    }
    .footer {
      background-color: #f8f9fa;
      padding: 30px;
      text-align: center;
      border-top: 1px solid #e5e5e5;
    }
    .footer p {
      margin: 5px 0;
      font-size: 13px;
      color: #777777;
    }
    .footer-logo {
      color: #004b5f;
      font-size: 18px;
      font-weight: 300;
      margin-bottom: 10px;
    }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="header">
      <h1>Meeting Request Received</h1>
    </div>
    
    <div class="content">
      <p class="greeting">Dear ${clientName},</p>
      
      <div class="message">
        <p>Thank you for scheduling a design consultation with Henderson Design Group for your Ālia residence.</p>
        <p>We have received your meeting request and our team will review your preferred times. You will receive a confirmation email within 24 hours with the final meeting details.</p>
      </div>
      
      <div class="meeting-details">
        <h3>📅 Your Meeting Request Details</h3>
        
        <div class="detail-row">
          <span class="detail-label">Unit Number:</span>
          <span class="detail-value">${unitNumber}</span>
        </div>
        
        <div class="detail-row">
          <span class="detail-label">Meeting Type:</span>
          <span class="detail-value">${meetingType === 'in-person' ? 'In-Person at HDG Showroom' : 'Virtual Video Call'}</span>
        </div>
        
        <div class="detail-row">
          <span class="detail-label">Preferred Date:</span>
          <span class="detail-value">${preferredDate}</span>
        </div>
        
        <div class="detail-row">
          <span class="detail-label">Preferred Time:</span>
          <span class="detail-value">${preferredTime}</span>
        </div>
        
        <div class="detail-row">
          <span class="detail-label">Alternate Date:</span>
          <span class="detail-value">${alternateDate}</span>
        </div>
        
        <div class="detail-row">
          <span class="detail-label">Alternate Time:</span>
          <span class="detail-value">${alternateTime}</span>
        </div>
        
        ${notes ? `
        <div class="detail-row" style="margin-top: 15px;">
          <span class="detail-label" style="vertical-align: top;">Notes:</span>
          <span class="detail-value">${notes}</span>
        </div>
        ` : ''}
      </div>
      
      <div class="info-box">
        <p><strong>What happens next?</strong></p>
        <p style="margin-top: 10px;">Our design team will confirm one of your proposed times or reach out if we need to suggest an alternative. Please ensure you check your email regularly for our confirmation.</p>
      </div>
      
      <div class="message">
        <p>If you have any questions or need to make changes to your request, please don't hesitate to contact us.</p>
        <p>We look forward to meeting with you!</p>
      </div>
    </div>
    
    <div class="footer">
      <p class="footer-logo">HENDERSON DESIGN GROUP</p>
      <p>Ālia Furnishing Program</p>
      <p style="margin-top: 15px;">Questions? Contact us at anggaraputra9552@gmail.com</p>
    </div>
  </div>
</body>
</html>
  `;
};

const meetingConfirmationTemplate = ({
  clientName,
  unitNumber,
  confirmedDate,
  confirmedTime,
  meetingType,
  meetingLink,
  notes
}) => {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333333;
      margin: 0;
      padding: 0;
      background-color: #f5f5f5;
    }
    .email-container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
    }
    .header {
      background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
      padding: 40px 30px;
      text-align: center;
    }
    .header h1 {
      color: #ffffff;
      margin: 0;
      font-size: 28px;
      font-weight: 300;
      letter-spacing: 0.5px;
    }
    .content {
      padding: 40px 30px;
    }
    .greeting {
      font-size: 18px;
      margin-bottom: 20px;
      color: #004b5f;
    }
    .message {
      font-size: 15px;
      line-height: 1.8;
      color: #555555;
      margin-bottom: 30px;
    }
    .meeting-details {
      background-color: #f8f9fa;
      border-left: 4px solid #28a745;
      padding: 20px;
      margin: 25px 0;
    }
    .meeting-details h3 {
      color: #28a745;
      margin: 0 0 15px 0;
      font-size: 16px;
      font-weight: 600;
    }
    .detail-row {
      margin: 10px 0;
      font-size: 14px;
    }
    .detail-label {
      font-weight: 600;
      color: #004b5f;
      display: inline-block;
      width: 150px;
    }
    .detail-value {
      color: #333333;
    }
    .cta-button {
      display: inline-block;
      background-color: #004b5f;
      color: #ffffff;
      padding: 14px 30px;
      text-decoration: none;
      border-radius: 8px;
      margin: 20px 0;
      font-weight: 500;
    }
    .info-box {
      background-color: #e7f3f6;
      border-radius: 8px;
      padding: 20px;
      margin: 25px 0;
    }
    .info-box p {
      margin: 0;
      font-size: 14px;
      color: #004b5f;
    }
    .info-box ul {
      margin: 10px 0;
      padding-left: 20px;
    }
    .info-box li {
      margin: 5px 0;
    }
    .footer {
      background-color: #f8f9fa;
      padding: 30px;
      text-align: center;
      border-top: 1px solid #e5e5e5;
    }
    .footer p {
      margin: 5px 0;
      font-size: 13px;
      color: #777777;
    }
    .footer-logo {
      color: #004b5f;
      font-size: 18px;
      font-weight: 300;
      margin-bottom: 10px;
    }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="header">
      <h1>✓ Meeting Confirmed</h1>
    </div>
    
    <div class="content">
      <p class="greeting">Dear ${clientName},</p>
      
      <div class="message">
        <p>Great news! Your design consultation has been confirmed. We're excited to meet with you and discuss your Ālia furnishing selections.</p>
      </div>
      
      <div class="meeting-details">
        <h3>📅 Confirmed Meeting Details</h3>
        
        <div class="detail-row">
          <span class="detail-label">Unit Number:</span>
          <span class="detail-value">${unitNumber}</span>
        </div>
        
        <div class="detail-row">
          <span class="detail-label">Date:</span>
          <span class="detail-value">${confirmedDate}</span>
        </div>
        
        <div class="detail-row">
          <span class="detail-label">Time:</span>
          <span class="detail-value">${confirmedTime}</span>
        </div>
        
        <div class="detail-row">
          <span class="detail-label">Meeting Type:</span>
          <span class="detail-value">${meetingType === 'in-person' ? 'In-Person at HDG Showroom' : 'Virtual Video Call'}</span>
        </div>
        
        ${meetingLink ? `
        <div class="detail-row" style="margin-top: 15px;">
          <span class="detail-label" style="vertical-align: top;">Meeting Link:</span>
          <span class="detail-value"><a href="${meetingLink}" style="color: #004b5f;">${meetingLink}</a></span>
        </div>
        ` : ''}
        
        ${notes ? `
        <div class="detail-row" style="margin-top: 15px;">
          <span class="detail-label" style="vertical-align: top;">Notes:</span>
          <span class="detail-value">${notes}</span>
        </div>
        ` : ''}
      </div>
      
      ${meetingType === 'in-person' ? `
      <div class="info-box">
        <p><strong>Location:</strong></p>
        <p style="margin-top: 10px;">Henderson Design Group Showroom<br>
        [Insert actual address here]</p>
        <p style="margin-top: 10px;"><strong>What to bring:</strong></p>
        <ul>
          <li>Any inspiration photos or design preferences</li>
          <li>Questions about the furnishing program</li>
          <li>Your questionnaire responses (if completed)</li>
        </ul>
      </div>
      ` : `
      <div class="info-box">
        <p><strong>Virtual Meeting:</strong></p>
        <p style="margin-top: 10px;">Please click the meeting link above at the scheduled time. We recommend joining 5 minutes early to test your connection.</p>
        <p style="margin-top: 10px;"><strong>What to prepare:</strong></p>
        <ul>
          <li>A stable internet connection</li>
          <li>Any inspiration photos to share on screen</li>
          <li>Questions about the furnishing program</li>
          <li>Your questionnaire responses (if completed)</li>
        </ul>
      </div>
      `}
      
      <div class="message">
        <p>If you need to reschedule or have any questions before our meeting, please contact us as soon as possible.</p>
        <p>We look forward to seeing you!</p>
      </div>
    </div>
    
    <div class="footer">
      <p class="footer-logo">HENDERSON DESIGN GROUP</p>
      <p>Ālia Furnishing Program</p>
      <p style="margin-top: 15px;">Questions? Contact us at anggaraputra9552@gmail.com</p>
    </div>
  </div>
</body>
</html>
  `;
};

const meetingCancellationTemplate = ({
  clientName,
  unitNumber,
  cancelledDate,
  cancelledTime,
  reason
}) => {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333333;
      margin: 0;
      padding: 0;
      background-color: #f5f5f5;
    }
    .email-container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
    }
    .header {
      background: linear-gradient(135deg, #dc3545 0%, #c82333 100%);
      padding: 40px 30px;
      text-align: center;
    }
    .header h1 {
      color: #ffffff;
      margin: 0;
      font-size: 28px;
      font-weight: 300;
      letter-spacing: 0.5px;
    }
    .content {
      padding: 40px 30px;
    }
    .greeting {
      font-size: 18px;
      margin-bottom: 20px;
      color: #004b5f;
    }
    .message {
      font-size: 15px;
      line-height: 1.8;
      color: #555555;
      margin-bottom: 30px;
    }
    .meeting-details {
      background-color: #f8f9fa;
      border-left: 4px solid #dc3545;
      padding: 20px;
      margin: 25px 0;
    }
    .meeting-details h3 {
      color: #dc3545;
      margin: 0 0 15px 0;
      font-size: 16px;
      font-weight: 600;
    }
    .detail-row {
      margin: 10px 0;
      font-size: 14px;
    }
    .detail-label {
      font-weight: 600;
      color: #004b5f;
      display: inline-block;
      width: 150px;
    }
    .detail-value {
      color: #333333;
    }
    .cta-button {
      display: inline-block;
      background-color: #004b5f;
      color: #ffffff;
      padding: 14px 30px;
      text-decoration: none;
      border-radius: 8px;
      margin: 20px 0;
      font-weight: 500;
    }
    .info-box {
      background-color: #fff3cd;
      border-radius: 8px;
      padding: 20px;
      margin: 25px 0;
      border: 1px solid #ffc107;
    }
    .info-box p {
      margin: 0;
      font-size: 14px;
      color: #856404;
    }
    .footer {
      background-color: #f8f9fa;
      padding: 30px;
      text-align: center;
      border-top: 1px solid #e5e5e5;
    }
    .footer p {
      margin: 5px 0;
      font-size: 13px;
      color: #777777;
    }
    .footer-logo {
      color: #004b5f;
      font-size: 18px;
      font-weight: 300;
      margin-bottom: 10px;
    }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="header">
      <h1>Meeting Cancelled</h1>
    </div>
    
    <div class="content">
      <p class="greeting">Dear ${clientName},</p>
      
      <div class="message">
        <p>We're writing to inform you that your scheduled design consultation has been cancelled.</p>
      </div>
      
      <div class="meeting-details">
        <h3>Cancelled Meeting Details</h3>
        
        <div class="detail-row">
          <span class="detail-label">Unit Number:</span>
          <span class="detail-value">${unitNumber}</span>
        </div>
        
        ${cancelledDate ? `
        <div class="detail-row">
          <span class="detail-label">Date:</span>
          <span class="detail-value">${cancelledDate}</span>
        </div>
        ` : ''}
        
        ${cancelledTime ? `
        <div class="detail-row">
          <span class="detail-label">Time:</span>
          <span class="detail-value">${cancelledTime}</span>
        </div>
        ` : ''}
        
        ${reason ? `
        <div class="detail-row" style="margin-top: 15px;">
          <span class="detail-label" style="vertical-align: top;">Reason:</span>
          <span class="detail-value">${reason}</span>
        </div>
        ` : ''}
      </div>
      
      <div class="info-box">
        <p><strong>Need to reschedule?</strong></p>
        <p style="margin-top: 10px;">We apologize for any inconvenience. If you'd like to schedule a new consultation, please visit your client portal or contact us directly.</p>
      </div>
      
      <div style="text-align: center;">
        <a href="[INSERT_PORTAL_URL]" class="cta-button">Schedule New Meeting</a>
      </div>
      
      <div class="message">
        <p>If you have any questions or concerns, please don't hesitate to reach out to our team.</p>
      </div>
    </div>
    
    <div class="footer">
      <p class="footer-logo">HENDERSON DESIGN GROUP</p>
      <p>Ālia Furnishing Program</p>
      <p style="margin-top: 15px;">Questions? Contact us at anggaraputra9552@gmail.com</p>
    </div>
  </div>
</body>
</html>
  `;
};

const adminMeetingNotificationTemplate = ({
  clientName,
  clientEmail,
  unitNumber,
  preferredDate,
  preferredTime,
  alternateDate,
  alternateTime,
  meetingType,
  meetingNotes,
  questionnaire
}) => {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333333;
      margin: 0;
      padding: 0;
      background-color: #f5f5f5;
    }
    .email-container {
      max-width: 650px;
      margin: 0 auto;
      background-color: #ffffff;
    }
    .header {
      background: linear-gradient(135deg, #6c757d 0%, #495057 100%);
      padding: 30px;
      text-align: center;
    }
    .header h1 {
      color: #ffffff;
      margin: 0;
      font-size: 24px;
      font-weight: 600;
    }
    .badge {
      display: inline-block;
      background-color: #ffc107;
      color: #000;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 600;
      margin-top: 10px;
    }
    .content {
      padding: 30px;
    }
    .alert {
      background-color: #fff3cd;
      border-left: 4px solid #ffc107;
      padding: 15px;
      margin-bottom: 25px;
    }
    .alert p {
      margin: 0;
      color: #856404;
      font-weight: 500;
    }
    .section {
      margin: 25px 0;
    }
    .section-title {
      color: #004b5f;
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 15px;
      padding-bottom: 8px;
      border-bottom: 2px solid #004b5f;
    }
    .detail-grid {
      display: grid;
      gap: 10px;
    }
    .detail-row {
      display: flex;
      font-size: 14px;
    }
    .detail-label {
      font-weight: 600;
      color: #495057;
      min-width: 160px;
    }
    .detail-value {
      color: #333333;
      flex: 1;
    }
    .time-option {
      background-color: #e7f3f6;
      padding: 15px;
      border-radius: 8px;
      margin: 10px 0;
    }
    .time-option-label {
      font-weight: 600;
      color: #004b5f;
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .questionnaire-summary {
      background-color: #f8f9fa;
      padding: 15px;
      border-radius: 8px;
      font-size: 13px;
    }
    .footer {
      background-color: #f8f9fa;
      padding: 20px;
      text-align: center;
      border-top: 1px solid #e5e5e5;
    }
    .footer p {
      margin: 5px 0;
      font-size: 12px;
      color: #777777;
    }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="header">
      <h1>🔔 New Meeting Request</h1>
      <span class="badge">ACTION REQUIRED</span>
    </div>
    
    <div class="content">
      <div class="alert">
        <p>A new design consultation has been requested. Please review and confirm a meeting time within 24 hours.</p>
      </div>
      
      <div class="section">
        <div class="section-title">Client Information</div>
        <div class="detail-grid">
          <div class="detail-row">
            <span class="detail-label">Name:</span>
            <span class="detail-value">${clientName}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Email:</span>
            <span class="detail-value"><a href="mailto:${clientEmail}">${clientEmail}</a></span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Unit Number:</span>
            <span class="detail-value">${unitNumber}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Meeting Type:</span>
            <span class="detail-value">${meetingType === 'in-person' ? '👥 In-Person' : '💻 Virtual'}</span>
          </div>
        </div>
      </div>
      
      <div class="section">
        <div class="section-title">Requested Time Options</div>
        
        <div class="time-option">
          <div class="time-option-label">Option 1 (Preferred)</div>
          <div style="margin-top: 8px;">
            <strong>📅 ${preferredDate}</strong><br>
            <strong>🕐 ${preferredTime}</strong>
          </div>
        </div>
        
        <div class="time-option">
          <div class="time-option-label">Option 2 (Alternate)</div>
          <div style="margin-top: 8px;">
            <strong>📅 ${alternateDate}</strong><br>
            <strong>🕐 ${alternateTime}</strong>
          </div>
        </div>
      </div>
      
      ${meetingNotes ? `
      <div class="section">
        <div class="section-title">Client Notes</div>
        <p style="font-size: 14px; color: #555;">${meetingNotes}</p>
      </div>
      ` : ''}
      
      ${questionnaire ? `
      <div class="section">
        <div class="section-title">Questionnaire Status</div>
        <div class="questionnaire-summary">
          <p><strong>Status:</strong> ${questionnaire.status}</p>
          <p><strong>Completed:</strong> ${new Date(questionnaire.updatedAt).toLocaleDateString()}</p>
          <p style="margin-top: 10px;"><em>Questionnaire responses are available in the admin portal.</em></p>
        </div>
      </div>
      ` : `
      <div class="section">
        <div class="section-title">Questionnaire Status</div>
        <div class="questionnaire-summary">
          <p style="color: #856404;"><strong>⚠️ No questionnaire submitted yet</strong></p>
          <p style="margin-top: 5px; font-size: 12px;">Consider requesting completion before the meeting.</p>
        </div>
      </div>
      `}
      
      <div class="section" style="text-align: center; margin-top: 35px;">
        <p style="color: #777; font-size: 13px; margin-bottom: 15px;">Action Required:</p>
        <a href="[INSERT_ADMIN_PORTAL_URL]" style="display: inline-block; background-color: #004b5f; color: #ffffff; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 500;">
          Review & Confirm Meeting
        </a>
      </div>
    </div>
    
    <div class="footer">
      <p>Henderson Design Group - Admin Notification</p>
      <p>This email was sent to ${process.env.ADMIN_EMAIL || 'anggaraputra9552@gmail.com'}</p>
    </div>
  </div>
</body>
</html>
  `;
};

module.exports = {
  meetingRequestTemplate,
  meetingConfirmationTemplate,
  meetingCancellationTemplate,
  adminMeetingNotificationTemplate
};