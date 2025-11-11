/**
 * Email Templates for Brevo Integration - English Version
 * Henderson Design Group - Meeting System
 * For International Clients
 */

// Template 1: Meeting Request Confirmation
const meetingRequestTemplate = ({ clientName, unitNumber, preferredDate, preferredTime, alternateDate, alternateTime, meetingType, notes }) => {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Meeting Request Confirmation</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
      <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr>
          <td align="center" style="padding: 40px 0;">
            <table role="presentation" style="width: 600px; max-width: 100%; border-collapse: collapse; background-color: #ffffff; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
              
              <!-- Header -->
              <tr>
                <td style="padding: 40px 30px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); text-align: center;">
                  <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold;">
                    Henderson Design Group
                  </h1>
                  <p style="margin: 10px 0 0 0; color: #ffffff; font-size: 14px;">
                    Transforming Spaces, Creating Dreams
                  </p>
                </td>
              </tr>

              <!-- Content -->
              <tr>
                <td style="padding: 40px 30px;">
                  <h2 style="margin: 0 0 20px 0; color: #2c3e50; font-size: 24px;">
                    📅 Meeting Request Received
                  </h2>
                  
                  <p style="margin: 0 0 20px 0; color: #555555; line-height: 1.6;">
                    Dear <strong>${clientName}</strong>,
                  </p>
                  
                  <p style="margin: 0 0 30px 0; color: #555555; line-height: 1.6;">
                    Thank you for submitting your meeting request with our team. Here are the details you provided:
                  </p>

                  <!-- Meeting Details Box -->
                  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f8f9fa; border-radius: 8px; margin-bottom: 30px;">
                    <tr>
                      <td style="padding: 25px;">
                        <h3 style="margin: 0 0 15px 0; color: #2c3e50; font-size: 18px;">
                          📋 Meeting Details
                        </h3>
                        
                        <table role="presentation" style="width: 100%; border-collapse: collapse;">
                          <tr>
                            <td style="padding: 8px 0; color: #555555; font-weight: bold; width: 40%;">
                              Unit Number:
                            </td>
                            <td style="padding: 8px 0; color: #555555;">
                              ${unitNumber}
                            </td>
                          </tr>
                          <tr>
                            <td style="padding: 8px 0; color: #555555; font-weight: bold;">
                              Meeting Type:
                            </td>
                            <td style="padding: 8px 0; color: #555555;">
                              ${meetingType === 'virtual' ? '💻 Virtual (Online)' : '🏢 In-Person'}
                            </td>
                          </tr>
                          <tr>
                            <td colspan="2" style="padding: 15px 0 8px 0; color: #555555; font-weight: bold;">
                              Option 1 (Preferred):
                            </td>
                          </tr>
                          <tr>
                            <td colspan="2" style="padding: 4px 0 4px 20px; color: #555555;">
                              📅 ${preferredDate}
                            </td>
                          </tr>
                          <tr>
                            <td colspan="2" style="padding: 4px 0 4px 20px; color: #555555;">
                              🕐 ${preferredTime}
                            </td>
                          </tr>
                          <tr>
                            <td colspan="2" style="padding: 15px 0 8px 0; color: #555555; font-weight: bold;">
                              Option 2 (Alternate):
                            </td>
                          </tr>
                          <tr>
                            <td colspan="2" style="padding: 4px 0 4px 20px; color: #555555;">
                              📅 ${alternateDate}
                            </td>
                          </tr>
                          <tr>
                            <td colspan="2" style="padding: 4px 0 4px 20px; color: #555555;">
                              🕐 ${alternateTime}
                            </td>
                          </tr>
                          ${notes ? `
                          <tr>
                            <td colspan="2" style="padding: 15px 0 8px 0; color: #555555; font-weight: bold;">
                              Additional Notes:
                            </td>
                          </tr>
                          <tr>
                            <td colspan="2" style="padding: 4px 0; color: #555555;">
                              ${notes}
                            </td>
                          </tr>
                          ` : ''}
                        </table>
                      </td>
                    </tr>
                  </table>

                  <!-- Status Box -->
                  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #fff3cd; border-radius: 8px; border-left: 4px solid #ffc107; margin-bottom: 30px;">
                    <tr>
                      <td style="padding: 20px;">
                        <h4 style="margin: 0 0 10px 0; color: #856404; font-size: 16px;">
                          ⏳ Awaiting Confirmation
                        </h4>
                        <p style="margin: 0; color: #856404; line-height: 1.6;">
                          Our team will review your request and send you a confirmation of your meeting schedule within <strong>1-2 business days</strong>.
                        </p>
                      </td>
                    </tr>
                  </table>

                  <!-- Next Steps -->
                  <h4 style="margin: 0 0 15px 0; color: #2c3e50; font-size: 16px;">
                    📝 What Happens Next:
                  </h4>
                  <ul style="margin: 0 0 30px 0; padding-left: 20px; color: #555555; line-height: 1.8;">
                    <li>Our team will review your preferred schedule</li>
                    <li>We will confirm one of your selected options</li>
                    <li>You will receive a final confirmation email with complete details</li>
                    <li>If adjustments are needed, we will contact you directly</li>
                  </ul>

                  <p style="margin: 30px 0 0 0; color: #555555; line-height: 1.6;">
                    We look forward to discussing your interior design project with you!
                  </p>

                </td>
              </tr>

              <!-- Contact Info -->
              <tr>
                <td style="padding: 30px; background-color: #f8f9fa; border-top: 1px solid #dee2e6;">
                  <p style="margin: 0 0 10px 0; color: #6c757d; font-size: 14px;">
                    <strong>Need Assistance?</strong>
                  </p>
                  <p style="margin: 0; color: #6c757d; font-size: 14px; line-height: 1.6;">
                    📧 Email: aloha@henderson.house<br/>
                  </p>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="padding: 20px 30px; background-color: #2c3e50; text-align: center;">
                  <p style="margin: 0; color: #ffffff; font-size: 12px;">
                    © 2025 Henderson Design Group. All rights reserved.
                  </p>
                  <p style="margin: 10px 0 0 0; color: #95a5a6; font-size: 11px;">
                    This email was sent because you submitted a meeting request through our client portal.
                  </p>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
};

