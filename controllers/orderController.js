const Order = require('../models/Order');
const { s3Client } = require('../config/s3');
const { PutObjectCommand } = require('@aws-sdk/client-s3');

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

    // Update the specific installment's status
    order.paymentDetails.installments[installmentIndex].status = status;
    await order.save();

    res.json(order);
  } catch (error) {
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


module.exports = {
  createOrder,
  getOrders,
  getOrderById,
  updateOrder,
  uploadPaymentProof,
  updatePaymentStatus,
  generateOrderPDF,
  getCurrentUserOrder
};