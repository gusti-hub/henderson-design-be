/**
 * Email Templates for Next Steps Options
 * Henderson Design Group - Ālia Collections
 */

// ============================================
// LOCK 2025 PRICING TEMPLATES
// ============================================

const lockPriceClientTemplate = ({ clientName, unitNumber, email, phone, notes }) => {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Lock 2025 Pricing - Next Steps</title>
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
                🔒 Lock 2025 Pricing Request Received
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
                Thank you for your interest in locking in 2025 pricing for your Ālia residence. We have received your request and our team will contact you shortly to discuss the next steps.
              </p>

              <!-- Request Details -->
              <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f8f9fa; border-radius: 8px; margin-bottom: 30px;">
                <tr>
                  <td style="padding: 25px;">
                    <h3 style="margin: 0 0 15px 0; color: #005670; font-size: 18px;">📋 Your Request Details</h3>
                    <table role="presentation" style="width: 100%; border-collapse: collapse;">
                      <tr>
                        <td style="padding: 8px 0; color: #555555; font-weight: bold; width: 30%;">Unit Number:</td>
                        <td style="padding: 8px 0; color: #555555;">${unitNumber}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #555555; font-weight: bold;">Email:</td>
                        <td style="padding: 8px 0; color: #555555;">${email}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #555555; font-weight: bold;">Phone:</td>
                        <td style="padding: 8px 0; color: #555555;">${phone}</td>
                      </tr>
                      ${notes !== 'None' ? `
                      <tr>
                        <td colspan="2" style="padding: 15px 0 8px 0; color: #555555; font-weight: bold;">Additional Notes:</td>
                      </tr>
                      <tr>
                        <td colspan="2" style="padding: 4px 0; color: #555555;">${notes}</td>
                      </tr>
                      ` : ''}
                    </table>
                  </td>
                </tr>
              </table>

              <!-- What's Included -->
              <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #d4edda; border-radius: 8px; border-left: 4px solid #28a745; margin-bottom: 30px;">
                <tr>
                  <td style="padding: 25px;">
                    <h4 style="margin: 0 0 15px 0; color: #155724; font-size: 16px;">✅ What's Included with Lock Pricing:</h4>
                    <ul style="margin: 0; padding-left: 20px; color: #155724; line-height: 1.8;">
                      <li>2025 pricing locked in for your selected collection</li>
                      <li>Materials reserved in our production schedule</li>
                      <li>30% deposit applies toward your final package</li>
                      <li>Protection from price increases</li>
                      <li>Priority scheduling for 2026 design phase</li>
                    </ul>
                  </td>
                </tr>
              </table>

              <!-- Next Steps -->
              <h4 style="margin: 0 0 15px 0; color: #005670; font-size: 16px;">📝 What Happens Next:</h4>
              <ul style="margin: 0 0 30px 0; padding-left: 20px; color: #555555; line-height: 1.8;">
                <li>Our team will contact you within 1-2 business days</li>
                <li>We'll review the Lock Pricing Agreement with you</li>
                <li>Discuss your selected collection and unit requirements</li>
                <li>Provide deposit payment instructions</li>
                <li>Answer any questions you may have</li>
              </ul>

              <p style="margin: 0; color: #555555; line-height: 1.6;">
                We look forward to helping you secure your 2025 pricing and begin your Ālia design journey!
              </p>
            </td>
          </tr>

          <!-- Contact Info -->
          <tr>
            <td style="padding: 30px; background-color: #f8f9fa; border-top: 1px solid #dee2e6;">
              <p style="margin: 0 0 10px 0; color: #6c757d; font-size: 14px;">
                <strong>Questions?</strong>
              </p>
              <p style="margin: 0; color: #6c757d; font-size: 14px; line-height: 1.6;">
                📧 Email: aloha@henderson.house
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
</html>`;
};

const lockPriceAdminTemplate = ({ clientName, clientEmail, clientPhone, unitNumber, notes, submittedAt }) => {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Lock Pricing Request</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 700px; max-width: 100%; border-collapse: collapse; background-color: #ffffff; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <tr>
            <td style="padding: 40px 30px; background: linear-gradient(135deg, #dc3545 0%, #c82333 100%); text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold;">
                🔒 New Lock 2025 Pricing Request
              </h1>
              <p style="margin: 10px 0 0 0; color: #ffffff; font-size: 14px;">
                Action Required - Client Awaiting Contact
              </p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 30px;">
              
              <!-- Client Info -->
              <div style="background-color: #e3f2fd; border-left: 4px solid #2196f3; padding: 20px; border-radius: 4px; margin-bottom: 30px;">
                <h2 style="margin: 0 0 15px 0; color: #1976d2; font-size: 20px;">👤 Client Information</h2>
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 0; color: #333; font-weight: bold; width: 30%;">Client Name:</td>
                    <td style="padding: 8px 0; color: #555;">${clientName}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #333; font-weight: bold;">Email:</td>
                    <td style="padding: 8px 0; color: #555;"><a href="mailto:${clientEmail}" style="color: #007bff;">${clientEmail}</a></td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #333; font-weight: bold;">Phone:</td>
                    <td style="padding: 8px 0; color: #555;">${clientPhone}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #333; font-weight: bold;">Unit Number:</td>
                    <td style="padding: 8px 0; color: #555; font-size: 18px; font-weight: bold;">${unitNumber}</td>
                  </tr>
                </table>
              </div>

              <!-- Request Type -->
              <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 20px; border-radius: 4px; margin-bottom: 30px;">
                <h2 style="margin: 0 0 10px 0; color: #856404; font-size: 20px;">📋 Selected Option</h2>
                <p style="margin: 0; color: #856404; font-size: 18px; font-weight: bold;">Lock 2025 Pricing (30% Deposit)</p>
              </div>

              ${notes !== 'None' ? `
              <!-- Additional Notes -->
              <div style="background-color: #f8f9fa; border-left: 4px solid #6c757d; padding: 20px; border-radius: 4px; margin-bottom: 30px;">
                <h3 style="margin: 0 0 10px 0; color: #495057; font-size: 18px;">📝 Client Notes</h3>
                <p style="margin: 0; color: #555; line-height: 1.6; white-space: pre-wrap;">${notes}</p>
              </div>
              ` : ''}

              <!-- Action Required -->
              <div style="background-color: #d4edda; border-left: 4px solid #28a745; padding: 20px; border-radius: 4px; margin-bottom: 20px;">
                <h3 style="margin: 0 0 15px 0; color: #155724; font-size: 18px;">✅ Next Steps:</h3>
                <ol style="margin: 0; padding-left: 20px; color: #155724; line-height: 1.8;">
                  <li>Contact client within 1-2 business days</li>
                  <li>Review Lock Pricing Agreement details</li>
                  <li>Discuss collection selection and unit requirements</li>
                  <li>Provide deposit payment instructions</li>
                  <li>Answer client questions</li>
                  <li>Process deposit once received</li>
                </ol>
              </div>

              <p style="margin: 0; color: #6c757d; font-size: 14px; text-align: center;">
                <strong>Submitted:</strong> ${submittedAt}
              </p>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 30px; background-color: #2c3e50; text-align: center;">
              <p style="margin: 0; color: #ffffff; font-size: 12px;">
                Automated notification from Henderson Design Client Portal
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

// ============================================
// DESIGN HOLD FEE TEMPLATES
// ============================================

const designFeeClientTemplate = ({ clientName, unitNumber, email, phone, notes }) => {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Design Hold Fee - Next Steps</title>
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
                📋 Design Hold Fee Request Received
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
                Thank you for your interest in reserving your design start date with our Design Hold Fee program. We have received your request and our team will contact you shortly to discuss the next steps.
              </p>

              <!-- Request Details -->
              <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f8f9fa; border-radius: 8px; margin-bottom: 30px;">
                <tr>
                  <td style="padding: 25px;">
                    <h3 style="margin: 0 0 15px 0; color: #005670; font-size: 18px;">📋 Your Request Details</h3>
                    <table role="presentation" style="width: 100%; border-collapse: collapse;">
                      <tr>
                        <td style="padding: 8px 0; color: #555555; font-weight: bold; width: 30%;">Unit Number:</td>
                        <td style="padding: 8px 0; color: #555555;">${unitNumber}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #555555; font-weight: bold;">Email:</td>
                        <td style="padding: 8px 0; color: #555555;">${email}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #555555; font-weight: bold;">Phone:</td>
                        <td style="padding: 8px 0; color: #555555;">${phone}</td>
                      </tr>
                      ${notes !== 'None' ? `
                      <tr>
                        <td colspan="2" style="padding: 15px 0 8px 0; color: #555555; font-weight: bold;">Additional Notes:</td>
                      </tr>
                      <tr>
                        <td colspan="2" style="padding: 4px 0; color: #555555;">${notes}</td>
                      </tr>
                      ` : ''}
                    </table>
                  </td>
                </tr>
              </table>

              <!-- What's Included -->
              <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #d4edda; border-radius: 8px; border-left: 4px solid #28a745; margin-bottom: 30px;">
                <tr>
                  <td style="padding: 25px;">
                    <h4 style="margin: 0 0 15px 0; color: #155724; font-size: 16px;">✅ What's Included with Design Hold Fee:</h4>
                    <ul style="margin: 0; padding-left: 20px; color: #155724; line-height: 1.8;">
                      <li>Confirmed design start date in 2026</li>
                      <li>Full design services package</li>
                      <li>Design intake meeting and floor plan review</li>
                      <li>Furniture layout and material selections</li>
                      <li>Design presentations and one revision round</li>
                      <li>100% credit toward final package when proceeding to production</li>
                    </ul>
                  </td>
                </tr>
              </table>

              <!-- Next Steps -->
              <h4 style="margin: 0 0 15px 0; color: #005670; font-size: 16px;">📝 What Happens Next:</h4>
              <ul style="margin: 0 0 30px 0; padding-left: 20px; color: #555555; line-height: 1.8;">
                <li>Our team will contact you within 1-2 business days</li>
                <li>We'll review the Design Fee Agreement with you</li>
                <li>Discuss your unit requirements and design preferences</li>
                <li>Confirm your design start date</li>
                <li>Provide payment instructions</li>
              </ul>

              <p style="margin: 0; color: #555555; line-height: 1.6;">
                We're excited to begin your design journey and create the perfect space for your Ālia residence!
              </p>
            </td>
          </tr>

          <!-- Contact Info -->
          <tr>
            <td style="padding: 30px; background-color: #f8f9fa; border-top: 1px solid #dee2e6;">
              <p style="margin: 0 0 10px 0; color: #6c757d; font-size: 14px;">
                <strong>Questions?</strong>
              </p>
              <p style="margin: 0; color: #6c757d; font-size: 14px; line-height: 1.6;">
                📧 Email: aloha@henderson.house
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
</html>`;
};

