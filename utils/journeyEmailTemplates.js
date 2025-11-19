// utils/journeyEmailTemplates.js
// Email templates for all journey steps with Email=Yes

const baseStyles = `
  <style>
    body { 
      font-size: 16px;
      line-height: 1.6;
      font-family: Arial, sans-serif;
    }
    .large-text { 
      font-size: 18px;
      font-weight: 600;
    }
    .extra-large-text {
      font-size: 20px;
      font-weight: bold;
    }
  </style>
`;

const emailHeader = (title, subtitle = '') => `
  <tr>
    <td style="padding: 40px; background: linear-gradient(135deg, #005670 0%, #007a9a 100%); text-align: center;">
      <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold;">
        ${title}
      </h1>
      ${subtitle ? `
      <p style="margin: 15px 0 0 0; color: #ffffff; font-size: 16px;">
        ${subtitle}
      </p>
      ` : ''}
    </td>
  </tr>
`;

const emailFooter = () => `
  <tr>
    <td style="padding: 30px; background-color: #f8f9fa; text-align: center; border-top: 2px solid #e0e0e0;">
      <p style="margin: 0 0 10px 0; color: #666666; font-size: 14px;">
        <strong>Henderson Design Group</strong><br>
        Ālia Collections | Hawaiian Luxury Furnishings
      </p>
      <p style="margin: 0; color: #888888; font-size: 13px;">
        <a href="mailto:aloha@henderson.house" style="color: #005670; text-decoration: none;">aloha@henderson.house</a> | 
        <a href="https://henderson.house" style="color: #005670; text-decoration: none;">henderson.house</a>
      </p>
    </td>
  </tr>
`;

const portalButton = () => `
  <table role="presentation" style="width: 100%; border-collapse: collapse; margin: 30px 0;">
    <tr>
      <td align="center">
        <a href="${process.env.FRONTEND_URL || 'https://alia.henderson.house'}/portal-login" 
           style="display: inline-block; padding: 16px 40px; background: linear-gradient(135deg, #005670 0%, #007a9a 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: bold;">
          👉 View Your Portal
        </a>
      </td>
    </tr>
  </table>
`;

// ==========================================
// PHASE B TEMPLATES
// ==========================================

const contractDeliveryTemplate = ({ clientName, unitNumber, contractAmount }) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${baseStyles}
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f4;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 30px 20px;">
        <table role="presentation" style="width: 600px; max-width: 100%; border-collapse: collapse; background-color: #ffffff; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          
          ${emailHeader('📄 Your Contract is Ready', 'Unit ' + unitNumber)}

          <tr>
            <td style="padding: 40px;">
              <p class="extra-large-text" style="margin: 0 0 20px 0; color: #333333;">
                Hello ${clientName},
              </p>

              <p style="margin: 0 0 20px 0; color: #555555; font-size: 16px;">
                Great news! Your design contract is now ready for your review and signature.
              </p>

              <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f8f9fa; border-radius: 8px; margin: 20px 0; border: 2px solid #dee2e6;">
                <tr>
                  <td style="padding: 25px;">
                    <h3 style="margin: 0 0 15px 0; color: #005670; font-size: 18px;">Contract Details</h3>
                    <p style="margin: 5px 0; color: #333333; font-size: 15px;">
                      <strong>Unit:</strong> ${unitNumber}
                    </p>
                    ${contractAmount ? `
                    <p style="margin: 5px 0; color: #333333; font-size: 15px;">
                      <strong>Contract Amount:</strong> $${contractAmount.toLocaleString()}
                    </p>
                    ` : ''}
                  </td>
                </tr>
              </table>

              ${portalButton()}

              <p style="margin: 20px 0 0 0; color: #555555; font-size: 15px;">
                Please log into your portal to review and sign the contract. If you have any questions, don't hesitate to reach out!
              </p>

              <p style="margin: 30px 0 0 0; color: #555555; font-size: 15px;">
                Warm regards,<br>
                <strong>Henderson Design Group Team</strong>
              </p>
            </td>
          </tr>

          ${emailFooter()}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

