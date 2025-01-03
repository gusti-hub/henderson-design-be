// pdfUtils.js
const PDFDocument = require('pdfkit');
const axios = require('axios');

const generateHeaderSection = (doc) => {
  try {
    // Henderson Design Group Header
    doc.fontSize(20)
       .text('HENDERSON', { align: 'center' })
       .fontSize(12)
       .text('DESIGN GROUP', { align: 'center' })
       .moveDown(2);
  } catch (error) {
    console.error('Error in generateHeaderSection:', error);
  }
};

const generateClientSection = (doc, order) => {
  try {
    // Client Information
    doc.text(order.clientInfo?.name || '')
       .text(order.clientInfo?.address || '')
       .text(`${order.clientInfo?.city || ''}, ${order.clientInfo?.state || ''} ${order.clientInfo?.zipCode || ''}`)
       .text(order.clientInfo?.email || '')
       .moveDown();

    // Proposal Details
    const currentDate = new Date().toLocaleDateString();
    doc.text(`Project: ${order.projectId || ''}`, { continued: true })
       .text(`Proposal #: ${order.proposalNumber || ''}`, { align: 'right' })
       .text(`Proposal Date: ${currentDate}`, { align: 'right' })
       .moveDown(2);
  } catch (error) {
    console.error('Error in generateClientSection:', error);
  }
};

const generateItemSection = async (doc, item, y) => {
  try {
    // Section Header (Room name)
    const sectionHeight = 300;
    
    // Draw section background
    doc.rect(50, y, doc.page.width - 100, 30)
       .fillColor('#f5f5f5')
       .fill()
       .stroke('#cccccc');
    
    // Reset text color to black
    doc.fillColor('black')
       .text(item.spotName || 'Living Room', 70, y + 10);
    
    // Main content box
    const contentY = y + 30;
    doc.rect(50, contentY, doc.page.width - 100, sectionHeight)
       .stroke('#cccccc');

    // Product image and details
    if (item.image?.url) {
      try {
        const response = await axios.get(item.image.url, { 
          responseType: 'arraybuffer',
          timeout: 5000 // 5 second timeout
        });
        const imageBuffer = Buffer.from(response.data);
        doc.image(imageBuffer, 60, contentY + 10, { 
          width: 100, 
          height: 100,
          fit: [100, 100]
        });
      } catch (error) {
        console.error('Error loading image:', error);
      }
    }

    // Product details
    doc.text(item.name || '', 170, contentY + 10)
       .text(`Leg Finish: ${item.legFinish || 'N/A'}`, 170, contentY + 35)
       .text(`Size: ${item.size || 'N/A'}`, 170, contentY + 55)
       .moveDown()
       .text('Fabric Details:', 170, contentY + 85)
       .text(`Manufacturer: ${item.manufacturer || 'N/A'}`, 170, contentY + 105)
       .text(`Fabric: ${item.fabric || 'N/A'}`, 170, contentY + 125);

    // Add description list if available
    if (item.description && Array.isArray(item.description)) {
      item.description.forEach((desc, index) => {
        doc.text(desc, 170, contentY + 145 + (index * 20));
      });
    }

    // Pricing section (right side)
    const priceX = doc.page.width - 200;
    doc.text(`Quantity: ${item.quantity || '1.00'}`, priceX, contentY + 10)
       .text(`Unit Price: $${(item.unitPrice || 0).toFixed(2)}`, priceX, contentY + 35)
       .text(`Sales Tax: $${(item.salesTax || 0).toFixed(2)}`, priceX, contentY + 60)
       .text(`Total Price: $${(item.totalPrice || 0).toFixed(2)}`, priceX, contentY + 85);

    return sectionHeight + 50; // Return height of section for spacing
  } catch (error) {
    console.error('Error in generateItemSection:', error);
    return 350; // Return default height in case of error
  }
};

const generateFooter = (doc) => {
  try {
    const footerY = doc.page.height - 50;
    doc.fontSize(10)
       .text('Henderson Design Group', { align: 'center' })
       .text('74-5518 Kaiwi Street Suite B, Kailua Kona, HI, 96740-3145', { align: 'center' })
       .text('Phone: (808) 315-8782', { align: 'center' });
  } catch (error) {
    console.error('Error in generateFooter:', error);
  }
};

module.exports = {
  generateHeaderSection,
  generateClientSection,
  generateItemSection,
  generateFooter
};