const designFeeAdminTemplate = ({ clientName, clientEmail, clientPhone, unitNumber, notes, submittedAt }) => {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Design Fee Request</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 700px; max-width: 100%; border-collapse: collapse; background-color: #ffffff; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <tr>
            <td style="padding: 40px 30px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold;">
                📋 New Design Hold Fee Request
              </h1>
              <p style="margin: 10px 0 0 0; color: #ffffff; font-size: 14px;">
                Action Required - Client Awaiting Contact
              </p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 30px;">
              
              <!-- Client Info -->
              <div style="background-color: #e3f2fd; border-left: 4px solid #2196f3; padding: 20px; border-radius: 4px; margin-bottom: 30px;">
                <h2 style="margin: 0 0 15px 0; color: #1976d2; font-size: 20px;">👤 Client Information</h2>
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 0; color: #333; font-weight: bold; width: 30%;">Client Name:</td>
                    <td style="padding: 8px 0; color: #555;">${clientName}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #333; font-weight: bold;">Email:</td>
                    <td style="padding: 8px 0; color: #555;"><a href="mailto:${clientEmail}" style="color: #007bff;">${clientEmail}</a></td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #333; font-weight: bold;">Phone:</td>
                    <td style="padding: 8px 0; color: #555;">${clientPhone}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #333; font-weight: bold;">Unit Number:</td>
                    <td style="padding: 8px 0; color: #555; font-size: 18px; font-weight: bold;">${unitNumber}</td>
                  </tr>
                </table>
              </div>

              <!-- Request Type -->
              <div style="background-color: #e8daef; border-left: 4px solid #8e44ad; padding: 20px; border-radius: 4px; margin-bottom: 30px;">
                <h2 style="margin: 0 0 10px 0; color: #5b2c6f; font-size: 20px;">📋 Selected Option</h2>
                <p style="margin: 0; color: #5b2c6f; font-size: 18px; font-weight: bold;">Design Hold Fee (Full Design Services)</p>
              </div>

              ${notes !== 'None' ? `
              <!-- Additional Notes -->
              <div style="background-color: #f8f9fa; border-left: 4px solid #6c757d; padding: 20px; border-radius: 4px; margin-bottom: 30px;">
                <h3 style="margin: 0 0 10px 0; color: #495057; font-size: 18px;">📝 Client Notes</h3>
                <p style="margin: 0; color: #555; line-height: 1.6; white-space: pre-wrap;">${notes}</p>
              </div>
              ` : ''}

              <!-- Action Required -->
              <div style="background-color: #d4edda; border-left: 4px solid #28a745; padding: 20px; border-radius: 4px; margin-bottom: 20px;">
                <h3 style="margin: 0 0 15px 0; color: #155724; font-size: 18px;">✅ Next Steps:</h3>
                <ol style="margin: 0; padding-left: 20px; color: #155724; line-height: 1.8;">
                  <li>Contact client within 1-2 business days</li>
                  <li>Review Design Fee Agreement details</li>
                  <li>Discuss unit requirements and design preferences</li>
                  <li>Confirm design start date in 2026 calendar</li>
                  <li>Provide payment instructions</li>
                  <li>Assign project manager once fee is received</li>
                </ol>
              </div>

              <p style="margin: 0; color: #6c757d; font-size: 14px; text-align: center;">
                <strong>Submitted:</strong> ${submittedAt}
              </p>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 30px; background-color: #2c3e50; text-align: center;">
              <p style="margin: 0; color: #ffffff; font-size: 12px;">
                Automated notification from Henderson Design Client Portal
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

// ============================================
// CONSULTATION/QUESTIONS TEMPLATES
// ============================================

const questionsClientTemplate = ({ clientName, unitNumber, email, phone, notes }) => {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Consultation Request Received</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 600px; max-width: 100%; border-collapse: collapse; background-color: #ffffff; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <tr>
            <td style="padding: 40px 30px; background: linear-gradient(135deg, #17a2b8 0%, #138496 100%); text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold;">
                💬 Consultation Request Received
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
                Thank you for reaching out to Henderson Design Group. We have received your consultation request and our team will be in touch with you shortly to discuss your questions and help you choose the best path forward for your Ālia residence.
              </p>

              <!-- Request Details -->
              <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f8f9fa; border-radius: 8px; margin-bottom: 30px;">
                <tr>
                  <td style="padding: 25px;">
                    <h3 style="margin: 0 0 15px 0; color: #005670; font-size: 18px;">📋 Your Contact Information</h3>
                    <table role="presentation" style="width: 100%; border-collapse: collapse;">
                      <tr>
                        <td style="padding: 8px 0; color: #555555; font-weight: bold; width: 30%;">Unit Number:</td>
                        <td style="padding: 8px 0; color: #555555;">${unitNumber}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #555555; font-weight: bold;">Email:</td>
                        <td style="padding: 8px 0; color: #555555;">${email}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #555555; font-weight: bold;">Phone:</td>
                        <td style="padding: 8px 0; color: #555555;">${phone}</td>
                      </tr>
                      ${notes !== 'None' ? `
                      <tr>
                        <td colspan="2" style="padding: 15px 0 8px 0; color: #555555; font-weight: bold;">Your Message:</td>
                      </tr>
                      <tr>
                        <td colspan="2" style="padding: 4px 0; color: #555555;">${notes}</td>
                      </tr>
                      ` : ''}
                    </table>
                  </td>
                </tr>
              </table>

              <!-- What We'll Discuss -->
              <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #d1ecf1; border-radius: 8px; border-left: 4px solid #17a2b8; margin-bottom: 30px;">
                <tr>
                  <td style="padding: 25px;">
                    <h4 style="margin: 0 0 15px 0; color: #0c5460; font-size: 16px;">💡 We Can Help You With:</h4>
                    <ul style="margin: 0; padding-left: 20px; color: #0c5460; line-height: 1.8;">
                      <li>Understanding the difference between Lock Pricing and Design Hold Fee</li>
                      <li>Choosing the right option for your timeline and budget</li>
                      <li>Explaining our design process and what to expect</li>
                      <li>Discussing collection options and customization</li>
                      <li>Answering any specific questions about your unit</li>
                      <li>Reviewing pricing and payment structures</li>
                    </ul>
                  </td>
                </tr>
              </table>

              <!-- Next Steps -->
              <h4 style="margin: 0 0 15px 0; color: #005670; font-size: 16px;">📝 What Happens Next:</h4>
              <ul style="margin: 0 0 30px 0; padding-left: 20px; color: #555555; line-height: 1.8;">
                <li>Our team will review your request</li>
                <li>We'll contact you within 1-2 business days</li>
                <li>Schedule a consultation call at your convenience</li>
                <li>Answer all your questions and provide guidance</li>
                <li>Help you choose the best option for your needs</li>
              </ul>

              <p style="margin: 0; color: #555555; line-height: 1.6;">
                We're here to make this process easy and enjoyable. We look forward to speaking with you soon!
              </p>
            </td>
          </tr>

          <!-- Contact Info -->
          <tr>
            <td style="padding: 30px; background-color: #f8f9fa; border-top: 1px solid #dee2e6;">
              <p style="margin: 0 0 10px 0; color: #6c757d; font-size: 14px;">
                <strong>Questions Before We Call?</strong>
              </p>
              <p style="margin: 0; color: #6c757d; font-size: 14px; line-height: 1.6;">
                📧 Email: aloha@henderson.house
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
</html>`;
};

const questionsAdminTemplate = ({ clientName, clientEmail, clientPhone, unitNumber, notes, submittedAt }) => {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Consultation Request</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 700px; max-width: 100%; border-collapse: collapse; background-color: #ffffff; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <tr>
            <td style="padding: 40px 30px; background: linear-gradient(135deg, #17a2b8 0%, #138496 100%); text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold;">
                ❓ New Consultation Request
              </h1>
              <p style="margin: 10px 0 0 0; color: #ffffff; font-size: 14px;">
                Action Required - Client Has Questions
              </p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 30px;">
              
              <!-- Client Info -->
              <div style="background-color: #e3f2fd; border-left: 4px solid #2196f3; padding: 20px; border-radius: 4px; margin-bottom: 30px;">
                <h2 style="margin: 0 0 15px 0; color: #1976d2; font-size: 20px;">👤 Client Information</h2>
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 0; color: #333; font-weight: bold; width: 30%;">Client Name:</td>
                    <td style="padding: 8px 0; color: #555;">${clientName}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #333; font-weight: bold;">Email:</td>
                    <td style="padding: 8px 0; color: #555;"><a href="mailto:${clientEmail}" style="color: #007bff;">${clientEmail}</a></td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #333; font-weight: bold;">Phone:</td>
                    <td style="padding: 8px 0; color: #555;">${clientPhone}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #333; font-weight: bold;">Unit Number:</td>
                    <td style="padding: 8px 0; color: #555; font-size: 18px; font-weight: bold;">${unitNumber}</td>
                  </tr>
                </table>
              </div>

              <!-- Request Type -->
              <div style="background-color: #d1ecf1; border-left: 4px solid #17a2b8; padding: 20px; border-radius: 4px; margin-bottom: 30px;">
                <h2 style="margin: 0 0 10px 0; color: #0c5460; font-size: 20px;">📋 Request Type</h2>
                <p style="margin: 0; color: #0c5460; font-size: 18px; font-weight: bold;">Consultation / Still Have Questions</p>
                <p style="margin: 10px 0 0 0; color: #0c5460;">Client needs help deciding which option is right for them.</p>
              </div>

              ${notes !== 'None' ? `
              <!-- Client Message -->
              <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 20px; border-radius: 4px; margin-bottom: 30px;">
                <h3 style="margin: 0 0 10px 0; color: #856404; font-size: 18px;">💬 Client's Message</h3>
                <p style="margin: 0; color: #856404; line-height: 1.6; white-space: pre-wrap;">${notes}</p>
              </div>
              ` : ''}

              <!-- Action Required -->
              <div style="background-color: #d4edda; border-left: 4px solid #28a745; padding: 20px; border-radius: 4px; margin-bottom: 20px;">
                <h3 style="margin: 0 0 15px 0; color: #155724; font-size: 18px;">✅ Next Steps:</h3>
                <ol style="margin: 0; padding-left: 20px; color: #155724; line-height: 1.8;">
                  <li>Contact client within 1-2 business days</li>
                  <li>Schedule consultation call at client's convenience</li>
                  <li>Discuss their questions and concerns</li>
                  <li>Explain the differences between Lock Pricing and Design Fee</li>
                  <li>Help client choose the best option for their needs</li>
                  <li>Provide next steps based on their decision</li>
                </ol>
              </div>

              <div style="background-color: #f8f9fa; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
                <h4 style="margin: 0 0 10px 0; color: #495057; font-size: 16px;">💡 Consultation Topics to Cover:</h4>
                <ul style="margin: 0; padding-left: 20px; color: #555; line-height: 1.8;">
                  <li>Timeline expectations and construction schedule</li>
                  <li>Budget considerations and pricing structure</li>
                  <li>Design process overview</li>
                  <li>Collection options and customization</li>
                  <li>Unit-specific requirements</li>
                  <li>Payment terms and deposit structure</li>
                </ul>
              </div>

              <p style="margin: 0; color: #6c757d; font-size: 14px; text-align: center;">
                <strong>Submitted:</strong> ${submittedAt}
              </p>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 30px; background-color: #2c3e50; text-align: center;">
              <p style="margin: 0; color: #ffffff; font-size: 12px;">
                Automated notification from Henderson Design Client Portal
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

const userApprovalTemplate = ({ 
  userName, 
  userEmail,
  temporaryPassword,
  loginUrl,
  unitNumber,
  propertyType
}) => {
  const propertyTypeDisplay = propertyType === 'Lock 2025 Pricing' 
    ? 'Lock 2025 Pricing' 
    : propertyType === 'Design Hold Fee' 
    ? 'Design Hold Fee' 
    : propertyType;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Account Approved - Henderson Design Group</title>
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
                🎉 Welcome to Ālia Collections!
              </h1>
              <p style="margin: 10px 0 0 0; color: #ffffff; font-size: 14px;">
                Your Account Has Been Approved
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
                Great news! Your Henderson Design Group account has been approved and is now active. You can now access your personalized client portal to explore our curated furniture collections and begin designing your perfect Ālia home.
              </p>

              <!-- Account Information -->
              <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f8f9fa; border-radius: 8px; margin-bottom: 30px;">
                <tr>
                  <td style="padding: 25px;">
                    <h2 style="margin: 0 0 20px 0; color: #005670; font-size: 18px; font-weight: bold;">
                      🔑 Your Login Credentials
                    </h2>
                    
                    <table style="width: 100%; border-collapse: collapse;">
                      <tr>
                        <td style="padding: 8px 0; color: #666666; font-weight: bold; width: 35%;">Email:</td>
                        <td style="padding: 8px 0; color: #333333; font-family: 'Courier New', monospace;">${userEmail}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #666666; font-weight: bold;">Password:</td>
                        <td style="padding: 8px 0; color: #333333; font-family: 'Courier New', monospace; background-color: #fff3cd; padding: 8px; border-radius: 4px;">
                          <strong>${temporaryPassword}</strong>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #666666; font-weight: bold;">Unit Number:</td>
                        <td style="padding: 8px 0; color: #333333;">${unitNumber}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #666666; font-weight: bold;">Property Type:</td>
                        <td style="padding: 8px 0; color: #333333;">${propertyTypeDisplay}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Security Notice -->
              <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #fff3cd; border-left: 4px solid #ffc107; margin-bottom: 30px;">
                <tr>
                  <td style="padding: 20px;">
                    <p style="margin: 0; color: #856404; line-height: 1.6;">
                      <strong>🔒 Security Reminder:</strong><br>
                      For your security, we recommend changing your password after your first login. You can do this from your account settings once logged in.
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Login Button -->
              <table role="presentation" style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
                <tr>
                  <td align="center" style="padding: 20px 0;">
                    <a href="${loginUrl}" style="display: inline-block; padding: 16px 40px; background: linear-gradient(135deg, #005670 0%, #007a9a 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                      🚀 Login to Your Account
                    </a>
                  </td>
                </tr>
                <tr>
                  <td align="center">
                    <p style="margin: 0; color: #888888; font-size: 12px;">
                      Or copy this link: <a href="${loginUrl}" style="color: #005670; word-break: break-all;">${loginUrl}</a>
                    </p>
                  </td>
                </tr>
              </table>

              <!-- What You Can Do -->
              <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #e8f5f9; border-radius: 8px; margin-bottom: 30px;">
                <tr>
                  <td style="padding: 25px;">
                    <h2 style="margin: 0 0 15px 0; color: #005670; font-size: 18px; font-weight: bold;">
                      ✨ What You Can Do Now
                    </h2>
                    <ul style="margin: 0; padding-left: 20px; color: #555555; line-height: 1.8;">
                      <li style="margin-bottom: 10px;">Browse our curated furniture collections</li>
                      <li style="margin-bottom: 10px;">View 3D visualizations of your unit with selected furniture</li>
                      <li style="margin-bottom: 10px;">Create and save your favorite design combinations</li>
                      <li style="margin-bottom: 10px;">Schedule consultations with our design team</li>
                      <li>Track your project progress and timeline</li>
                    </ul>
                  </td>
                </tr>
              </table>

              <!-- Next Steps -->
              <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #d4edda; border-left: 4px solid #28a745; margin-bottom: 30px;">
                <tr>
                  <td style="padding: 20px;">
                    <p style="margin: 0 0 10px 0; color: #155724; line-height: 1.6;">
                      <strong>📋 Next Steps:</strong>
                    </p>
                    <ol style="margin: 0; padding-left: 20px; color: #155724; line-height: 1.8;">
                      <li style="margin-bottom: 8px;">Click the login button above to access your portal</li>
                      <li style="margin-bottom: 8px;">Complete any additional profile information</li>
                      <li style="margin-bottom: 8px;">Review your design preferences questionnaire</li>
                      <li>Start exploring furniture options for your unit</li>
                    </ol>
                  </td>
                </tr>
              </table>

              <p style="margin: 0 0 20px 0; color: #555555; line-height: 1.6;">
                Our design team has reviewed your preferences and is excited to help you create a space that reflects your unique style and meets your functional needs. If you have any questions or need assistance getting started, please don't hesitate to reach out.
              </p>

              <p style="margin: 0; color: #555555; line-height: 1.6;">
                Welcome to the Henderson Design Group family!<br><br>
                <strong>Henderson Design Group Team</strong><br>
                <em>Ālia Collections</em>
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
              <p style="margin: 10px 0 0 0; color: #888888; font-size: 12px;">
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

// ============================================
// USER REGISTRATION CONFIRMATION TEMPLATE
// (Sent immediately after registration - pending approval)
// ============================================

const registrationConfirmationTemplate = ({ 
  userName, 
  userEmail,
  unitNumber,
  propertyType
}) => {
  const propertyTypeDisplay = propertyType === 'Lock 2025 Pricing' 
    ? 'Lock 2025 Pricing' 
    : propertyType === 'Design Hold Fee' 
    ? 'Design Hold Fee' 
    : propertyType;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Registration Received - Henderson Design Group</title>
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
                ✉️ Registration Received
              </h1>
              <p style="margin: 10px 0 0 0; color: #ffffff; font-size: 14px;">
                Thank You for Your Interest in Ālia Collections
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
                Thank you for registering with Henderson Design Group! We have received your registration and design preferences questionnaire for Unit ${unitNumber}.
              </p>

              <!-- Registration Summary -->
              <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f8f9fa; border-radius: 8px; margin-bottom: 30px;">
                <tr>
                  <td style="padding: 25px;">
                    <h2 style="margin: 0 0 20px 0; color: #005670; font-size: 18px; font-weight: bold;">
                      📋 Registration Summary
                    </h2>
                    
                    <table style="width: 100%; border-collapse: collapse;">
                      <tr>
                        <td style="padding: 8px 0; color: #666666; font-weight: bold; width: 35%;">Name:</td>
                        <td style="padding: 8px 0; color: #333333;">${userName}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #666666; font-weight: bold;">Email:</td>
                        <td style="padding: 8px 0; color: #333333;">${userEmail}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #666666; font-weight: bold;">Unit Number:</td>
                        <td style="padding: 8px 0; color: #333333;">${unitNumber}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #666666; font-weight: bold;">Property Type:</td>
                        <td style="padding: 8px 0; color: #333333;">${propertyTypeDisplay}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- What Happens Next -->
              <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #e8f5f9; border-radius: 8px; margin-bottom: 30px;">
                <tr>
                  <td style="padding: 25px;">
                    <h2 style="margin: 0 0 15px 0; color: #005670; font-size: 18px; font-weight: bold;">
                      ⏭️ What Happens Next
                    </h2>
                    <ul style="margin: 0; padding-left: 20px; color: #555555; line-height: 1.8;">
                      <li style="margin-bottom: 10px;">Our admin team will review your registration and questionnaire responses</li>
                      <li style="margin-bottom: 10px;">We'll verify your information and unit details</li>
                      <li style="margin-bottom: 10px;">You'll receive an email with your login credentials once approved</li>
                      <li>You can then access your personalized client portal</li>
                    </ul>
                  </td>
                </tr>
              </table>

              <!-- Timeline -->
              <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #fff3cd; border-left: 4px solid #ffc107; margin-bottom: 30px;">
                <tr>
                  <td style="padding: 20px;">
                    <p style="margin: 0; color: #856404; line-height: 1.6;">
                      <strong>⏰ Approval Timeline:</strong><br>
                      The review process typically takes 1-2 business days. You'll receive an email notification once your account is approved. We appreciate your patience!
                    </p>
                  </td>
                </tr>
              </table>

              <p style="margin: 0 0 20px 0; color: #555555; line-height: 1.6;">
                We're excited to work with you on creating your perfect Ālia home. Our team will carefully review your design preferences to ensure we provide you with the most personalized experience possible.
              </p>

              <p style="margin: 0 0 20px 0; color: #555555; line-height: 1.6;">
                If you have any questions in the meantime, please don't hesitate to contact us at <a href="mailto:aloha@henderson.house" style="color: #005670; text-decoration: none;">aloha@henderson.house</a> or call us at (808) 315-8782.
              </p>

              <p style="margin: 0; color: #555555; line-height: 1.6;">
                Thank you for choosing Henderson Design Group!<br><br>
                <strong>Henderson Design Group Team</strong><br>
                <em>Ālia Collections</em>
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
              <p style="margin: 10px 0 0 0; color: #888888; font-size: 12px;">
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

// ============================================
// ADMIN NOTIFICATION FOR NEW REGISTRATION
// ============================================

const adminRegistrationNotificationTemplate = ({ 
  userName, 
  userEmail,
  unitNumber,
  phoneNumber,
  propertyType,
  questionnaire,
  registrationDate
}) => {
  const propertyTypeDisplay = propertyType === 'Lock 2025 Pricing' 
    ? 'Lock 2025 Pricing' 
    : propertyType === 'Design Hold Fee' 
    ? 'Design Hold Fee' 
    : propertyType;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Client Registration - Pending Approval</title>
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
                🆕 New Client Registration
              </h1>
              <p style="margin: 10px 0 0 0; color: #ffffff; font-size: 14px;">
                Action Required - Pending Approval
              </p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <p style="margin: 0 0 30px 0; color: #555555; line-height: 1.6; font-size: 16px;">
                A new client has registered and is pending approval:
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
                        <td style="padding: 8px 0; color: #333333;"><strong>${userName}</strong></td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #666666; font-weight: bold;">Email:</td>
                        <td style="padding: 8px 0; color: #333333;"><a href="mailto:${userEmail}" style="color: #005670; text-decoration: none;">${userEmail}</a></td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #666666; font-weight: bold;">Phone:</td>
                        <td style="padding: 8px 0; color: #333333;">${phoneNumber}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #666666; font-weight: bold;">Unit Number:</td>
                        <td style="padding: 8px 0; color: #333333;"><strong>${unitNumber}</strong></td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #666666; font-weight: bold;">Property Type:</td>
                        <td style="padding: 8px 0; color: #333333;"><strong>${propertyTypeDisplay}</strong></td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #666666; font-weight: bold;">Registration Date:</td>
                        <td style="padding: 8px 0; color: #333333;">${registrationDate}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Questionnaire Summary -->
              <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #e8f5f9; border-radius: 8px; margin-bottom: 30px;">
                <tr>
                  <td style="padding: 25px;">
                    <h2 style="margin: 0 0 20px 0; color: #005670; font-size: 18px; font-weight: bold;">
                      📝 Questionnaire Highlights
                    </h2>
                    
                    ${questionnaire.designStyle && questionnaire.designStyle.length > 0 ? `
                    <div style="margin-bottom: 15px;">
                      <p style="margin: 0 0 5px 0; color: #666666; font-weight: bold;">Design Style:</p>
                      <p style="margin: 0; color: #333333;">${questionnaire.designStyle.join(', ')}</p>
                    </div>
                    ` : ''}
                    
                    ${questionnaire.colorPalette && questionnaire.colorPalette.length > 0 ? `
                    <div style="margin-bottom: 15px;">
                      <p style="margin: 0 0 5px 0; color: #666666; font-weight: bold;">Color Preferences:</p>
                      <p style="margin: 0; color: #333333;">${questionnaire.colorPalette.join(', ')}</p>
                    </div>
                    ` : ''}
                    
                    ${questionnaire.primaryUse && questionnaire.primaryUse.length > 0 ? `
                    <div style="margin-bottom: 15px;">
                      <p style="margin: 0 0 5px 0; color: #666666; font-weight: bold;">Primary Use:</p>
                      <p style="margin: 0; color: #333333;">${questionnaire.primaryUse.join(', ')}</p>
                    </div>
                    ` : ''}
                    
                    ${questionnaire.budgetFlexibility ? `
                    <div>
                      <p style="margin: 0 0 5px 0; color: #666666; font-weight: bold;">Budget Flexibility:</p>
                      <p style="margin: 0; color: #333333;">${questionnaire.budgetFlexibility}</p>
                    </div>
                    ` : ''}
                  </td>
                </tr>
              </table>

              <!-- Action Required -->
              <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #fff3cd; border-left: 4px solid #ffc107; margin-bottom: 30px;">
                <tr>
                  <td style="padding: 20px;">
                    <p style="margin: 0; color: #856404; line-height: 1.6;">
                      <strong>⚠️ Action Required:</strong><br>
                      Please review this registration in the admin panel and approve or reject the account. The client is waiting for approval to access their portal.
                    </p>
                  </td>
                </tr>
              </table>

              <p style="margin: 0; color: #555555; line-height: 1.6;">
                <em>This is an automated notification from the Ālia client registration system.</em>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 30px; background-color: #f8f9fa; text-align: center; border-top: 1px solid #e0e0e0;">
              <p style="margin: 0; color: #888888; font-size: 12px;">
                Henderson Design Group - Admin Dashboard<br>
                Ālia Collections Client Management System
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
  lockPriceClientTemplate,
  lockPriceAdminTemplate,
  designFeeClientTemplate,
  designFeeAdminTemplate,
  questionsClientTemplate,
  questionsAdminTemplate,
  userApprovalTemplate,
  registrationConfirmationTemplate,
  adminRegistrationNotificationTemplate
};