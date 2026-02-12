const Order = require('../models/Order');
const User = require('../models/User'); // ✅ ADDED
const ProposalVersion = require('../models/ProposalVersion');
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
const nodemailer = require('nodemailer');

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

const updateOrder = async (req, res) => {
  try {
    console.log('📝 updateOrder called for ID:', req.params.id);
    console.log('📦 Request body keys:', Object.keys(req.body));

    const existingOrder = await Order.findById(req.params.id);
    if (!existingOrder) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // ✅ FIX: Declare updateData here
    const updateData = {};

    // ✅ Handle selectedProducts with temporary ID cleanup
    if (req.body.selectedProducts && Array.isArray(req.body.selectedProducts)) {
      console.log(`📦 Processing ${req.body.selectedProducts.length} products`);
      
      updateData.selectedProducts = req.body.selectedProducts.map(product => {
        // ✅ Remove _id if it's a temporary ID
        const cleanProduct = { ...product };
        
        if (product._id && typeof product._id === 'string' && product._id.startsWith('temp_')) {
          delete cleanProduct._id; // Let MongoDB generate new _id
          console.log(`🔄 Removed temporary ID for product: ${product.name}`);
        }
        
        return {
          ...(cleanProduct._id && { _id: cleanProduct._id }), // Only include if valid
          product_id: product.product_id,
          name: product.name,
          category: product.category,
          spotName: product.spotName,
          quantity: product.quantity || 1,
          unitPrice: product.unitPrice || 0,
          finalPrice: product.finalPrice || 0,
          vendor: product.vendor || null,
          sourceType: product.sourceType || 'manual',
          isEditable: product.isEditable !== undefined ? product.isEditable : true,
          selectedOptions: {
            poNumber: product.selectedOptions?.poNumber || '',
            vendorOrderNumber: product.selectedOptions?.vendorOrderNumber || '',
            trackingInfo: product.selectedOptions?.trackingInfo || '',
            deliveryStatus: product.selectedOptions?.deliveryStatus || '',
            finish: product.selectedOptions?.finish || '',
            fabric: product.selectedOptions?.fabric || '',
            size: product.selectedOptions?.size || '',
            insetPanel: product.selectedOptions?.insetPanel || '',
            image: product.selectedOptions?.image || '',
            images: product.selectedOptions?.images || [],
            links: product.selectedOptions?.links || [],
            specifications: product.selectedOptions?.specifications || '',
            notes: product.selectedOptions?.notes || '',
            uploadedImages: (product.selectedOptions?.uploadedImages || []).map(img => ({
              filename: img.filename || '',
              contentType: img.contentType || '',
              url: img.url || '',
              key: img.key || '',
              size: img.size || 0,
              uploadedAt: img.uploadedAt || new Date()
              // ✅ No Buffer/data field - URL only
            })),
            customAttributes: product.selectedOptions?.customAttributes || {}
          },
          placement: product.placement || null
        };
      });
    }

    // ✅ Handle customFloorPlan
    if (req.body.customFloorPlan) {
      updateData.customFloorPlan = req.body.customFloorPlan;
      console.log('📐 Floor plan included in update');
    }

    // Handle occupiedSpots
    if (req.body.occupiedSpots !== undefined) {
      updateData.occupiedSpots = req.body.occupiedSpots;
    }

    // Handle selectedPlan
    if (req.body.selectedPlan) {
      updateData.selectedPlan = req.body.selectedPlan;
    }

    // Handle status
    if (req.body.status) {
      updateData.status = req.body.status;
    }

    // Handle step
    if (req.body.step !== undefined) {
      updateData.step = req.body.step;
    }

    // Handle Package
    if (req.body.Package) {
      updateData.Package = req.body.Package;
    }

    // If floor plan changed, reset products (only for non-custom packages)
    if (req.body.selectedPlan && 
        existingOrder.packageType !== 'custom' &&
        existingOrder.selectedPlan?.id !== req.body.selectedPlan?.id) {
      console.log('⚠️ Floor plan changed - resetting products');
      updateData.selectedProducts = [];
      updateData.occupiedSpots = {};
    }

    console.log('📦 Final update data keys:', Object.keys(updateData));

    // ✅ Update order using direct assignment instead of findByIdAndUpdate
    // This avoids casting issues with temporary IDs
    Object.assign(existingOrder, updateData);
    const updatedOrder = await existingOrder.save();

    console.log(`✅ Order updated successfully`);
    console.log(`📦 Final selectedProducts count: ${updatedOrder.selectedProducts?.length || 0}`);

    // Check if status changed to confirmed
    if (updateData.status === 'confirmed' && existingOrder.status !== 'confirmed') {
      try {
        const user = await User.findById(existingOrder.user);
        if (user && user.email) {
          console.log('📧 Confirmation email queued');
        }
      } catch (emailError) {
        console.error('⚠️ Failed to send confirmation email:', emailError);
      }
    }

    res.json(updatedOrder);

  } catch (error) {
    console.error('❌ Error updating order:', error);
    res.status(500).json({ 
      success: false,
      message: error.message 
    });
  }
};

