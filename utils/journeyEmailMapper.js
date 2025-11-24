// utils/journeyEmailMapper.js
const T = require('./journeyEmailTemplates');

// Mapping step → template
// Mapping step → template
const STEP_EMAIL_MAP = {
  3: T.contractDeliveryTemplate,
  4: T.fundingInstructionsTemplate,
  5: T.contractConfirmationTemplate,

  10: T.scheduleDesignMeeting1Template,
  11: T.meetingConfirmationTemplate,

  // FIX HERE
  18: T.proposalDelivery,      
  21: T.proposalConfirmation,
  22: T.proposalFundingConfirmation,

  30: T.productionStartedTemplate,

  40: T.progressPayment25InvoiceTemplate,
  41: T.progressPayment25ConfirmationTemplate,

  50: T.finalBalance25InvoiceTemplate,
  51: T.finalPaymentConfirmationTemplate,

  60: T.scheduleFinalWalkthroughTemplate
};


// Export function
module.exports = function selectEmailTemplate(step) {
  return STEP_EMAIL_MAP[Number(step.step)] || null;
};