const fundingInstructionsTemplate = ({ clientName, amount, bankDetails }) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${baseStyles}
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f4;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 30px 20px;">
        <table role="presentation" style="width: 600px; max-width: 100%; border-collapse: collapse; background-color: #ffffff;">
          
          ${emailHeader('💰 Payment Instructions', 'Next Steps')}

          <tr>
            <td style="padding: 40px;">
              <p class="extra-large-text" style="margin: 0 0 20px 0; color: #333333;">
                Hello ${clientName},
              </p>

              <p style="margin: 0 0 20px 0; color: #555555; font-size: 16px;">
                Please find below the payment instructions for your project.
              </p>

              <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #e8f5f9; border-radius: 8px; margin: 20px 0; border: 2px solid #bee5eb;">
                <tr>
                  <td style="padding: 25px;">
                    <h3 style="margin: 0 0 15px 0; color: #005670; font-size: 18px;">Payment Amount</h3>
                    <p style="margin: 0; color: #005670; font-size: 24px; font-weight: bold;">
                      $${amount ? amount.toLocaleString() : '___________'}
                    </p>
                  </td>
                </tr>
              </table>

              ${bankDetails ? `
              <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f8f9fa; border-radius: 8px; margin: 20px 0; border: 2px solid #dee2e6;">
                <tr>
                  <td style="padding: 25px;">
                    <h3 style="margin: 0 0 15px 0; color: #005670; font-size: 18px;">Bank Details</h3>
                    <p style="margin: 5px 0; color: #333333; font-size: 14px;">
                      ${bankDetails}
                    </p>
                  </td>
                </tr>
              </table>
              ` : ''}

              <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #fff3cd; border-radius: 8px; margin: 20px 0; border: 2px solid #ffc107;">
                <tr>
                  <td style="padding: 20px;">
                    <p style="margin: 0; color: #856404; font-size: 15px;">
                      <strong>⚠️ Important:</strong> Please include your unit number in the payment reference.
                    </p>
                  </td>
                </tr>
              </table>

              ${portalButton()}

              <p style="margin: 30px 0 0 0; color: #555555; font-size: 15px;">
                Best regards,<br>
                <strong>Henderson Design Group Team</strong>
              </p>
            </td>
          </tr>

          ${emailFooter()}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

const contractConfirmationTemplate = ({ clientName, unitNumber }) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${baseStyles}
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f4;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 30px 20px;">
        <table role="presentation" style="width: 600px; max-width: 100%; border-collapse: collapse; background-color: #ffffff;">
          
          ${emailHeader('✅ Contract Received', 'Thank you!')}

          <tr>
            <td style="padding: 40px;">
              <p class="extra-large-text" style="margin: 0 0 20px 0; color: #333333;">
                Hello ${clientName},
              </p>

              <p style="margin: 0 0 20px 0; color: #555555; font-size: 16px;">
                We're delighted to confirm that we've received your signed contract for Unit ${unitNumber}!
              </p>

              <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #d4edda; border-radius: 8px; margin: 20px 0; border: 2px solid #c3e6cb;">
                <tr>
                  <td style="padding: 25px; text-align: center;">
                    <p style="margin: 0; color: #155724; font-size: 18px; font-weight: bold;">
                      ✓ Your contract has been processed successfully
                    </p>
                  </td>
                </tr>
              </table>

              <p style="margin: 20px 0; color: #555555; font-size: 16px;">
                We're excited to begin this journey with you! Our team will be in touch soon with the next steps.
              </p>

              ${portalButton()}

              <p style="margin: 30px 0 0 0; color: #555555; font-size: 15px;">
                Warmly,<br>
                <strong>Henderson Design Group Team</strong>
              </p>
            </td>
          </tr>

          ${emailFooter()}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

const fundingConfirmationTemplate = ({ clientName, amount, unitNumber }) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${baseStyles}
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f4;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 30px 20px;">
        <table role="presentation" style="width: 600px; max-width: 100%; border-collapse: collapse; background-color: #ffffff;">
          
          ${emailHeader('✅ Payment Received', 'Unit ' + unitNumber)}

          <tr>
            <td style="padding: 40px;">
              <p class="extra-large-text" style="margin: 0 0 20px 0; color: #333333;">
                Hello ${clientName},
              </p>

              <p style="margin: 0 0 20px 0; color: #555555; font-size: 16px;">
                Thank you! We've successfully received your payment.
              </p>

              <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #d4edda; border-radius: 8px; margin: 20px 0; border: 2px solid #c3e6cb;">
                <tr>
                  <td style="padding: 25px;">
                    <h3 style="margin: 0 0 10px 0; color: #155724; font-size: 18px;">Payment Confirmed</h3>
                    <p style="margin: 0; color: #155724; font-size: 24px; font-weight: bold;">
                      $${amount ? amount.toLocaleString() : 'Received'}
                    </p>
                  </td>
                </tr>
              </table>

              <p style="margin: 20px 0; color: #555555; font-size: 16px;">
                Your payment has been processed and your journey continues! Check your portal for the latest updates.
              </p>

              ${portalButton()}

              <p style="margin: 30px 0 0 0; color: #555555; font-size: 15px;">
                With gratitude,<br>
                <strong>Henderson Design Group Team</strong>
              </p>
            </td>
          </tr>

          ${emailFooter()}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