const getOrders = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || '';
    const status = req.query.status;
    const skip = (page - 1) * limit;

    // ✅ Build optimized query
    let searchQuery = {};

    // Add search conditions
    if (search) {
      searchQuery.$or = [
        { 'clientInfo.name': { $regex: search, $options: 'i' } },
        { 'clientInfo.unitNumber': { $regex: search, $options: 'i' } }
      ];
    }

    // Add status filter
    if (status && status !== 'all') {
      searchQuery.status = status;
    }

    console.log('📊 Query:', searchQuery);
    console.time('getOrders');

    // ✅ CRITICAL: Exclude heavy fields from list view
    const excludeFields = {
      // 'selectedProducts.selectedOptions.uploadedImages': 0, // Don't load images in list
      'customFloorPlan.data': 0, // Don't load floor plan in list
      'occupiedSpots': 0 // Don't need spot data in list
    };

    // Execute query with lean() for better performance
    const [total, orders] = await Promise.all([
      Order.countDocuments(searchQuery),
      Order.find(searchQuery, excludeFields)
        .populate({
          path: 'user',
          select: 'name email clientCode unitNumber' // Only needed fields
        })
        .select('-__v') // Exclude version key
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 })
        .lean() // ✅ Use lean() for faster queries
    ]);

    console.timeEnd('getOrders');
    console.log(`✅ Returned ${orders.length} orders in page ${page}`);

    // Send response
    res.json({
      orders,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    });

  } catch (error) {
    console.error('❌ Error in getOrders:', error);
    res.status(500).json({ message: error.message });
  }
};

