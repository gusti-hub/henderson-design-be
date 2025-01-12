const Order = require('../models/Order');
const { s3Client } = require('../config/s3');
const { PutObjectCommand } = require('@aws-sdk/client-s3');
const axios = require('axios');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const {
  generateHeaderSection,
  generateClientSection,
  generateItemSection,
  generateFooter
} = require('../config/pdfUtils');
const puppeteer = require('puppeteer');
const html_to_pdf = require('html-pdf-node');
const { generatePDF } = require('../config/pdfConfig');

const createOrder = async (req, res) => {
  try {
    // Check if user already has an order
    const existingOrder = await Order.findOne({
      user: req.user.id
    });

    if (existingOrder) {
      // If order exists, update it instead
      const updatedOrder = await Order.findOneAndUpdate(
        { _id: existingOrder._id },
        req.body,
        { new: true }
      );
      return res.json(updatedOrder);
    }

    // If no order exists, create new one
    const orderData = {
      user: req.user.id,
      selectedPlan: req.body.selectedPlan,
      clientInfo: req.body.clientInfo,
      selectedProducts: req.body.selectedProducts,
      occupiedSpots: req.body.occupiedSpots,
      step: req.body.step,
      package: req.body.package,
      status: req.body.status
    };

    const order = await Order.create(orderData);
    res.status(201).json(order);
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ message: error.message });
  }
};

// Modify the updateOrder function
const updateOrder = async (req, res) => {
  try {
    const existingOrder = await Order.findById(req.params.id);
    if (!existingOrder) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Clean up selected products if present in request
    let cleanedData = { ...req.body };
    if (req.body.selectedProducts) {
      cleanedData.selectedProducts = req.body.selectedProducts.map(product => ({
        _id: product._id,
        name: product.name,
        product_id: product.product_id,
        spotId: product.spotId,
        spotName: product.spotName,
        finalPrice: product.finalPrice,
        quantity: product.quantity,
        unitPrice: product.unitPrice,
        selectedOptions: {
          finish: product.selectedOptions?.finish || '',
          fabric: product.selectedOptions?.fabric || '',
          image: product.selectedOptions?.image || ''
        }
      }));
    }

    // If floor plan changed, reset products
    if (existingOrder.selectedPlan?.id !== req.body.selectedPlan?.id) {
      cleanedData.package = req.body.package;
      cleanedData.selectedProducts = [];
      cleanedData.occupiedSpots = {};
    }

    const order = await Order.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      cleanedData,
      { new: true }
    );

    res.json(order);
  } catch (error) {
    console.error('Error updating order:', error);
    res.status(500).json({ message: error.message });
  }
};

const getOrders = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || '';
    const status = req.query.status;
    const skip = (page - 1) * limit;


    // Create base query
    let searchQuery = {};

    // Add search conditions if search exists
    if (search) {
      searchQuery.$or = [
        { 'selectedPlan.clientInfo.name': { $regex: search, $options: 'i' } },
        { 'selectedPlan.clientInfo.unitNumber': { $regex: search, $options: 'i' } },
        { 'selectedProducts.name': { $regex: search, $options: 'i' } }
      ];
    }

    // Add status filter
    if (status && status !== 'all') {
      searchQuery.status = status;
    }

    // Execute query
    const total = await Order.countDocuments(searchQuery);
    const orders = await Order.find(searchQuery)
      .populate({
        path: 'user',
        select: 'name email'  // Select specific fields you need
      })
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });


    // Send response
    res.json({
      orders,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    });

  } catch (error) {
    console.error('Error in getOrders:', error);
    res.status(500).json({ message: error.message });
  }
};

