// utils/contractGenerator.js
// PDF Contract Generator using pdfkit

const PDFDocument = require('pdfkit');
const { Readable } = require('stream');

/**
 * Generate Contract PDF
 * @param {Object} data - Contract data
 * @returns {Promise<Buffer>} - PDF as Buffer
 */
const generateContractPDF = async (data) => {
  return new Promise((resolve, reject) => {
    try {
      const {
        clientName,
        clientEmail,
        unitNumber,
        floorPlan,
        contractAmount,
        downPaymentAmount,
        contractDate,
        contractType = 'Design Fee', // 'Design Fee' or 'Production'
        clientCode
      } = data;

      // Create PDF document
      const doc = new PDFDocument({
        size: 'LETTER',
        margins: { top: 72, bottom: 72, left: 72, right: 72 }
      });

      // Collect buffer chunks
      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(buffers);
        resolve(pdfBuffer);
      });
      doc.on('error', reject);

      // ==========================================
      // HEADER
      // ==========================================
      doc.fontSize(24)
         .font('Helvetica-Bold')
         .fillColor('#005670')
         .text('Henderson Design Group', { align: 'center' });
      
      doc.fontSize(12)
         .font('Helvetica')
         .fillColor('#333333')
         .text('Ālia Collections', { align: 'center' });
      
      doc.moveDown();
      doc.fontSize(18)
         .font('Helvetica-Bold')
         .fillColor('#005670')
         .text(`${contractType} Contract`, { align: 'center' });
      
      doc.moveDown(2);

      // ==========================================
      // CONTRACT DETAILS BOX
      // ==========================================
      const boxTop = doc.y;
      doc.rect(50, boxTop, 495, 120)
         .fillAndStroke('#f8f9fa', '#dee2e6');
      
      doc.fillColor('#333333')
         .fontSize(10)
         .font('Helvetica-Bold')
         .text('Contract Information', 70, boxTop + 15);
      
      doc.fontSize(9)
         .font('Helvetica')
         .text(`Contract Date: ${contractDate || new Date().toLocaleDateString()}`, 70, boxTop + 35);
      
      doc.text(`Contract Type: ${contractType}`, 70, boxTop + 50);
      
      if (clientCode) {
        doc.text(`Client Code: ${clientCode}`, 70, boxTop + 65);
      }
      
      doc.text(`Unit Number: ${unitNumber || 'N/A'}`, 70, boxTop + 80);
      doc.text(`Floor Plan: ${floorPlan || 'N/A'}`, 70, boxTop + 95);
      
      doc.moveDown(3);

      // ==========================================
      // PARTIES
      // ==========================================
      doc.fontSize(14)
         .font('Helvetica-Bold')
         .fillColor('#005670')
         .text('Contract Between:', { underline: true });
      
      doc.moveDown(0.5);
      
      // HDG Details
      doc.fontSize(10)
         .font('Helvetica-Bold')
         .fillColor('#333333')
         .text('Provider:');
      
      doc.fontSize(9)
         .font('Helvetica')
         .text('Henderson Design Group');
      doc.text('Ālia Collections');
      doc.text('Email: aloha@henderson.house');
      doc.text('Website: henderson.house');
      
      doc.moveDown(1);
      
      // Client Details
      doc.fontSize(10)
         .font('Helvetica-Bold')
         .text('Client:');
      
      doc.fontSize(9)
         .font('Helvetica')
         .text(clientName || 'Client Name');
      doc.text(`Email: ${clientEmail || 'client@email.com'}`);
      if (unitNumber) doc.text(`Unit: ${unitNumber}`);
      
      doc.moveDown(2);

      // ==========================================
      // PAYMENT TERMS
      // ==========================================
      doc.fontSize(14)
         .font('Helvetica-Bold')
         .fillColor('#005670')
         .text('Payment Terms:', { underline: true });
      
      doc.moveDown(0.5);
      
      // Payment Amount Box
      const paymentBoxTop = doc.y;
      doc.rect(50, paymentBoxTop, 495, 80)
         .fillAndStroke('#e8f5f9', '#bee5eb');
      
      doc.fontSize(11)
         .font('Helvetica-Bold')
         .fillColor('#005670')
         .text('Total Contract Amount:', 70, paymentBoxTop + 15);
      
      doc.fontSize(18)
         .text(`$${contractAmount ? contractAmount.toLocaleString() : '___________'}`, 70, paymentBoxTop + 35);
      
      if (downPaymentAmount) {
        doc.fontSize(10)
           .font('Helvetica')
           .fillColor('#333333')
           .text(`Initial Payment Due: $${downPaymentAmount.toLocaleString()}`, 70, paymentBoxTop + 60);
      }
      
      doc.moveDown(3);

      // ==========================================
      // TERMS & CONDITIONS
      // ==========================================
      doc.fontSize(14)
         .font('Helvetica-Bold')
         .fillColor('#005670')
         .text('Terms & Conditions:', { underline: true });
      
      doc.moveDown(0.5);
      
      const terms = contractType === 'Design Fee' ? [
        '1. This contract covers the design fee for custom furniture design services.',
        '2. The design fee is non-refundable once the design process has begun.',
        '3. The client will receive up to 3 design presentations with revisions.',
        '4. Upon final design approval, a separate production contract will be issued.',
        '5. Design files and specifications remain the property of Henderson Design Group.',
        '6. Timeline estimates are approximate and subject to change based on project complexity.',
        '7. Any additional design work beyond 3 presentations may incur additional fees.'
      ] : [
        '1. This contract covers the production and delivery of custom furniture as specified.',
        '2. Payment schedule: 50% upon contract signing, 25% progress payment, 25% final balance.',
        '3. Production timeline estimates are approximate and subject to vendor availability.',
        '4. All materials and finishes are as specified in the approved design.',
        '5. Installation and delivery are included as outlined in the proposal.',
        '6. Client is responsible for site preparation and access arrangements.',
        '7. Final walkthrough and approval required upon installation completion.',
        '8. Warranty terms apply as specified in the detailed proposal documentation.'
      ];
      
      doc.fontSize(9)
         .font('Helvetica')
         .fillColor('#333333');
      
      terms.forEach((term, index) => {
        doc.text(term, {
          indent: 10,
          width: 475,
          align: 'left'
        });
        if (index < terms.length - 1) doc.moveDown(0.3);
      });
      
      doc.moveDown(2);

      // ==========================================
      // SIGNATURE SECTION
      // ==========================================
      if (doc.y > 650) {
        doc.addPage();
      }
      
      doc.fontSize(14)
         .font('Helvetica-Bold')
         .fillColor('#005670')
         .text('Signatures:', { underline: true });
      
      doc.moveDown(2);
      
      // Client Signature
      doc.fontSize(10)
         .font('Helvetica')
         .fillColor('#333333')
         .text('Client Signature:', 70);
      
      doc.moveTo(70, doc.y + 30)
         .lineTo(270, doc.y + 30)
         .stroke();
      
      doc.text('', 70, doc.y + 35);
      doc.fontSize(8)
         .text(`Name: ${clientName || '____________________'}`, 70);
      doc.text('Date: ____________________', 70);
      
      // HDG Signature
      doc.fontSize(10)
         .text('Henderson Design Group Representative:', 320, doc.y - 75);
      
      doc.moveTo(320, doc.y + 30)
         .lineTo(520, doc.y + 30)
         .stroke();
      
      doc.text('', 320, doc.y + 35);
      doc.fontSize(8)
         .text('Name: ____________________', 320);
      doc.text('Date: ____________________', 320);
      
      doc.moveDown(3);

      // ==========================================
      // FOOTER
      // ==========================================
      const footerTop = 720;
      doc.fontSize(8)
         .font('Helvetica')
         .fillColor('#888888')
         .text(
           'Henderson Design Group | Ālia Collections | aloha@henderson.house | henderson.house',
           72,
           footerTop,
           {
             align: 'center',
             width: 450
           }
         );

      // Finalize PDF
      doc.end();

    } catch (error) {
      reject(error);
    }
  });
};