const getOrderById = async (req, res) => {
  try {
    console.log('📦 getOrderById called for:', req.params.id);
    
    const order = await Order.findById(req.params.id)
      .populate({
        path: 'user',
        select: 'name email clientCode unitNumber'
      })
      .lean();

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // ✅ Handle customFloorPlan - reconstruct URL if missing
    if (order.customFloorPlan) {
      console.log('📐 Custom floor plan found:', {
        hasUrl: !!order.customFloorPlan.url,
        hasKey: !!order.customFloorPlan.key,
        hasData: !!order.customFloorPlan.data,
        filename: order.customFloorPlan.filename
      });
      
      // ✅ If URL is missing but key exists, reconstruct it
      if (!order.customFloorPlan.url && order.customFloorPlan.key) {
        const HARDCODED_CONFIG = {
          region: 'sfo3',
          bucket: 'hale-project'
        };
        order.customFloorPlan.url = `https://${HARDCODED_CONFIG.bucket}.${HARDCODED_CONFIG.region}.digitaloceanspaces.com/${order.customFloorPlan.key}`;
        console.log('🔧 Reconstructed floor plan URL:', order.customFloorPlan.url);
      }
      
      // ✅ Remove Buffer data to reduce response size
      if (order.customFloorPlan.data) {
        delete order.customFloorPlan.data;
        console.log('🗑️ Removed Buffer data from response');
      }
    }

    // ✅ Handle product uploaded images - reconstruct URLs if missing
    if (order.selectedProducts && order.selectedProducts.length > 0) {
      order.selectedProducts.forEach((product, idx) => {
        if (product.selectedOptions?.uploadedImages?.length > 0) {
          product.selectedOptions.uploadedImages.forEach((img, imgIdx) => {
            // Reconstruct URL if missing
            if (!img.url && img.key) {
              const HARDCODED_CONFIG = {
                region: 'sfo3',
                bucket: 'hale-project'
              };
              img.url = `https://${HARDCODED_CONFIG.bucket}.${HARDCODED_CONFIG.region}.digitaloceanspaces.com/${img.key}`;
              console.log(`🔧 Reconstructed product image URL: Product ${idx}, Image ${imgIdx}`);
            }
            
            // Remove Buffer data
            if (img.data) {
              delete img.data;
            }
          });
        }
      });
    }

    console.log('✅ Order loaded successfully');
    res.json(order);

  } catch (error) {
    console.error('❌ Error in getOrderById:', error);
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
    const { notes } = req.body;
    const order = await Order.findById(req.params.id)
      .populate('user')
      .lean();

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Get next version number
    const latestVersion = await ProposalVersion.findOne(
      { orderId: order._id },
      { version: 1 },
      { sort: { version: -1 } }
    );
    const nextVersion = (latestVersion?.version || 0) + 1;

    await ProposalVersion.create({
      orderId: order._id,
      version: nextVersion,
      selectedProducts: order.selectedProducts,
      selectedPlan: order.selectedPlan,
      clientInfo: order.clientInfo,
      occupiedSpots: order.occupiedSpots,
      notes: notes || 'Initial proposal version',
      status: 'draft',
      createdBy: req.user.id
    });

    const products = order.selectedProducts || [];
    
    const productPages = [];
    productPages.push(products.slice(0, 2));
    for (let i = 2; i < products.length; i += 3) {
      productPages.push(products.slice(i, i + 3));
    }

    const totalBudget = getBudgetForPlan(order.selectedPlan.id);
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
        /* ✅ UPDATED: Logo-only header */
        .header {
            text-align: center;
            margin-bottom: 40px;
        }
        .header img {
            height: 80px;
            width: auto;
            object-fit: contain;
            margin: 0 auto;
            display: block;
            filter: brightness(0) saturate(100%) invert(21%) sepia(98%) saturate(1160%) hue-rotate(160deg) brightness(92%) contrast(90%);
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
                    <!-- ✅ UPDATED: Logo image only -->
                    <div class="header">
                        <img src="/images/HDG-Logo.png" alt="Henderson Design Group">
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
                                      ${product.selectedOptions?.size ? `<p>Size: ${product.selectedOptions.size}</p>` : ''}
                                      ${product.selectedOptions?.insetPanel ? `<p>Inset Panel: ${product.selectedOptions.insetPanel}</p>` : ''}
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
            <!-- ✅ UPDATED: Logo image only -->
            <div class="header">
                <img src="/images/HDG-Logo.png" alt="Henderson Design Group">
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
      },
      timeout: 120000
    });

    productPages.length = 0;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=proposal-${order._id}-v${nextVersion}.pdf`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);

  } catch (error) {
    console.error('Error generating PDF:', error);
    res.status(500).json({ message: 'Error generating PDF' });
  }
};

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
      'Size',
      'Inset Panel',
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
      product.selectedOptions?.size || '',
      product.selectedOptions?.insetPanel || '',
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
      { wch: 15 }, // Size
      { wch: 15 }, // Inset Panel
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

const transporter = nodemailer.createTransport({
  // Configure your email service
  service: 'gmail', // or your preferred service
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

const sendOrderConfirmationEmail = async (userEmail, orderDetails) => {
  try {
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: userEmail,
      subject: 'Order Confirmation',
      html: `
        <h1>Your Order Has Been Confirmed</h1>
        <p>Order Details:</p>
        <ul>
          <li>Order ID: ${orderDetails._id}</li>
          <li>Package: ${orderDetails.Package}</li>
          <li>Client Name: ${orderDetails.clientInfo.name}</li>
          <li>Unit Number: ${orderDetails.clientInfo.unitNumber}</li>
        </ul>
        <p>Thank you for your order!</p>
        <p>The Henderson team will contact you shortly to review your order.</p>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log('Confirmation email sent successfully');
  } catch (error) {
    console.error('Error sending confirmation email:', error);
    throw error;
  }
};

