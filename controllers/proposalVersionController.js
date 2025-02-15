// controllers/proposalVersionController.js
const ProposalVersion = require('../models/ProposalVersion');
const Order = require('../models/Order');
const { s3Client } = require('../config/s3');
const { PutObjectCommand } = require('@aws-sdk/client-s3');
const { generatePDF } = require('../config/pdfConfig');

const getBudgetForPlan = (planId) => {
    const budgets = {
      'investor-a': 80835,  // 2 Bedroom
      'investor-b': 115000, // 2 Bedroom + 2.5 Bath
      'investor-c': 115000, // 2 Bedroom + Den
      'investor-d': 65000,  // 1 Bedroom
      'investor-e': 70000,  // 2 Bedroom
      'investor-f': 120000, // 3 Bedroom + Den
      'custom-a': 133414,  // 2 Bedroom
      'custom-b': 105000,  // 2 Bedroom + 2.5 Bath
      'custom-c': 147000,  // 2 Bedroom + Den
      'custom-d': 85000,   // 1 Bedroom
      'custom-e': 90000,   // 2 Bedroom
      'custom-f': 140000,  // 3 Bedroom + Den
      default: 80000
    };
  
    return budgets[planId] || budgets.default;
  };
  

const generateVersionPdf = async (req, res) => {
try {
    const { id, version } = req.params;
    // Get the order and version data

    // Get the specific version
    const proposalVersion = await ProposalVersion.findOne({
    orderId: id,
    version: parseInt(version)
    });

    if (!proposalVersion) {
    return res.status(404).json({ message: 'Version not found' });
    }

    // Use the products from the version instead of current order
    const products = proposalVersion.selectedProducts || [];
    
    const productPages = [];
    productPages.push(products.slice(0, 2));
    for (let i = 2; i < products.length; i += 3) {
    productPages.push(products.slice(i, i + 3));
    }

    const totalBudget = getBudgetForPlan(proposalVersion.selectedPlan.id);
    const subTotal = totalBudget;
    const salesTax = subTotal * 0;
    const total = subTotal + salesTax;
    const deposit = total * 0.5;
    const totalPages = productPages.length + 2;

    const htmlTemplate = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        @page {
            size: letter;
            margin: 0;
        }
        body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 0;
            font-size: 12px;
            line-height: 1.4;
        }
        .page {
            position: relative;
            height: 11in;
            padding: 40px;
            box-sizing: border-box;
            page-break-after: always;
        }
        .header {
            text-align: center;
            margin-bottom: 40px;
        }
        .header h1 {
            color: rgb(0, 86, 112);
            font-size: 28px;
            margin: 0;
            font-weight: normal;
        }
        .header p {
            color: rgb(0, 86, 112);
            font-size: 14px;
            margin: 5px 0 0 0;
        }
        .proposal-title {
            color: rgb(128, 0, 0);
            font-weight: bold;
            margin: 20px 0;
        }
        .section-header {
            background: #f0f0f0;
            padding: 8px;
            text-align: center;
            border: 1px solid #000;
            border-bottom: none;
        }
        .section-content {
            border: 1px solid #000;
            padding: 20px;
            margin-bottom: 20px;
            min-height: 150px;
        }
        .product-box {
            display: grid;
            grid-template-columns: 120px 1fr 200px;
            gap: 20px;
        }
        .product-image {
            width: 120px;
        }
        .product-image img {
            width: 100%;
            height: auto;
            max-height: 120px;
            object-fit: contain;
        }
        .product-details p {
            margin: 3px 0;
        }
        .pricing {
            text-align: right;
        }
        .pricing p {
            margin: 3px 0;
        }
        .page-footer {
            position: absolute;
            bottom: 60px;
            left: 0;
            right: 0;
            text-align: center;
            font-size: 11px;
            color: rgb(0, 86, 112);
            background: white;
            padding: 0 40px;
        }
        .page-number {
            position: absolute;
            bottom: 20px;
            right: 40px;
            font-size: 11px;
        }
        .totals {
            text-align: right;
            margin: 20px 0;
        }
        .warranty-section {
            margin: 20px 0;
        }
        .warranty-title {
            color: rgb(128, 0, 0);
            font-weight: bold;
        }
        .content-wrapper {
            margin-bottom: 100px;
        }
        .signature-line {
            border-top: 1px solid black;
            margin-top: 40px;
        }
        .client-info {
            margin-bottom: 20px;
        }
        .client-info p {
            margin: 3px 0;
        }
        .project-info {
            display: flex;
            justify-content: space-between;
            margin: 20px 0;
        }
        .project-info .left {
            color: rgb(0, 0, 128);
        }
        .project-info .right {
            text-align: right;
        }
        .project-info p {
            margin: 3px 0;
        }
        .pricing {
            text-align: right;
            border-left: 1px solid #eee;
            padding-left: 20px;
        }
        .pricing p {
            margin: 3px 0;
            line-height: 1.6;
        }
        .pricing p:last-child {
            margin-top: 8px;
            padding-top: 8px;
            border-top: 1px solid #eee;
        }
    </style>
</head>
<body>
    ${productPages.map((pageProducts, pageIndex) => `
        <div class="page">
            <div class="content-wrapper">
                ${pageIndex === 0 ? `
                    <div class="header">
                        <h1>HENDERSON</h1>
                        <p>DESIGN GROUP</p>
                    </div>

                    <div class="proposal-title">Proposal</div>

                    <div class="client-info">
                        <p>${proposalVersion.clientInfo?.name || ''}</p>
                        <p>${proposalVersion.clientInfo?.unitNumber || ''}</p>
                        <p>Kailua Kona, Hawaii 96740</p>
                        <p>${proposalVersion.user?.email || ''}</p>
                    </div>

                    <div class="project-info">
                        <div class="left">
                            <p>Project: Alia</p>
                        </div>
                        <div class="right">
                            <p>Proposal #: ${proposalVersion._id}</p>
                            <p>Proposal Date: ${new Date().toLocaleDateString()}</p>
                        </div>
                    </div>
                ` : ''}

                  ${pageProducts.map(product => `
                      <div>
                          <div class="section-header">${product.spotName || ''}</div>
                          <div class="section-content">
                              <div class="product-box">
                                  <div class="product-image">
                                      ${product.selectedOptions?.image ? 
                                          `<img src="${product.selectedOptions.image}" alt="${product.name}">` 
                                          : '<div style="width:120px;height:120px;background:#f0f0f0;display:flex;align-items:center;justify-content:center;">No Image</div>'}
                                  </div>
                                  <div class="product-details">
                                      <p style="font-weight:bold">${product.name}</p>
                                      <p>Product ID: ${product.product_id || ''}</p>
                                      <p>Fabric Details</p>
                                      <p>Finish: ${product.selectedOptions?.finish || ''}</p>
                                      <p>Fabric: ${product.selectedOptions?.fabric || ''}</p>
                                  </div>
                                  <div class="pricing">
                                      <p>Quantity: ${product.quantity || 1}</p>
                                      <p>Unit Price: $${(1).toFixed(2) || '0.00'}</p>
                                      <p>Subtotal: $${(((1) || 0) * ((1) || 1)).toFixed(2)}</p>
                                      <p>Sales Tax: $${(((1) * ((1) || 1)) * 1).toFixed(2) || '0.00'}</p>
                                      <p style="font-weight:bold">Total Price: $${(1).toFixed(2) || '0.00'}</p>
                                  </div>
                              </div>
                          </div>
                      </div>
                  `).join('')}
            </div>

            <div class="page-footer">
                <p>Henderson Design Group 74-5518 Kaiwi Street Suite B, Kailua Kona, HI, 96740-3145</p>
                <p>Phone: (808) 315-8782</p>
            </div>
            <div class="page-number">${pageIndex + 1}/${totalPages}</div>
        </div>
    `).join('')}

    <!-- Warranty Terms Page -->
    <div class="page">
        <div class="content-wrapper">
            <div class="totals">
                <p>Sub Total: $${subTotal.toFixed(2)}</p>
                <p>Sales Tax: $${(1).toFixed(2)}</p>
                <p>Total: $${total.toFixed(2)}</p>
                <p>Required Deposit: $${deposit.toFixed(2)}</p>
            </div>

            <div class="warranty-title">Proposal Terms: Henderson Design Group Warranty Terms and Conditions</div>
            
            <div class="warranty-section">
                <p>Coverage Period: Furniture is warranted to be free from defects in workmanship, materials, and functionality for a period of 30 days from the date of installation.</p>

                <p>Scope of Warranty:</p>
                <p>• Workmanship, Materials, and Functionality: The warranty covers defects in workmanship, materials, and functionality under normal wear and tear conditions.</p>
                <p>• Repair or Replacement: If a defect is identified within the 30-day period, Henderson Design Group will, at its discretion, either repair or replace the defective item. This warranty applies to normal household use only.</p>

                <p>Returns and Exchanges:</p>
                <p>• No Returns: Items are not eligible for returns.</p>
                <p>• No Exchanges: Exchanges are not permitted except in cases of defects as noted above.</p>
                <p>• Custom Items: Custom items, including upholstery, are not eligible for returns or exchanges.</p>

                <p>Exclusions:</p>
                <p>• Negligence, Misuse, or Accidents: The warranty does not cover defects resulting from negligence, misuse, or accidents after installation.</p>
                <p>• Maintenance and Commercial Use: The warranty is void for any condition resulting from incorrect or inadequate maintenance.</p>
                <p>• Non-Residential Use: The warranty is void for any condition resulting from other than ordinary residential wear.</p>
                <p>• Natural Material Variations: The warranty does not cover the matching of color, grain, or texture of wood, leather, or fabrics.</p>
                <p>• Environmental Responses: Wood may expand and contract in response to temperature and humidity variations, potentially causing small movements and cracks. This is a natural occurrence and not considered a defect.</p>
                <p>• Fabric and Leather Wear: The warranty does not cover colorfastness, dye lot variations, wrinkling, or wear of fabrics or leather.</p>
                <p>• Softening of Fillings: The warranty does not cover the softening of filling materials under normal use.</p>
                <p>• Sun Exposure: Extensive exposure to the sun is not covered by the warranty.</p>
                <p>• Fabric Protectants: Applying a fabric protectant to your upholstered furniture could void the Henderson warranty.</p>
            </div>
        </div>

        <div class="page-footer">
            <p>Henderson Design Group 74-5518 Kaiwi Street Suite B, Kailua Kona, HI, 96740-3145</p>
            <p>Phone: (808) 315-8782</p>
        </div>
        <div class="page-number">${totalPages - 1}/${totalPages}</div>
    </div>

    <!-- Signature Page -->
    <div class="page">
        <div class="content-wrapper">
            <div class="header">
                <h1>HENDERSON</h1>
                <p>DESIGN GROUP</p>
            </div>

            <div class="proposal-title">Proposal</div>

            <div>
                <p>${proposalVersion.clientInfo?.name || ''}</p>
                <p>${proposalVersion.clientInfo?.unitNumber || ''}</p>
                <p>Kailua Kona, Hawaii 96740</p>
                <p>${proposalVersion.user?.email || ''}</p>
            </div>

            <div class="project-info">
                <p>Project: Alia</p>
                <div>
                    <p>Proposal #: ${proposalVersion._id}</p>
                    <p>Proposal Date: ${new Date().toLocaleDateString()}</p>
                </div>
            </div>

            <div class="warranty-section">
                <p>• Original Buyer: The warranty applies to the original buyer only and covers furniture that has been installed under Henderson Design Group supervision.</p>
                <p>• Original Installation Location: The warranty is valid only for furnishings and products in the space where they were originally installed.</p>
                <p>• Repair, Touch-Up, or Replacement Only: Henderson Design Group policies are for repair, touch-up, or replacement only. No refunds.</p>
                <p>• Non-Returnable Custom Upholstery: Custom upholstery is non-returnable.</p>
                <p>• Non-Transferable Warranty: The warranty is non-transferable.</p>

                <p style="margin-top: 30px">100% Deposit</p>
                
                <p style="margin-top: 30px">Accept and Approve:</p>
                <div class="signature-line"></div>
            </div>
        </div>

        <div class="page-footer">
            <p>Henderson Design Group 74-5518 Kaiwi Street Suite B, Kailua Kona, HI, 96740-3145</p>
            <p>Phone: (808) 315-8782</p>
        </div>
        <div class="page-number">${totalPages}/${totalPages}</div>
    </div>
</body>
</html>`;

    const pdfBuffer = await generatePDF(htmlTemplate, {
      format: 'Letter',
      printBackground: true,
      preferCSSPageSize: true,
      margin: {
        top: '0',
        right: '0',
        bottom: '0',
        left: '0'
      }
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=proposal-${id}-v${version}.pdf`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);

} catch (error) {
    console.error('Error generating version PDF:', error);
    res.status(500).json({ message: 'Error generating PDF' });
}
};

const getProposalVersions = async (req, res) => {
  try {
    const { orderId } = req.params;
    
    const versions = await ProposalVersion.find({ orderId })
      .populate('createdBy', 'name email')
      .sort({ version: -1 });
      
    res.json(versions);
  } catch (error) {
    console.error('Error fetching proposal versions:', error);
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  generateVersionPdf,
  getProposalVersions
};