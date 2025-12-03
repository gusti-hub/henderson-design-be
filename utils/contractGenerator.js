const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

const generateContractPDF = async (client, step) => {
  console.log(">>> GENERATING CONTRACT DOCX <<<");

  try {
    const templatePath = path.join(__dirname, 'templates', 'Design_Fee_Agreement_Template.docx');
    const tempDir = '/tmp/contract-generator';
    const timestamp = Date.now();
    const outputDocx = path.join(tempDir, `contract_${timestamp}.docx`);

    await fs.mkdir(tempDir, { recursive: true });
    await fs.access(templatePath);

    const clientData = {
      effectiveDate: '11.30.25',
      clientName: client?.name || 'Client Name',
      unitNumber: client?.unitNumber || '________',
      invoiceRef: client?.clientCode || 'Invoice #ALIA0006',
      bedroomCount: '1 bedroom',
      packageType: 'Nalu package',
      designFeeAmount: '$5,000',
      collectionType: 'Nalu'
    };

    // Save to JSON file
    const dataPath = path.join(tempDir, `data_${timestamp}.json`);
    await fs.writeFile(dataPath, JSON.stringify(clientData));

    const pythonScript = `
import json
from docx import Document

with open("${dataPath.replace(/\\/g, '/')}", 'r') as f:
    data = json.load(f)

doc = Document("${templatePath.replace(/\\/g, '/')}")

# Replace {{placeholders}} in paragraphs
for p in doc.paragraphs:
    for key, value in data.items():
        placeholder = "{{" + key + "}}"
        if placeholder in p.text:
            for run in p.runs:
                if placeholder in run.text:
                    run.text = run.text.replace(placeholder, value)

# Replace {{placeholders}} in tables
for table in doc.tables:
    for row in table.rows:
        for cell in row.cells:
            for p in cell.paragraphs:
                for key, value in data.items():
                    placeholder = "{{" + key + "}}"
                    if placeholder in p.text:
                        for run in p.runs:
                            if placeholder in run.text:
                                run.text = run.text.replace(placeholder, value)

doc.save("${outputDocx.replace(/\\/g, '/')}")
print("SUCCESS")
`;

    const scriptPath = path.join(tempDir, `modify_${timestamp}.py`);
    await fs.writeFile(scriptPath, pythonScript);

    const pythonCmd = 'python3';
    const { stdout, stderr } = await execPromise(`${pythonCmd} "${scriptPath}"`);

    if (!stdout.includes('SUCCESS')) {
      throw new Error(`Python failed: ${stderr}`);
    }

    console.log('✓ DOCX created');

    const docxBuffer = await fs.readFile(outputDocx);

    // Cleanup
    await fs.unlink(scriptPath).catch(() => {});
    await fs.unlink(dataPath).catch(() => {});
    await fs.unlink(outputDocx).catch(() => {});

    return docxBuffer;

  } catch (error) {
    console.error('Error:', error.message);
    throw error;
  }
};

/**
 * Generate Proposal/Production Contract PDF
 */
const generateProposalPDF = async (data) => {
  return new Promise((resolve, reject) => {
    try {
      const PDFDocument = require('pdfkit');
      
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