// ✅ HELPERS (same as clientController)
const getFloorPlanImagePath = (configId) => {
  const imageMap = {
    'investor-a': '/images/investor_plan/Alia_05A.png',
    'investor-b': '/images/investor_plan/Alia_03A.png',
    'investor-c': '/images/investor_plan/Alia_03B.png',
    'custom-a': '/images/custom_plan/Alia_05A.png',
    'custom-b': '/images/custom_plan/Alia_03A.png',
    'custom-c': '/images/custom_plan/Alia_03B.png',
  };
  
  return imageMap[configId] || '/images/investor_plan/investor_1.png';
};

const getFloorPlanConfigId = (floorPlan, collection, packageType = 'investor') => {
  if (!floorPlan) return 'investor-a';
  
  if (packageType === 'library') {
    const residenceMap = {
      'Residence 05A': 'investor-a',
      'Residence 03A': 'investor-b',
      'Residence 03B': 'investor-c',
      'Residence 00A': 'investor-a',
      'Residence 01B': 'investor-b',
      'Residence 05B': 'investor-b',
      'Residence 07B': 'investor-b',
      'Residence 08': 'investor-c',
      'Residence 09B': 'investor-b',
      'Residence 10/12': 'investor-c',
      'Residence 10A/12A': 'investor-a',
      'Residence 11B': 'investor-b',
      'Residence 13A': 'investor-a',
    };
    return residenceMap[floorPlan] || 'investor-a';
  }
  
  const isLani = collection?.includes('Lani');
  
  const residenceMap = {
    'Residence 05A': isLani ? 'custom-a' : 'investor-a',
    'Residence 03A': isLani ? 'custom-b' : 'investor-b',
    'Residence 03B': isLani ? 'custom-c' : 'investor-c',
    'Residence 00A': 'investor-a',
    'Residence 01B': 'investor-b',
    'Residence 05B': 'investor-b',
    'Residence 07B': 'custom-b',
    'Residence 08': 'custom-c',
    'Residence 09B': 'investor-b',
    'Residence 10/12': 'custom-c',
    'Residence 10A/12A': 'custom-a',
    'Residence 11B': 'custom-b',
    'Residence 13A': 'custom-a',
  };

  return residenceMap[floorPlan] || 'investor-a';
};

// @desc    Get orders by client (with auto-create for approved clients)
// @route   GET /api/orders/client/:clientId
// @access  Private
const getOrdersByClient = async (req, res) => {
  try {
    const { clientId } = req.params;

    const user = await User.findById(clientId);
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'Client not found' 
      });
    }

    let orders = await Order.find({ user: user._id })
      .sort({ createdAt: -1 });

    if (orders.length === 0 && user.status === 'approved') {
      console.log(`📦 Auto-creating order for approved client: ${user.clientCode}`);
      
      const packageType = user.packageType || 'investor';
      const floorPlanConfigId = getFloorPlanConfigId(user.floorPlan, user.collection, packageType);
      const floorPlanImage = getFloorPlanImagePath(floorPlanConfigId);
      
      const newOrder = await Order.create({
        user: user._id,
        packageType,
        clientInfo: {
          name: user.name,
          unitNumber: user.unitNumber,
          floorPlan: user.floorPlan
        },
        selectedPlan: {
          id: floorPlanConfigId,
          title: user.floorPlan || 'Residence',
          description: user.collection ? `${user.collection} - ${user.bedroomCount} Bedroom` : 'Library Package',
          image: floorPlanImage,
          clientInfo: {
            name: user.name,
            unitNumber: user.unitNumber,
            floorPlan: user.floorPlan
          }
        },
        Package: user.collection ? `${user.collection} - ${user.bedroomCount}BR` : 'Library',
        selectedProducts: [],
        occupiedSpots: {},
        status: 'ongoing',
        step: 1
      });

      orders = [newOrder];
      console.log('✅ Order created with config ID:', floorPlanConfigId, 'Package Type:', packageType);
    }

    res.json({
      success: true,
      orders: orders
    });

  } catch (error) {
    console.error('❌ Error getOrdersByClient:', error);
    res.status(500).json({ 
      success: false,
      message: error.message 
    });
  }
};