// Template 2: Meeting Confirmation
const meetingConfirmationTemplate = ({ clientName, unitNumber, confirmedDate, confirmedTime, meetingType, meetingLink, notes }) => {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Meeting Confirmed</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
      <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr>
          <td align="center" style="padding: 40px 0;">
            <table role="presentation" style="width: 600px; max-width: 100%; border-collapse: collapse; background-color: #ffffff; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
              
              <!-- Header -->
              <tr>
                <td style="padding: 40px 30px; background: linear-gradient(135deg, #28a745 0%, #20c997 100%); text-align: center;">
                  <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold;">
                    ✅ Meeting Confirmed!
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
                    Dear <strong>${clientName}</strong>,
                  </p>
                  
                  <p style="margin: 0 0 30px 0; color: #555555; line-height: 1.6;">
                    Great news! Your meeting has been confirmed. Here are the final details:
                  </p>

                  <!-- Meeting Details Box -->
                  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #d4edda; border-radius: 8px; border-left: 4px solid #28a745; margin-bottom: 30px;">
                    <tr>
                      <td style="padding: 25px;">
                        <h3 style="margin: 0 0 15px 0; color: #155724; font-size: 18px;">
                          📅 Confirmed Meeting Details
                        </h3>
                        
                        <table role="presentation" style="width: 100%; border-collapse: collapse;">
                          <tr>
                            <td style="padding: 8px 0; color: #155724; font-weight: bold; width: 40%;">
                              Unit Number:
                            </td>
                            <td style="padding: 8px 0; color: #155724;">
                              ${unitNumber}
                            </td>
                          </tr>
                          <tr>
                            <td style="padding: 8px 0; color: #155724; font-weight: bold;">
                              Date:
                            </td>
                            <td style="padding: 8px 0; color: #155724; font-size: 18px; font-weight: bold;">
                              📅 ${confirmedDate}
                            </td>
                          </tr>
                          <tr>
                            <td style="padding: 8px 0; color: #155724; font-weight: bold;">
                              Time:
                            </td>
                            <td style="padding: 8px 0; color: #155724; font-size: 18px; font-weight: bold;">
                              🕐 ${confirmedTime}
                            </td>
                          </tr>
                          <tr>
                            <td style="padding: 8px 0; color: #155724; font-weight: bold;">
                              Meeting Type:
                            </td>
                            <td style="padding: 8px 0; color: #155724;">
                              ${meetingType === 'virtual' ? '💻 Virtual (Online)' : '🏢 In-Person'}
                            </td>
                          </tr>
                          ${meetingLink ? `
                          <tr>
                            <td style="padding: 8px 0; color: #155724; font-weight: bold;">
                              Meeting Link:
                            </td>
                            <td style="padding: 8px 0;">
                              <a href="${meetingLink}" style="color: #007bff; text-decoration: none; font-weight: bold;">
                                Join Meeting
                              </a>
                            </td>
                          </tr>
                          ` : ''}
                          ${notes ? `
                          <tr>
                            <td colspan="2" style="padding: 15px 0 8px 0; color: #155724; font-weight: bold;">
                              Additional Notes:
                            </td>
                          </tr>
                          <tr>
                            <td colspan="2" style="padding: 4px 0; color: #155724;">
                              ${notes}
                            </td>
                          </tr>
                          ` : ''}
                        </table>
                      </td>
                    </tr>
                  </table>

                  <!-- Preparation Tips -->
                  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f8f9fa; border-radius: 8px; margin-bottom: 30px;">
                    <tr>
                      <td style="padding: 25px;">
                        <h4 style="margin: 0 0 15px 0; color: #2c3e50; font-size: 16px;">
                          💡 Meeting Preparation Tips:
                        </h4>
                        <ul style="margin: 0; padding-left: 20px; color: #555555; line-height: 1.8;">
                          <li>Please arrive 5-10 minutes early</li>
                          <li>Prepare any design references or inspiration you'd like to share</li>
                          <li>Create a list of questions or specific requirements</li>
                          ${meetingType === 'virtual' ? 
                            '<li>Ensure stable internet connection and working camera/microphone</li>' : 
                            '<li>Our office address: [Henderson Design Office Address]</li>'}
                          <li>Bring any documents or photos of the space you wish to renovate (if available)</li>
                        </ul>
                      </td>
                    </tr>
                  </table>

                  <!-- Add to Calendar -->
                  <table role="presentation" style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                    <tr>
                      <td align="center" style="padding: 10px 0;">
                        <p style="margin: 0; color: #555555; font-size: 14px;">
                          💡 <strong>Tip:</strong> Add this meeting to your calendar so you don't forget!
                        </p>
                      </td>
                    </tr>
                  </table>

                  <p style="margin: 0; color: #555555; line-height: 1.6; text-align: center; font-size: 16px;">
                    <strong>We look forward to meeting you and bringing your design vision to life!</strong>
                  </p>

                </td>
              </tr>

              <!-- Contact Info -->
              <tr>
                <td style="padding: 30px; background-color: #f8f9fa; border-top: 1px solid #dee2e6;">
                  <p style="margin: 0 0 10px 0; color: #6c757d; font-size: 14px;">
                    <strong>Need to Reschedule or Have Questions?</strong>
                  </p>
                  <p style="margin: 0; color: #6c757d; font-size: 14px; line-height: 1.6;">
                    📧 Email: aloha@henderson.house<br/>
                  </p>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="padding: 20px 30px; background-color: #2c3e50; text-align: center;">
                  <p style="margin: 0; color: #ffffff; font-size: 12px;">
                    © 2025 Henderson Design Group. All rights reserved.
                  </p>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
};

