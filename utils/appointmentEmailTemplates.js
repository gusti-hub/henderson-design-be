/**
 * Email Templates for Appointment Confirmations
 * Henderson Design Group - Ālia Collections
 */

// ============================================
// APPOINTMENT CONFIRMATION TEMPLATES
// ============================================

const appointmentClientTemplate = ({ 
  clientName, 
  clientEmail,
  unitNumber, 
  appointmentDate, 
  appointmentTime, 
  duration,
  optionType,
  clientNotes 
}) => {
  const optionDisplayNames = {
    'lock-price': 'Lock 2025 Pricing',
    'design-fee': 'Design Hold Fee',
    'questions': 'Consultation'
  };

  const optionDisplayName = optionDisplayNames[optionType] || 'Consultation';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Appointment Confirmed</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 600px; max-width: 100%; border-collapse: collapse; background-color: #ffffff; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <tr>
            <td style="padding: 40px 30px; background: linear-gradient(135deg, #005670 0%, #007a9a 100%); text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold;">
                ✅ Appointment Confirmed
              </h1>
              <p style="margin: 10px 0 0 0; color: #ffffff; font-size: 14px;">
                Henderson Design Group - Ālia Collections
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
                Your consultation appointment has been confirmed! We look forward to speaking with you about your ${optionDisplayName}.
              </p>

              <!-- Appointment Details -->
              <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f8f9fa; border-radius: 8px; margin-bottom: 30px;">
                <tr>
                  <td style="padding: 25px;">
                    <h2 style="margin: 0 0 20px 0; color: #005670; font-size: 18px; font-weight: bold;">
                      📅 Appointment Details
                    </h2>
                    
                    <table style="width: 100%; border-collapse: collapse;">
                      <tr>
                        <td style="padding: 8px 0; color: #666666; font-weight: bold; width: 35%;">Date:</td>
                        <td style="padding: 8px 0; color: #333333;">${appointmentDate}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #666666; font-weight: bold;">Time:</td>
                        <td style="padding: 8px 0; color: #333333;">${appointmentTime} (Hawaii Time)</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #666666; font-weight: bold;">Duration:</td>
                        <td style="padding: 8px 0; color: #333333;">${duration} minutes</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #666666; font-weight: bold;">Unit:</td>
                        <td style="padding: 8px 0; color: #333333;">${unitNumber}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #666666; font-weight: bold;">Purpose:</td>
                        <td style="padding: 8px 0; color: #333333;">${optionDisplayName}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              ${clientNotes ? `
              <!-- Client Notes -->
              <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f8f9fa; border-radius: 8px; margin-bottom: 30px;">
                <tr>
                  <td style="padding: 25px;">
                    <h2 style="margin: 0 0 15px 0; color: #005670; font-size: 18px; font-weight: bold;">
                      📝 Your Notes
                    </h2>
                    <p style="margin: 0; color: #555555; line-height: 1.6;">
                      ${clientNotes.replace(/\n/g, '<br>')}
                    </p>
                  </td>
                </tr>
              </table>
              ` : ''}

              <!-- What to Expect -->
              <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #e8f5f9; border-radius: 8px; margin-bottom: 30px;">
                <tr>
                  <td style="padding: 25px;">
                    <h2 style="margin: 0 0 15px 0; color: #005670; font-size: 18px; font-weight: bold;">
                      💡 What to Expect
                    </h2>
                    <ul style="margin: 0; padding-left: 20px; color: #555555; line-height: 1.8;">
                      <li style="margin-bottom: 10px;">Our team will call you at the scheduled time</li>
                      <li style="margin-bottom: 10px;">We'll discuss your specific needs and answer any questions</li>
                      <li style="margin-bottom: 10px;">We'll outline the next steps in the process</li>
                      <li>The call typically lasts ${duration} minutes</li>
                    </ul>
                  </td>
                </tr>
              </table>

              <!-- Important Note -->
              <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #fff3cd; border-left: 4px solid #ffc107; margin-bottom: 30px;">
                <tr>
                  <td style="padding: 20px;">
                    <p style="margin: 0; color: #856404; line-height: 1.6;">
                      <strong>⚠️ Need to Reschedule?</strong><br>
                      If you need to change your appointment time, please contact us at least 24 hours in advance at <a href="mailto:info@henderson.house" style="color: #005670;">info@henderson.house</a>
                    </p>
                  </td>
                </tr>
              </table>

              <p style="margin: 0 0 20px 0; color: #555555; line-height: 1.6;">
                We're excited to help you create your perfect Ālia home. If you have any questions before our call, please don't hesitate to reach out.
              </p>

              <p style="margin: 0; color: #555555; line-height: 1.6;">
                Best regards,<br>
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
              <p style="margin: 0; color: #888888; font-size: 12px;">
                <a href="mailto:info@henderson.house" style="color: #005670; text-decoration: none;">info@henderson.house</a> | 
                <a href="https://henderson.house" style="color: #005670; text-decoration: none;">henderson.house</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
};

