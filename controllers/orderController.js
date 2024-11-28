const Order = require('../models/Order');

const createOrder = async (req, res) => {
  try {
    const order = await Order.create({
      user: req.user.id,
      ...req.body
    });
    res.status(201).json(order);
  } catch (error) {
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
      user: req.user.id
    });
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    res.json(order);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateOrder = async (req, res) => {
  try {
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
    res.status(500).json({ message: error.message });
  }
};

const uploadPaymentProof = async (req, res) => {
  try {
    const order = await Order.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      { 
        paymentStatus: 'pending',
        paymentProof: req.file.path 
      },
      { new: true }
    );
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    res.json(order);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updatePaymentStatus = async (req, res) => {
    try {
      const order = await Order.findByIdAndUpdate(
        req.params.id,
        {
          paymentStatus: req.body.status,
          status: req.body.status === 'approved' ? 'processing' : 'pending'
        },
        { new: true }
      );
      
      if (!order) {
        return res.status(404).json({ message: 'Order not found' });
      }
      
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

module.exports = {
  createOrder,
  getOrders,
  getOrderById,
  updateOrder,
  uploadPaymentProof,
  updatePaymentStatus,
  generateOrderPDF
};