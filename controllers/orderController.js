const Order = require('../models/Order');
const { s3Client } = require('../config/s3');
const { PutObjectCommand } = require('@aws-sdk/client-s3');
const axios = require('axios');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const createOrder = async (req, res) => {
  try {
    // Clean up the payment details to match the schema
    const paymentDetails = {
      method: req.body.paymentDetails?.method?.method || req.body.paymentDetails?.method,
      installments: req.body.paymentDetails?.installments?.map(installment => ({
        percent: installment.percent,
        dueDate: installment.dueDate,
        status: installment.status,
        amount: installment.amount,
        proofOfPayment: installment.proofOfPayment
      }))
    };

    // Create the order with cleaned data
    const orderData = {
      user: req.user.id,
      selectedPlan: req.body.selectedPlan,
      clientInfo: req.body.clientInfo,
      designSelections: req.body.designSelections,
      step: req.body.step,
      status: req.body.status,
      paymentDetails: paymentDetails
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
    // Check if this is a floor plan change
    const existingOrder = await Order.findById(req.params.id);
    if (existingOrder && existingOrder.selectedPlan?.id !== req.body.selectedPlan?.id) {
      // If floor plan changed, ensure products are reset
      req.body.selectedProducts = [];
      req.body.occupiedSpots = {};
      req.body.designSelections = null;
    }

    const order = await Order.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      req.body,
      { new: true }
    );

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
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
  
      // Create search query
      const searchQuery = {
        $or: [
          { orderId: { $regex: search, $options: 'i' } },
          { 'clientInfo.name': { $regex: search, $options: 'i' } }
        ]
      };
  
      // Add status filter if specified
      if (status && status !== 'all') {
        searchQuery.status = status;
      }
  
      const total = await Order.countDocuments(searchQuery);
      const orders = await Order.find(searchQuery)
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 });
  
      res.json({
        orders,
        total,
        page,
        totalPages: Math.ceil(total / limit)
      });
    } catch (error) {
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
    // Find the most recent order for the current user
    const order = await Order.findOne({
      user: req.user.id,
      //status: { $in: ['in_progress', 'pending', 'confirmed'] } // Added 'confirmed' status
    }).sort({ createdAt: -1 });

    if (!order) {
      return res.status(404).json({ message: 'No active order found' });
    }

    res.json(order);
  } catch (error) {
    console.error('Error fetching user order:', error);
    res.status(500).json({ message: error.message });
  }
};