const getOrderById = async (req, res) => {
  try {
    const order = await Order.findOne({
      _id: req.params.id,
      //user: req.user.id
    });
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    res.json(order);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const uploadPaymentProof = async (req, res) => {
  try {
    const { id } = req.params;
    const { installmentIndex } = req.body;
    const paymentProofFile = req.file;

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (!paymentProofFile) {
      return res.status(400).json({ error: 'No payment proof uploaded' });
    }

    const installment = order.paymentDetails.installments[installmentIndex];
    if (!installment) {
      return res.status(400).json({ error: 'Invalid installment index' });
    }

    const updatedOrder = await Order.updateOne(
      { _id: order._id, 'paymentDetails.installments._id': installment._id },
      {
        $set: {
          'paymentDetails.installments.$.status': 'uploaded',
          'paymentDetails.installments.$.proofOfPayment': {
            filename: paymentProofFile.originalname,
            url: paymentProofFile.location,
            key: paymentProofFile.key,
            uploadDate: new Date()
          }
        }
      }
    );
    
    res.json(updatedOrder);
  } catch (error) {
    console.error('Error uploading payment proof:', error);
    res.status(500).json({ message: 'Failed to upload payment proof' });
  }
};

const updatePaymentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { installmentIndex, status } = req.body;
    
    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Check if installment exists
    if (!order.paymentDetails?.installments?.[installmentIndex]) {
      return res.status(400).json({ message: 'Invalid installment index' });
    }

    // Update the installment status
    order.paymentDetails.installments[installmentIndex].status = status;

    // If all installments are verified, update order status
    const allVerified = order.paymentDetails.installments.every(
      inst => inst.status === 'verified'
    );
    
    if (allVerified) {
      order.status = 'completed';
    }

    await order.save();
    res.json(order);

  } catch (error) {
    console.error('Error updating payment status:', error);
    res.status(500).json({ message: error.message });
  }
};

  
const generateOrderPDF = async (req, res) => {
    try {
      const order = await Order.findById(req.params.id);
      if (!order) {
        return res.status(404).json({ message: 'Order not found' });
      }
  
      const doc = new PDFDocument();
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=order-${order._id}.pdf`);
      
      doc.pipe(res);
  
      // Header
      doc.fontSize(20).text('Henderson Design Group', { align: 'center' });
      doc.fontSize(16).text('Order Details', { align: 'center' });
      doc.moveDown();
  
      // Client Information
      doc.fontSize(14).text('Client Information');
      doc.fontSize(12)
        .text(`Name: ${order.clientInfo.name}`)
        .text(`Unit Number: ${order.clientInfo.unitNumber}`);
      doc.moveDown();
  
      // Order Information
      doc.fontSize(14).text('Order Information');
      doc.fontSize(12)
        .text(`Order ID: ${order._id}`)
        .text(`Floor Plan: ${order.selectedPlan}`)
        .text(`Status: ${order.status}`)
        .text(`Payment Status: ${order.paymentStatus}`);
      doc.moveDown();
  
      // Area Selections
      if (order.selections && Object.keys(order.selections).length > 0) {
        doc.fontSize(14).text('Area Selections');
        Object.entries(order.selections).forEach(([area, details]) => {
          doc.fontSize(12).text(`\n${area}:`);
          details.furniture.forEach(item => {
            doc.text(`  • ${item.type}`)
              .text(`    - Material: ${item.material}`)
              .text(`    - Color: ${item.color}`)
              .text(`    - Style: ${item.style}`);
          });
        });
      }
  
      doc.end();
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
};

const getCurrentUserOrder = async (req, res) => {
  try {
    // Look for any order, not just 'ongoing' ones
    const order = await Order.findOne({
      user: req.user.id
    }).sort({ createdAt: -1 }); // Get most recent order

    if (!order) {
      return res.status(404).json({ message: 'No order found' });
    }

    res.json(order);
  } catch (error) {
    console.error('Error fetching user order:', error);
    res.status(500).json({ message: error.message });
  }
};


const generateProposal = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('user')
      .lean();

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const products = order.selectedProducts || [];
    
    const productPages = [];
    productPages.push(products.slice(0, 2));
    for (let i = 2; i < products.length; i += 3) {
      productPages.push(products.slice(i, i + 3));
    }

    const subTotal = products.reduce((sum, product) => sum + (product.finalPrice || 0), 0);
    const salesTax = subTotal * 0.04712;
    const total = subTotal + salesTax;

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
                        <p>${order.clientInfo?.name || ''}</p>
                        <p>${order.clientInfo?.unitNumber || ''}</p>
                        <p>Kailua Kona, Hawaii 96740</p>
                        <p>${order.user?.email || ''}</p>
                    </div>

                    <div class="project-info">
                        <div class="left">
                            <p>Project: Alia</p>
                        </div>
                        <div class="right">
                            <p>Proposal #: ${order._id}</p>
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
                                      <p>Unit Price: $${product.unitPrice?.toFixed(2) || '0.00'}</p>
                                      <p>Subtotal: $${((product.unitPrice || 0) * (product.quantity || 1)).toFixed(2)}</p>
                                      <p>Sales Tax: $${((product.unitPrice * (product.quantity || 1)) * 0.04712).toFixed(2) || '0.00'}</p>
                                      <p style="font-weight:bold">Total Price: $${product.finalPrice?.toFixed(2) || '0.00'}</p>
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
                <p>Sales Tax: $${salesTax.toFixed(2)}</p>
                <p>Total: $${total.toFixed(2)}</p>
                <p>Required Deposit: $${total.toFixed(2)}</p>
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
                <p>${order.clientInfo?.name || ''}</p>
                <p>${order.clientInfo?.unitNumber || ''}</p>
                <p>Kailua Kona, Hawaii 96740</p>
                <p>${order.user?.email || ''}</p>
            </div>

            <div class="project-info">
                <p>Project: Alia</p>
                <div>
                    <p>Proposal #: ${order._id}</p>
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
    res.setHeader('Content-Disposition', `attachment; filename=proposal-${order._id}.pdf`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);

  } catch (error) {
    console.error('Error generating PDF:', error);
    res.status(500).json({ message: 'Error generating PDF' });
  }
};




const generateOrderSummary = async (req, res) => {
  try {
    const XLSX = require('xlsx');
    const order = await Order.findById(req.params.id)
      .populate('user')
      .lean();

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    
    // Create headers for the products sheet
    const headers = [
      'Product Name',
      'Product ID',
      'Location',
      'Quantity',
      'Unit Price',
      'Subtotal',
      'Sales Tax',
      'Total Price',
      'Finish',
      'Fabric',
      'Image URL'
    ];

    // Transform products data
    const productData = (order.selectedProducts || []).map(product => [
      product.name,
      product.product_id,
      product.spotName,
      product.quantity || 1,
      product.unitPrice?.toFixed(2) || '0.00',
      ((product.unitPrice || 0) * (product.quantity || 1)).toFixed(2),
      ((product.unitPrice * (product.quantity || 1)) * 0.04712).toFixed(2),
      product.finalPrice?.toFixed(2) || '0.00',
      product.selectedOptions?.finish || '',
      product.selectedOptions?.fabric || '',
      product.selectedOptions?.image || ''
    ]);

    // Calculate totals
    const subTotal = order.selectedProducts?.reduce((sum, product) => sum + (product.finalPrice || 0), 0) || 0;
    const salesTax = subTotal * 0.04712;
    const total = subTotal + salesTax;

    // Add summary rows
    const summaryRows = [
      [], // Empty row for spacing
      ['Order Summary'],
      ['Order ID:', order._id],
      ['Client Name:', order.clientInfo?.name || ''],
      ['Unit Number:', order.clientInfo?.unitNumber || ''],
      ['Floor Plan:', order.selectedPlan?.title || ''],
      ['Status:', order.status],
      [],
      ['Subtotal:', subTotal.toFixed(2)],
      ['Sales Tax:', salesTax.toFixed(2)],
      ['Total:', total.toFixed(2)]
    ];

    // Combine all data
    const wsData = [
      headers,
      ...productData,
      ...summaryRows
    ];

    // Create worksheet
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Set column widths
    const colWidths = [
      { wch: 30 }, // Product Name
      { wch: 15 }, // Product ID
      { wch: 20 }, // Location
      { wch: 10 }, // Quantity
      { wch: 12 }, // Unit Price
      { wch: 12 }, // Subtotal
      { wch: 12 }, // Sales Tax
      { wch: 12 }, // Total Price
      { wch: 15 }, // Finish
      { wch: 15 }, // Fabric
      { wch: 50 }  // Image URL
    ];
    ws['!cols'] = colWidths;

    // Style the headers
    const headerRange = XLSX.utils.decode_range(ws['!ref']);
    for (let C = headerRange.s.c; C <= headerRange.e.c; ++C) {
      const address = XLSX.utils.encode_cell({ r: 0, c: C });
      if (!ws[address]) continue;
      ws[address].s = {
        font: { bold: true },
        fill: { fgColor: { rgb: "CCCCCC" } }
      };
    }

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Order Summary');

    // Generate buffer
    const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    // Set headers for Excel file download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=order-summary-${order._id}.xlsx`);
    res.setHeader('Content-Length', excelBuffer.length);

    // Send the file
    res.send(excelBuffer);

  } catch (error) {
    console.error('Error generating Excel summary:', error);
    res.status(500).json({ message: 'Error generating Excel summary' });
  }
};


module.exports = {
  createOrder,
  getOrders,
  getOrderById,
  updateOrder,
  uploadPaymentProof,
  updatePaymentStatus,
  generateOrderPDF,
  getCurrentUserOrder,
  generateProposal,
  generateOrderSummary
};