// ==========================================
// PHASE C TEMPLATES (Design & Presentations)
// ==========================================

const scheduleDesignMeeting1Template = ({ clientName, portalLink }) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${baseStyles}
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f4;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 30px 20px;">
        <table role="presentation" style="width: 600px; max-width: 100%; border-collapse: collapse; background-color: #ffffff;">
          
          ${emailHeader('🎨 Schedule Your Design Meeting', 'Let\'s Begin!')}

          <tr>
            <td style="padding: 40px;">
              <p class="extra-large-text" style="margin: 0 0 20px 0; color: #333333;">
                Hello ${clientName},
              </p>

              <p style="margin: 0 0 20px 0; color: #555555; font-size: 16px;">
                It's time to begin the exciting design process! We're ready to schedule your first design meeting.
              </p>

              <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #e8f5f9; border-radius: 8px; margin: 20px 0; border: 2px solid #bee5eb;">
                <tr>
                  <td style="padding: 25px;">
                    <h3 style="margin: 0 0 15px 0; color: #005670; font-size: 18px;">What to Expect</h3>
                    <ul style="margin: 10px 0; padding-left: 20px; color: #333333; font-size: 15px;">
                      <li style="margin: 8px 0;">Review your questionnaire responses</li>
                      <li style="margin: 8px 0;">Discuss your design preferences</li>
                      <li style="margin: 8px 0;">Explore initial concepts</li>
                      <li style="margin: 8px 0;">Answer any questions you have</li>
                    </ul>
                  </td>
                </tr>
              </table>

              ${portalButton()}

              <p style="margin: 20px 0; color: #555555; font-size: 16px;">
                Please log into your portal to select a convenient time for your design meeting.
              </p>

              <p style="margin: 30px 0 0 0; color: #555555; font-size: 15px;">
                Looking forward to working with you!<br>
                <strong>Henderson Design Group Team</strong>
              </p>
            </td>
          </tr>

          ${emailFooter()}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

const meetingConfirmationTemplate = ({ clientName, meetingDate, meetingTime, meetingType }) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${baseStyles}
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f4;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 30px 20px;">
        <table role="presentation" style="width: 600px; max-width: 100%; border-collapse: collapse; background-color: #ffffff;">
          
          ${emailHeader('📅 Meeting Confirmed', meetingType || 'Your Appointment')}

          <tr>
            <td style="padding: 40px;">
              <p class="extra-large-text" style="margin: 0 0 20px 0; color: #333333;">
                Hello ${clientName},
              </p>

              <p style="margin: 0 0 20px 0; color: #555555; font-size: 16px;">
                Great! Your meeting has been confirmed.
              </p>

              <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #d4edda; border-radius: 8px; margin: 20px 0; border: 2px solid #c3e6cb;">
                <tr>
                  <td style="padding: 25px;">
                    <h3 style="margin: 0 0 15px 0; color: #155724; font-size: 18px;">Meeting Details</h3>
                    ${meetingDate ? `
                    <p style="margin: 5px 0; color: #155724; font-size: 16px;">
                      <strong>📅 Date:</strong> ${meetingDate}
                    </p>
                    ` : ''}
                    ${meetingTime ? `
                    <p style="margin: 5px 0; color: #155724; font-size: 16px;">
                      <strong>🕐 Time:</strong> ${meetingTime}
                    </p>
                    ` : ''}
                    ${meetingType ? `
                    <p style="margin: 5px 0; color: #155724; font-size: 16px;">
                      <strong>📋 Type:</strong> ${meetingType}
                    </p>
                    ` : ''}
                  </td>
                </tr>
              </table>

              <p style="margin: 20px 0; color: #555555; font-size: 16px;">
                We'll send you a calendar invitation shortly. If you need to reschedule, please let us know as soon as possible.
              </p>

              ${portalButton()}

              <p style="margin: 30px 0 0 0; color: #555555; font-size: 15px;">
                See you soon!<br>
                <strong>Henderson Design Group Team</strong>
              </p>
            </td>
          </tr>

          ${emailFooter()}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