// Template 3: Meeting Cancellation
const meetingCancellationTemplate = ({ clientName, unitNumber, cancelledDate, cancelledTime, reason }) => {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Meeting Cancelled</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
      <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr>
          <td align="center" style="padding: 40px 0;">
            <table role="presentation" style="width: 600px; max-width: 100%; border-collapse: collapse; background-color: #ffffff; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
              
              <!-- Header -->
              <tr>
                <td style="padding: 40px 30px; background-color: #dc3545; text-align: center;">
                  <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold;">
                    ❌ Meeting Cancelled
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
                    Dear <strong>${clientName}</strong>,
                  </p>
                  
                  <p style="margin: 0 0 30px 0; color: #555555; line-height: 1.6;">
                    We regret to inform you that the scheduled meeting has been cancelled.
                  </p>

                  <!-- Cancelled Meeting Details -->
                  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f8d7da; border-radius: 8px; border-left: 4px solid #dc3545; margin-bottom: 30px;">
                    <tr>
                      <td style="padding: 25px;">
                        <h3 style="margin: 0 0 15px 0; color: #721c24; font-size: 18px;">
                          Cancelled Meeting Details:
                        </h3>
                        
                        <table role="presentation" style="width: 100%; border-collapse: collapse;">
                          <tr>
                            <td style="padding: 8px 0; color: #721c24; font-weight: bold; width: 40%;">
                              Unit Number:
                            </td>
                            <td style="padding: 8px 0; color: #721c24;">
                              ${unitNumber}
                            </td>
                          </tr>
                          <tr>
                            <td style="padding: 8px 0; color: #721c24; font-weight: bold;">
                              Date:
                            </td>
                            <td style="padding: 8px 0; color: #721c24;">
                              ${cancelledDate || 'Not yet confirmed'}
                            </td>
                          </tr>
                          <tr>
                            <td style="padding: 8px 0; color: #721c24; font-weight: bold;">
                              Time:
                            </td>
                            <td style="padding: 8px 0; color: #721c24;">
                              ${cancelledTime || 'Not yet confirmed'}
                            </td>
                          </tr>
                          ${reason ? `
                          <tr>
                            <td colspan="2" style="padding: 15px 0 8px 0; color: #721c24; font-weight: bold;">
                              Reason for Cancellation:
                            </td>
                          </tr>
                          <tr>
                            <td colspan="2" style="padding: 4px 0; color: #721c24;">
                              ${reason}
                            </td>
                          </tr>
                          ` : ''}
                        </table>
                      </td>
                    </tr>
                  </table>

                  <!-- Reschedule Option -->
                  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #d1ecf1; border-radius: 8px; border-left: 4px solid #17a2b8; margin-bottom: 30px;">
                    <tr>
                      <td style="padding: 25px;">
                        <h4 style="margin: 0 0 10px 0; color: #0c5460; font-size: 16px;">
                          🔄 Would You Like to Reschedule?
                        </h4>
                        <p style="margin: 0; color: #0c5460; line-height: 1.6;">
                          If you would like to schedule a new meeting, please contact us or submit a new meeting request through our client portal.
                        </p>
                      </td>
                    </tr>
                  </table>

                  <p style="margin: 0; color: #555555; line-height: 1.6; text-align: center;">
                    We sincerely apologize for any inconvenience this may have caused.
                  </p>

                </td>
              </tr>

              <!-- Contact Info -->
              <tr>
                <td style="padding: 30px; background-color: #f8f9fa; border-top: 1px solid #dee2e6;">
                  <p style="margin: 0 0 10px 0; color: #6c757d; font-size: 14px;">
                    <strong>Get in Touch:</strong>
                  </p>
                  <p style="margin: 0; color: #6c757d; font-size: 14px; line-height: 1.6;">
                    📧 Email: aloha@henderson.house<br/>
                  </p>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="padding: 20px 30px; background-color: #2c3e50; text-align: center;">
                  <p style="margin: 0; color: #ffffff; font-size: 12px;">
                    © 2025 Henderson Design Group. All rights reserved.
                  </p>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
};

