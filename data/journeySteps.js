// /backend/data/journeySteps.js
// Journey – TOTAL 61 steps (step from 1 → 61), CSV steps preserved.

const JOURNEY_STEPS = [

  // ==========================================
  // PHASE B (original step 7–16) → step 1–10
  // ==========================================
  {
    step: 1,
    csvStep: 7,
    title: "Client Portal First Login",
    description: "Client logs into the portal for the first time",
    phase: "Portal Activation & Design Setup",
    email: false,
    clientAction: true,
    actionBy: "Client"
  },
  {
    step: 2,
    csvStep: 7.5,
    title: "Complete Initial Questionnaire",
    description: "Client must complete the questionnaire before continuing",
    phase: "Portal Activation & Design Setup",
    email: false,
    clientAction: true,
    actionBy: "Client",
    autoCheck: true
  },
  {
    step: 3,
    csvStep: 8,
    title: "Contract & Funding Preparation",
    description: "HDG prepares contract and funding amount",
    phase: "Portal Activation & Design Setup",
    email: false,
    clientAction: false,
    actionBy: "HDG",
    autoGenerate: "contract"
  },
  {
    step: 4,
    csvStep: 9,
    title: "Contract Delivery",
    description: "HDG sends contract for signature",
    phase: "Portal Activation & Design Setup",
    email: true,
    clientAction: false,
    actionBy: "HDG",
    emailTemplate: "contractDelivery"
  },
  {
    step: 5,
    csvStep: "9.a",
    title: "Funding Instructions Delivery",
    description: "HDG sends funding instructions",
    phase: "Portal Activation & Design Setup",
    email: true,
    clientAction: false,
    actionBy: "HDG",
    emailTemplate: "fundingInstructions"
  },
  {
    step: 6,
    csvStep: 10,
    title: "Client Signs and Funds",
    description: "Client signs contract and submits payment",
    phase: "Portal Activation & Design Setup",
    email: false,
    clientAction: true,
    actionBy: "Client"
  },
  {
    step: 7,
    csvStep: 11,
    title: "HDG Receives Signed Contract",
    description: "HDG confirms receipt of signed contract",
    phase: "Portal Activation & Design Setup",
    email: false,
    clientAction: false,
    actionBy: "HDG"
  },
  {
    step: 8,
    csvStep: 12,
    title: "Bank Confirms Receipt",
    description: "Bank/System confirms payment receipt",
    phase: "Portal Activation & Design Setup",
    email: false,
    clientAction: false,
    actionBy: "Bank/System",
    autoTrigger: true
  },
  {
    step: 9,
    csvStep: 13,
    title: "Contract Receipt Confirmation",
    description: "HDG confirms receipt of signed contract to client",
    phase: "Portal Activation & Design Setup",
    email: true,
    clientAction: false,
    actionBy: "HDG",
    emailTemplate: "contractConfirmation"
  },
  {
    step: 10,
    csvStep: 14,
    title: "Funding Receipt Confirmation",
    description: "HDG confirms receipt of funding to client",
    phase: "Portal Activation & Design Setup",
    email: true,
    clientAction: false,
    actionBy: "HDG",
    emailTemplate: "fundingConfirmation"
  },

  // ==========================================
  // PHASE C (original 17–35) → step 11–29
  // ==========================================
  {
    step: 11,
    csvStep: 15,
    title: "Schedule Design Meeting 1",
    description: "HDG emails client to schedule Design Meeting 1",
    phase: "Design Meetings & Presentations",
    email: true,
    clientAction: false,
    actionBy: "HDG",
    emailTemplate: "scheduleDesignMeeting1"
  },
  {
    step: 12,
    csvStep: 16,
    title: "Client Books Design Meeting 1",
    description: "Client signs up for Design Meeting 1",
    phase: "Design Meetings & Presentations",
    email: false,
    clientAction: true,
    actionBy: "Client"
  },
  {
    step: 13,
    csvStep: 17,
    title: "Design Meeting 1 Confirmation",
    description: "HDG sends confirmation with meeting details",
    phase: "Design Meetings & Presentations",
    email: true,
    clientAction: false,
    actionBy: "HDG",
    emailTemplate: "meetingConfirmation",
    autoTrigger: true
  },
  {
    step: 14,
    csvStep: 18,
    title: "Design Team Review",
    description: "Design team reviews questionnaire and client info",
    phase: "Design Meetings & Presentations",
    email: false,
    clientAction: false,
    actionBy: "HDG"
  },
  {
    step: 15,
    csvStep: 19,
    title: "Design Meeting 1",
    description: "HDG and client hold Design Meeting 1",
    phase: "Design Meetings & Presentations",
    email: false,
    clientAction: false,
    actionBy: "HDG + Client"
  },
  {
    step: 16,
    csvStep: 20,
    title: "Prepare Presentation 1",
    description: "HDG prepares first design presentation",
    phase: "Design Meetings & Presentations",
    email: false,
    clientAction: false,
    actionBy: "HDG"
  },
  {
    step: 17,
    csvStep: 21,
    title: "Schedule Presentation 1",
    description: "HDG emails client to schedule Presentation 1",
    phase: "Design Meetings & Presentations",
    email: true,
    clientAction: false,
    actionBy: "HDG",
    emailTemplate: "schedulePresentation1"
  },
  {
    step: 18,
    csvStep: 22,
    title: "Client Books Presentation 1",
    description: "Client signs up for Presentation 1",
    phase: "Design Meetings & Presentations",
    email: false,
    clientAction: true,
    actionBy: "Client"
  },
  {
    step: 19,
    csvStep: 23,
    title: "Presentation 1 Meeting",
    description: "HDG presents first design to client",
    phase: "Design Meetings & Presentations",
    email: false,
    clientAction: false,
    actionBy: "HDG + Client"
  },
  {
    step: 20,
    csvStep: 24,
    title: "Design Revision 1",
    description: "HDG revises design based on feedback",
    phase: "Design Meetings & Presentations",
    email: false,
    clientAction: false,
    actionBy: "HDG"
  },
  {
    step: 21,
    csvStep: 25,
    title: "Schedule Presentation 2",
    description: "HDG emails client to schedule Presentation 2",
    phase: "Design Meetings & Presentations",
    email: true,
    clientAction: false,
    actionBy: "HDG",
    emailTemplate: "schedulePresentation2"
  },
  {
    step: 22,
    csvStep: 26,
    title: "Client Books Presentation 2",
    description: "Client signs up for Presentation 2",
    phase: "Design Meetings & Presentations",
    email: false,
    clientAction: true,
    actionBy: "Client"
  },
  {
    step: 23,
    csvStep: 27,
    title: "Presentation 2 Meeting",
    description: "HDG presents revised design to client",
    phase: "Design Meetings & Presentations",
    email: false,
    clientAction: false,
    actionBy: "HDG + Client"
  },
  {
    step: 24,
    csvStep: 28,
    title: "Design Revision 2",
    description: "HDG revises design based on feedback",
    phase: "Design Meetings & Presentations",
    email: false,
    clientAction: false,
    actionBy: "HDG"
  },
  {
    step: 25,
    csvStep: 29,
    title: "Schedule Presentation 3",
    description: "HDG emails client to schedule Presentation 3",
    phase: "Design Meetings & Presentations",
    email: true,
    clientAction: false,
    actionBy: "HDG",
    emailTemplate: "schedulePresentation3"
  },
  {
    step: 26,
    csvStep: 30,
    title: "Client Books Presentation 3",
    description: "Client signs up for Presentation 3",
    phase: "Design Meetings & Presentations",
    email: false,
    clientAction: true,
    actionBy: "Client"
  },
  {
    step: 27,
    csvStep: 31,
    title: "Presentation 3 Meeting",
    description: "HDG presents final design iteration to client",
    phase: "Design Meetings & Presentations",
    email: false,
    clientAction: false,
    actionBy: "HDG + Client"
  },
  {
    step: 28,
    csvStep: 32,
    title: "Final Design Approval Request",
    description: "HDG sends final design for approval",
    phase: "Design Meetings & Presentations",
    email: true,
    clientAction: false,
    actionBy: "HDG",
    emailTemplate: "finalDesignApproval"
  },
  {
    step: 29,
    csvStep: 33,
    title: "Client Approves Final Design",
    description: "Client reviews and approves final design",
    phase: "Design Meetings & Presentations",
    email: false,
    clientAction: true,
    actionBy: "Client"
  },

  // ==========================================
  // PHASE D (original step 36–43) → step 30–37
  // ==========================================
  {
    step: 30,
    csvStep: 34,
    title: "Production Contract Preparation",
    description: "HDG prepares production contract",
    phase: "Proposal Contract & 50% Funding",
    email: false,
    clientAction: false,
    actionBy: "HDG",
    autoGenerate: "proposalContract"
  },
  {
    step: 31,
    csvStep: 35,
    title: "Proposal Amount Calculation",
    description: "HDG prepares and calculates proposal amount",
    phase: "Proposal Contract & 50% Funding",
    email: false,
    clientAction: false,
    actionBy: "HDG"
  },
  {
    step: 32,
    csvStep: 36,
    title: "Proposal & Funding Instructions Delivery",
    description: "HDG sends proposal and funding instructions",
    phase: "Proposal Contract & 50% Funding",
    email: true,
    clientAction: false,
    actionBy: "HDG",
    emailTemplate: "proposalDelivery"
  },
  {
    step: 33,
    csvStep: 37,
    title: "Client Signs and Funds Proposal",
    description: "Client signs proposal and submits 50% payment",
    phase: "Proposal Contract & 50% Funding",
    email: false,
    clientAction: true,
    actionBy: "Client"
  },
  {
    step: 34,
    csvStep: 38,
    title: "HDG Receives Signed Proposal",
    description: "HDG confirms receipt of signed proposal",
    phase: "Proposal Contract & 50% Funding",
    email: false,
    clientAction: false,
    actionBy: "HDG"
  },
  {
    step: 35,
    csvStep: 39,
    title: "Bank Confirms Proposal Payment",
    description: "Bank/System confirms proposal payment receipt",
    phase: "Proposal Contract & 50% Funding",
    email: false,
    clientAction: false,
    actionBy: "Bank/System",
    autoTrigger: true
  },
  {
    step: 36,
    csvStep: 40,
    title: "Proposal Receipt Confirmation",
    description: "HDG confirms receipt of signed proposal",
    phase: "Proposal Contract & 50% Funding",
    email: true,
    clientAction: false,
    actionBy: "HDG",
    emailTemplate: "proposalConfirmation"
  },
  {
    step: 37,
    csvStep: 41,
    title: "Proposal Funding Confirmation",
    description: "HDG confirms receipt of proposal funding",
    phase: "Proposal Contract & 50% Funding",
    email: true,
    clientAction: false,
    actionBy: "HDG",
    emailTemplate: "proposalFundingConfirmation"
  },

  // ==========================================
  // PHASE E (original 44–50) → step 38–44
  // ==========================================
  {
    step: 38,
    csvStep: 42,
    title: "Vendor Order Preparation",
    description: "HDG prepares vendor orders",
    phase: "Vendor Order & Production",
    email: false,
    clientAction: false,
    actionBy: "HDG"
  },
  {
    step: 39,
    csvStep: 43,
    title: "Send Orders to Vendors",
    description: "HDG sends orders to vendors",
    phase: "Vendor Order & Production",
    email: false,
    clientAction: false,
    actionBy: "HDG"
  },
  {
    step: 40,
    csvStep: 44,
    title: "Vendor Invoice Received",
    description: "Vendor sends 50% production deposit invoice",
    phase: "Vendor Order & Production",
    email: false,
    clientAction: false,
    actionBy: "Vendor"
  },
  {
    step: 41,
    csvStep: 45,
    title: "Fund Vendor Deposit",
    description: "HDG funds 50% vendor deposit",
    phase: "Vendor Order & Production",
    email: false,
    clientAction: false,
    actionBy: "HDG"
  },
  {
    step: 42,
    csvStep: 46,
    title: "Vendor Production Begins",
    description: "Vendor begins production",
    phase: "Vendor Order & Production",
    email: false,
    clientAction: false,
    actionBy: "Vendor"
  },
  {
    step: 43,
    csvStep: 47,
    title: "Production Start Notification",
    description: "HDG emails client that order is in production",
    phase: "Vendor Order & Production",
    email: true,
    clientAction: false,
    actionBy: "HDG",
    emailTemplate: "productionStarted",
    autoTrigger: true
  },
  {
    step: 44,
    csvStep: 48,
    title: "Production Management",
    description: "HDG manages and monitors production",
    phase: "Vendor Order & Production",
    email: false,
    clientAction: false,
    actionBy: "HDG"
  },

  // ==========================================
  // PHASE F (original 51–58) → step 45–52
  // ==========================================
  {
    step: 45,
    csvStep: 49,
    title: "25% Progress Payment Invoice",
    description: "HDG invoices client for 25% progress payment",
    phase: "25% Progress Payment",
    email: true,
    clientAction: false,
    actionBy: "HDG",
    emailTemplate: "progressPayment25Invoice"
  },
  {
    step: 46,
    csvStep: 50,
    title: "Progress Payment Funding Instructions",
    description: "HDG sends funding instructions for 25% progress payment",
    phase: "25% Progress Payment",
    email: true,
    clientAction: false,
    actionBy: "HDG",
    emailTemplate: "progressPayment25Instructions"
  },
  {
    step: 47,
    csvStep: 51,
    title: "Client Submits Progress Payment",
    description: "Client signs and funds 25% progress payment",
    phase: "25% Progress Payment",
    email: false,
    clientAction: true,
    actionBy: "Client"
  },
  {
    step: 48,
    csvStep: 52,
    title: "Bank Confirms Progress Payment",
    description: "Bank/System confirms progress payment receipt",
    phase: "25% Progress Payment",
    email: false,
    clientAction: false,
    actionBy: "Bank/System",
    autoTrigger: true
  },
  {
    step: 49,
    csvStep: 53,
    title: "Progress Payment Confirmation",
    description: "HDG confirms receipt of progress payment",
    phase: "25% Progress Payment",
    email: true,
    clientAction: false,
    actionBy: "HDG",
    emailTemplate: "progressPayment25Confirmation"
  },
  {
    step: 50,
    csvStep: 54,
    title: "Fund Vendor Final Payment",
    description: "HDG funds vendor final 50% balance",
    phase: "25% Progress Payment",
    email: false,
    clientAction: false,
    actionBy: "HDG"
  },
  {
    step: 51,
    csvStep: 55,
    title: "Manage Consolidation",
    description: "HDG manages consolidation and logistics",
    phase: "25% Progress Payment",
    email: false,
    clientAction: false,
    actionBy: "HDG"
  },
  {
    step: 52,
    csvStep: 56,
    title: "Products Ship",
    description: "Products ship from vendor",
    phase: "25% Progress Payment",
    email: false,
    clientAction: false,
    actionBy: "Vendor/Logistics"
  },

  // ==========================================
  // PHASE G (original 59–63) → step 53–57
  // ==========================================
  {
    step: 53,
    csvStep: 57,
    title: "Final Balance Invoice",
    description: "HDG invoices client final 25% balance",
    phase: "Final 25% Balance",
    email: true,
    clientAction: false,
    actionBy: "HDG",
    emailTemplate: "finalBalance25Invoice"
  },
  {
    step: 54,
    csvStep: 58,
    title: "Final Funding Instructions",
    description: "HDG sends final funding instructions",
    phase: "Final 25% Balance",
    email: true,
    clientAction: false,
    actionBy: "HDG",
    emailTemplate: "finalBalance25Instructions"
  },
  {
    step: 55,
    csvStep: 59,
    title: "Client Submits Final Payment",
    description: "Client signs and funds final 25% payment",
    phase: "Final 25% Balance",
    email: false,
    clientAction: true,
    actionBy: "Client"
  },
  {
    step: 56,
    csvStep: 60,
    title: "Bank Confirms Final Payment",
    description: "Bank/System confirms final payment receipt",
    phase: "Final 25% Balance",
    email: false,
    clientAction: false,
    actionBy: "Bank/System",
    autoTrigger: true
  },
  {
    step: 57,
    csvStep: 61,
    title: "Final Payment Confirmation",
    description: "HDG confirms receipt of final payment",
    phase: "Final 25% Balance",
    email: true,
    clientAction: false,
    actionBy: "HDG",
    emailTemplate: "finalPaymentConfirmation"
  },

  // ==========================================
  // PHASE H (original 64–67) → step 58–61
  // ==========================================
  {
    step: 58,
    csvStep: 62,
    title: "Freight Management",
    description: "HDG manages freight and shipping",
    phase: "Delivery Installation & Reveal",
    email: false,
    clientAction: false,
    actionBy: "HDG"
  },
  {
    step: 59,
    csvStep: 63,
    title: "Coordinate Delivery",
    description: "HDG coordinates delivery with building",
    phase: "Delivery Installation & Reveal",
    email: false,
    clientAction: false,
    actionBy: "HDG"
  },
  {
    step: 60,
    csvStep: 64,
    title: "Installation",
    description: "HDG installs furniture",
    phase: "Delivery Installation & Reveal",
    email: false,
    clientAction: false,
    actionBy: "HDG"
  },
  {
    step: 61,
    csvStep: 65,
    title: "Schedule Final Walkthrough",
    description: "HDG emails client to schedule walkthrough or reveal",
    phase: "Delivery Installation & Reveal",
    email: true,
    clientAction: false,
    actionBy: "HDG",
    emailTemplate: "scheduleFinalWalkthrough"
  }
];

module.exports = JOURNEY_STEPS;