const schedulePresentationTemplate = (presentationNumber) => ({ clientName }) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${baseStyles}
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f4;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 30px 20px;">
        <table role="presentation" style="width: 600px; max-width: 100%; border-collapse: collapse; background-color: #ffffff;">
          
          ${emailHeader('✨ Design Presentation Ready', 'Presentation ' + presentationNumber)}

          <tr>
            <td style="padding: 40px;">
              <p class="extra-large-text" style="margin: 0 0 20px 0; color: #333333;">
                Hello ${clientName},
              </p>

              <p style="margin: 0 0 20px 0; color: #555555; font-size: 16px;">
                Exciting news! Your design presentation ${presentationNumber} is ready for review.
              </p>

              <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f8f9fa; border-radius: 8px; margin: 20px 0; border: 2px solid #dee2e6;">
                <tr>
                  <td style="padding: 25px;">
                    <p style="margin: 0; color: #333333; font-size: 16px; text-align: center;">
                      Our team has carefully crafted this presentation based on your preferences and feedback.
                    </p>
                  </td>
                </tr>
              </table>

              ${portalButton()}

              <p style="margin: 20px 0; color: #555555; font-size: 16px;">
                Please log into your portal to schedule a time to review the presentation with our design team.
              </p>

              <p style="margin: 30px 0 0 0; color: #555555; font-size: 15px;">
                Can't wait to show you!<br>
                <strong>Henderson Design Group Team</strong>
              </p>
            </td>
          </tr>

          ${emailFooter()}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

const finalDesignApprovalTemplate = ({ clientName, unitNumber }) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${baseStyles}
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f4;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 30px 20px;">
        <table role="presentation" style="width: 600px; max-width: 100%; border-collapse: collapse; background-color: #ffffff;">
          
          ${emailHeader('🎯 Final Design Approval', 'Unit ' + unitNumber)}

          <tr>
            <td style="padding: 40px;">
              <p class="extra-large-text" style="margin: 0 0 20px 0; color: #333333;">
                Hello ${clientName},
              </p>

              <p style="margin: 0 0 20px 0; color: #555555; font-size: 16px;">
                We're thrilled to present your final design for approval!
              </p>

              <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #fff3cd; border-radius: 8px; margin: 20px 0; border: 2px solid #ffc107;">
                <tr>
                  <td style="padding: 25px;">
                    <h3 style="margin: 0 0 15px 0; color: #856404; font-size: 18px;">⚠️ Action Required</h3>
                    <p style="margin: 0; color: #856404; font-size: 15px;">
                      Please review and approve your final design so we can proceed to the next phase.
                    </p>
                  </td>
                </tr>
              </table>

              ${portalButton()}

              <p style="margin: 20px 0; color: #555555; font-size: 16px;">
                Once you approve, we'll move forward with creating your detailed proposal and production timeline.
              </p>

              <p style="margin: 30px 0 0 0; color: #555555; font-size: 15px;">
                Excited for the next chapter!<br>
                <strong>Henderson Design Group Team</strong>
              </p>
            </td>
          </tr>

          ${emailFooter()}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

// ==========================================
// PHASE D TEMPLATES (Proposal)
// ==========================================

const proposalDeliveryTemplate = ({ clientName, unitNumber, proposalAmount }) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${baseStyles}
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f4;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 30px 20px;">
        <table role="presentation" style="width: 600px; max-width: 100%; border-collapse: collapse; background-color: #ffffff;">
          
          ${emailHeader('📋 Your Production Proposal', 'Unit ' + unitNumber)}

          <tr>
            <td style="padding: 40px;">
              <p class="extra-large-text" style="margin: 0 0 20px 0; color: #333333;">
                Hello ${clientName},
              </p>

              <p style="margin: 0 0 20px 0; color: #555555; font-size: 16px;">
                Your detailed production proposal is now ready for your review!
              </p>

              <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #e8f5f9; border-radius: 8px; margin: 20px 0; border: 2px solid #bee5eb;">
                <tr>
                  <td style="padding: 25px;">
                    <h3 style="margin: 0 0 15px 0; color: #005670; font-size: 18px;">Proposal Amount</h3>
                    <p style="margin: 0; color: #005670; font-size: 28px; font-weight: bold;">
                      $${proposalAmount ? proposalAmount.toLocaleString() : '___________'}
                    </p>
                    <p style="margin: 10px 0 0 0; color: #555555; font-size: 14px;">
                      (50% initial payment required)
                    </p>
                  </td>
                </tr>
              </table>

              <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f8f9fa; border-radius: 8px; margin: 20px 0; border: 2px solid #dee2e6;">
                <tr>
                  <td style="padding: 25px;">
                    <h3 style="margin: 0 0 15px 0; color: #333333; font-size: 18px;">What's Included</h3>
                    <ul style="margin: 10px 0; padding-left: 20px; color: #555555; font-size: 15px;">
                      <li style="margin: 8px 0;">Detailed production specifications</li>
                      <li style="margin: 8px 0;">Material selections and finishes</li>
                      <li style="margin: 8px 0;">Production timeline</li>
                      <li style="margin: 8px 0;">Payment schedule</li>
                    </ul>
                  </td>
                </tr>
              </table>

              ${portalButton()}

              <p style="margin: 20px 0; color: #555555; font-size: 16px;">
                Please review the proposal carefully. Once signed and funded, we'll begin production immediately!
              </p>

              <p style="margin: 30px 0 0 0; color: #555555; font-size: 15px;">
                Let's bring your vision to life!<br>
                <strong>Henderson Design Group Team</strong>
              </p>
            </td>
          </tr>

          ${emailFooter()}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