/**
 * Generate Proposal/Production Contract PDF (more detailed)
 * @param {Object} data - Proposal data
 * @returns {Promise<Buffer>} - PDF as Buffer
 */
const generateProposalPDF = async (data) => {
  return new Promise((resolve, reject) => {
    try {
      const {
        clientName,
        clientEmail,
        unitNumber,
        floorPlan,
        proposalAmount,
        itemizedList = [],
        specifications = '',
        estimatedTimeline = '',
        clientCode,
        proposalDate
      } = data;

      const doc = new PDFDocument({
        size: 'LETTER',
        margins: { top: 72, bottom: 72, left: 72, right: 72 }
      });

      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(buffers);
        resolve(pdfBuffer);
      });
      doc.on('error', reject);

      // HEADER
      doc.fontSize(24)
         .font('Helvetica-Bold')
         .fillColor('#005670')
         .text('Henderson Design Group', { align: 'center' });
      
      doc.fontSize(12)
         .font('Helvetica')
         .fillColor('#333333')
         .text('Ālia Collections', { align: 'center' });
      
      doc.moveDown();
      doc.fontSize(18)
         .font('Helvetica-Bold')
         .fillColor('#005670')
         .text('Production Proposal', { align: 'center' });
      
      doc.moveDown(2);

      // PROPOSAL INFO BOX
      const boxTop = doc.y;
      doc.rect(50, boxTop, 495, 100)
         .fillAndStroke('#f8f9fa', '#dee2e6');
      
      doc.fillColor('#333333')
         .fontSize(10)
         .font('Helvetica-Bold')
         .text('Proposal Details', 70, boxTop + 15);
      
      doc.fontSize(9)
         .font('Helvetica')
         .text(`Proposal Date: ${proposalDate || new Date().toLocaleDateString()}`, 70, boxTop + 35);
      
      if (clientCode) {
        doc.text(`Client Code: ${clientCode}`, 70, boxTop + 50);
      }
      
      doc.text(`Client: ${clientName}`, 70, boxTop + 65);
      doc.text(`Unit: ${unitNumber} | Floor Plan: ${floorPlan}`, 70, boxTop + 80);
      
      doc.moveDown(2);

      // TOTAL AMOUNT
      const amountBoxTop = doc.y;
      doc.rect(50, amountBoxTop, 495, 60)
         .fillAndStroke('#e8f5f9', '#bee5eb');
      
      doc.fontSize(12)
         .font('Helvetica-Bold')
         .fillColor('#005670')
         .text('Total Proposal Amount:', 70, amountBoxTop + 15);
      
      doc.fontSize(22)
         .text(`$${proposalAmount ? proposalAmount.toLocaleString() : '___________'}`, 70, amountBoxTop + 35);
      
      doc.moveDown(2);

      // ITEMIZED LIST
      if (itemizedList.length > 0) {
        doc.fontSize(14)
           .font('Helvetica-Bold')
           .fillColor('#005670')
           .text('Furniture Items:', { underline: true });
        
        doc.moveDown(0.5);
        
        itemizedList.forEach((item, index) => {
          doc.fontSize(9)
             .font('Helvetica')
             .fillColor('#333333')
             .text(`${index + 1}. ${item.name || 'Item'}`, { indent: 10 });
          
          if (item.description) {
            doc.fontSize(8)
               .fillColor('#666666')
               .text(`   ${item.description}`, { indent: 20 });
          }
          
          doc.moveDown(0.3);
        });
        
        doc.moveDown(1);
      }

      // PAYMENT SCHEDULE
      doc.fontSize(14)
         .font('Helvetica-Bold')
         .fillColor('#005670')
         .text('Payment Schedule:', { underline: true });
      
      doc.moveDown(0.5);
      
      const payment50 = proposalAmount ? (proposalAmount * 0.5).toLocaleString() : '___________';
      const payment25 = proposalAmount ? (proposalAmount * 0.25).toLocaleString() : '___________';
      
      doc.fontSize(9)
         .font('Helvetica')
         .fillColor('#333333')
         .text(`• 50% Initial Payment: $${payment50} (Due upon contract signing)`, { indent: 10 });
      doc.text(`• 25% Progress Payment: $${payment25} (Due during production)`, { indent: 10 });
      doc.text(`• 25% Final Balance: $${payment25} (Due before delivery)`, { indent: 10 });
      
      doc.moveDown(2);

      // TIMELINE
      if (estimatedTimeline) {
        doc.fontSize(14)
           .font('Helvetica-Bold')
           .fillColor('#005670')
           .text('Estimated Timeline:', { underline: true });
        
        doc.moveDown(0.5);
        
        doc.fontSize(9)
           .font('Helvetica')
           .fillColor('#333333')
           .text(estimatedTimeline, { indent: 10, width: 475 });
        
        doc.moveDown(2);
      }

      // SPECIFICATIONS
      if (specifications) {
        if (doc.y > 650) doc.addPage();
        
        doc.fontSize(14)
           .font('Helvetica-Bold')
           .fillColor('#005670')
           .text('Specifications:', { underline: true });
        
        doc.moveDown(0.5);
        
        doc.fontSize(9)
           .font('Helvetica')
           .fillColor('#333333')
           .text(specifications, { indent: 10, width: 475 });
        
        doc.moveDown(2);
      }

      // SIGNATURE SECTION
      if (doc.y > 650) doc.addPage();
      
      doc.fontSize(14)
         .font('Helvetica-Bold')
         .fillColor('#005670')
         .text('Acceptance & Signatures:', { underline: true });
      
      doc.moveDown(1);
      
      doc.fontSize(9)
         .font('Helvetica')
         .fillColor('#333333')
         .text(
           'By signing below, the client accepts the terms of this proposal and authorizes Henderson Design Group to proceed with production.',
           { width: 475 }
         );
      
      doc.moveDown(2);
      
      // Client Signature
      doc.fontSize(10)
         .text('Client Signature:', 70);
      
      doc.moveTo(70, doc.y + 30)
         .lineTo(270, doc.y + 30)
         .stroke();
      
      doc.text('', 70, doc.y + 35);
      doc.fontSize(8)
         .text(`Name: ${clientName}`, 70);
      doc.text('Date: ____________________', 70);
      
      // HDG Signature
      doc.fontSize(10)
         .text('Henderson Design Group:', 320, doc.y - 75);
      
      doc.moveTo(320, doc.y + 30)
         .lineTo(520, doc.y + 30)
         .stroke();
      
      doc.text('', 320, doc.y + 35);
      doc.fontSize(8)
         .text('Name: ____________________', 320);
      doc.text('Date: ____________________', 320);

      // FOOTER
      const footerTop = 720;
      doc.fontSize(8)
         .font('Helvetica')
         .fillColor('#888888')
         .text(
           'Henderson Design Group | Ālia Collections | aloha@henderson.house | henderson.house',
           72,
           footerTop,
           { align: 'center', width: 450 }
         );

      doc.end();

    } catch (error) {
      reject(error);
    }
  });
};

module.exports = {
  generateContractPDF,
  generateProposalPDF
};