// ✅ NEW: Save furniture placements for library orders
// @desc    Save furniture placements for library package
// @route   PUT /api/orders/:orderId/furniture-placements
// @access  Private (Admin)
const saveFurniturePlacements = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { placements } = req.body;

    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    if (order.packageType !== 'library') {
      return res.status(400).json({
        success: false,
        message: 'This order is not a library package'
      });
    }

    // Update occupiedSpots with new placements
    order.occupiedSpots = placements;
    await order.save();

    console.log('✅ Furniture placements saved for order:', orderId);

    res.json({
      success: true,
      message: 'Furniture placements saved successfully',
      data: order
    });

  } catch (error) {
    console.error('❌ Error saving furniture placements:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save furniture placements',
      error: error.message
    });
  }
};

// ✅ NEW: Upload custom product images to S3
const uploadCustomProductImages = async (req, res) => {
  try {
    const { orderId } = req.params;
    
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No images uploaded'
      });
    }

    const uploadedImages = req.files.map(file => ({
      filename: file.originalname,
      contentType: file.contentType,
      url: file.location,
      key: file.key,
      size: file.size,
      uploadedAt: new Date()
    }));

    console.log(`✅ Uploaded ${uploadedImages.length} images to S3`);

    res.json({
      success: true,
      data: uploadedImages
    });

  } catch (error) {
    console.error('❌ Error uploading product images:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// ✅ NEW: Upload floor plan to S3
const uploadOrderFloorPlan = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { notes } = req.body;
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No floor plan uploaded'
      });
    }

    const floorPlanData = {
      filename: req.file.originalname,
      contentType: req.file.contentType,
      url: req.file.location,
      key: req.file.key,
      size: req.file.size,
      notes: notes || '',
      uploadedAt: new Date()
    };

    console.log(`✅ Uploaded floor plan to S3: ${req.file.key}`);

    await Order.findByIdAndUpdate(orderId, {
      customFloorPlan: floorPlanData
    });

    res.json({
      success: true,
      data: floorPlanData
    });

  } catch (error) {
    console.error('❌ Error uploading floor plan:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

const generateInstallBinder = async (req, res) => {
  try {
    const Order = require('../models/Order');
    const { generatePDF } = require('../config/pdfConfig');
    
    const order = await Order.findById(req.params.id)
      .populate('user')
      .populate('selectedProducts.vendor')
      .lean();

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const products = order.selectedProducts || [];
    
    // Calculate total pages (3 products per page)
    const totalProducts = products.length;
    const totalPages = Math.ceil(totalProducts / 3);

    // Helper function to get vendor info
    const getVendorInfo = (product) => {
      if (product.vendor) {
        return {
          name: product.vendor.name || 'N/A',
          description: product.name || ''
        };
      }
      return {
        name: 'HDG Inventory',
        description: '*HNL Inventory'
      };
    };

    // Helper to escape HTML entities
    const escapeHtml = (text) => {
      if (!text) return '';
      return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    };

    // Generate HTML
    const htmlTemplate = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        @page {
            size: letter landscape;
            margin: 0.5in;
        }
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: Arial, sans-serif;
            font-size: 9pt;
            line-height: 1.3;
        }
        .page {
            page-break-after: always;
            position: relative;
            min-height: 7.5in;
        }
        .page:last-child {
            page-break-after: avoid;
        }
        
        /* Header */
        .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 2px solid #000;
        }
        .header-left {
            display: flex;
            align-items: center;
        }
        .header-left img {
            height: 60px;
            width: auto;
            object-fit: contain;
            filter: brightness(0) saturate(100%) invert(21%) sepia(98%) saturate(1160%) hue-rotate(160deg) brightness(92%) contrast(90%);
        }
        .header-right {
            text-align: right;
            font-size: 8pt;
        }
        .header-right h2 {
            font-size: 20pt;
            font-weight: bold;
            margin-bottom: 8px;
        }
        
        /* Project Info */
        .project-info {
            margin-bottom: 15px;
            font-size: 9pt;
        }
        .project-info p {
            margin: 2px 0;
        }
        
        /* Table */
        table {
            width: 100%;
            border-collapse: collapse;
            font-size: 8pt;
        }
        th {
            background-color: #f0f0f0;
            border: 1px solid #000;
            padding: 6px 4px;
            text-align: left;
            font-weight: bold;
            font-size: 7pt;
        }
        td {
            border: 1px solid #000;
            padding: 6px 4px;
            vertical-align: top;
        }
        
        /* Photo column */
        td.photo {
            width: 80px;
            text-align: center;
            padding: 4px;
        }
        td.photo img {
            max-width: 70px;
            max-height: 70px;
            object-fit: contain;
        }
        
        /* Room column */
        td.room {
            width: 100px;
            font-weight: 600;
        }
        
        /* Vendor Name */
        td.vendor-name {
            width: 100px;
        }
        
        /* Vendor Description */
        td.vendor-desc {
            width: auto;
            min-width: 150px;
        }
        .product-name {
            font-weight: bold;
            margin-bottom: 3px;
        }
        .product-details {
            font-size: 7pt;
            color: #333;
            line-height: 1.4;
        }
        
        /* PO column */
        td.po {
            width: 85px;
        }
        
        /* Quantity */
        td.quantity {
            width: 50px;
            text-align: center;
        }
        
        /* Vendor Order Number */
        td.order-num {
            width: 90px;
        }
        
        /* Tracking */
        td.tracking {
            width: 120px;
            font-size: 7pt;
        }
        
        /* Notes */
        td.notes {
            width: 120px;
            font-size: 7pt;
            white-space: pre-line;
        }
        
        /* Footer */
        .footer {
            position: absolute;
            bottom: 0;
            right: 0;
            font-size: 8pt;
            color: #666;
        }
        
        /* Empty cell styling */
        .empty {
            background-color: #fafafa;
        }
    </style>
</head>
<body>
    ${Array.from({ length: totalPages }, (_, pageIndex) => {
      const startIdx = pageIndex * 3;
      const pageProducts = products.slice(startIdx, startIdx + 3);
      
      return `
    <div class="page">
        <!-- Header -->
        <div class="header">
            <div class="header-left">
                <img src="/images/HDG-Logo.png" alt="Henderson Design Group">
            </div>
            <div class="header-right">
                <h2>Install Binder</h2>
                <p><strong>Designer:</strong> Henderson Design Group</p>
                <p><strong>Client:</strong> ${escapeHtml(order.clientInfo?.name || 'N/A')}</p>
                <p><strong>Project:</strong> ${escapeHtml(
                  [
                    order.clientInfo?.name,
                    order.clientInfo?.floorPlan
                  ].filter(Boolean).join(' - ')
                )}</p>
            </div>
        </div>
        
        <!-- Table -->
        <table>
            <thead>
                <tr>
                    <th>Photo</th>
                    <th>Room</th>
                    <th>Vendor Name</th>
                    <th>Vendor Description</th>
                    <th>PO #</th>
                    <th>Quantity</th>
                    <th>Vendor Order Number</th>
                    <th>Shipment Tracking Info</th>
                    <th>Notes</th>
                </tr>
            </thead>
            <tbody>
                ${pageProducts.map(product => {
                  const vendorInfo = getVendorInfo(product);
                  
                  // ✅ FIX: Check multiple image sources with priority
                  let primaryImage = null;
                  
                  // Priority 1: Direct image field
                  if (product.selectedOptions?.image) {
                    primaryImage = product.selectedOptions.image;
                  }
                  // Priority 2: Images array first item
                  else if (product.selectedOptions?.images && product.selectedOptions.images.length > 0) {
                    primaryImage = product.selectedOptions.images[0];
                  }
                  // Priority 3: Uploaded images first item
                  else if (product.selectedOptions?.uploadedImages && product.selectedOptions.uploadedImages.length > 0) {
                    const uploadedImg = product.selectedOptions.uploadedImages[0];
                    primaryImage = uploadedImg.url || (uploadedImg.data ? `data:${uploadedImg.contentType};base64,${uploadedImg.data}` : null);
                  }
                  
                  return `
                <tr>
                    <td class="photo">
                        ${primaryImage ? 
                          `<img src="${escapeHtml(primaryImage)}" alt="${escapeHtml(product.name)}" onerror="this.parentElement.innerHTML='<span style=\\'color: #999; font-size: 7pt;\\'>No Image</span>'">` : 
                          '<span style="color: #999; font-size: 7pt;">No Image</span>'}
                    </td>
                    <td class="room">${escapeHtml(product.category || product.spotName || 'General')}</td>
                    <td class="vendor-name">${escapeHtml(vendorInfo.name)}</td>
                    <td class="vendor-desc">
                        <div class="product-name">${escapeHtml(product.name || 'N/A')}</div>
                        <div class="product-details">
                            ${product.product_id ? `<div>Product ID: ${escapeHtml(product.product_id)}</div>` : ''}
                            ${product.selectedOptions?.specifications ? 
                              `<div>${escapeHtml(product.selectedOptions.specifications)}</div>` : ''}
                            ${product.selectedOptions?.finish ? 
                              `<div>Finish: ${escapeHtml(product.selectedOptions.finish)}</div>` : ''}
                            ${product.selectedOptions?.fabric ? 
                              `<div>Fabric: ${escapeHtml(product.selectedOptions.fabric)}</div>` : ''}
                            ${product.selectedOptions?.size ? 
                              `<div>Size: ${escapeHtml(product.selectedOptions.size)}</div>` : ''}
                        </div>
                    </td>
                    <td class="po">${escapeHtml(product.selectedOptions?.poNumber || '')}</td>
                    <td class="quantity">${product.quantity || 1}</td>
                    <td class="order-num">${escapeHtml(product.selectedOptions?.vendorOrderNumber || '')}</td>
                    <td class="tracking">${escapeHtml(product.selectedOptions?.trackingInfo || '')}</td>
                    <td class="notes">${escapeHtml(product.selectedOptions?.deliveryStatus || 
                                        product.selectedOptions?.notes || '')}</td>
                </tr>
                  `;
                }).join('')}
            </tbody>
        </table>
        
        <!-- Footer -->
        <div class="footer">
            Page ${pageIndex + 1} of ${totalPages}
        </div>
    </div>
      `;
    }).join('')}
</body>
</html>`;

    // Set response headers to display HTML in browser (same as proposal)
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Content-Disposition', 'inline');
    
    // Send HTML for browser display
    res.send(htmlTemplate);

  } catch (error) {
    console.error('❌ Error generating install binder:', error);
    res.status(500).json({ 
      message: 'Error generating install binder',
      error: error.message 
    });
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
  generateOrderSummary,
  getOrdersByClient,
  saveFurniturePlacements,
  uploadCustomProductImages,  // ✅ NEW
  uploadOrderFloorPlan, 
  generateInstallBinder,
};