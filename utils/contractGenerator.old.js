// utils/contractGenerator.js
// PDF Contract Generator - EXACT REPLICA of Word Template

const PDFDocument = require('pdfkit');
const { Readable } = require('stream');

// =========================================
// SANITIZER
// =========================================
const sanitize = (t) => {
  if (!t) return "";
  return String(t)
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/Ā/g, "A")
    .replace(/ā/g, "a")
    .replace(/[^\x00-\x7F]/g, "");
};

// ==================================================================================
// EXACT CONTRACT PDF MATCHING WORD TEMPLATE
// ==================================================================================
const generateContractPDF = async (client, step) => {
  console.log(">>> GENERATING EXACT CONTRACT PDF <<<");

  return new Promise((resolve, reject) => {
    try {
      // Extract client data
      const clientName = sanitize(client?.name || "Client Name");
      const clientEmail = sanitize(client?.email || "client@email.com");
      const unitNumber = sanitize(client?.unitNumber || "________");
      const clientCode = sanitize(client?.clientCode || "ALIA0000");
      
      // Static values matching Word template
      const effectiveDate = "11.30.25";
      const invoiceRef = "Invoice #ALIA0006";
      const bedroomCount = "1 bedroom";
      const packageType = "Nalu package";
      const collectionName = "Nalu Collection";
      const designFeeAmount = "$5,000";

      const doc = new PDFDocument({
        size: 'LETTER',
        margins: { top: 60, bottom: 72, left: 72, right: 72 }
      });

      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
      const startX = doc.page.margins.left;
      let currentPage = 1;

      // Helper: Add header to each page
      const addHeader = () => {
        doc.fontSize(18)
           .font('Helvetica')
           .fillColor('#4A5568')
           .text('HENDERSON', startX, 30, { align: 'center', width: pageWidth });
        
        doc.fontSize(9)
           .fillColor('#718096')
           .text('DESIGN GROUP', startX, 50, { align: 'center', width: pageWidth });
        
        doc.moveDown(2);
      };

      // Helper: Add page number at bottom
      const addPageNumber = (pageNum) => {
        doc.fontSize(10)
           .font('Helvetica')
           .fillColor('#000000')
           .text(String(pageNum), startX, doc.page.height - 50, { 
             align: 'right', 
             width: pageWidth 
           });
      };

      // Helper: Yellow highlight background
      const highlightText = (text, x, y, width) => {
        const textWidth = doc.widthOfString(text);
        const textHeight = doc.currentLineHeight();
        
        doc.rect(x, y - 2, textWidth + 4, textHeight)
           .fill('#FFF9C4');
        
        doc.fillColor('#000000')
           .text(text, x, y);
      };

      // Helper: Write label with highlighted value
      const writeLabelHighlight = (label, value, y = null) => {
        if (y !== null) doc.y = y;
        
        const labelWidth = doc.widthOfString(label);
        const currentY = doc.y;
        
        doc.font('Helvetica')
           .fontSize(11)
           .fillColor('#000000')
           .text(label, startX, currentY, { continued: false });
        
        highlightText(value, startX + labelWidth + 1, currentY, 200);
        doc.moveDown(0.3);
      };

      // ============================================
      // PAGE 1
      // ============================================
      addHeader();

      // Title
      doc.fontSize(14)
         .font('Helvetica-Bold')
         .fillColor('#000000')
         .text('Henderson Design Group', { align: 'left' });
      
      doc.fontSize(14)
         .font('Helvetica-Bold')
         .text('Design Agreement - Alia Furniture Collections', { align: 'left' });
      
      doc.fontSize(11)
         .font('Helvetica')
         .text('(For Clients with 2025 Price Lock)', { align: 'left' });
      
      doc.moveDown(1.5);

      // Client info with yellow highlights
      writeLabelHighlight('Effective Date: ', effectiveDate);
      writeLabelHighlight('Client Name: ', clientName);
      writeLabelHighlight('Unit / Residence: ', unitNumber);
      writeLabelHighlight('Reference: ', invoiceRef);
      
      doc.moveDown(1.5);

      // Section 1: Purpose
      doc.fontSize(11)
         .font('Helvetica-Bold')
         .fillColor('#000000')
         .text('1. ', { continued: true, underline: true })
         .text('Purpose:', { underline: true });
      
      doc.moveDown(0.5);
      
      doc.font('Helvetica')
         .fontSize(11)
         .text(
           'This Design Agreement authorizes Henderson Design Group ("HDG") to begin the design phase for the Client\'s residence and outlines the scope, process, and payment terms for the design work.',
           { align: 'justify', width: pageWidth }
         );
      
      doc.moveDown(1.5);

      // Section 2: Design Fee and Payment Terms
      doc.fontSize(11)
         .font('Helvetica-Bold')
         .text('2. ', { continued: true, underline: true })
         .text('Design Fee and Payment Terms:', { underline: true });
      
      doc.moveDown(0.5);
      
      doc.font('Helvetica')
         .fontSize(11)
         .text(
           'The Client agrees to pay HDG a non-refundable design fee, due in full at signing. This fee covers all design services outlined in Section 3.',
           { align: 'justify', width: pageWidth }
         );
      
      doc.moveDown(0.8);

      // Description of Scope with highlights
      const scopeY = doc.y;
      doc.text('Description of Scope: Client has a ', { continued: true });
      const afterText1 = doc.x;
      const afterY1 = doc.y;
      
      doc.text('  '); // space for highlight
      highlightText(bedroomCount, afterText1, afterY1, 100);
      
      const afterHighlight1X = afterText1 + doc.widthOfString(bedroomCount) + 4;
      doc.text(' unit and would like to proceed with a ', afterHighlight1X, afterY1, { continued: true });
      const afterText2X = doc.x;
      
      doc.text('  ');
      highlightText(packageType, afterText2X, afterY1, 120);
      
      doc.text('.', afterText2X + doc.widthOfString(packageType) + 4, afterY1);
      
      doc.moveDown(1.2);

      // Table intro
      doc.fontSize(11)
         .text('Agreement will specify only one of the following:');
      
      doc.moveDown(0.8);

      // PRICING TABLE with proper borders
      const tableTop = doc.y;
      const rowHeight = 25;
      const col1X = startX;
      const col2X = startX + 180;
      const col3X = startX + 310;
      const col4X = startX + 440;
      const tableWidth = pageWidth;

      // Draw table borders
      const drawTableBorders = (startY, rows) => {
        // Horizontal lines
        for (let i = 0; i <= rows; i++) {
          doc.moveTo(col1X, startY + (i * rowHeight))
             .lineTo(col1X + tableWidth, startY + (i * rowHeight))
             .stroke();
        }
        
        // Vertical lines
        [col1X, col2X, col3X, col4X, col1X + tableWidth].forEach(x => {
          doc.moveTo(x, startY)
             .lineTo(x, startY + (rows * rowHeight))
             .stroke();
        });
      };

      drawTableBorders(tableTop, 4);

      // Header row
      doc.fontSize(10)
         .font('Helvetica-Bold')
         .fillColor('#000000')
         .text('Collection', col1X + 5, tableTop + 7, { width: 170 })
         .text('1 Bedroom', col2X + 5, tableTop + 7, { width: 120 })
         .text('2 Bedroom', col3X + 5, tableTop + 7, { width: 120 })
         .text('3 Bedroom', col4X + 5, tableTop + 7, { width: 120 });

      // Row 1: Nalu Foundation
      doc.fontSize(10)
         .font('Helvetica-Bold')
         .text('Nalu Foundation', col1X + 5, tableTop + rowHeight + 7, { width: 170 });
      doc.font('Helvetica-Bold')
         .text('Collection', col1X + 5, tableTop + rowHeight + 18, { width: 170 });
      doc.font('Helvetica')
         .text('$2,500', col2X + 5, tableTop + rowHeight + 7, { width: 120 })
         .text('$3,500', col3X + 5, tableTop + rowHeight + 7, { width: 120 })
         .text('$4,500', col4X + 5, tableTop + rowHeight + 7, { width: 120 });

      // Row 2: Nalu Collection (HIGHLIGHTED)
      const naluRowY = tableTop + (2 * rowHeight);
      
      // Yellow background for this row
      doc.rect(col1X + 1, naluRowY + 1, col2X - col1X - 2, rowHeight - 2)
         .fill('#FFF9C4');
      doc.rect(col2X + 1, naluRowY + 1, col3X - col2X - 2, rowHeight - 2)
         .fill('#FFF9C4');
      
      doc.fontSize(10)
         .font('Helvetica-Bold')
         .fillColor('#000000')
         .text('Nalu Collection', col1X + 5, naluRowY + 7, { width: 170 });
      doc.font('Helvetica')
         .text('$5,000', col2X + 5, naluRowY + 7, { width: 120 })
         .text('$7,500', col3X + 5, naluRowY + 7, { width: 120 })
         .text('$10,000', col4X + 5, naluRowY + 7, { width: 120 });

      // Row 3: Lani
      doc.fontSize(10)
         .font('Helvetica-Bold')
         .text('Lani', col1X + 5, tableTop + (3 * rowHeight) + 7, { width: 170 });
      doc.font('Helvetica')
         .text('$10,000', col2X + 5, tableTop + (3 * rowHeight) + 7, { width: 120 })
         .text('$15,000', col3X + 5, tableTop + (3 * rowHeight) + 7, { width: 120 })
         .text('$20,000', col4X + 5, tableTop + (3 * rowHeight) + 7, { width: 120 });

      doc.y = tableTop + (4 * rowHeight) + 20;

      // Continue with payment text
      doc.fontSize(11)
         .font('Helvetica')
         .fillColor('#000000')
         .text(
           'Payment is required before HDG begins design preparation, assigns design resources, or sets confirmed meeting dates.',
           { align: 'justify', width: pageWidth }
         );
      
      doc.moveDown(0.8);
      
      doc.text(
        'If the Client proceeds to production, 100% of the design fee will be credited toward the total furnishing package price. This credit remains valid for six (6) months from the final design presentation date.',
        { align: 'justify', width: pageWidth }
      );

      // Add page number
      addPageNumber(currentPage++);

      // ============================================
      // PAGE 2
      // ============================================
      doc.addPage();
      addHeader();

      // Section 3: Scope of Services
      doc.fontSize(11)
         .font('Helvetica-Bold')
         .text('3. ', { continued: true, underline: true })
         .text('Scope of Services:', { underline: true });
      
      doc.moveDown(0.5);
      
      doc.font('Helvetica')
         .text('The Design Fee includes:');
      
      doc.moveDown(0.3);

      // Bullet list with "o" instead of "•"
      const bullets = [
        'A design intake meeting',
        'Review of floor plan and unit layout',
        'Furniture layout and package selection (Lani, Nalu, or Foundation)',
        'Material, fabric, and finish selections',
        'One round of revisions',
        'Preparation of a final design presentation and furnishing proposal with a line item budget'
      ];

      bullets.forEach(item => {
        doc.text('o   ' + item, { indent: 20, width: pageWidth - 20 });
        doc.moveDown(0.3);
      });

      doc.moveDown(0.5);
      
      doc.text(
        'Additional revisions, custom designs, add-on sourcing, or in-person consultations may be billed separately at HDG\'s standard hourly rates.',
        { align: 'justify', width: pageWidth }
      );
      
      doc.moveDown(1.5);

      // Section 4: Schedule
      doc.fontSize(11)
         .font('Helvetica-Bold')
         .text('4. ', { continued: true, underline: true })
         .text('Schedule:', { underline: true });
      
      doc.moveDown(0.5);
      
      doc.font('Helvetica')
         .text(
           'Upon payment outlined in this agreement, Client secures a place in HDG\'s 2026 design calendar, HDG will now assign a confirmed design start date upon execution of this Agreement and receipt of payment.',
           { align: 'justify', width: pageWidth }
         );
      
      doc.moveDown(0.8);
      
      doc.text(
        'A Project Manager will be assigned as the Client\'s primary point of contact. Intake meeting and presentation dates will be scheduled according to HDG\'s 2026 design calendar.',
        { align: 'justify', width: pageWidth }
      );
      
      doc.moveDown(1.5);

      // Section 5: Credit Toward Production
      doc.fontSize(11)
         .font('Helvetica-Bold')
         .text('5. ', { continued: true, underline: true })
         .text('Credit Toward Production:', { underline: true });
      
      doc.moveDown(0.5);
      
      doc.font('Helvetica')
         .text(
           'If the Client moves forward to production, the full design fee will be applied as a credit toward the total furnishing package cost.',
           { align: 'justify', width: pageWidth }
         );
      
      doc.moveDown(0.8);
      
      doc.text(
        'If the Client does not proceed to production within six (6) months of design presentation approval, the credit expires.',
        { align: 'justify', width: pageWidth }
      );
      
      doc.moveDown(1.5);

      // Section 6: Cancellation and Refunds
      doc.fontSize(11)
         .font('Helvetica-Bold')
         .text('6. ', { continued: true, underline: true })
         .text('Cancellation and Refunds:', { underline: true });
      
      doc.moveDown(0.5);
      
      doc.font('Helvetica')
         .text(
           'The design fee is non-refundable. If the Client chooses not to proceed after design begins, HDG may, at its discretion, apply the fee toward future design services for the same property.',
           { align: 'justify', width: pageWidth }
         );

      // Add page number
      addPageNumber(currentPage++);

      // ============================================
      // PAGE 3
      // ============================================
      doc.addPage();
      addHeader();

      // Section 7: Ownership of Materials
      doc.fontSize(11)
         .font('Helvetica-Bold')
         .text('7. ', { continued: true, underline: true })
         .text('Ownership of Materials:', { underline: true });
      
      doc.moveDown(0.5);
      
      doc.font('Helvetica')
         .text(
           'All drawings, layouts, specifications, and renderings remain the exclusive property of HDG until the furnishing package is paid in full.',
           { align: 'justify', width: pageWidth }
         );
      
      doc.moveDown(0.8);
      
      doc.text(
        'The Client may not reuse, reproduce, or implement the design without HDG\'s written approval.',
        { align: 'justify', width: pageWidth }
      );
      
      doc.moveDown(1.5);

      // Section 8: Liability and Limitations
      doc.fontSize(11)
         .font('Helvetica-Bold')
         .text('8. ', { continued: true, underline: true })
         .text('Liability and Limitations:', { underline: true });
      
      doc.moveDown(0.5);
      
      doc.font('Helvetica')
         .text('HDG will exercise reasonable care in performing all services.');
      
      doc.moveDown(0.8);
      
      doc.text(
        'HDG is not responsible for delays caused by third parties, construction progress, HOA/building access limitations, material availability, or shipping logistics outside its control.',
        { align: 'justify', width: pageWidth }
      );
      
      doc.moveDown(1.5);

      // Section 9: Governing Law
      doc.fontSize(11)
         .font('Helvetica-Bold')
         .text('9. ', { continued: true, underline: true })
         .text('Governing Law:', { underline: true });
      
      doc.moveDown(0.5);
      
      doc.font('Helvetica')
         .text('This Agreement is governed by the laws of the State of Hawaii.');
      
      doc.moveDown(1.5);

      // Section 10: Acceptance
      doc.fontSize(11)
         .font('Helvetica-Bold')
         .text('10.     ', { continued: true, underline: true })
         .text('Acceptance:', { underline: true });
      
      doc.moveDown(0.5);
      
      doc.font('Helvetica')
         .text('By signing below, both parties agree to the terms of this Agreement:');
      
      doc.moveDown(1.5);

      // Signature blocks
      doc.fontSize(11)
         .font('Helvetica-Bold')
         .text('Client Signature', startX);
      
      doc.moveTo(startX + 140, doc.y - 8)
         .lineTo(startX + pageWidth, doc.y - 8)
         .stroke();
      
      doc.moveDown(1.5);
      
      doc.font('Helvetica-Bold')
         .text('Date', startX);
      
      doc.moveTo(startX + 45, doc.y - 8)
         .lineTo(startX + 150, doc.y - 8)
         .stroke();
      
      doc.moveDown(2);
      
      doc.font('Helvetica-Bold')
         .text('Printed Name', startX);
      
      doc.moveTo(startX + 110, doc.y - 8)
         .lineTo(startX + pageWidth, doc.y - 8)
         .stroke();
      
      doc.moveDown(3);

      // HDG signature
      doc.font('Helvetica-Bold')
         .text('HDG Representative', startX);
      
      doc.moveTo(startX + 150, doc.y - 8)
         .lineTo(startX + pageWidth, doc.y - 8)
         .stroke();
      
      doc.moveDown(1.5);
      
      doc.font('Helvetica-Bold')
         .text('Date', startX);
      
      doc.moveTo(startX + 45, doc.y - 8)
         .lineTo(startX + 150, doc.y - 8)
         .stroke();
      
      doc.moveDown(2);
      
      doc.font('Helvetica-Bold')
         .text('Printed Name', startX);
      
      doc.moveTo(startX + 110, doc.y - 8)
         .lineTo(startX + pageWidth, doc.y - 8)
         .stroke();

      // Add page number
      addPageNumber(currentPage++);

      // ============================================
      // PAGE 4 - EXHIBITS
      // ============================================
      doc.addPage();
      addHeader();

      // Exhibit A
      doc.fontSize(11)
         .font('Helvetica-Bold')
         .text('Exhibit A - ', { continued: true, underline: true })
         .text('Design Fee Summary:', { underline: true });
      
      doc.moveDown(1.5);

      // Design Fee with highlight
      const feeY = doc.y;
      doc.font('Helvetica')
         .text('Design Fee Amount: ', { continued: false });
      highlightText(designFeeAmount, startX + doc.widthOfString('Design Fee Amount: '), feeY, 100);
      
      doc.moveDown(1.5);

      // Collection Type with highlight
      const collectionY = doc.y;
      doc.text('Collection Type: ', { continued: false });
      highlightText('Nalu', startX + doc.widthOfString('Collection Type: '), collectionY, 100);
      
      doc.moveDown(1.5);

      // Payment Method
      doc.text('Payment Method:');
      doc.moveDown(0.3);
      doc.fontSize(11).text('▪   Check or', { indent: 20 });
      doc.text('▪   Wire Payment', { indent: 20 });
      
      doc.moveDown(1);
      
      doc.text('Date Received: ___________________________');
      
      doc.moveDown(2);

      // Horizontal separator
      doc.moveTo(startX, doc.y)
         .lineTo(startX + pageWidth, doc.y)
         .stroke();
      
      doc.moveDown(1.5);

      // Exhibit B
      doc.fontSize(11)
         .font('Helvetica-Bold')
         .text('Exhibit B - ', { continued: true, underline: true })
         .text('Deliverables:', { underline: true });
      
      doc.moveDown(0.8);
      
      doc.font('Helvetica')
         .text(
           'Design intake, layout development, material/finish selections, one revision, and final design presentation.',
           { align: 'justify', width: pageWidth }
         );
      
      doc.moveDown(2);

      // Horizontal separator
      doc.moveTo(startX, doc.y)
         .lineTo(startX + pageWidth, doc.y)
         .stroke();
      
      doc.moveDown(1.5);

      // Exhibit C
      doc.fontSize(11)
         .font('Helvetica-Bold')
         .text('Exhibit C - ', { continued: true, underline: true })
         .text('Schedule:', { underline: true });
      
      doc.moveDown(1.5);
      
      doc.font('Helvetica')
         .text('Confirmed Design Start: _________________________');
      
      doc.moveDown(1.5);
      
      doc.text('Estimated Completion: _________________________');

      // Add page number
      addPageNumber(currentPage++);

      doc.end();

    } catch (err) {
      console.error('PDF Generation Error:', err);
      reject(err);
    }
  });
};

/**
 * Generate Proposal/Production Contract PDF (unchanged)
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
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      // HEADER
      doc.fontSize(24)
         .font('Helvetica-Bold')
         .fillColor('#005670')
         .text('Henderson Design Group', { align: 'center' });
      
      doc.fontSize(12)
         .font('Helvetica')
         .fillColor('#333333')
         .text('Alia Collections', { align: 'center' });
      
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
           'Henderson Design Group | Alia Collections | aloha@henderson.house | henderson.house',
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