const appointmentAdminTemplate = ({ 
  clientName, 
  clientEmail, 
  clientPhone,
  unitNumber, 
  appointmentDate, 
  appointmentTime, 
  duration,
  optionType,
  clientNotes,
  submittedAt 
}) => {
  const optionDisplayNames = {
    'lock-price': 'Lock 2025 Pricing',
    'design-fee': 'Design Hold Fee',
    'questions': 'Consultation'
  };

  const optionDisplayName = optionDisplayNames[optionType] || 'Consultation';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Appointment Scheduled</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 600px; max-width: 100%; border-collapse: collapse; background-color: #ffffff; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <tr>
            <td style="padding: 40px 30px; background: linear-gradient(135deg, #005670 0%, #007a9a 100%); text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold;">
                📅 New Appointment Scheduled
              </h1>
              <p style="margin: 10px 0 0 0; color: #ffffff; font-size: 14px;">
                Henderson Design Group - Admin Notification
              </p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <p style="margin: 0 0 30px 0; color: #555555; line-height: 1.6; font-size: 16px;">
                A new consultation appointment has been scheduled:
              </p>

              <!-- Client Information -->
              <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f8f9fa; border-radius: 8px; margin-bottom: 30px;">
                <tr>
                  <td style="padding: 25px;">
                    <h2 style="margin: 0 0 20px 0; color: #005670; font-size: 18px; font-weight: bold;">
                      👤 Client Information
                    </h2>
                    
                    <table style="width: 100%; border-collapse: collapse;">
                      <tr>
                        <td style="padding: 8px 0; color: #666666; font-weight: bold; width: 35%;">Name:</td>
                        <td style="padding: 8px 0; color: #333333;"><strong>${clientName}</strong></td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #666666; font-weight: bold;">Email:</td>
                        <td style="padding: 8px 0; color: #333333;"><a href="mailto:${clientEmail}" style="color: #005670; text-decoration: none;">${clientEmail}</a></td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #666666; font-weight: bold;">Phone:</td>
                        <td style="padding: 8px 0; color: #333333;">${clientPhone}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #666666; font-weight: bold;">Unit:</td>
                        <td style="padding: 8px 0; color: #333333;"><strong>${unitNumber}</strong></td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Appointment Details -->
              <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #e8f5f9; border-radius: 8px; margin-bottom: 30px;">
                <tr>
                  <td style="padding: 25px;">
                    <h2 style="margin: 0 0 20px 0; color: #005670; font-size: 18px; font-weight: bold;">
                      📅 Appointment Details
                    </h2>
                    
                    <table style="width: 100%; border-collapse: collapse;">
                      <tr>
                        <td style="padding: 8px 0; color: #666666; font-weight: bold; width: 35%;">Date:</td>
                        <td style="padding: 8px 0; color: #333333;"><strong>${appointmentDate}</strong></td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #666666; font-weight: bold;">Time:</td>
                        <td style="padding: 8px 0; color: #333333;"><strong>${appointmentTime} HST</strong></td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #666666; font-weight: bold;">Duration:</td>
                        <td style="padding: 8px 0; color: #333333;">${duration} minutes</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #666666; font-weight: bold;">Purpose:</td>
                        <td style="padding: 8px 0; color: #333333;"><strong>${optionDisplayName}</strong></td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #666666; font-weight: bold;">Scheduled:</td>
                        <td style="padding: 8px 0; color: #333333;">${submittedAt}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              ${clientNotes ? `
              <!-- Client Notes -->
              <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #fff3cd; border-radius: 8px; margin-bottom: 30px;">
                <tr>
                  <td style="padding: 25px;">
                    <h2 style="margin: 0 0 15px 0; color: #856404; font-size: 18px; font-weight: bold;">
                      📝 Client Notes
                    </h2>
                    <p style="margin: 0; color: #555555; line-height: 1.6;">
                      ${clientNotes.replace(/\n/g, '<br>')}
                    </p>
                  </td>
                </tr>
              </table>
              ` : ''}

              <!-- Action Required -->
              <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #d4edda; border-left: 4px solid #28a745; margin-bottom: 30px;">
                <tr>
                  <td style="padding: 20px;">
                    <p style="margin: 0; color: #155724; line-height: 1.6;">
                      <strong>✅ Action Required:</strong><br>
                      Please add this appointment to your calendar and prepare to call the client at the scheduled time.
                    </p>
                  </td>
                </tr>
              </table>

              <p style="margin: 0; color: #555555; line-height: 1.6;">
                <em>This is an automated notification from the Ālia Next Steps system.</em>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 30px; background-color: #f8f9fa; text-align: center; border-top: 1px solid #e0e0e0;">
              <p style="margin: 0; color: #888888; font-size: 12px;">
                Henderson Design Group - Admin Dashboard<br>
                Ālia Collections Next Steps System
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
};

module.exports = {
  appointmentClientTemplate,
  appointmentAdminTemplate
};