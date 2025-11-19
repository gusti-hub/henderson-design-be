// /backend/data/journeySteps.js
// 23 Main Steps with Sub-steps

const JOURNEY_STEPS = [
  // Phase 1: Introduction
  { 
    step: 1, 
    title: "Initial Client Contact & Portal Setup",
    description: "Introduction, portal setup, and client information gathering",
    phase: "Introduction",
    subSteps: [
      { sub: 1, email: true, title: "Email to client for introduction meeting" },
      { sub: 2, title: "Introduction with client" },
      { sub: 3, title: "HDG input client information into software" },
      { sub: 4, email: true, title: "HDG send out welcome portal" },
      { sub: 5, clientAction: true, title: "Client responds through portal" },
      { sub: 6, email: true, title: "Confirm portal completion" }
    ]
  },
  { 
    step: 2, 
    title: "First Meeting Scheduling",
    description: "Client schedules initial consultation meeting",
    phase: "Introduction",
    clientAction: true
  },
  { 
    step: 3, 
    title: "Initial Consultation & Pricing Review",
    description: "HDG meets client to review pricing (30% Hold/Design, Contract, Options)",
    phase: "Introduction"
  },

  // Phase 2: Contract & Initial Payment
  { 
    step: 4, 
    title: "Contract Preparation & Delivery",
    description: "Contract and funding instructions preparation and delivery",
    phase: "Contract",
    subSteps: [
      { sub: 1, title: "HDG accounting prepares contract(s) & funding instructions" },
      { sub: 2, email: true, title: "HDG send out contract(s) for client to sign" },
      { sub: 3, email: true, title: "HDG send funding instructions" }
    ]
  },
  { 
    step: 5, 
    title: "Client Contract Execution & Payment",
    description: "Client signs contract and submits initial payment",
    phase: "Contract",
    subSteps: [
      { sub: 1, clientAction: true, title: "Client signs and funds" },
      { sub: 2, title: "HDG receives signed contract(s)" },
      { sub: 3, title: "Bank confirms receipt of funding" }
    ]
  },
  { 
    step: 6, 
    title: "Contract Confirmation & Design Meeting Setup",
    description: "Confirm receipt and schedule design meeting",
    phase: "Contract",
    subSteps: [
      { sub: 1, email: true, title: "HDG confirms receipt of contract" },
      { sub: 2, email: true, title: "HDG confirms receipt of funding" },
      { sub: 3, email: true, title: "HDG emails to schedule design meeting" },
      { sub: 4, clientAction: true, title: "Client signs up for design meeting" },
      { sub: 5, email: true, title: "HDG sends design meeting confirmation" }
    ]
  },

  // Phase 3: Design Development
  { 
    step: 7, 
    title: "Design Meeting 1 & Presentation Prep",
    description: "First design meeting and presentation preparation",
    phase: "Design",
    subSteps: [
      { sub: 1, title: "HDG design team reviews client response" },
      { sub: 2, title: "Design meeting 1" },
      { sub: 3, title: "HDG prepares presentation 1" }
    ]
  },
  { 
    step: 8, 
    title: "Presentation 1 & Revisions",
    description: "First design presentation and initial revisions",
    phase: "Design",
    subSteps: [
      { sub: 1, email: true, title: "HDG emails to schedule presentation 1" },
      { sub: 2, clientAction: true, title: "Client signs up for presentation 1" },
      { sub: 3, title: "HDG/Client presentation 1 meeting" },
      { sub: 4, title: "HDG revises design (as needed)" }
    ]
  },
  { 
    step: 9, 
    title: "Presentation 2 & Revisions",
    description: "Second design presentation and revisions (as needed)",
    phase: "Design",
    subSteps: [
      { sub: 1, email: true, title: "HDG emails to schedule presentation 2" },
      { sub: 2, clientAction: true, title: "Client signs up for presentation 2" },
      { sub: 3, title: "HDG/Client presentation 2 meeting" },
      { sub: 4, title: "HDG revises design (as needed)" }
    ]
  },
  { 
    step: 10, 
    title: "Presentation 3 & Revisions",
    description: "Third design presentation and revisions (as needed)",
    phase: "Design",
    subSteps: [
      { sub: 1, email: true, title: "HDG emails to schedule presentation 3" },
      { sub: 2, clientAction: true, title: "Client signs up for presentation 3" },
      { sub: 3, title: "HDG/Client presentation 3 meeting" }
    ]
  },
  { 
    step: 11, 
    title: "Final Design Approval",
    description: "Client reviews and approves final design",
    phase: "Design",
    subSteps: [
      { sub: 1, email: true, title: "HDG sends final design for approval" },
      { sub: 2, clientAction: true, title: "Client approves design" }
    ]
  },

  // Phase 4: Final Proposal & Payment
  { 
    step: 12, 
    title: "Final Proposal Preparation & Delivery",
    description: "Preparation and delivery of final proposal",
    phase: "Proposal",
    subSteps: [
      { sub: 1, title: "Design team and accounting prepare proposal" },
      { sub: 2, title: "HDG accounting prepares proposal amount" },
      { sub: 3, email: true, title: "HDG sends funding instructions & proposal to client" }
    ]
  },
  { 
    step: 13, 
    title: "Client Proposal Execution & Payment",
    description: "Client signs proposal and submits payment",
    phase: "Proposal",
    subSteps: [
      { sub: 1, clientAction: true, title: "Client signs and funds" },
      { sub: 2, title: "HDG receives signed proposal" },
      { sub: 3, title: "Bank confirms receipt of proposal funding" }
    ]
  },
  { 
    step: 14, 
    title: "Proposal Payment Confirmation",
    description: "Confirmation of proposal receipt and payment",
    phase: "Proposal",
    subSteps: [
      { sub: 1, email: true, title: "HDG confirms receipt of signed proposal" },
      { sub: 2, email: true, title: "HDG confirms receipt of proposal funding" }
    ]
  },

  // Phase 5: Production Preparation
  { 
    step: 15, 
    title: "Vendor Orders & Production Start",
    description: "Vendor order processing and production initiation",
    phase: "Production Prep",
    subSteps: [
      { sub: 1, title: "HDG prepares orders for vendor(s)" },
      { sub: 2, title: "HDG sends order to vendor(s)" },
      { sub: 3, title: "HDG receives vendor deposit 50% invoice" },
      { sub: 4, title: "HDG funds vendor deposit 50%" },
      { sub: 5, title: "Vendor production begins" }
    ]
  },
  { 
    step: 16, 
    title: "Production Start Notification",
    description: "Notify client that order is in production",
    phase: "Production Prep",
    email: true
  },

  // Phase 6: Manufacturing
  { 
    step: 17, 
    title: "Production Management & First Progress Payment",
    description: "Production oversight and first progress payment processing",
    phase: "Manufacturing",
    subSteps: [
      { sub: 1, title: "HDG manages production" },
      { sub: 2, title: "HDG accounting invoices client 25% progress payment" },
      { sub: 3, email: true, title: "HDG sends funding instructions & 25% invoice" },
      { sub: 4, clientAction: true, title: "Client signs and funds" },
      { sub: 5, title: "Bank confirms receipt of 25% progress payment" }
    ]
  },
  { 
    step: 18, 
    title: "First Progress Payment Confirmation",
    description: "Confirm receipt of 25% progress payment",
    phase: "Manufacturing",
    email: true
  },
  { 
    step: 19, 
    title: "Vendor Final Payment & Shipping",
    description: "Complete vendor payment and initiate shipping",
    phase: "Manufacturing",
    subSteps: [
      { sub: 1, title: "HDG funds vendor final balance 50%" },
      { sub: 2, title: "HDG manages consolidation" },
      { sub: 3, title: "Products ships" }
    ]
  },

  // Phase 7: Final Payment
  { 
    step: 20, 
    title: "Final Balance Invoice & Payment",
    description: "Final payment processing and confirmation",
    phase: "Shipping",
    subSteps: [
      { sub: 1, email: true, title: "HDG invoices client 25% final balance" },
      { sub: 2, email: true, title: "HDG sends funding instructions & balance invoice" },
      { sub: 3, clientAction: true, title: "Client signs and funds" },
      { sub: 4, title: "Bank confirms receipt of 25% balance payment" }
    ]
  },
  { 
    step: 21, 
    title: "Final Payment Confirmation",
    description: "Confirm receipt of final payment",
    phase: "Shipping",
    email: true
  },

  // Phase 8: Delivery & Installation
  { 
    step: 22, 
    title: "Delivery Coordination & Installation",
    description: "Freight management, delivery coordination, and installation",
    phase: "Delivery",
    subSteps: [
      { sub: 1, title: "HDG manages freight" },
      { sub: 2, title: "HDG coordinates delivery with building" },
      { sub: 3, title: "HDG installs" }
    ]
  },
  { 
    step: 23, 
    title: "Final Walkthrough Scheduling",
    description: "Schedule final walkthrough and cleanup",
    phase: "Delivery",
    email: true
  }
];

module.exports = JOURNEY_STEPS;