const proposalConfirmationTemplate = ({ clientName, unitNumber }) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${baseStyles}
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f4;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 30px 20px;">
        <table role="presentation" style="width: 600px; max-width: 100%; border-collapse: collapse; background-color: #ffffff;">
          
          ${emailHeader('✅ Proposal Confirmed', 'Unit ' + unitNumber)}

          <tr>
            <td style="padding: 40px;">
              <p class="extra-large-text" style="margin: 0 0 20px 0; color: #333333;">
                Hello ${clientName},
              </p>

              <p style="margin: 0 0 20px 0; color: #555555; font-size: 16px;">
                Wonderful! We've received your signed production proposal.
              </p>

              <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #d4edda; border-radius: 8px; margin: 20px 0; border: 2px solid #c3e6cb;">
                <tr>
                  <td style="padding: 25px; text-align: center;">
                    <p style="margin: 0; color: #155724; font-size: 18px; font-weight: bold;">
                      ✓ Your proposal has been confirmed
                    </p>
                  </td>
                </tr>
              </table>

              <p style="margin: 20px 0; color: #555555; font-size: 16px;">
                We're one step closer to creating your beautiful custom furniture. Our team is preparing to begin production!
              </p>

              ${portalButton()}

              <p style="margin: 30px 0 0 0; color: #555555; font-size: 15px;">
                Aloha,<br>
                <strong>Henderson Design Group Team</strong>
              </p>
            </td>
          </tr>

          ${emailFooter()}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

const proposalFundingConfirmationTemplate = ({ clientName, amount }) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${baseStyles}
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f4;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 30px 20px;">
        <table role="presentation" style="width: 600px; max-width: 100%; border-collapse: collapse; background-color: #ffffff;">
          
          ${emailHeader('✅ Payment Received', 'Production Funding')}

          <tr>
            <td style="padding: 40px;">
              <p class="extra-large-text" style="margin: 0 0 20px 0; color: #333333;">
                Hello ${clientName},
              </p>

              <p style="margin: 0 0 20px 0; color: #555555; font-size: 16px;">
                Perfect! Your proposal payment has been successfully received.
              </p>

              <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #d4edda; border-radius: 8px; margin: 20px 0; border: 2px solid #c3e6cb;">
                <tr>
                  <td style="padding: 25px;">
                    <h3 style="margin: 0 0 10px 0; color: #155724; font-size: 18px;">Payment Confirmed</h3>
                    <p style="margin: 0; color: #155724; font-size: 24px; font-weight: bold;">
                      $${amount ? amount.toLocaleString() : 'Received'}
                    </p>
                  </td>
                </tr>
              </table>

              <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #e8f5f9; border-radius: 8px; margin: 20px 0; border: 2px solid #bee5eb;">
                <tr>
                  <td style="padding: 25px;">
                    <h3 style="margin: 0 0 15px 0; color: #005670; font-size: 18px;">🎉 What's Next</h3>
                    <p style="margin: 0; color: #333333; font-size: 15px;">
                      Now that funding is complete, we'll immediately begin processing vendor orders and initiating production. You'll receive updates as your project progresses!
                    </p>
                  </td>
                </tr>
              </table>

              ${portalButton()}

              <p style="margin: 30px 0 0 0; color: #555555; font-size: 15px;">
                Mahalo!<br>
                <strong>Henderson Design Group Team</strong>
              </p>
            </td>
          </tr>

          ${emailFooter()}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

// ==========================================
// PHASE E TEMPLATES (Production)
// ==========================================