const generateOrderSummary = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('selectedProducts')
      .populate('clientInfo');

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const doc = new PDFDocument({
      margin: 50,
      size: 'A4'
    });
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=summary-${order._id}.pdf`);
    
    doc.pipe(res);

    // Header
    doc.fontSize(24).text('HALE', 50, 50);
    doc.moveDown();

    // Client Information
    doc.fontSize(12)
      .text(`Client: ${order.clientInfo?.name}`)
      .text(`Unit Number: ${order.clientInfo?.unitNumber}`)
      .text(`Order ID: ${order._id}`)
      .text(`Date: ${new Date().toLocaleDateString()}`);
    doc.moveDown();

    // Products
    if (order.designSelections?.selectedProducts?.length > 0) {
      for (const product of order.designSelections.selectedProducts) {
        // Location name centered above table
        doc.text(product.spotName || 'Unknown', { align: 'center' });
        doc.moveDown(0.5);

        const startY = doc.y;

        // First row - Product name and Quantity
        doc.rect(50, startY, 500, 25).stroke();
        doc.text(product.name || '1500', 60, startY + 5);
        doc.text(`Quantity: ${product.quantity || 1}`, 350, startY + 5);

        // Second row - Content
        const contentStartY = startY + 25;
        const contentHeight = 200;

        // Main content rectangle
        doc.rect(50, contentStartY, 500, contentHeight).stroke();

        // Vertical line to split content
        doc.moveTo(300, contentStartY).lineTo(300, contentStartY + contentHeight).stroke();

        // Left side - Image and details
        if (product.variants?.[0]?.image?.url) {
          try {
            const imageUrl = product.variants[0].image.url;
            const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
            const imageBuffer = Buffer.from(imageResponse.data);
            doc.image(imageBuffer, 60, contentStartY + 10, { 
              width: 180, 
              height: 120 
            });
          } catch (imageError) {
            console.error('Error loading image:', imageError);
          }
        }

        // Product details below image
        doc.text(`Leg Finish: ${product.selectedOptions?.finish || 'Light'}`, 60, contentStartY + 140)
           .text(`Size: ${product.size || 'N/A'}`, 60, contentStartY + 155)
           .text('Fabric Details:', 60, contentStartY + 170)
           .text(`Manufacturer: ${product.selectedOptions?.manufacturer || 'N/A'}`, 60, contentStartY + 185)
           .text(`Fabric: ${product.selectedOptions?.fabric || 'Cream'}`, 60, contentStartY + 200);

        // Right side - Pricing
        doc.text(`Unit Price: $${product.finalPrice?.toFixed(2) || '0.00'}`, 310, contentStartY + 10)
           .text(`Sales Tax: $${(product.finalPrice * 0.04712).toFixed(2) || '0.00'}`, 310, contentStartY + 30)
           .text(`Total Price: $${product.finalPrice?.toFixed(2) || '0.00'}`, 310, contentStartY + 50);

        // Add space before next product
        doc.moveDown(12);
      }
    }

    doc.end();

  } catch (error) {
    console.error('Error generating summary:', error);
    if (!res.headersSent) {
      res.status(500).json({ message: 'Error generating summary' });
    }
  }
};


const generateProposal = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('selectedProducts')
      .populate('clientInfo');

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const doc = new PDFDocument({
      margin: 50,
      size: 'A4'
    });
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=summary-${order._id}.pdf`);
    
    doc.pipe(res);

    // Header
    doc.fontSize(24).text('HALE', 50, 50);
    doc.moveDown();

    // Client Information
    doc.fontSize(12)
      .text(`Client: ${order.clientInfo?.name}`)
      .text(`Unit Number: ${order.clientInfo?.unitNumber}`)
      .text(`Order ID: ${order._id}`)
      .text(`Date: ${new Date().toLocaleDateString()}`);
    doc.moveDown();

    // Products
    if (order.designSelections?.selectedProducts?.length > 0) {
      for (const product of order.designSelections.selectedProducts) {
        // Room/Location name above table
        doc.fontSize(12)
           .text(product.spotName || 'Unknown', { align: 'center' });

        // Start table
        const tableTop = doc.y + 5;
        const rowHeight = 250; // Increased height to fit content

        // Header row with product name and quantity
        doc.rect(50, tableTop, 500, 30).stroke()
           .text(product.name || '', 60, tableTop + 10)
           .text(`Quantity: ${product.quantity || 1}`, 400, tableTop + 10);

        // Main content row
        const contentY = tableTop + 30;
        
        // Draw main content container
        doc.rect(50, contentY, 500, rowHeight).stroke();
        
        // Draw vertical line to separate content and pricing
        doc.moveTo(350, contentY).lineTo(350, contentY + rowHeight).stroke();

        // Left side: Image and Details
        if (product.variants?.[0]?.image?.url) {
          try {
            const imageUrl = product.variants[0].image.url;
            const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
            const imageBuffer = Buffer.from(imageResponse.data);
            doc.image(imageBuffer, 60, contentY + 10, { 
              width: 150,
              height: 150
            });
          } catch (imageError) {
            console.error('Error loading image:', imageError);
          }
        }

        // Product details below image
        doc.text(`Leg Finish: ${product.selectedOptions?.finish || 'N/A'}`, 60, contentY + 170)
           .text(`Size: ${product.size || 'N/A'}`, 60, contentY + 190)
           .text('Fabric Details:', 60, contentY + 210)
           .text(`Manufacturer: ${product.selectedOptions?.manufacturer || 'N/A'}`, 60, contentY + 230)
           .text(`Fabric: ${product.selectedOptions?.fabric || 'Cream'}`, 60, contentY + 250);

        // Right side: Pricing
        doc.text(`Unit Price: $${product.finalPrice?.toFixed(2) || '0.00'}`, 360, contentY + 10)
           .text(`Sales Tax: $${(product.finalPrice * 0.04712).toFixed(2) || '0.00'}`, 360, contentY + 30)
           .text(`Total Price: $${product.finalPrice?.toFixed(2) || '0.00'}`, 360, contentY + 50);

        // Add spacing before next product
        doc.moveDown(15);
      }

      // FDI Section
      if (order.fdi) {
        // Similar structure for FDI section
        // ...
      }
    }

    // Footer
    const footerY = doc.page.height - 50;
    doc.fontSize(10)
      .text('Generated by Hale Admin System', { align: 'center' })
      .text(new Date().toLocaleString(), { align: 'center' });

    doc.end();

  } catch (error) {
    console.error('Error generating summary:', error);
    if (!res.headersSent) {
      res.status(500).json({ message: 'Error generating summary' });
    }
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