/**
 * Admin Notification Email Template
 * Sent when client schedules a meeting
 * Includes: Meeting details + Questionnaire results
 */

const adminMeetingNotificationTemplate = ({ 
  clientName, 
  clientEmail, 
  unitNumber,
  // Meeting details
  preferredDate, 
  preferredTime, 
  alternateDate, 
  alternateTime,
  meetingType,
  meetingNotes,
  // Questionnaire data
  questionnaire 
}) => {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>New Meeting Request - ${unitNumber}</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
      <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr>
          <td align="center" style="padding: 40px 0;">
            <table role="presentation" style="width: 800px; max-width: 100%; border-collapse: collapse; background-color: #ffffff; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
              
              <!-- Header -->
              <tr>
                <td style="padding: 40px 30px; background: linear-gradient(135deg, #dc3545 0%, #c82333 100%); text-align: center;">
                  <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold;">
                    🔔 New Meeting Request
                  </h1>
                  <p style="margin: 10px 0 0 0; color: #ffffff; font-size: 14px;">
                    From Client Portal - Requires Your Attention
                  </p>
                </td>
              </tr>

              <!-- Client Info -->
              <tr>
                <td style="padding: 30px;">
                  <div style="background-color: #e3f2fd; border-left: 4px solid #2196f3; padding: 20px; border-radius: 4px; margin-bottom: 30px;">
                    <h2 style="margin: 0 0 15px 0; color: #1976d2; font-size: 20px;">👤 Client Information</h2>
                    <table style="width: 100%; border-collapse: collapse;">
                      <tr>
                        <td style="padding: 8px 0; color: #333; font-weight: bold; width: 30%;">Client Name:</td>
                        <td style="padding: 8px 0; color: #555;">${clientName}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #333; font-weight: bold;">Email:</td>
                        <td style="padding: 8px 0; color: #555;">${clientEmail}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #333; font-weight: bold;">Unit Number:</td>
                        <td style="padding: 8px 0; color: #555; font-size: 18px; font-weight: bold;">${unitNumber}</td>
                      </tr>
                    </table>
                  </div>

                  <!-- Meeting Details -->
                  <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 20px; border-radius: 4px; margin-bottom: 30px;">
                    <h2 style="margin: 0 0 15px 0; color: #856404; font-size: 20px;">📅 Meeting Schedule</h2>
                    
                    <div style="background-color: #ffffff; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                      <h3 style="margin: 0 0 10px 0; color: #2c3e50; font-size: 16px;">Option 1 (Preferred):</h3>
                      <table style="width: 100%;">
                        <tr>
                          <td style="padding: 5px 0; color: #333; font-weight: bold; width: 30%;">Date:</td>
                          <td style="padding: 5px 0; color: #555;">${preferredDate}</td>
                        </tr>
                        <tr>
                          <td style="padding: 5px 0; color: #333; font-weight: bold;">Time:</td>
                          <td style="padding: 5px 0; color: #555;">${preferredTime}</td>
                        </tr>
                      </table>
                    </div>

                    <div style="background-color: #ffffff; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                      <h3 style="margin: 0 0 10px 0; color: #2c3e50; font-size: 16px;">Option 2 (Alternate):</h3>
                      <table style="width: 100%;">
                        <tr>
                          <td style="padding: 5px 0; color: #333; font-weight: bold; width: 30%;">Date:</td>
                          <td style="padding: 5px 0; color: #555;">${alternateDate}</td>
                        </tr>
                        <tr>
                          <td style="padding: 5px 0; color: #333; font-weight: bold;">Time:</td>
                          <td style="padding: 5px 0; color: #555;">${alternateTime}</td>
                        </tr>
                      </table>
                    </div>

                    <table style="width: 100%;">
                      <tr>
                        <td style="padding: 8px 0; color: #333; font-weight: bold; width: 30%;">Meeting Type:</td>
                        <td style="padding: 8px 0; color: #555;">${meetingType === 'virtual' ? '💻 Virtual (Online)' : '🏢 In-Person'}</td>
                      </tr>
                      ${meetingNotes ? `
                      <tr>
                        <td style="padding: 8px 0; color: #333; font-weight: bold; vertical-align: top;">Notes:</td>
                        <td style="padding: 8px 0; color: #555;">${meetingNotes}</td>
                      </tr>
                      ` : ''}
                    </table>
                  </div>

                  <!-- Questionnaire Results -->
                  ${questionnaire ? `
                  <div style="background-color: #f8f9fa; border-left: 4px solid #6c757d; padding: 20px; border-radius: 4px; margin-bottom: 30px;">
                    <h2 style="margin: 0 0 20px 0; color: #495057; font-size: 20px;">📋 Design Questionnaire Results</h2>
                    
                    <!-- Home Use & Lifestyle -->
                    <div style="background-color: #ffffff; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                      <h3 style="margin: 0 0 15px 0; color: #005670; font-size: 18px; border-bottom: 2px solid #005670; padding-bottom: 8px;">
                        🏠 Home Use & Lifestyle
                      </h3>
                      <table style="width: 100%; line-height: 1.8;">
                        <tr>
                          <td style="padding: 5px 0; color: #333; font-weight: bold; width: 35%;">Purpose:</td>
                          <td style="padding: 5px 0; color: #555;">${questionnaire.homeUse?.purpose || 'Not specified'}</td>
                        </tr>
                        <tr>
                          <td style="padding: 5px 0; color: #333; font-weight: bold;">Primary Users:</td>
                          <td style="padding: 5px 0; color: #555;">${questionnaire.homeUse?.primaryUsers || 'Not specified'}</td>
                        </tr>
                        ${questionnaire.homeUse?.familyMembers ? `
                        <tr>
                          <td style="padding: 5px 0; color: #333; font-weight: bold;">Family Members:</td>
                          <td style="padding: 5px 0; color: #555;">${questionnaire.homeUse.familyMembers}</td>
                        </tr>
                        ` : ''}
                        ${questionnaire.homeUse?.childrenAges ? `
                        <tr>
                          <td style="padding: 5px 0; color: #333; font-weight: bold;">Children Ages:</td>
                          <td style="padding: 5px 0; color: #555;">${questionnaire.homeUse.childrenAges}</td>
                        </tr>
                        ` : ''}
                        ${questionnaire.homeUse?.hasPets ? `
                        <tr>
                          <td style="padding: 5px 0; color: #333; font-weight: bold;">Pets:</td>
                          <td style="padding: 5px 0; color: #555;">${questionnaire.homeUse.petDetails || 'Yes'}</td>
                        </tr>
                        ` : ''}
                        <tr>
                          <td style="padding: 5px 0; color: #333; font-weight: bold;">Living Style:</td>
                          <td style="padding: 5px 0; color: #555;">${questionnaire.homeUse?.livingStyle || 'Not specified'}</td>
                        </tr>
                        ${questionnaire.homeUse?.desiredFeel?.length > 0 ? `
                        <tr>
                          <td style="padding: 5px 0; color: #333; font-weight: bold; vertical-align: top;">Desired Feel:</td>
                          <td style="padding: 5px 0; color: #555;">${questionnaire.homeUse.desiredFeel.join(', ')}</td>
                        </tr>
                        ` : ''}
                      </table>
                    </div>

                    <!-- Work from Home -->
                    ${(questionnaire.workFromHome?.homeOfficeNeeded || questionnaire.workFromHome?.deskNeeded) ? `
                    <div style="background-color: #ffffff; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                      <h3 style="margin: 0 0 15px 0; color: #005670; font-size: 18px; border-bottom: 2px solid #005670; padding-bottom: 8px;">
                        💼 Work from Home
                      </h3>
                      <ul style="margin: 0; padding-left: 20px; color: #555;">
                        ${questionnaire.workFromHome.homeOfficeNeeded ? '<li>Home office needed</li>' : ''}
                        ${questionnaire.workFromHome.deskNeeded ? '<li>Dedicated desk needed</li>' : ''}
                      </ul>
                    </div>
                    ` : ''}

                    <!-- Design Options -->
                    ${questionnaire.designOptions ? `
                    <div style="background-color: #ffffff; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                      <h3 style="margin: 0 0 15px 0; color: #005670; font-size: 18px; border-bottom: 2px solid #005670; padding-bottom: 8px;">
                        🎨 Design Preferences
                      </h3>
                      <table style="width: 100%; line-height: 1.8;">
                        ${questionnaire.designOptions.designType ? `
                        <tr>
                          <td style="padding: 5px 0; color: #333; font-weight: bold; width: 35%;">Design Type:</td>
                          <td style="padding: 5px 0; color: #555;">${questionnaire.designOptions.designType}</td>
                        </tr>
                        ` : ''}
                        ${questionnaire.designOptions.preferredCollection ? `
                        <tr>
                          <td style="padding: 5px 0; color: #333; font-weight: bold;">Collection:</td>
                          <td style="padding: 5px 0; color: #555;">${questionnaire.designOptions.preferredCollection}</td>
                        </tr>
                        ` : ''}
                        ${questionnaire.designOptions.styleDirection ? `
                        <tr>
                          <td style="padding: 5px 0; color: #333; font-weight: bold;">Style Direction:</td>
                          <td style="padding: 5px 0; color: #555;">${questionnaire.designOptions.styleDirection}</td>
                        </tr>
                        ` : ''}
                        ${questionnaire.designOptions.mainUpholsteryColor ? `
                        <tr>
                          <td style="padding: 5px 0; color: #333; font-weight: bold;">Main Upholstery:</td>
                          <td style="padding: 5px 0; color: #555;">${questionnaire.designOptions.mainUpholsteryColor}</td>
                        </tr>
                        ` : ''}
                        ${questionnaire.designOptions.accentColors?.length > 0 ? `
                        <tr>
                          <td style="padding: 5px 0; color: #333; font-weight: bold; vertical-align: top;">Accent Colors:</td>
                          <td style="padding: 5px 0; color: #555;">${questionnaire.designOptions.accentColors.join(', ')}</td>
                        </tr>
                        ` : ''}
                        ${questionnaire.designOptions.metalTone ? `
                        <tr>
                          <td style="padding: 5px 0; color: #333; font-weight: bold;">Metal Tone:</td>
                          <td style="padding: 5px 0; color: #555;">${questionnaire.designOptions.metalTone}</td>
                        </tr>
                        ` : ''}
                      </table>
                    </div>
                    ` : ''}

                    <!-- Bedrooms -->
                    ${questionnaire.bedrooms ? `
                    <div style="background-color: #ffffff; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                      <h3 style="margin: 0 0 15px 0; color: #005670; font-size: 18px; border-bottom: 2px solid #005670; padding-bottom: 8px;">
                        🛏️ Bedroom Preferences
                      </h3>
                      <table style="width: 100%; line-height: 1.8;">
                        ${questionnaire.bedrooms.bedSizes?.length > 0 ? `
                        <tr>
                          <td style="padding: 5px 0; color: #333; font-weight: bold; width: 35%;">Bed Sizes:</td>
                          <td style="padding: 5px 0; color: #555;">${questionnaire.bedrooms.bedSizes.join(', ')}</td>
                        </tr>
                        ` : ''}
                        ${questionnaire.bedrooms.mattressFirmness ? `
                        <tr>
                          <td style="padding: 5px 0; color: #333; font-weight: bold;">Mattress Firmness:</td>
                          <td style="padding: 5px 0; color: #555;">${questionnaire.bedrooms.mattressFirmness}</td>
                        </tr>
                        ` : ''}
                        ${questionnaire.bedrooms.beddingType?.length > 0 ? `
                        <tr>
                          <td style="padding: 5px 0; color: #333; font-weight: bold; vertical-align: top;">Bedding Type:</td>
                          <td style="padding: 5px 0; color: #555;">${questionnaire.bedrooms.beddingType.join(', ')}</td>
                        </tr>
                        ` : ''}
                        ${questionnaire.bedrooms.lightingMood ? `
                        <tr>
                          <td style="padding: 5px 0; color: #333; font-weight: bold;">Lighting Mood:</td>
                          <td style="padding: 5px 0; color: #555;">${questionnaire.bedrooms.lightingMood}</td>
                        </tr>
                        ` : ''}
                      </table>
                    </div>
                    ` : ''}

                    <!-- Add-ons -->
                    ${(questionnaire.closetSolutions?.interested || questionnaire.windowCoverings?.interested || questionnaire.audioVisual?.interested || questionnaire.greenery?.interested || questionnaire.kitchenEssentials?.interested) ? `
                    <div style="background-color: #ffffff; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                      <h3 style="margin: 0 0 15px 0; color: #005670; font-size: 18px; border-bottom: 2px solid #005670; padding-bottom: 8px;">
                        ⭐ Add-On Services Requested
                      </h3>
                      <ul style="margin: 0; padding-left: 20px; color: #555; line-height: 1.8;">
                        ${questionnaire.closetSolutions?.interested ? '<li><strong>Closet Solutions</strong></li>' : ''}
                        ${questionnaire.windowCoverings?.interested ? '<li><strong>Window Coverings</strong></li>' : ''}
                        ${questionnaire.audioVisual?.interested ? '<li><strong>Audio/Visual</strong></li>' : ''}
                        ${questionnaire.greenery?.interested ? '<li><strong>Greenery/Plants</strong></li>' : ''}
                        ${questionnaire.kitchenEssentials?.interested ? '<li><strong>Kitchen Essentials</strong></li>' : ''}
                      </ul>
                    </div>
                    ` : ''}

                    <!-- Additional Notes -->
                    ${questionnaire.additionalNotes ? `
                    <div style="background-color: #ffffff; padding: 15px; border-radius: 8px;">
                      <h3 style="margin: 0 0 10px 0; color: #005670; font-size: 18px; border-bottom: 2px solid #005670; padding-bottom: 8px;">
                        📝 Additional Notes
                      </h3>
                      <p style="margin: 0; color: #555; line-height: 1.6; white-space: pre-wrap;">${questionnaire.additionalNotes}</p>
                    </div>
                    ` : ''}
                  </div>
                  ` : `
                  <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 20px; border-radius: 4px; margin-bottom: 30px;">
                    <p style="margin: 0; color: #856404;">
                      ⚠️ <strong>Note:</strong> Client has not yet completed the design questionnaire.
                    </p>
                  </div>
                  `}

                  <!-- Action Required -->
                  <div style="background-color: #d4edda; border-left: 4px solid #28a745; padding: 20px; border-radius: 4px;">
                    <h3 style="margin: 0 0 15px 0; color: #155724; font-size: 18px;">✅ Next Steps:</h3>
                    <ol style="margin: 0; padding-left: 20px; color: #155724; line-height: 1.8;">
                      <li>Review the meeting schedule and questionnaire results</li>
                      <li>Confirm or adjust the meeting time</li>
                      <li>Send meeting confirmation to client via admin panel</li>
                      <li>Prepare design materials based on questionnaire responses</li>
                    </ol>
                  </div>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="padding: 30px; background-color: #f8f9fa; text-align: center; border-top: 1px solid #dee2e6;">
                  <p style="margin: 0 0 10px 0; color: #6c757d; font-size: 14px;">
                    <strong>This is an automated notification from Henderson Design Interior Client Portal</strong>
                  </p>
                  <p style="margin: 0; color: #6c757d; font-size: 12px;">
                    Received: ${new Date().toLocaleString('en-US', { 
                      weekday: 'long', 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric', 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </p>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
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