const productionStartedTemplate = ({ clientName, unitNumber, estimatedCompletion }) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${baseStyles}
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f4;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 30px 20px;">
        <table role="presentation" style="width: 600px; max-width: 100%; border-collapse: collapse; background-color: #ffffff;">
          
          ${emailHeader('🏭 Production Has Begun!', 'Unit ' + unitNumber)}

          <tr>
            <td style="padding: 40px;">
              <p class="extra-large-text" style="margin: 0 0 20px 0; color: #333333;">
                Hello ${clientName},
              </p>

              <p style="margin: 0 0 20px 0; color: #555555; font-size: 16px;">
                Great news! Your custom furniture is now in production.
              </p>

              <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #d4edda; border-radius: 8px; margin: 20px 0; border: 2px solid #c3e6cb;">
                <tr>
                  <td style="padding: 25px; text-align: center;">
                    <p style="margin: 0 0 10px 0; font-size: 48px;">🎨</p>
                    <p style="margin: 0; color: #155724; font-size: 18px; font-weight: bold;">
                      Production is underway!
                    </p>
                  </td>
                </tr>
              </table>

              ${estimatedCompletion ? `
              <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f8f9fa; border-radius: 8px; margin: 20px 0; border: 2px solid #dee2e6;">
                <tr>
                  <td style="padding: 25px;">
                    <h3 style="margin: 0 0 10px 0; color: #333333; font-size: 18px;">📅 Estimated Completion</h3>
                    <p style="margin: 0; color: #005670; font-size: 20px; font-weight: bold;">
                      ${estimatedCompletion}
                    </p>
                  </td>
                </tr>
              </table>
              ` : ''}

              <p style="margin: 20px 0; color: #555555; font-size: 16px;">
                Our skilled craftsmen are bringing your design to life. We'll keep you updated throughout the production process via your portal.
              </p>

              ${portalButton()}

              <p style="margin: 30px 0 0 0; color: #555555; font-size: 15px;">
                Exciting times ahead!<br>
                <strong>Henderson Design Group Team</strong>
              </p>
            </td>
          </tr>

          ${emailFooter()}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

// ==========================================
// PHASE F TEMPLATES (Progress Payment)
// ==========================================

const progressPayment25InvoiceTemplate = ({ clientName, amount, unitNumber }) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${baseStyles}
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f4;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 30px 20px;">
        <table role="presentation" style="width: 600px; max-width: 100%; border-collapse: collapse; background-color: #ffffff;">
          
          ${emailHeader('📄 Progress Payment Invoice', '25% - Unit ' + unitNumber)}

          <tr>
            <td style="padding: 40px;">
              <p class="extra-large-text" style="margin: 0 0 20px 0; color: #333333;">
                Hello ${clientName},
              </p>

              <p style="margin: 0 0 20px 0; color: #555555; font-size: 16px;">
                Your project is progressing beautifully! It's time for the 25% progress payment.
              </p>

              <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #fff3cd; border-radius: 8px; margin: 20px 0; border: 2px solid #ffc107;">
                <tr>
                  <td style="padding: 25px;">
                    <h3 style="margin: 0 0 15px 0; color: #856404; font-size: 18px;">⚠️ Payment Due</h3>
                    <p style="margin: 0; color: #856404; font-size: 28px; font-weight: bold;">
                      $${amount ? amount.toLocaleString() : '___________'}
                    </p>
                    <p style="margin: 10px 0 0 0; color: #856404; font-size: 14px;">
                      25% Progress Payment
                    </p>
                  </td>
                </tr>
              </table>

              <p style="margin: 20px 0; color: #555555; font-size: 16px;">
                This payment allows us to continue production and ensure everything stays on schedule. Funding instructions are available in your portal.
              </p>

              ${portalButton()}

              <p style="margin: 30px 0 0 0; color: #555555; font-size: 15px;">
                Thank you for your continued partnership!<br>
                <strong>Henderson Design Group Team</strong>
              </p>
            </td>
          </tr>

          ${emailFooter()}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

const progressPayment25InstructionsTemplate = ({ clientName, amount, bankDetails }) => 
  fundingInstructionsTemplate({ clientName, amount, bankDetails });

