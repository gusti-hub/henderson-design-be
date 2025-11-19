// utils/journeyEmailTemplates.js

const journeyStepEmailTemplate = ({ 
  clientName,
  stepNumber,
  stepTitle,
  stepDescription,
  adminMessage,
  estimatedDate,
  actionRequired
}) => {
  const formatDate = (date) => {
    if (!date) return null;
    return new Date(date).toLocaleDateString('en-US', { 
      weekday: 'long',
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Journey Update</title>
  <style>
    /* Senior-friendly styles */
    body { 
      font-size: 18px !important; 
      line-height: 1.8 !important;
    }
    .large-text { 
      font-size: 20px !important; 
      font-weight: bold;
    }
    .extra-large-text {
      font-size: 24px !important;
      font-weight: bold;
    }
  </style>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4; font-size: 18px;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="width: 650px; max-width: 100%; border-collapse: collapse; background-color: #ffffff; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
          
          <!-- Header -->
          <tr>
            <td style="padding: 50px 40px; background: linear-gradient(135deg, #005670 0%, #007a9a 100%); text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: bold;">
                📬 Journey Update
              </h1>
              <p style="margin: 15px 0 0 0; color: #ffffff; font-size: 18px; line-height: 1.6;">
                Step ${stepNumber}: ${stepTitle}
              </p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 50px 40px;">
              <p class="extra-large-text" style="margin: 0 0 30px 0; color: #333333; font-size: 24px;">
                Hello ${clientName},
              </p>

              ${actionRequired ? `
              <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #fff3cd; border-radius: 12px; margin-bottom: 40px; border: 3px solid #ffc107;">
                <tr>
                  <td style="padding: 30px;">
                    <p style="margin: 0; color: #856404; font-size: 22px; font-weight: bold; line-height: 1.8;">
                      ⚠️ ACTION REQUIRED
                    </p>
                    <p style="margin: 15px 0 0 0; color: #856404; font-size: 18px; line-height: 1.8;">
                      Please review this update and respond if needed.
                    </p>
                  </td>
                </tr>
              </table>
              ` : ''}

              <!-- Step Details -->
              <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f8f9fa; border-radius: 12px; margin-bottom: 40px; border: 2px solid #dee2e6;">
                <tr>
                  <td style="padding: 35px;">
                    <h2 style="margin: 0 0 25px 0; color: #005670; font-size: 24px; font-weight: bold;">
                      Current Step
                    </h2>
                    
                    <p class="large-text" style="margin: 0 0 20px 0; color: #333333; font-size: 20px; line-height: 1.8;">
                      <strong>${stepTitle}</strong>
                    </p>
                    
                    <p style="margin: 0; color: #555555; font-size: 18px; line-height: 1.8;">
                      ${stepDescription}
                    </p>

                    ${estimatedDate ? `
                    <div style="margin-top: 25px; padding-top: 25px; border-top: 2px solid #dee2e6;">
                      <p style="margin: 0; color: #666666; font-size: 16px;">
                        <strong>Estimated completion:</strong>
                      </p>
                      <p class="large-text" style="margin: 10px 0 0 0; color: #005670; font-size: 20px;">
                        ${formatDate(estimatedDate)}
                      </p>
                    </div>
                    ` : ''}
                  </td>
                </tr>
              </table>

              ${adminMessage ? `
              <!-- Message from Team -->
              <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #e8f5f9; border-radius: 12px; margin-bottom: 40px; border: 2px solid #bee5eb;">
                <tr>
                  <td style="padding: 35px;">
                    <h2 style="margin: 0 0 20px 0; color: #005670; font-size: 24px; font-weight: bold;">
                      💬 Message from Our Team
                    </h2>
                    <p style="margin: 0; color: #333333; font-size: 18px; line-height: 1.8; white-space: pre-wrap;">
                      ${adminMessage}
                    </p>
                  </td>
                </tr>
              </table>
              ` : ''}

              <!-- Call to Action -->
              <table role="presentation" style="width: 100%; border-collapse: collapse; margin-bottom: 40px;">
                <tr>
                  <td align="center" style="padding: 20px 0;">
                    <a href="${process.env.FRONTEND_URL || 'https://alia.henderson.house'}/portal-login" 
                       style="display: inline-block; padding: 20px 50px; background: linear-gradient(135deg, #005670 0%, #007a9a 100%); color: #ffffff; text-decoration: none; border-radius: 12px; font-size: 20px; font-weight: bold; box-shadow: 0 4px 8px rgba(0,86,112,0.3);">
                      👉 View Your Portal
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 0 0 25px 0; color: #555555; font-size: 18px; line-height: 1.8;">
                You can reply to this update directly in your client portal, or contact us:
              </p>

              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 15px 0;">
                    <p style="margin: 0; color: #005670; font-size: 18px;">
                      📧 <a href="mailto:info@henderson.house" style="color: #005670; text-decoration: none; font-weight: bold;">info@henderson.house</a>
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 15px 0;">
                    <p style="margin: 0; color: #005670; font-size: 18px;">
                      📞 <a href="tel:+18083158782" style="color: #005670; text-decoration: none; font-weight: bold;">(808) 315-8782</a>
                    </p>
                  </td>
                </tr>
              </table>

              <p style="margin: 40px 0 0 0; color: #555555; font-size: 18px; line-height: 1.8;">
                Warm regards,<br>
                <strong style="font-size: 20px;">Henderson Design Group Team</strong>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 40px; background-color: #f8f9fa; text-align: center; border-top: 2px solid #e0e0e0;">
              <p style="margin: 0 0 15px 0; color: #666666; font-size: 16px; line-height: 1.6;">
                <strong>Henderson Design Group</strong><br>
                Ālia Collections | Hawaiian Luxury Furnishings
              </p>
              <p style="margin: 0; color: #888888; font-size: 14px;">
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

module.exports = {
  journeyStepEmailTemplate
};