const progressPayment25ConfirmationTemplate = ({ clientName, amount }) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${baseStyles}
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f4;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 30px 20px;">
        <table role="presentation" style="width: 600px; max-width: 100%; border-collapse: collapse; background-color: #ffffff;">
          
          ${emailHeader('✅ Progress Payment Received', 'Thank you!')}

          <tr>
            <td style="padding: 40px;">
              <p class="extra-large-text" style="margin: 0 0 20px 0; color: #333333;">
                Hello ${clientName},
              </p>

              <p style="margin: 0 0 20px 0; color: #555555; font-size: 16px;">
                Thank you! Your 25% progress payment has been successfully received.
              </p>

              <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #d4edda; border-radius: 8px; margin: 20px 0; border: 2px solid #c3e6cb;">
                <tr>
                  <td style="padding: 25px;">
                    <h3 style="margin: 0 0 10px 0; color: #155724; font-size: 18px;">Payment Confirmed</h3>
                    <p style="margin: 0; color: #155724; font-size: 24px; font-weight: bold;">
                      $${amount ? amount.toLocaleString() : 'Received'}
                    </p>
                  </td>
                </tr>
              </table>

              <p style="margin: 20px 0; color: #555555; font-size: 16px;">
                Production continues at full pace! We'll keep you updated on the progress through your portal.
              </p>

              ${portalButton()}

              <p style="margin: 30px 0 0 0; color: #555555; font-size: 15px;">
                With appreciation,<br>
                <strong>Henderson Design Group Team</strong>
              </p>
            </td>
          </tr>

          ${emailFooter()}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

// ==========================================
// PHASE G TEMPLATES (Final Payment)
// ==========================================

const finalBalance25InvoiceTemplate = ({ clientName, amount, unitNumber }) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${baseStyles}
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f4;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 30px 20px;">
        <table role="presentation" style="width: 600px; max-width: 100%; border-collapse: collapse; background-color: #ffffff;">
          
          ${emailHeader('📄 Final Balance Invoice', '25% - Unit ' + unitNumber)}

          <tr>
            <td style="padding: 40px;">
              <p class="extra-large-text" style="margin: 0 0 20px 0; color: #333333;">
                Hello ${clientName},
              </p>

              <p style="margin: 0 0 20px 0; color: #555555; font-size: 16px;">
                Wonderful news! Your furniture is ready to ship. It's time for the final 25% payment.
              </p>

              <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #e8f5f9; border-radius: 8px; margin: 20px 0; border: 2px solid #bee5eb;">
                <tr>
                  <td style="padding: 25px;">
                    <h3 style="margin: 0 0 15px 0; color: #005670; font-size: 18px;">Final Payment Due</h3>
                    <p style="margin: 0; color: #005670; font-size: 28px; font-weight: bold;">
                      $${amount ? amount.toLocaleString() : '___________'}
                    </p>
                    <p style="margin: 10px 0 0 0; color: #555555; font-size: 14px;">
                      25% Final Balance
                    </p>
                  </td>
                </tr>
              </table>

              <p style="margin: 20px 0; color: #555555; font-size: 16px;">
                Once this payment is received, we'll coordinate delivery and installation to bring your beautiful furniture home!
              </p>

              ${portalButton()}

              <p style="margin: 30px 0 0 0; color: #555555; font-size: 15px;">
                Almost there!<br>
                <strong>Henderson Design Group Team</strong>
              </p>
            </td>
          </tr>

          ${emailFooter()}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

const finalBalance25InstructionsTemplate = ({ clientName, amount, bankDetails }) => 
  fundingInstructionsTemplate({ clientName, amount, bankDetails });

const finalPaymentConfirmationTemplate = ({ clientName, amount }) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${baseStyles}
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f4;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 30px 20px;">
        <table role="presentation" style="width: 600px; max-width: 100%; border-collapse: collapse; background-color: #ffffff;">
          
          ${emailHeader('🎉 Final Payment Received', 'Delivery Next!')}

          <tr>
            <td style="padding: 40px;">
              <p class="extra-large-text" style="margin: 0 0 20px 0; color: #333333;">
                Hello ${clientName},
              </p>

              <p style="margin: 0 0 20px 0; color: #555555; font-size: 16px;">
                Perfect! Your final payment has been successfully received.
              </p>

              <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #d4edda; border-radius: 8px; margin: 20px 0; border: 2px solid #c3e6cb;">
                <tr>
                  <td style="padding: 25px;">
                    <h3 style="margin: 0 0 10px 0; color: #155724; font-size: 18px;">✓ Payment Complete</h3>
                    <p style="margin: 0; color: #155724; font-size: 24px; font-weight: bold;">
                      $${amount ? amount.toLocaleString() : 'Received'}
                    </p>
                  </td>
                </tr>
              </table>

              <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #fff3cd; border-radius: 8px; margin: 20px 0; border: 2px solid #ffc107;">
                <tr>
                  <td style="padding: 25px;">
                    <h3 style="margin: 0 0 15px 0; color: #856404; font-size: 18px;">🚚 What's Next</h3>
                    <p style="margin: 0; color: #856404; font-size: 15px;">
                      Now we'll coordinate freight, delivery, and installation. We'll be in touch soon with your delivery timeline!
                    </p>
                  </td>
                </tr>
              </table>

              ${portalButton()}

              <p style="margin: 30px 0 0 0; color: #555555; font-size: 15px;">
                Can't wait to deliver your furniture!<br>
                <strong>Henderson Design Group Team</strong>
              </p>
            </td>
          </tr>

          ${emailFooter()}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

// ==========================================
// PHASE H TEMPLATES (Delivery)
// ==========================================

const scheduleFinalWalkthroughTemplate = ({ clientName, unitNumber }) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${baseStyles}
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f4;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 30px 20px;">
        <table role="presentation" style="width: 600px; max-width: 100%; border-collapse: collapse; background-color: #ffffff;">
          
          ${emailHeader('🎊 Final Walkthrough', 'Unit ' + unitNumber)}

          <tr>
            <td style="padding: 40px;">
              <p class="extra-large-text" style="margin: 0 0 20px 0; color: #333333;">
                Hello ${clientName},
              </p>

              <p style="margin: 0 0 20px 0; color: #555555; font-size: 16px;">
                Your furniture has been installed! Let's schedule your final walkthrough and reveal.
              </p>

              <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #d4edda; border-radius: 8px; margin: 20px 0; border: 2px solid #c3e6cb;">
                <tr>
                  <td style="padding: 25px; text-align: center;">
                    <p style="margin: 0 0 10px 0; font-size: 48px;">✨</p>
                    <p style="margin: 0; color: #155724; font-size: 18px; font-weight: bold;">
                      Installation Complete!
                    </p>
                  </td>
                </tr>
              </table>

              <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f8f9fa; border-radius: 8px; margin: 20px 0; border: 2px solid #dee2e6;">
                <tr>
                  <td style="padding: 25px;">
                    <h3 style="margin: 0 0 15px 0; color: #333333; font-size: 18px;">Walkthrough Details</h3>
                    <ul style="margin: 10px 0; padding-left: 20px; color: #555555; font-size: 15px;">
                      <li style="margin: 8px 0;">Review the installation</li>
                      <li style="margin: 8px 0;">Address any final adjustments</li>
                      <li style="margin: 8px 0;">Care instructions walkthrough</li>
                      <li style="margin: 8px 0;">Celebrate your new space!</li>
                    </ul>
                  </td>
                </tr>
              </table>

              ${portalButton()}

              <p style="margin: 20px 0; color: #555555; font-size: 16px;">
                Please log into your portal to schedule a time for your final walkthrough. We're so excited to see your reaction!
              </p>

              <p style="margin: 30px 0 0 0; color: #555555; font-size: 15px;">
                With joy and mahalo,<br>
                <strong>Henderson Design Group Team</strong>
              </p>
            </td>
          </tr>

          ${emailFooter()}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

// ==========================================
// EXPORT ALL TEMPLATES
// ==========================================

const EMAIL_TEMPLATES = {
  // Phase B
  contractDelivery: contractDeliveryTemplate,
  fundingInstructions: fundingInstructionsTemplate,
  contractConfirmation: contractConfirmationTemplate,
  fundingConfirmation: fundingConfirmationTemplate,
  
  // Phase C
  scheduleDesignMeeting1: scheduleDesignMeeting1Template,
  meetingConfirmation: meetingConfirmationTemplate,
  schedulePresentation1: schedulePresentationTemplate(1),
  schedulePresentation2: schedulePresentationTemplate(2),
  schedulePresentation3: schedulePresentationTemplate(3),
  finalDesignApproval: finalDesignApprovalTemplate,
  
  // Phase D
  proposalDelivery: proposalDeliveryTemplate,
  proposalConfirmation: proposalConfirmationTemplate,
  proposalFundingConfirmation: proposalFundingConfirmationTemplate,
  
  // Phase E
  productionStarted: productionStartedTemplate,
  
  // Phase F
  progressPayment25Invoice: progressPayment25InvoiceTemplate,
  progressPayment25Instructions: progressPayment25InstructionsTemplate,
  progressPayment25Confirmation: progressPayment25ConfirmationTemplate,
  
  // Phase G
  finalBalance25Invoice: finalBalance25InvoiceTemplate,
  finalBalance25Instructions: finalBalance25InstructionsTemplate,
  finalPaymentConfirmation: finalPaymentConfirmationTemplate,
  
  // Phase H
  scheduleFinalWalkthrough: scheduleFinalWalkthroughTemplate
};

module.exports = EMAIL_TEMPLATES;