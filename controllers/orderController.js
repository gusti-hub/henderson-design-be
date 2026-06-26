const Order = require('../models/Order');
const POVersion = require('../models/POVersion');
const BillInvoice = require('../models/BillInvoice');
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
const { logOrderChanges } = require('../utils/auditLogger');
const { generatePresignedUploadUrl } = require('../config/s3');


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
 
    // ✅ AUDIT STEP 1: snapshot SEBELUM mutasi apapun
    const beforeSnapshot = existingOrder.toObject();
 
    const updateData = {};
 
    if (req.body.proposalNumber !== undefined) {
      if (!existingOrder.proposalNumber) {
        updateData.proposalNumber = req.body.proposalNumber;
        console.log('📋 Setting proposalNumber:', req.body.proposalNumber);
      } else {
        console.log('📋 proposalNumber already set:', existingOrder.proposalNumber, '— skipping');
      }
    }
 
    if (req.body.selectedProducts && Array.isArray(req.body.selectedProducts)) {
      console.log(`📦 Processing ${req.body.selectedProducts.length} products`);

      // ── Build map dari existing products di DB: index → _id ──────────────
      // Dipakai untuk restore _id yang tidak dikirim dari frontend
      const existingIdByIndex = new Map();
      const existingIdByProductId = new Map();
      (existingOrder.selectedProducts || []).forEach((p, idx) => {
        if (p._id) {
          existingIdByIndex.set(idx, p._id);
          if (p.product_id) existingIdByProductId.set(p.product_id, p._id);
        }
      });

      const mongoose = require('mongoose');

      // Cegah _id ganda dalam satu order. Duplikasi produk yang SAMA tetap diperbolehkan —
      // tiap baris hanya dijamin punya _id yang UNIK. Inilah yang menutup bug field-ketukar
      // & duplikat-saat-edit (yang berakar dari dua baris berbagi _id yang sama).
      const usedIds = new Set();
      const isFree = (id) => id && !usedIds.has(String(id));

      updateData.selectedProducts = req.body.selectedProducts.map((product, idx) => {
        // ── Resolve _id ──────────────────────────────────────────────────────
        // Priority (selalu lewati _id yang sudah terpakai di order ini → unik):
        // 1. _id dari frontend yang valid (bukan temp_)
        // 2. _id dari DB di posisi index yang sama
        // 3. _id dari DB yang match product_id
        // 4. Generate ObjectId baru (produk baru ATAU duplikat dari produk yang sama)
        let resolvedId;

        const isTemp = product._id && String(product._id).startsWith('temp_');
        const hasValidId = product._id && !isTemp && mongoose.Types.ObjectId.isValid(product._id);
        const candidateFromIndex = existingIdByIndex.get(idx);
        const candidateFromPid    = product.product_id ? existingIdByProductId.get(product.product_id) : null;

        if (hasValidId && isFree(product._id)) {
          resolvedId = product._id;
          console.log(`📦 [${idx}] "${product.name}" — keep existing _id`);
        } else if (isFree(candidateFromIndex)) {
          resolvedId = candidateFromIndex;
          console.log(`📦 [${idx}] "${product.name}" — restore _id from index`);
        } else if (isFree(candidateFromPid)) {
          resolvedId = candidateFromPid;
          console.log(`📦 [${idx}] "${product.name}" — restore _id from product_id`);
        } else {
          resolvedId = new mongoose.Types.ObjectId();
          console.log(`📦 [${idx}] "${product.name}" — new/duplicate product, generated unique _id`);
        }
        usedIds.add(String(resolvedId));

        return {
          _id: resolvedId,  // ← selalu ada sekarang
          product_id: product.product_id,
          name: product.name,
          category: product.category,
          package: product.package || '',
          spotName: product.spotName,
          quantity: product.quantity || 1,
          unitPrice: product.unitPrice || 0,
          finalPrice: product.finalPrice || 0,
          vendor: product.vendor || null,
          sourceType: product.sourceType || 'manual',
          isEditable: product.isEditable !== undefined ? product.isEditable : true,
          libraryProductId: product.libraryProductId || null,
          selectedOptions: {
            sidemark:           product.selectedOptions?.sidemark           || '',
            group:              product.selectedOptions?.group              || '',
            tags:               product.selectedOptions?.tags               || [],
            itemClass:          product.selectedOptions?.itemClass          || '',
            cfaSampleApproval:  product.selectedOptions?.cfaSampleApproval  || '',
            vendorDescription:  product.selectedOptions?.vendorDescription  || '',
            finish:             product.selectedOptions?.finish             || '',
            fabric:             product.selectedOptions?.fabric             || '',
            size:               product.selectedOptions?.size               || '',
            insetPanel:         product.selectedOptions?.insetPanel         || '',
            image:              product.selectedOptions?.image              || '',
            images:             product.selectedOptions?.images             || [],
            links:              product.selectedOptions?.links              || [],
            specifications:     product.selectedOptions?.specifications     || '',
            notes:              product.selectedOptions?.notes              || '',
            itemNotes:          product.selectedOptions?.itemNotes          || '',
            shipToVendorId:     product.selectedOptions?.shipToVendorId     || null,
            shipToName:         product.selectedOptions?.shipToName         || '',
            shippingStreet:     product.selectedOptions?.shippingStreet     || '',
            shippingCity:       product.selectedOptions?.shippingCity       || '',
            shippingState:      product.selectedOptions?.shippingState      || '',
            shippingPostalCode: product.selectedOptions?.shippingPostalCode || '',
            shippingCountry:    product.selectedOptions?.shippingCountry    || '',
            shipToPhone:        product.selectedOptions?.shipToPhone        || '',
            poNumber:           product.selectedOptions?.poNumber           || '',
            vendorOrderNumber:  product.selectedOptions?.vendorOrderNumber  || '',
            trackingInfo:       product.selectedOptions?.trackingInfo       || '',
            deliveryStatus:     product.selectedOptions?.deliveryStatus     || '',
            installerNotes:     product.selectedOptions?.installerNotes     || '',
            leadTime:           product.selectedOptions?.leadTime           || '',
            room:                     product.selectedOptions?.room                     || '',
            statusCategory:           product.selectedOptions?.statusCategory           || '',
            proposalNumber:           product.selectedOptions?.proposalNumber           || '',
            shipTo:                   product.selectedOptions?.shipTo                   || '',
            orderDate:                product.selectedOptions?.orderDate                || '',
            expectedShipDate:         product.selectedOptions?.expectedShipDate         || '',
            expectedArrivalDate:      product.selectedOptions?.expectedArrivalDate      || '',
            dateReceived:             product.selectedOptions?.dateReceived             || '',
            dateInspected:            product.selectedOptions?.dateInspected            || '',
            estimatedDeliveryDate:    product.selectedOptions?.estimatedDeliveryDate    || '',
            shippingCarrier:          product.selectedOptions?.shippingCarrier          || '',
            orderStatus:              product.selectedOptions?.orderStatus              || '',
            nextStep:                 product.selectedOptions?.nextStep                 || '',
            nextStepDate:             product.selectedOptions?.nextStepDate             || '',
            warehouseReceivingNumber: product.selectedOptions?.warehouseReceivingNumber || '',
            units:              product.selectedOptions?.units              || 'Each',
            msrp:               product.selectedOptions?.msrp               || 0,
            discountPercent:    product.selectedOptions?.discountPercent    || 0,
            netCostOverride:    product.selectedOptions?.netCostOverride    ?? null,
            noNetPurchaseCost:  product.selectedOptions?.noNetPurchaseCost  || false,
            discountTaken:      product.selectedOptions?.discountTaken      || '',
            shippingCost:       product.selectedOptions?.shippingCost       || 0,
            otherCost:          product.selectedOptions?.otherCost          || 0,
            markupPercent:          product.selectedOptions?.markupPercent          || 0,
            shippingMarkupPercent:  product.selectedOptions?.shippingMarkupPercent  || 0,
            otherMarkupPercent:     product.selectedOptions?.otherMarkupPercent     || 0,
            depositPercent:         product.selectedOptions?.depositPercent         || 0,
            vendorDepositPercent:   product.selectedOptions?.vendorDepositPercent   || 0,
            salesTaxRate:           product.selectedOptions?.salesTaxRate           || 0,
            taxableCost:            product.selectedOptions?.taxableCost            !== false,
            taxableMarkup:          product.selectedOptions?.taxableMarkup          !== false,
            taxableShippingCost:    product.selectedOptions?.taxableShippingCost    !== false,
            taxableShippingMarkup:  product.selectedOptions?.taxableShippingMarkup  !== false,
            taxableOtherCost:       product.selectedOptions?.taxableOtherCost       !== false,
            taxableOtherMarkup:     product.selectedOptions?.taxableOtherMarkup     !== false,
            uploadedImages: (product.selectedOptions?.uploadedImages || []).map(img => ({
              filename:    img.filename    || '',
              contentType: img.contentType || '',
              url:         img.url         || '',
              key:         img.key         || '',
              size:        img.size        || 0,
              uploadedAt:  img.uploadedAt  || new Date(),
            })),
            customAttributes: product.selectedOptions?.customAttributes || {},
          },
          placement: product.placement || null
        };
      });
    }
 
    if (req.body.customFloorPlan) {
      updateData.customFloorPlan = req.body.customFloorPlan;
      console.log('📐 Floor plan included in update');
    }
    if (req.body.occupiedSpots !== undefined)  updateData.occupiedSpots   = req.body.occupiedSpots;
    if (req.body.selectedPlan)                 updateData.selectedPlan    = req.body.selectedPlan;
    if (req.body.status)                       updateData.status          = req.body.status;
    if (req.body.step !== undefined)           updateData.step            = req.body.step;
    if (req.body.installationDate !== undefined) updateData.installationDate  = req.body.installationDate;
    if (req.body.installationNotes !== undefined) updateData.installationNotes = req.body.installationNotes;
    if (req.body.Package)                      updateData.Package         = req.body.Package;
 
    if (req.body.selectedPlan &&
        existingOrder.packageType !== 'custom' &&
        existingOrder.selectedPlan?.id !== req.body.selectedPlan?.id) {
      console.log('⚠️ Floor plan changed - resetting products');
      updateData.selectedProducts = [];
      updateData.occupiedSpots = {};
    }
 
    console.log('📦 Final update data keys:', Object.keys(updateData));
 
    Object.assign(existingOrder, updateData);
    existingOrder.updatedBy = req.user.id;
    const updatedOrder = await existingOrder.save();
 
    console.log(`✅ Order updated successfully`);
    console.log(`📦 Final selectedProducts count: ${updatedOrder.selectedProducts?.length || 0}`);
 
    // ── AUDIT ────────────────────────────────────────────────────────────────
    const performer = {
      _id:  req.user?._id || req.user?.id,
      name: req.user?.name || req.user?.email || 'Unknown',
    };

    // Fetch fresh dari DB — _id subdokumen pasti ada dan benar
    const freshForAudit = await Order.findById(updatedOrder._id)
      .populate({ path: 'selectedProducts.vendor', select: 'name' })
      .lean();

    console.log(`[audit] queuing for order ${updatedOrder._id}, performer: ${performer.name}`);

    setImmediate(() => {
      logOrderChanges({ before: beforeSnapshot, after: freshForAudit, performer })
        .then(() => console.log('[audit] ✅ done'))
        .catch(err => console.error('[audit] ❌ failed:', err.message));
    });
 
    // Email logic (unchanged)
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
 
    res.json(freshForAudit);

  } catch (error) {
    console.error('❌ Error updating order:', error);
    res.status(500).json({ success: false, message: error.message });
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
          select: 'name email clientCode unitNumber'
        })
        .populate({
          path: 'selectedProducts.vendor',
          select: 'name'          // ✅ FIX: populate vendor name
        })
        .populate({ path: 'updatedBy', select: 'name' }) 
        .select('-__v')
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 })
        .lean()
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
      .populate({
        path: 'selectedProducts.vendor',
        select: 'name'          // ✅ FIX: populate vendor name
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

// ── REPLACE buildVendorPoNumberMap ──────────────────────────────────────
const buildVendorPoNumberMap = (poVersions) => {
  // Group by vendorId, pick the latest version (already sorted desc by caller)
  const map = new Map(); // vendorId → poNumber of latest version
  poVersions.forEach(po => {
    const key = po.vendorId?.toString();
    if (key && !map.has(key)) {
      // First entry per vendor = latest version (sorted desc)
      map.set(key, po.poNumber || '');
    }
  });
  return map;
};

// ── REPLACE generateInstallBinder ───────────────────────────────────────
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

    // Build vendorId → latest PO number (latest version = highest version number)
    const allPoVersions = await POVersion.find({ orderId: req.params.id })
      .sort({ version: -1 })
      .lean();

    const byVendor = new Map();
    allPoVersions.forEach(po => {
      const key = po.vendorId?.toString();
      if (!key) return;
      if (!byVendor.has(key)) byVendor.set(key, []);
      byVendor.get(key).push(po);
    });

    const vendorPOMap = new Map();
    byVendor.forEach((versions, vendorId) => {
      // versions already sorted desc — index 0 = latest version
      vendorPOMap.set(vendorId, versions[0]?.poNumber || '');
    });

    const getPoNumber = (p) => {
      let vid = null;
      if (p.vendor) {
        if (typeof p.vendor === 'object' && p.vendor._id) {
          vid = p.vendor._id.toString();          // populated object
        } else {
          vid = p.vendor.toString();              // raw ObjectId or string
        }
      }
      if (vid && vendorPOMap.has(vid)) return vendorPOMap.get(vid);
      return p.selectedOptions?.poNumber || '';
    };

    // Calculate total pages (3 products per page)
    const totalProducts = products.length;
    const totalPages = Math.ceil(totalProducts / 3);

    const getVendorInfo = (product) => {
      if (product.vendor) {
        return { name: product.vendor.name || 'N/A', description: product.name || '' };
      }
      return { name: 'HDG Inventory', description: '*HNL Inventory' };
    };

    const escapeHtml = (text) => {
      if (!text) return '';
      return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    };

    const htmlTemplate = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        @page { size: letter landscape; margin: 0.5in; }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, sans-serif; font-size: 9pt; line-height: 1.3; }
        .page { page-break-after: always; position: relative; min-height: 7.5in; }
        .page:last-child { page-break-after: avoid; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; padding-bottom: 10px; border-bottom: 2px solid #000; }
        .header-left img { height: 60px; width: auto; object-fit: contain; filter: brightness(0) saturate(100%) invert(21%) sepia(98%) saturate(1160%) hue-rotate(160deg) brightness(92%) contrast(90%); }
        .header-right { text-align: right; font-size: 8pt; }
        .header-right h2 { font-size: 20pt; font-weight: bold; margin-bottom: 8px; }
        table { width: 100%; border-collapse: collapse; font-size: 8pt; }
        th { background-color: #f0f0f0; border: 1px solid #000; padding: 6px 4px; text-align: left; font-weight: bold; font-size: 7pt; }
        td { border: 1px solid #000; padding: 6px 4px; vertical-align: top; }
        td.photo { width: 80px; text-align: center; padding: 4px; }
        td.photo img { max-width: 70px; max-height: 70px; object-fit: contain; }
        td.room { width: 100px; font-weight: 600; }
        td.vendor-name { width: 100px; }
        td.vendor-desc { width: auto; min-width: 150px; }
        .product-name { font-weight: bold; margin-bottom: 3px; }
        .product-details { font-size: 7pt; color: #333; line-height: 1.4; }
        td.po { width: 85px; }
        td.quantity { width: 50px; text-align: center; }
        td.order-num { width: 90px; }
        td.tracking { width: 120px; font-size: 7pt; }
        td.notes { width: 120px; font-size: 7pt; white-space: pre-line; }
        .footer { position: absolute; bottom: 0; right: 0; font-size: 8pt; color: #666; }
    </style>
</head>
<body>
    \${Array.from({ length: totalPages }, (_, pageIndex) => {
      const startIdx = pageIndex * 3;
      const pageProducts = products.slice(startIdx, startIdx + 3);
      return \`
    <div class="page">
        <div class="header">
            <div class="header-left">
                <img src="/images/HDG-Logo.png" alt="Henderson Design Group">
            </div>
            <div class="header-right">
                <h2>Install Binder</h2>
                <p><strong>Designer:</strong> Henderson Design Group</p>
                <p><strong>Client:</strong> \${escapeHtml(order.clientInfo?.name || 'N/A')}</p>
                <p><strong>Project:</strong> \${escapeHtml([order.clientInfo?.name, order.clientInfo?.floorPlan].filter(Boolean).join(' - '))}</p>
            </div>
        </div>
        <table>
            <thead>
                <tr>
                    <th>Photo</th><th>Room</th><th>Vendor Name</th><th>Vendor Description</th>
                    <th>PO #</th><th>Quantity</th><th>Vendor Order Number</th>
                    <th>Shipment Tracking Info</th><th>Notes</th>
                </tr>
            </thead>
            <tbody>
                \${pageProducts.map(product => {
                  const vendorInfo = getVendorInfo(product);
                  let primaryImage = null;
                  if (product.selectedOptions?.image) primaryImage = product.selectedOptions.image;
                  else if (product.selectedOptions?.images?.length > 0) primaryImage = product.selectedOptions.images[0];
                  else if (product.selectedOptions?.uploadedImages?.length > 0) {
                    const u = product.selectedOptions.uploadedImages[0];
                    primaryImage = u.url || (u.data ? \`data:\${u.contentType};base64,\${u.data}\` : null);
                  }
                  return \`
                <tr>
                    <td class="photo">
                        \${primaryImage
                          ? \`<img src="\${escapeHtml(primaryImage)}" alt="\${escapeHtml(product.name)}" onerror="this.parentElement.innerHTML='<span style=\\'color:#999;font-size:7pt\\'>No Image</span>'">\`
                          : '<span style="color:#999;font-size:7pt">No Image</span>'}
                    </td>
                    <td class="room">\${escapeHtml(product.category || product.spotName || 'General')}</td>
                    <td class="vendor-name">\${escapeHtml(vendorInfo.name)}</td>
                    <td class="vendor-desc">
                        <div class="product-name">\${escapeHtml(product.name || 'N/A')}</div>
                        <div class="product-details">
                            \${product.product_id ? \`<div>Product ID: \${escapeHtml(product.product_id)}</div>\` : ''}
                            \${product.selectedOptions?.specifications ? \`<div>\${escapeHtml(product.selectedOptions.specifications)}</div>\` : ''}
                            \${product.selectedOptions?.finish ? \`<div>Finish: \${escapeHtml(product.selectedOptions.finish)}</div>\` : ''}
                            \${product.selectedOptions?.fabric ? \`<div>Fabric: \${escapeHtml(product.selectedOptions.fabric)}</div>\` : ''}
                            \${product.selectedOptions?.size ? \`<div>Size: \${escapeHtml(product.selectedOptions.size)}</div>\` : ''}
                        </div>
                    </td>
                    <td class="po">\${escapeHtml(getPoNumber(product))}</td>
                    <td class="quantity">\${product.quantity || 1}</td>
                    <td class="order-num">\${escapeHtml(product.selectedOptions?.vendorOrderNumber || '')}</td>
                    <td class="tracking">\${escapeHtml(product.selectedOptions?.trackingInfo || '')}</td>
                    <td class="notes">\${escapeHtml(product.selectedOptions?.deliveryStatus || product.selectedOptions?.notes || '')}</td>
                </tr>\`;
                }).join('')}
            </tbody>
        </table>
        <div class="footer">Page \${pageIndex + 1} of \${totalPages}</div>
    </div>\`;
    }).join('')}
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html');
    const clientNameSafe = (order.clientInfo?.name || 'Client').replace(/[^a-zA-Z0-9 ]/g, '').trim();
    res.setHeader('Content-Disposition', `inline; filename="InstallBinder_\${clientNameSafe}.html"`);
    res.send(htmlTemplate);

  } catch (error) {
    console.error('❌ Error generating install binder:', error);
    res.status(500).json({ message: 'Error generating install binder', error: error.message });
  }
};

// ── REPLACE generateInstallBinderExcel ──────────────────────────────────
const generateInstallBinderExcel = async (req, res) => {
  try {
    const ExcelJS  = require('exceljs');
    const axios    = require('axios');
    const mongoose = require('mongoose');

    const order = await Order.findById(req.params.id)
      .populate('user')
      .populate('selectedProducts.vendor')
      .lean();

    if (!order) return res.status(404).json({ message: 'Order not found' });

    const products   = order.selectedProducts || [];
    const clientName = order.clientInfo?.name  || 'Client';
    const unitNumber = order.clientInfo?.unitNumber || '';
    const floorPlan  = order.clientInfo?.floorPlan  || '';
    const projectLabel = [clientName, unitNumber ? `Unit ${unitNumber}` : '', floorPlan]
      .filter(Boolean).join(' — ');

    // ── Build product_id → PO number map ─────────────────────────────────
    // Logic: for each product_id, find which PO version contains it.
    // A product may appear in multiple PO versions (re-ordered).
    // We want the EARLIEST version that contains the product
    // (i.e., the first PO it was ordered on).
    //
    // Steps:
    // 1. Fetch ALL PO versions for this vendor (all vendors in this order)
    // 2. Sort ASC by version (earliest first)
    // 3. For each product_id, record the first PO version that contains it
    // ─────────────────────────────────────────────────────────────────────
    const orderObjectId = mongoose.Types.ObjectId.isValid(req.params.id)
      ? new mongoose.Types.ObjectId(req.params.id)
      : req.params.id;

    // Fetch ALL PO versions, ASC so earliest first
    const allPoVersions = await POVersion.find({ orderId: orderObjectId })
      .sort({ version: 1 })   // ASC — earliest version first
      .lean();

    console.log(`[InstallBinder] ${allPoVersions.length} PO versions found`);

    // Build map: product_id → poNumber of the earliest PO that contains it
    // If same product appears in v1 and v3, it gets v1's PO number
    const productPoMap = new Map(); // product_id → poNumber

    allPoVersions.forEach(po => {
      (po.products || []).forEach(poProduct => {
        const pid = poProduct.product_id;
        if (!pid) return;
        // Only record the first occurrence (earliest version)
        if (!productPoMap.has(pid)) {
          productPoMap.set(pid, po.poNumber || '');
          console.log(`[InstallBinder] product_id ${pid} → PO# ${po.poNumber} (v${po.version})`);
        }
      });
    });

    // Fallback: if product not found by product_id, try vendor-level latest PO
    // (handles products without product_id or custom items)
    const byVendor = new Map();
    allPoVersions.forEach(po => {
      const key = po.vendorId?.toString();
      if (!key) return;
      // Keep latest (sort was ASC, so each push overwrites → last = latest)
      byVendor.set(key, po.poNumber || '');
    });

    const getPoNumber = (p) => {
      // Primary: look up by product_id
      if (p.product_id && productPoMap.has(p.product_id)) {
        return productPoMap.get(p.product_id);
      }
      // Fallback: vendor-level latest PO
      let vid = null;
      if (p.vendor) {
        if (typeof p.vendor === 'object' && p.vendor._id) vid = p.vendor._id.toString();
        else vid = p.vendor.toString();
      }
      if (vid && byVendor.has(vid)) return byVendor.get(vid);
      // Last resort: selectedOptions
      return p.selectedOptions?.poNumber || '';
    };
    // ─────────────────────────────────────────────────────────────────────

    const downloadImage = async (url) => {
      try {
        if (!url || url.startsWith('data:')) return null;
        const response = await axios.get(url, {
          responseType: 'arraybuffer',
          timeout: 8000,
          headers: { 'User-Agent': 'HDG-InstallBinder/1.0' }
        });
        const ct = response.headers['content-type'] || '';
        let ext = 'png';
        if (ct.includes('jpeg') || ct.includes('jpg')) ext = 'jpeg';
        else if (ct.includes('gif')) ext = 'gif';
        return { buffer: Buffer.from(response.data), extension: ext };
      } catch { return null; }
    };

    const getPrimaryImageUrl = (p) => {
      if (p.selectedOptions?.image) return p.selectedOptions.image;
      if (p.selectedOptions?.images?.length > 0) return p.selectedOptions.images[0];
      if (p.selectedOptions?.uploadedImages?.length > 0)
        return p.selectedOptions.uploadedImages[0].url || null;
      return null;
    };

    const imageCache = new Map();
    await Promise.all(products.map(async (p, idx) => {
      const url = getPrimaryImageUrl(p);
      if (url) {
        const imgData = await downloadImage(url);
        if (imgData) imageCache.set(idx, imgData);
      }
    }));

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Henderson Design Group';
    const ws  = wb.addWorksheet('Install Binder');

    ws.getColumn('A').width = 13;
    ws.getColumn('B').width = 18;
    ws.getColumn('C').width = 20;
    ws.getColumn('D').width = 38;
    ws.getColumn('E').width = 16;
    ws.getColumn('F').width = 10;
    ws.getColumn('G').width = 20;
    ws.getColumn('H').width = 24;
    ws.getColumn('I').width = 26;

    const thinBorder = {
      top: { style: 'thin' }, left: { style: 'thin' },
      bottom: { style: 'thin' }, right: { style: 'thin' },
    };
    const headerFont = { name: 'Arial', bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
    const dataFont   = { name: 'Arial', size: 9 };
    const wrapTop    = { vertical: 'top', wrapText: true };

    ws.mergeCells('A1:I1');
    const titleCell = ws.getCell('A1');
    titleCell.value     = 'Henderson Design Group — Install Binder';
    titleCell.font      = { name: 'Arial', bold: true, size: 13, color: { argb: 'FF005670' } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
    ws.getRow(1).height = 28;

    ws.mergeCells('A2:I2');
    const projCell = ws.getCell('A2');
    projCell.value     = projectLabel;
    projCell.font      = { name: 'Arial', bold: true, size: 10 };
    projCell.alignment = { vertical: 'middle', horizontal: 'center' };
    ws.getRow(2).height = 20;

    ws.mergeCells('A3:I3');
    const dateCell = ws.getCell('A3');
    dateCell.value = `Printed: ${new Date().toLocaleDateString('en-US', {
      month: '2-digit', day: '2-digit', year: 'numeric'
    })}`;
    dateCell.font      = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF666666' } };
    dateCell.alignment = { vertical: 'middle', horizontal: 'center' };
    ws.getRow(3).height = 16;

    ['Photo','Room','Vendor Name','Vendor Description','HDG PO#','Qty',
     'Vendor Order #','Tracking Info','Notes'].forEach((h, i) => {
      const cell = ws.getCell(4, i + 1);
      cell.value     = h;
      cell.font      = headerFont;
      cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF005670' } };
      cell.border    = thinBorder;
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    });
    ws.getRow(4).height = 24;

    const grouped = {};
    products.forEach(p => {
      const room = p.selectedOptions?.room || p.category || p.spotName || '— No Room Assigned —';
      if (!grouped[room]) grouped[room] = [];
      grouped[room].push(p);
    });

    let rowNum = 5;

    Object.entries(grouped).forEach(([room, roomProducts]) => {
      ws.mergeCells(`A${rowNum}:I${rowNum}`);
      const roomCell = ws.getCell(`A${rowNum}`);
      roomCell.value     = room;
      roomCell.font      = { name: 'Arial', bold: true, size: 10, color: { argb: 'FF005670' } };
      roomCell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F4F7' } };
      roomCell.border    = thinBorder;
      roomCell.alignment = { vertical: 'middle', indent: 1 };
      ws.getRow(rowNum).height = 20;
      rowNum++;

      roomProducts.forEach((p) => {
        const originalIdx = products.indexOf(p);
        ws.getRow(rowNum).height = 90;

        const vendorName = (p.vendor && typeof p.vendor === 'object' && p.vendor.name)
          ? p.vendor.name : 'HDG Inventory';

        const descParts = [];
        if (p.name)                            descParts.push(p.name);
        if (p.product_id)                      descParts.push(`SKU: ${p.product_id}`);
        if (p.selectedOptions?.specifications) descParts.push(p.selectedOptions.specifications);
        if (p.selectedOptions?.finish)         descParts.push(`Finish: ${p.selectedOptions.finish}`);
        if (p.selectedOptions?.fabric)         descParts.push(`Fabric: ${p.selectedOptions.fabric}`);
        if (p.selectedOptions?.size)           descParts.push(`Size: ${p.selectedOptions.size}`);
        if (p.selectedOptions?.leadTime)       descParts.push(`Lead Time: ${p.selectedOptions.leadTime}`);
        const vendorDesc = descParts.join('\n');

        ws.getCell(rowNum, 1).border = thinBorder;
        if (imageCache.has(originalIdx)) {
          try {
            const imgData = imageCache.get(originalIdx);
            const imageId = wb.addImage({ buffer: imgData.buffer, extension: imgData.extension });
            ws.addImage(imageId, {
              tl: { col: 0.05, row: rowNum - 1 + 0.05 },
              ext: { width: 80, height: 80 },
              editAs: 'oneCell',
            });
          } catch (_) {}
        }

        const cellB = ws.getCell(rowNum, 2);
        cellB.value = p.selectedOptions?.room || p.category || p.spotName || '';
        cellB.font = dataFont; cellB.border = thinBorder; cellB.alignment = wrapTop;

        const cellC = ws.getCell(rowNum, 3);
        cellC.value = vendorName;
        cellC.font = dataFont; cellC.border = thinBorder; cellC.alignment = wrapTop;

        const cellD = ws.getCell(rowNum, 4);
        cellD.value = vendorDesc;
        cellD.font = dataFont; cellD.border = thinBorder; cellD.alignment = wrapTop;

        const cellE = ws.getCell(rowNum, 5);
        cellE.value = getPoNumber(p);
        cellE.font = dataFont; cellE.border = thinBorder; cellE.alignment = wrapTop;

        const cellF = ws.getCell(rowNum, 6);
        cellF.value = p.quantity || 1;
        cellF.font = dataFont; cellF.border = thinBorder;
        cellF.alignment = { ...wrapTop, horizontal: 'center' };

        const cellG = ws.getCell(rowNum, 7);
        cellG.value = p.selectedOptions?.vendorOrderNumber || '';
        cellG.font = dataFont; cellG.border = thinBorder; cellG.alignment = wrapTop;

        const cellH = ws.getCell(rowNum, 8);
        cellH.value = p.selectedOptions?.trackingInfo || '';
        cellH.font = dataFont; cellH.border = thinBorder; cellH.alignment = wrapTop;

        const cellI = ws.getCell(rowNum, 9);
        const notesParts = [
          p.selectedOptions?.deliveryStatus,
          p.selectedOptions?.notes,
          p.selectedOptions?.installerNotes,
        ].filter(Boolean);
        cellI.value = notesParts.join('\n') || '';
        cellI.font = dataFont; cellI.border = thinBorder; cellI.alignment = wrapTop;

        rowNum++;
      });
    });

    if (products.length === 0) {
      ws.mergeCells(`A${rowNum}:I${rowNum}`);
      ws.getCell(`A${rowNum}`).value     = 'No products in this order';
      ws.getCell(`A${rowNum}`).font      = { ...dataFont, italic: true };
      ws.getCell(`A${rowNum}`).alignment = { horizontal: 'center' };
      rowNum++;
    }

    ws.mergeCells(`A${rowNum}:I${rowNum}`);
    const footerCell = ws.getCell(`A${rowNum}`);
    footerCell.value = 'Henderson Design Group  |  4343 Royal Place, Honolulu, HI 96816  |  (808) 315-8782';
    footerCell.font  = { name: 'Arial', size: 8, color: { argb: 'FF999999' }, italic: true };
    footerCell.alignment = { horizontal: 'center' };

    // Filename: "ClientName - Install Binder.xlsx"
    const safeClient = clientName.replace(/[^a-zA-Z0-9 ]/g, '').trim();
    const filename   = `${safeClient} - Install Binder.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    await wb.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('❌ Error generating install binder Excel:', error);
    res.status(500).json({ message: 'Error generating install binder Excel', error: error.message });
  }
};

const generateStatusReport = async (req, res) => {
  try {
    const ExcelJS = require('exceljs');
    const axios = require('axios');

    const order = await Order.findById(req.params.id)
      .populate('user')
      .populate('selectedProducts.vendor')
      .lean();

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // ── Fetch latest POVersion per vendor & build PO# lookup ──
    const poVersions = await POVersion.find({ orderId: req.params.id })
      .sort({ version: -1 })
      .lean();

    // vendorId → { poNumber, productIds: Set<product_id>, nameKeys: Set<"name::..."> }
    // Only take the latest version per vendor (sort desc, skip if already seen)
    const vendorPoMap = new Map();
    poVersions.forEach(po => {
      const key = po.vendorId?.toString();
      if (!key || vendorPoMap.has(key)) return;
      const productIds = new Set();
      const nameKeys   = new Set();
      (po.products || []).forEach(pp => {
        if (pp.product_id) productIds.add(pp.product_id);
        if (pp.name)       nameKeys.add('name::' + pp.name.trim().toLowerCase());
      });
      vendorPoMap.set(key, { poNumber: po.poNumber || '', productIds, nameKeys });
    });

    // Returns PO# for a product without mixing up duplicates:
    // 1. Use selectedOptions.poNumber if already set on the product
    // 2. Else look up from POVersion, but only if this product_id/name exists in that PO
    const resolvePoNumber = (p) => {
      if (p.selectedOptions?.poNumber) return p.selectedOptions.poNumber;
      const vendorId = p.vendor?._id?.toString() || (typeof p.vendor === 'string' ? p.vendor : null);
      if (!vendorId) return '';
      const entry = vendorPoMap.get(vendorId);
      if (!entry) return '';
      const pid     = p.product_id;
      const nameKey = 'name::' + (p.name || '').trim().toLowerCase();
      if ((pid && entry.productIds.has(pid)) || entry.nameKeys.has(nameKey)) {
        return entry.poNumber;
      }
      return '';
    };

    const wb = new ExcelJS.Workbook();
    const products = order.selectedProducts || [];
    const clientName = order.clientInfo?.name || 'Unknown Client';
    const unitNumber = order.clientInfo?.unitNumber || '';
    const floorPlan = order.clientInfo?.floorPlan || '';
    const projectLabel = [clientName, floorPlan].filter(Boolean).join(' - ');
    const todayStr = new Date().toLocaleDateString('en-US', {
      month: '2-digit', day: '2-digit', year: 'numeric'
    });

    // ── Helper: normalize any date value to MM/DD/YYYY string ──
    const fmtDate = (val) => {
      if (!val) return '';
      const d = new Date(val);
      if (isNaN(d.getTime())) return String(val);
      // Treat ISO date-only strings (YYYY-MM-DD) as local date to avoid UTC shift
      if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val)) {
        const [y, m, dy] = val.split('-');
        return `${m}/${dy}/${y}`;
      }
      return d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
    };

    const installDate = fmtDate(order.installationDate);

    // ── Helper: get vendor name ──
    const getVendorName = (product) => {
      if (product.vendor && typeof product.vendor === 'object') {
        return product.vendor.name || 'N/A';
      }
      return 'HDG Inventory';
    };

    // ── Helper: build vendor description (for internal sheet col F) ──
    const buildVendorDescription = (p) => {
      const parts = [];
      if (p.name) parts.push(p.name);
      if (p.product_id) parts.push(`Product ID: ${p.product_id}`);
      if (p.selectedOptions?.specifications) parts.push(p.selectedOptions.specifications);
      if (p.selectedOptions?.finish) parts.push(`Finish: ${p.selectedOptions.finish}`);
      if (p.selectedOptions?.fabric) parts.push(`Fabric: ${p.selectedOptions.fabric}`);
      if (p.selectedOptions?.size) parts.push(`Size: ${p.selectedOptions.size}`);
      if (p.selectedOptions?.links?.length > 0) {
        parts.push(`\nOrder Link: ${p.selectedOptions.links[0]}`);
      }
      return parts.join('\n');
    };

    // ── Helper: get primary image URL ──
    const getPrimaryImageUrl = (p) => {
      if (p.selectedOptions?.image) return p.selectedOptions.image;
      if (p.selectedOptions?.images?.length > 0) return p.selectedOptions.images[0];
      if (p.selectedOptions?.uploadedImages?.length > 0) {
        const img = p.selectedOptions.uploadedImages[0];
        return img.url || null;
      }
      return null;
    };

    // ── Helper: download image to buffer ──
    const downloadImage = async (url) => {
      try {
        if (!url || url.startsWith('data:')) return null;
        const response = await axios.get(url, {
          responseType: 'arraybuffer',
          timeout: 8000,
          headers: { 'User-Agent': 'HDG-StatusReport/1.0' }
        });
        const contentType = response.headers['content-type'] || '';
        let ext = 'png';
        if (contentType.includes('jpeg') || contentType.includes('jpg')) ext = 'jpeg';
        else if (contentType.includes('gif')) ext = 'gif';
        else if (contentType.includes('png')) ext = 'png';
        return { buffer: Buffer.from(response.data), extension: ext };
      } catch (err) {
        console.warn(`⚠️ Failed to download image: ${url}`, err.message);
        return null;
      }
    };

    // ── Pre-download all product images ──
    console.log(`📸 Pre-downloading images for ${products.length} products...`);
    const imageCache = new Map();
    await Promise.all(
      products.map(async (p, idx) => {
        const url = getPrimaryImageUrl(p);
        if (url) {
          const imgData = await downloadImage(url);
          if (imgData) {
            imageCache.set(idx, imgData);
          }
        }
      })
    );
    console.log(`✅ Downloaded ${imageCache.size} images`);

    // ── Room sort order (matches ProposalEditor & CustomProductManager) ──
    const ROOM_ORDER = [
      'COURTYARD','EXTERIOR ENTRY','INTERIOR ENTRY','FOYER','LIVING ROOM','DINING ROOM',
      'KITCHEN','PANTRY','PRIMARY BEDROOM','PRIMARY BEDROOM LANAI','PRIMARY BATHROOM',
      'PRIMARY CLOSET','BEDROOM 2','BATHROOM 2','BEDROOM 2 CLOSET','BEDROOM 2 LANAI',
      'BEDROOM 3','BATHROOM 3','BEDROOM 3 CLOSET','BEDROOM 3 LANAI','BEDROOM 4','BATHROOM 4',
      'BEDROOM 4 CLOSET','BEDROOM 4 LANAI','POWDER ROOM','OFFICE','MEDIA ROOM','DEN','HALLWAY',
      'LANAI','LANAI 1','LANAI 2','LANAI 3','MAIN LANAI','POOL LANAI','POOL AREA','BREAKFAST NOOK','GREAT ROOM','FAMILY ROOM','WET BAR','BBQ AREA',
      'POOL BATH','PAVILLION','GYM','WINE ROOM','REC ROOM','GARAGE','SITTING ROOM',
      'FLEX SPACE','LAUNDRY ROOM','MUD ROOM','TERRACE','BALCONY','OUTDOOR DINING',
      'OUTDOOR LIVING','GUEST SUITE','DESIGN SERVICES','PROJECT MANAGEMENT SERVICES',
      'PROCUREMENT SERVICES','FDI SERVICES (FREIGHT, DELIVERY & INSTALLATION)',
      'WALLPAPER INSTALLATION SERVICES','ELECTRICAL INSTALLATION SERVICES',
      'ART INSTALLATION SERVICES','WALLPAPER TRADE COORDINATION',
      'ELECTRICAL TRADE COORDINATION','CLOSET SOLUTIONS',
      'KITCHEN & HOUSEHOLD ESSENTIALS PACKAGE','WINDOW COVERING SERVICES',
      'AUDIO VISUAL SERVICES','GREENERY & PLANT STYLING',
      'CONSTRUCTION DESIGN & PM SERVICES','CUSTOM MILLWORK SERVICES',
      'CUSTOM FURNITURE SERVICES','LIGHTING PROCUREMENT & COORDINATION',
      'APPLIANCE COORDINATION','PLUMBING FIXTURE COORDINATION',
      'DECORATIVE PLUMBING COORDINATION','STONE & SLAB COORDINATION',
      'TILE & SURFACE COORDINATION','HARDWARE & DECORATIVE HARDWARE COORDINATION',
      'OUTDOOR FURNISHINGS','LANAI / TERRACE FURNISHINGS','STYLING & ACCESSORIES',
      'BEDDING PACKAGE','TURNKEY MOVE-IN PACKAGE','OWNER STORAGE & INVENTORY COORDINATION',
      'CLIENT SUPPLIED ITEMS COORDINATION','WHITE GLOVE RECEIVING & WAREHOUSING',
      'PUNCH LIST & COMPLETION COORDINATION','SITE VISIT COORDINATION',
      'EXPEDITING SERVICES','BUILDING COORDINATION SERVICES',
      'CONTRACTOR COORDINATION SERVICES','INSTALLATION OVERSIGHT',
      'FINAL STYLING & STAGING','REVEAL PREPARATION',
    ];

    const sortByRoom = (a, b) => {
      const ra = (a.selectedOptions?.room || a.category || a.spotName || '').toUpperCase();
      const rb = (b.selectedOptions?.room || b.category || b.spotName || '').toUpperCase();
      const ia = ROOM_ORDER.indexOf(ra);
      const ib = ROOM_ORDER.indexOf(rb);
      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return 1;
      return ra.localeCompare(rb);
    };

    // ── Helper: group products by statusCategory, items sorted by room order ──
    const groupByCategory = (items) => {
      const groups = {};
      items.forEach(p => {
        const cat = p.selectedOptions?.statusCategory || 'Uncategorized';
        if (!groups[cat]) groups[cat] = [];
        groups[cat].push(p);
      });
      Object.values(groups).forEach(arr => arr.sort(sortByRoom));
      return groups;
    };

    // ── Colors ──
    const COLORS = {
      purple:   'FFF5ECF9',
      blue:     'FFD6EAF8',
      orange:   'FFFDEBD0',
      green:    'FFDDF2CE',
      yellow:   'FFF0E8BB',
      headerBg: 'FFD9E2F3',
    };

    const CATEGORY_COLORS = {
      'Items to be delivered during the week of installation': COLORS.purple,
      'Items shipping to Resort':      COLORS.blue,
      'Items currently in transit':     COLORS.orange,
      'Deliveries to Freight Forwarder': COLORS.green,
      'Items Delivered':                COLORS.yellow,
      'Pending Delivery':              COLORS.headerBg,
    };

    // ── Styles ──
    const thinBorder = {
      top:    { style: 'thin' },
      left:   { style: 'thin' },
      bottom: { style: 'thin' },
      right:  { style: 'thin' },
    };
    const headerFont = { name: 'Arial', bold: true, size: 12 };
    const dataFont   = { name: 'Arial', size: 11 };
    const titleFont  = { name: 'Arial', bold: true, size: 14 };
    const wrapTop    = { vertical: 'top', wrapText: true };

    // ── Helper: add image to a cell in a worksheet ──
    // colWidthPx: approximate pixel width of the column
    // rowHeightPx: approximate pixel height of the row
    const addImageToCell = (ws, imgData, rowNum, colNum, colWidthPx = 210, rowHeightPx = 120) => {
      try {
        const imageId = wb.addImage({
          buffer: imgData.buffer,
          extension: imgData.extension,
        });

        // Padding inside the cell (px)
        const pad = 6;
        const maxW = colWidthPx - pad * 2;
        const maxH = rowHeightPx - pad * 2;

        // Determine intrinsic image size (fallback to square)
        let imgW = maxW;
        let imgH = maxH;

        // Scale to fit while maintaining aspect ratio
        // Since we don't have sharp/image-size, use maxW x maxH as-is
        // The image will stretch to fit; for best results keep images roughly square
        const fitW = maxW;
        const fitH = maxH;

        ws.addImage(imageId, {
          tl: { col: colNum - 1 + 0.05, row: rowNum - 1 + 0.05 },
          ext: { width: fitW, height: fitH },
          editAs: 'oneCell',
        });
      } catch (err) {
        console.warn(`⚠️ Failed to embed image at row ${rowNum}:`, err.message);
      }
    };

    // ── Build product index map (original index → product) ──
    const productOriginalIndex = new Map();
    products.forEach((p, idx) => productOriginalIndex.set(p, idx));

    const grouped = groupByCategory(products);

    // ====================================================================
    // SHEET 1: Client Facing Status Report
    // ====================================================================
    const ws1 = wb.addWorksheet('Client Facing Status Report');

    ws1.getColumn('A').width = 20;
    ws1.getColumn('B').width = 28;
    ws1.getColumn('C').width = 28;
    ws1.getColumn('D').width = 15;
    ws1.getColumn('E').width = 16;
    ws1.getColumn('F').width = 36;

    // ── Legend (rows 1-7) ──
    ws1.mergeCells('A1:B3');
    ws1.getCell('A1').value = 'Henderson Design Group';
    ws1.getCell('A1').font = { name: 'Arial', bold: true, size: 14 };
    ws1.getCell('A1').alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };

    const legendItems = [
      { row: 2, text: 'Items to be delivered during the week of installation', color: COLORS.purple },
      { row: 3, text: 'Items shipping to Resort',                             color: COLORS.blue },
      { row: 4, text: 'Items currently in transit',                            color: COLORS.orange },
      { row: 5, text: 'Deliveries to Freight Forwarder / sailing prior to installation', color: COLORS.green },
      { row: 6, text: 'Items Delivered',                                       color: COLORS.yellow },
    ];

    legendItems.forEach(({ row, text, color }) => {
      ws1.mergeCells(`D${row}:F${row}`);
      const cell = ws1.getCell(`D${row}`);
      cell.value = text;
      cell.font = { ...headerFont };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
      cell.alignment = wrapTop;
      ws1.getRow(row).height = 30;
    });

    // ── Project Info ──
    ws1.getCell('A8').value = unitNumber || clientName;
    ws1.getCell('A8').font = titleFont;
    ws1.getRow(8).height = 25;

    ws1.getCell('A9').value = todayStr;
    ws1.getCell('A9').font = titleFont;
    ws1.getRow(9).height = 25;

    if (installDate) {
      ws1.mergeCells('A10:B10');
      ws1.getCell('A10').value = `Installation: ${installDate}`;
      ws1.getCell('A10').font = titleFont;
      ws1.getRow(10).height = 25;
    }

    // ── Table Header ──
    const ch = 11;
    const cHeaders = ['Room', 'Photo', 'Description', 'Quantity', 'Date Received', 'Estimated Delivery Date (to residence)'];
    cHeaders.forEach((h, i) => {
      const cell = ws1.getCell(ch, i + 1);
      cell.value = h;
      cell.font = headerFont;
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.headerBg } };
      cell.border = thinBorder;
      cell.alignment = { ...wrapTop, horizontal: 'center' };
    });
    ws1.getRow(ch).height = 24;

    // ── Data rows ──
    let cr = ch + 1;

    Object.entries(grouped).forEach(([category, items]) => {
      // Category header
      ws1.mergeCells(`A${cr}:F${cr}`);
      const catCell = ws1.getCell(`A${cr}`);
      catCell.value = category;
      catCell.font = { ...headerFont, bold: true };
      catCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CATEGORY_COLORS[category] || COLORS.headerBg } };
      catCell.border = thinBorder;
      ws1.getRow(cr).height = 30;
      cr++;

      items.forEach(p => {
        const originalIdx = productOriginalIndex.get(p);
        ws1.getRow(cr).height = 120;

        // A - Room
        const cellA = ws1.getCell(cr, 1);
        cellA.value = p.selectedOptions?.room || p.category || p.spotName || '';
        cellA.font = dataFont; cellA.border = thinBorder; cellA.alignment = wrapTop;

        // B - Photo (image)
        const cellB = ws1.getCell(cr, 2);
        cellB.border = thinBorder;
        if (imageCache.has(originalIdx)) {
          addImageToCell(ws1, imageCache.get(originalIdx), cr, 2, 210, 120);
        }

        // C - Description
        const cellC = ws1.getCell(cr, 3);
        cellC.value = p.name || '';
        cellC.font = dataFont; cellC.border = thinBorder; cellC.alignment = wrapTop;

        // D - Quantity
        const cellD = ws1.getCell(cr, 4);
        cellD.value = p.quantity || 1;
        cellD.font = dataFont; cellD.border = thinBorder; cellD.alignment = { ...wrapTop, horizontal: 'center' };

        // E - Date Received
        const cellE = ws1.getCell(cr, 5);
        cellE.value = fmtDate(p.selectedOptions?.dateReceived);
        cellE.font = dataFont; cellE.border = thinBorder; cellE.alignment = wrapTop;

        // F - Estimated Delivery Date
        const cellF = ws1.getCell(cr, 6);
        cellF.value = fmtDate(p.selectedOptions?.estimatedDeliveryDate);
        cellF.font = dataFont; cellF.border = thinBorder; cellF.alignment = wrapTop;

        cr++;
      });
    });

    if (products.length === 0) {
      ws1.mergeCells(`A${cr}:F${cr}`);
      ws1.getCell(`A${cr}`).value = 'No products in this order';
      ws1.getCell(`A${cr}`).font = { ...dataFont, italic: true };
      ws1.getCell(`A${cr}`).alignment = { horizontal: 'center' };
    }

    // ====================================================================
    // SHEET 2: Internal Status Report
    // ====================================================================
    const ws2 = wb.addWorksheet('Internal Status Report');

    ws2.getColumn('A').width = 20;
    ws2.getColumn('B').width = 28;
    ws2.getColumn('C').width = 16;
    ws2.getColumn('D').width = 18;
    ws2.getColumn('E').width = 26;
    ws2.getColumn('F').width = 40;
    ws2.getColumn('G').width = 15;
    ws2.getColumn('H').width = 15;
    ws2.getColumn('I').width = 14;
    ws2.getColumn('J').width = 18;
    ws2.getColumn('K').width = 16;
    ws2.getColumn('L').width = 25;
    ws2.getColumn('M').width = 20;
    ws2.getColumn('N').width = 27;
    ws2.getColumn('O').width = 23;
    ws2.getColumn('P').width = 21;
    ws2.getColumn('Q').width = 26;

    // ── Legend ──
    ws2.mergeCells('A1:B3');
    ws2.getCell('A1').value = 'Henderson Design Group';
    ws2.getCell('A1').font = { name: 'Arial', bold: true, size: 14 };
    ws2.getCell('A1').alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };

    const intLegend = [
      { row: 2, text: 'order in process',                       color: COLORS.blue },
      { row: 3, text: 'Shipping / in transit',                   color: COLORS.orange },
      { row: 4, text: 'at Freight Forwarder pending sailing',    color: COLORS.green },
      { row: 5, text: 'Order delivered',                         color: COLORS.green },
    ];
    intLegend.forEach(({ row, text, color }) => {
      const cell = ws2.getCell(`M${row}`);
      cell.value = text;
      cell.font = dataFont;
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
    });

    // Installation highlight
    ws2.mergeCells('C4:D4');
    ws2.getCell('C4').value = installDate ? `Installation: ${installDate}` : 'Installation: TBD';
    ws2.getCell('C4').font = { ...headerFont };
    ws2.getCell('C4').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDFB03' } };

    // Project info
    ws2.getCell('A7').value = unitNumber || clientName;
    ws2.getCell('A7').font = { name: 'Arial', bold: true, size: 16 };
    ws2.getCell('A8').value = todayStr;
    ws2.getCell('A8').font = { name: 'Arial', bold: true, size: 16 };

    // ── Table Header (row 9) ──
    const ih = 9;
    const iHeaders = [
      'Room', 'Photo', 'External PO#', 'Proposal Number', 'Vendor Name',
      'Vendor Description', 'Quantity', 'Ship To', 'Order Date',
      'Expected Ship Date', 'Date Received', 'Notes', 'Shipping Carrier',
      'Tracking #', 'Warehouse Receiving #',
      'Expediting Order Status', 'Vendor Order Number'
    ];
    iHeaders.forEach((h, i) => {
      const cell = ws2.getCell(ih, i + 1);
      cell.value = h;
      cell.font = headerFont;
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.headerBg } };
      cell.border = thinBorder;
      cell.alignment = { ...wrapTop, horizontal: 'center' };
    });
    ws2.getRow(ih).height = 26;

    // ── Data rows ──
    let ir = ih + 1;
    const defaultShipTo = projectLabel;

    Object.entries(grouped).forEach(([category, items]) => {
      // Category separator
      ws2.mergeCells(`A${ir}:B${ir}`);
      const catCell = ws2.getCell(`A${ir}`);
      catCell.value = category;
      catCell.font = { ...headerFont, bold: true };
      catCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CATEGORY_COLORS[category] || COLORS.headerBg } };
      catCell.border = thinBorder;
      ws2.getRow(ir).height = 30;
      ir++;

      items.forEach(p => {
        const originalIdx = productOriginalIndex.get(p);
        ws2.getRow(ir).height = 120;

        const vendorName = getVendorName(p);
        const vendorDesc = buildVendorDescription(p);

        // A - Room
        const cA = ws2.getCell(ir, 1);
        cA.value = p.selectedOptions?.room || p.category || p.spotName || '';
        cA.font = dataFont; cA.border = thinBorder; cA.alignment = wrapTop;

        // B - Photo (image)
        ws2.getCell(ir, 2).border = thinBorder;
        if (imageCache.has(originalIdx)) {
          addImageToCell(ws2, imageCache.get(originalIdx), ir, 2, 210, 120);
        }

        // C - External PO#
        const cC = ws2.getCell(ir, 3);
        cC.value = resolvePoNumber(p);
        cC.font = dataFont; cC.border = thinBorder; cC.alignment = wrapTop;

        // D - Proposal Number
        const cD = ws2.getCell(ir, 4);
        cD.value = order.proposalNumber || '';
        cD.font = dataFont; cD.border = thinBorder; cD.alignment = wrapTop;

        // E - Vendor Name
        const cE = ws2.getCell(ir, 5);
        cE.value = vendorName;
        cE.font = dataFont; cE.border = thinBorder; cE.alignment = wrapTop;

        // F - Vendor Description
        const cF = ws2.getCell(ir, 6);
        cF.value = vendorDesc;
        cF.font = dataFont; cF.border = thinBorder; cF.alignment = wrapTop;

        // G - Quantity
        const cG = ws2.getCell(ir, 7);
        cG.value = p.quantity || 1;
        cG.font = dataFont; cG.border = thinBorder; cG.alignment = { ...wrapTop, horizontal: 'center' };

        // H - Ship To
        const cH = ws2.getCell(ir, 8);
        cH.value = p.selectedOptions?.shipToName || p.selectedOptions?.shipTo || defaultShipTo;
        cH.font = dataFont; cH.border = thinBorder; cH.alignment = wrapTop;

        // I - Order Date
        const cI = ws2.getCell(ir, 9);
        cI.value = fmtDate(p.selectedOptions?.orderDate);
        cI.font = dataFont; cI.border = thinBorder; cI.alignment = wrapTop;

        // J - Expected Ship Date
        const cJ = ws2.getCell(ir, 10);
        cJ.value = fmtDate(p.selectedOptions?.expectedShipDate);
        cJ.font = dataFont; cJ.border = thinBorder; cJ.alignment = wrapTop;

        // K - Date Received
        const cK = ws2.getCell(ir, 11);
        cK.value = fmtDate(p.selectedOptions?.dateReceived);
        cK.font = dataFont; cK.border = thinBorder; cK.alignment = wrapTop;

        // L - Notes
        const cL = ws2.getCell(ir, 12);
        cL.value = p.selectedOptions?.notes || '';
        cL.font = dataFont; cL.border = thinBorder; cL.alignment = wrapTop;

        // M - Shipping Carrier
        const cM = ws2.getCell(ir, 13);
        cM.value = p.selectedOptions?.shippingCarrier || '';
        cM.font = dataFont; cM.border = thinBorder; cM.alignment = wrapTop;

        // N - Tracking #
        const cN = ws2.getCell(ir, 14);
        cN.value = p.selectedOptions?.trackingInfo || '';
        cN.font = dataFont; cN.border = thinBorder; cN.alignment = wrapTop;

        // O - Warehouse Receiving # ✅ SARA
        const cO = ws2.getCell(ir, 15);
        cO.value = p.selectedOptions?.warehouseReceivingNumber || '';
        cO.font = dataFont; cO.border = thinBorder; cO.alignment = wrapTop;

        // P - Expediting Order Status (from Status Category in Custom Products Manager)
        const cP = ws2.getCell(ir, 16);
        cP.value = p.selectedOptions?.statusCategory || '';
        cP.font = dataFont; cP.border = thinBorder; cP.alignment = wrapTop;

        // Q - Vendor Order Number
        const cQ = ws2.getCell(ir, 17);
        cQ.value = p.selectedOptions?.vendorOrderNumber || '';
        cQ.font = dataFont; cQ.border = thinBorder; cQ.alignment = wrapTop;

        ir++;
      });
    });

    if (products.length === 0) {
      ws2.mergeCells(`A${ir}:Q${ir}`);
      ws2.getCell(`A${ir}`).value = 'No products in this order';
      ws2.getCell(`A${ir}`).font = { ...dataFont, italic: true };
      ws2.getCell(`A${ir}`).alignment = { horizontal: 'center' };
    }

    // ── Generate & send ──
    const buffer = await wb.xlsx.writeBuffer();

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    const _srClientName = (order.clientInfo?.name || 'Client').replace(/[^a-zA-Z0-9 ]/g, '').trim();
    res.setHeader('Content-Disposition', `attachment; filename="${_srClientName}.xlsx"`);
    res.setHeader('Content-Length', buffer.length);
    res.send(Buffer.from(buffer));

  } catch (error) {
    console.error('❌ Error generating status report:', error);
    res.status(500).json({ message: 'Error generating status report', error: error.message });
  }
};

const getUploadPresignedUrl = async (req, res) => {
  try {
    const { filename, contentType, folder = 'uploads' } = req.body;

    if (!filename || !contentType) {
      return res.status(400).json({
        success: false,
        message: 'filename and contentType are required'
      });
    }

    // Validasi folder yang diizinkan
    const allowedFolders = ['floor-plans', 'product-images', 'payment-proofs'];
    if (!allowedFolders.includes(folder)) {
      return res.status(400).json({
        success: false,
        message: `folder must be one of: ${allowedFolders.join(', ')}`
      });
    }

    const result = await generatePresignedUploadUrl({ folder, filename, contentType });

    console.log('✅ Presigned URL generated:', result.key);

    res.json({
      success: true,
      uploadUrl: result.uploadUrl,
      key: result.key,
      publicUrl: result.publicUrl,
    });
  } catch (error) {
    console.error('❌ Failed to generate presigned URL:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// ─── COG Report Excel ─────────────────────────────────────────────────────────
// Format: Row1=project title, Row2=yellow bar, Row3=black header, data, SUM total
const generateCogExcel = async (req, res) => {
  try {
    const ExcelJS   = require('exceljs');

    const order = await Order.findById(req.params.id)
      .populate('selectedProducts.vendor')
      .lean();
    if (!order) return res.status(404).json({ message: 'Order not found' });

    const clientName   = order.clientInfo?.name || 'Client';
    const unitNumber   = order.clientInfo?.unitNumber || '';
    const shortId      = req.params.id.toString().slice(-4).toUpperCase();
    const nameParts    = clientName.trim().split(/\s+/);
    const lastName     = nameParts[nameParts.length - 1] || nameParts[0] || 'CLT';
    const clientCode   = lastName.replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase().padEnd(3, 'X');
    const lotLabel     = unitNumber ? ` - Lot ${unitNumber}` : '';
    const projectLabel = `Project: ${clientName}${lotLabel} - ${shortId}`;

    const products = order.selectedProducts || [];

    // ✅ Fetch latest POVersion per vendor — for PO number lookup
    const poVersions = await POVersion.find({ orderId: req.params.id })
      .sort({ version: -1 })
      .lean();

    const getVendorName = (p) => {
      if (p.vendor && typeof p.vendor === 'object' && p.vendor.name) return p.vendor.name;
      return p.selectedOptions?.shipToName || 'HDG Inventory';
    };

    // ── One row per unique (vendorId + poNumber), using POVersion as source of truth ──
    // poVersions is sorted desc by version — first hit per key = latest version
    const rowMap = new Map(); // `${vendorId}::${poNumber}` → row
    const vendorsWithPO = new Set();

    poVersions.forEach(po => {
      const vid = po.vendorId?.toString();
      if (!vid) return;
      vendorsWithPO.add(vid);
      const pno = (po.poNumber || '').trim();
      const key = `${vid}::${pno}`;
      if (!rowMap.has(key)) {
        rowMap.set(key, {
          vendorId:   vid,
          poNumber:   pno || '(No PO# yet)',
          vendorName: po.vendorInfo?.name || 'Unknown Vendor',
          poStatus:   po.status || 'draft',
          poEntry:    po,
          calcTotal:  0,
        });
      }
    });

    // Freshen vendor names from populated products; collect no-PO vendors
    const noPoVendors = new Map(); // vendorId → { vendorName, calcTotal }

    products.forEach((p) => {
      const vendorId   = p.vendor?._id?.toString() || p.vendor?.toString() || 'no_vendor';
      const vendorName = getVendorName(p);

      if (vendorsWithPO.has(vendorId)) {
        // Update vendorName on all rows for this vendor
        for (const row of rowMap.values()) {
          if (row.vendorId === vendorId) row.vendorName = vendorName;
        }
        return;
      }

      // Vendor has no PO — accumulate calculated total
      const opts     = p.selectedOptions || {};
      const qty      = parseFloat(p.quantity) || 1;
      const msrp     = parseFloat(opts.msrp) || 0;
      const discount = parseFloat(opts.discountPercent) || 0;
      const netCost  = (opts.netCostOverride != null && opts.netCostOverride !== '')
                         ? parseFloat(opts.netCostOverride)
                         : msrp * (1 - discount / 100);
      const calc = netCost * qty;

      if (noPoVendors.has(vendorId)) {
        noPoVendors.get(vendorId).calcTotal += calc;
      } else {
        noPoVendors.set(vendorId, { vendorName, calcTotal: calc });
      }
    });

    // Build final rows: PO rows use POVersion.total; no-PO rows use calculated total
    const poRows = [
      ...Array.from(rowMap.values()).map(row => ({
        poNumber:   row.poNumber,
        vendorName: row.vendorName,
        poStatus:   row.poStatus,
        poEntry:    row.poEntry,
        total:      parseFloat(row.poEntry.total) || 0,
      })),
      ...Array.from(noPoVendors.values()).map(row => ({
        poNumber:   '(No PO# yet)',
        vendorName: row.vendorName,
        poStatus:   null,
        poEntry:    null,
        total:      row.calcTotal,
      })),
    ];

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Henderson Design Group';
    const ws   = wb.addWorksheet('COG Report');

    // Row 1 — project title
    ws.mergeCells('A1:D1');
    const r1 = ws.getCell('A1');
    r1.value     = projectLabel;
    r1.font      = { name: 'Arial', bold: true, size: 11 };
    r1.alignment = { vertical: 'middle' };
    ws.getRow(1).height = 20;

    // Row 2 — yellow bar
    ['A2','B2','C2','D2'].forEach(addr => {
      ws.getCell(addr).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
    });
    ws.getRow(2).height = 14;

    // Row 3 — black header (4 columns)
    ['HDG PO#', 'Vendor', 'Status PO', 'HDG PO Total'].forEach((h, i) => {
      const cell = ws.getCell(3, i + 1);
      cell.value     = h;
      cell.font      = { name: 'Arial', bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
      cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF000000' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });
    ws.getRow(3).height = 28;

    // Data rows
    poRows.forEach((row, i) => {
      const r = i + 4;
      ws.getRow(r).height = 22;
      const poCell     = ws.getCell(r, 1);
      const vendorCell = ws.getCell(r, 2);
      const statusCell = ws.getCell(r, 3);
      const totalCell  = ws.getCell(r, 4);
      poCell.value     = row.poNumber;
      vendorCell.value = row.vendorName;
      statusCell.value = row.poStatus || '—';
      totalCell.value  = row.total;
      [poCell, vendorCell, statusCell, totalCell].forEach(c => {
        c.font   = { name: 'Arial', size: 10 };
        c.border = { bottom: { style: 'thin', color: { argb: 'FFEEEEEE' } } };
      });
      poCell.alignment     = { horizontal: 'left',   vertical: 'middle', indent: 1 };
      vendorCell.alignment = { horizontal: 'left',   vertical: 'middle', indent: 1 };
      statusCell.alignment = { horizontal: 'center', vertical: 'middle' };
      totalCell.alignment  = { horizontal: 'right',  vertical: 'middle' };
      totalCell.numFmt     = '"$"#,##0.00';

      // Gray out rows without a PO yet — visual indicator for forecast
      if (row.poNumber === '(No PO# yet)') {
        [poCell, vendorCell, statusCell, totalCell].forEach(c => {
          c.font = { name: 'Arial', size: 10, italic: true, color: { argb: 'FF999999' } };
          c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F5' } };
        });
      }
    });

    // Grand total row
    const lastData  = poRows.length + 3;
    const totalRowN = poRows.length + 4;
    ws.getRow(totalRowN).height = 22;
    const grandTotal = ws.getCell(totalRowN, 4);
    grandTotal.value     = { formula: `SUM(D4:D${lastData})` };
    grandTotal.font      = { name: 'Arial', bold: true, size: 11 };
    grandTotal.alignment = { horizontal: 'right', vertical: 'middle' };
    grandTotal.numFmt    = '"$"#,##0.00';
    grandTotal.border    = { top: { style: 'thin', color: { argb: 'FF000000' } } };

    ws.getColumn(1).width = 18;
    ws.getColumn(2).width = 34;
    ws.getColumn(3).width = 16;
    ws.getColumn(4).width = 18;

    const safeName = clientName.replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `COG_${safeName}_${shortId}.xlsx`;
    res.setHeader('Content-Type',        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    await wb.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('generateCogExcel error:', error);
    res.status(500).json({ message: error.message });
  }
};

// ─── COG Report with Bill Invoice Comparison ─────────────────────────────────
// Same format as generateCogExcel but adds a Bill Invoice column (bill total)
const generateCogWithBill = async (req, res) => {
  try {
    const ExcelJS = require('exceljs');

    const order = await Order.findById(req.params.id)
      .populate('selectedProducts.vendor')
      .lean();
    if (!order) return res.status(404).json({ message: 'Order not found' });

    const clientName   = order.clientInfo?.name || 'Client';
    const unitNumber   = order.clientInfo?.unitNumber || '';
    const shortId      = req.params.id.toString().slice(-4).toUpperCase();
    const nameParts    = clientName.trim().split(/\s+/);
    const lastName     = nameParts[nameParts.length - 1] || nameParts[0] || 'CLT';
    const clientCode   = lastName.replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase().padEnd(3, 'X');
    const lotLabel     = unitNumber ? ` - Lot ${unitNumber}` : '';
    const projectLabel = `Project: ${clientName}${lotLabel} - ${shortId}`;

    const products = order.selectedProducts || [];

    // poVersions sorted desc — first hit per key = latest version
    const poVersions = await POVersion.find({ orderId: req.params.id }).sort({ version: -1 }).lean();

    // poVersionId → BillInvoice (1:1 via poVersionId)
    const bills = await BillInvoice.find({ orderId: req.params.id }).lean();
    const billByPOVersionId = new Map();
    bills.forEach(b => {
      const pvid = b.poVersionId?.toString();
      if (pvid) billByPOVersionId.set(pvid, b);
    });

    const getVendorName = (p) => {
      if (p.vendor && typeof p.vendor === 'object' && p.vendor.name) return p.vendor.name;
      return p.selectedOptions?.shipToName || 'HDG Inventory';
    };

    // ── One row per unique (vendorId + poNumber), POVersion as source of truth ──
    const rowMap = new Map();
    const vendorsWithPO = new Set();

    poVersions.forEach(po => {
      const vid = po.vendorId?.toString();
      if (!vid) return;
      vendorsWithPO.add(vid);
      const pno = (po.poNumber || '').trim();
      const key = `${vid}::${pno}`;
      if (!rowMap.has(key)) {
        const bill = billByPOVersionId.get(po._id.toString());
        rowMap.set(key, {
          vendorId:   vid,
          poNumber:   pno || '(No PO# yet)',
          vendorName: po.vendorInfo?.name || 'Unknown Vendor',
          poStatus:   po.status || 'draft',
          poEntry:    po,
          billTotal:  bill ? (parseFloat(bill.total) || 0) : null,
          billNumber: bill ? bill.billNumber : null,
          billStatus: bill ? bill.status : null,
          calcTotal:  0,
        });
      }
    });

    // Freshen vendor names; collect no-PO vendors
    const noPoVendors = new Map();

    products.forEach((p) => {
      const vendorId   = p.vendor?._id?.toString() || p.vendor?.toString() || 'no_vendor';
      const vendorName = getVendorName(p);

      if (vendorsWithPO.has(vendorId)) {
        for (const row of rowMap.values()) {
          if (row.vendorId === vendorId) row.vendorName = vendorName;
        }
        return;
      }

      const opts     = p.selectedOptions || {};
      const qty      = parseFloat(p.quantity) || 1;
      const msrp     = parseFloat(opts.msrp) || 0;
      const discount = parseFloat(opts.discountPercent) || 0;
      const netCost  = (opts.netCostOverride != null && opts.netCostOverride !== '')
                         ? parseFloat(opts.netCostOverride)
                         : msrp * (1 - discount / 100);
      const calc = netCost * qty;

      if (noPoVendors.has(vendorId)) {
        noPoVendors.get(vendorId).calcTotal += calc;
      } else {
        noPoVendors.set(vendorId, { vendorName, calcTotal: calc });
      }
    });

    const poRows = [
      ...Array.from(rowMap.values()).map(row => ({
        poNumber:   row.poNumber,
        vendorName: row.vendorName,
        poStatus:   row.poStatus,
        poEntry:    row.poEntry,
        billTotal:  row.billTotal,
        billNumber: row.billNumber,
        billStatus: row.billStatus,
        total:      parseFloat(row.poEntry.total) || 0,
      })),
      ...Array.from(noPoVendors.values()).map(row => ({
        poNumber:   '(No PO# yet)',
        vendorName: row.vendorName,
        poStatus:   null,
        poEntry:    null,
        billTotal:  null,
        billNumber: null,
        billStatus: null,
        total:      row.calcTotal,
      })),
    ];

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Henderson Design Group';
    const ws   = wb.addWorksheet('COG + Bill Comparison');

    // Row 1 — project title
    ws.mergeCells('A1:F1');
    const r1 = ws.getCell('A1');
    r1.value     = projectLabel;
    r1.font      = { name: 'Arial', bold: true, size: 11 };
    r1.alignment = { vertical: 'middle' };
    ws.getRow(1).height = 20;

    // Row 2 — yellow bar
    ['A2','B2','C2','D2','E2','F2'].forEach(addr => {
      ws.getCell(addr).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
    });
    ws.getRow(2).height = 14;

    // Row 3 — black header (6 columns)
    ['HDG PO#', 'Vendor', 'Status PO', 'HDG PO Total', 'Bill Invoice', 'Status Bill'].forEach((h, i) => {
      const cell = ws.getCell(3, i + 1);
      cell.value     = h;
      cell.font      = { name: 'Arial', bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
      cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF000000' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });
    ws.getRow(3).height = 28;

    // Data rows
    poRows.forEach((row, i) => {
      const r = i + 4;
      ws.getRow(r).height = 22;
      const poCell         = ws.getCell(r, 1);
      const vendorCell     = ws.getCell(r, 2);
      const statusCell     = ws.getCell(r, 3);
      const totalCell      = ws.getCell(r, 4);
      const billCell       = ws.getCell(r, 5);
      const billStatusCell = ws.getCell(r, 6);

      poCell.value         = row.poNumber;
      vendorCell.value     = row.vendorName;
      statusCell.value     = row.poStatus  || '—';
      totalCell.value      = row.total;
      billCell.value       = row.billTotal !== null ? row.billTotal : '—';
      billStatusCell.value = row.billStatus || '—';

      [poCell, vendorCell, statusCell, totalCell, billCell, billStatusCell].forEach(c => {
        c.font   = { name: 'Arial', size: 10 };
        c.border = { bottom: { style: 'thin', color: { argb: 'FFEEEEEE' } } };
      });
      poCell.alignment         = { horizontal: 'left',   vertical: 'middle', indent: 1 };
      vendorCell.alignment     = { horizontal: 'left',   vertical: 'middle', indent: 1 };
      statusCell.alignment     = { horizontal: 'center', vertical: 'middle' };
      totalCell.alignment      = { horizontal: 'right',  vertical: 'middle' };
      billCell.alignment       = { horizontal: 'right',  vertical: 'middle' };
      billStatusCell.alignment = { horizontal: 'center', vertical: 'middle' };

      if (row.billTotal !== null) {
        totalCell.numFmt = '"$"#,##0.00';
        billCell.numFmt  = '"$"#,##0.00';
        // Highlight amount mismatch in red
        if (Math.abs(row.total - row.billTotal) > 0.01) {
          billCell.font = { name: 'Arial', size: 10, color: { argb: 'FFCC0000' }, bold: true };
        }
      }

      if (row.poNumber === '(No PO# yet)') {
        [poCell, vendorCell, statusCell, totalCell, billCell, billStatusCell].forEach(c => {
          c.font = { name: 'Arial', size: 10, italic: true, color: { argb: 'FF999999' } };
          c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F5' } };
        });
      }
    });

    // Grand total row
    const lastData  = poRows.length + 3;
    const totalRowN = poRows.length + 4;
    ws.getRow(totalRowN).height = 22;

    const grandPO = ws.getCell(totalRowN, 4);
    grandPO.value     = { formula: `SUM(D4:D${lastData})` };
    grandPO.font      = { name: 'Arial', bold: true, size: 11 };
    grandPO.alignment = { horizontal: 'right', vertical: 'middle' };
    grandPO.numFmt    = '"$"#,##0.00';
    grandPO.border    = { top: { style: 'thin', color: { argb: 'FF000000' } } };

    ws.getColumn(1).width = 20;
    ws.getColumn(2).width = 34;
    ws.getColumn(3).width = 16;
    ws.getColumn(4).width = 18;
    ws.getColumn(5).width = 18;
    ws.getColumn(6).width = 16;

    const safeName = clientName.replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `COG_Bill_${safeName}_${shortId}.xlsx`;
    res.setHeader('Content-Type',        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    await wb.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('generateCogWithBill error:', error);
    res.status(500).json({ message: error.message });
  }
};

const getLatestConfirmedPOs = async (req, res) => {
  try {
    const mongoose  = require('mongoose');
    const POVersion = require('../models/POVersion');
    const { orderId } = req.params;
 
    const confirmed = await POVersion.aggregate([
      { $match: {
          orderId: mongoose.Types.ObjectId.createFromHexString(orderId),
          status: 'confirmed'
      }},
      { $sort: { vendorId: 1, version: -1 } },
      { $group: {
          _id:         '$vendorId',
          poVersionId: { $first: '$_id' },
          poNumber:    { $first: '$poNumber' },
          vendorName:  { $first: '$vendorInfo.name' },
      }},
    ]);
 
    if (!confirmed.length) {
      return res.status(404).json({ message: 'No confirmed POs found for this order' });
    }
 
    res.json({
      success:      true,
      poVersionIds: confirmed.map(c => c.poVersionId.toString()),
      details:      confirmed.map(c => ({
        poVersionId: c.poVersionId,
        poNumber:    c.poNumber,
        vendorName:  c.vendorName,
      })),
    });
  } catch (error) {
    console.error('getLatestConfirmedPOs error:', error);
    res.status(500).json({ message: error.message });
  }
};

const saveCurrentVersion = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { products, clientInfo, notes } = req.body;
 
    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ message: 'Order not found' });
 
    const proposalNumber = await ensureProposalNumber(order);
 
    // Find the latest version for this order
    const latestVersion = await ProposalVersion.findOne(
      { orderId },
      {},
      { sort: { version: -1 } }
    );
 
    if (latestVersion) {
      // Update in-place — same version number, no bump
      latestVersion.selectedProducts = products;
      if (clientInfo) latestVersion.clientInfo = clientInfo;
      if (notes) latestVersion.notes = notes;
      latestVersion.updatedAt = new Date();
      latestVersion.updatedBy = req.user.id;
      await latestVersion.save();
 
      console.log(`[proposal] Saved current version ${latestVersion.version} for order ${orderId}`);
      return res.json({
        success: true,
        message: `Version ${latestVersion.version} updated`,
        data: latestVersion,
        proposalNumber,
      });
    }
 
    // No version exists yet — create version 1
    const newVersion = await ProposalVersion.create({
      orderId,
      version:          1,
      selectedProducts: products,
      clientInfo:       clientInfo || order.clientInfo,
      notes:            notes || 'Initial version',
      status:           'draft',
      createdBy:        req.user.id,
    });
 
    console.log(`[proposal] Created initial version 1 for order ${orderId}`);
    return res.json({
      success: true,
      message: 'Version 1 created',
      data: newVersion,
      proposalNumber,
    });
 
  } catch (error) {
    console.error('saveCurrentVersion error:', error);
    res.status(500).json({ message: error.message });
  }
};

const generateAllProductsReport = async (req, res) => {
  try {
    const ExcelJS = require('exceljs');
 
    // Fetch all orders with vendor populated
    const orders = await Order.find({})
      .populate('selectedProducts.vendor', 'name')
      .lean();
 
    // Fetch latest PO per vendor per order for PO# lookup
    const allPOVersions = await POVersion.find({})
      .sort({ version: 1 }) // ASC — earliest first for per-product lookup
      .lean();
 
    // Build product_id → poNumber map (earliest PO that contains this product)
    const productPoMap = new Map();
    allPOVersions.forEach(po => {
      (po.products || []).forEach(poProduct => {
        const pid = poProduct.product_id;
        if (pid && !productPoMap.has(pid)) {
          productPoMap.set(pid, po.poNumber || '');
        }
      });
    });
 
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Henderson Design Group';
    const ws = wb.addWorksheet('All Products');
 
    // Column widths
    ws.getColumn('A').width = 22; // Client
    ws.getColumn('B').width = 10; // Unit
    ws.getColumn('C').width = 18; // Vendor
    ws.getColumn('D').width = 30; // Product Name
    ws.getColumn('E').width = 20; // SKU
    ws.getColumn('F').width = 18; // Room
    ws.getColumn('G').width = 8;  // Qty
    ws.getColumn('H').width = 14; // Net Cost (unit)
    ws.getColumn('I').width = 14; // Net Cost (total)
    ws.getColumn('J').width = 14; // Sell Price (unit)
    ws.getColumn('K').width = 14; // Sell Price (total)
    ws.getColumn('L').width = 14; // Sales Tax
    ws.getColumn('M').width = 14; // Grand Total
    ws.getColumn('N').width = 18; // PO#
    ws.getColumn('O').width = 16; // Finish
    ws.getColumn('P').width = 16; // Fabric
    ws.getColumn('Q').width = 12; // Size
    ws.getColumn('R').width = 14; // Lead Time
    ws.getColumn('S').width = 14; // Order Status
 
    const thinBorder = {
      top: { style: 'thin' }, left: { style: 'thin' },
      bottom: { style: 'thin' }, right: { style: 'thin' },
    };
    const wrapTop = { vertical: 'top', wrapText: true };
    const dataFont = { name: 'Arial', size: 9 };
 
    // Row 1 — Title
    ws.mergeCells('A1:S1');
    ws.getCell('A1').value = `Henderson Design Group — All Products Report — ${new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}`;
    ws.getCell('A1').font = { name: 'Arial', bold: true, size: 13, color: { argb: 'FF005670' } };
    ws.getCell('A1').alignment = { vertical: 'middle', horizontal: 'center' };
    ws.getRow(1).height = 28;
 
    // Row 2 — Headers
    const headers = [
      'Client', 'Unit', 'Vendor', 'Product Name', 'SKU', 'Room', 'Qty',
      'Net Cost (Unit)', 'Net Cost (Total)', 'Sell Price (Unit)', 'Sell Price (Total)',
      'Sales Tax', 'Grand Total', 'PO #', 'Finish', 'Fabric', 'Size', 'Lead Time', 'Order Status'
    ];
    headers.forEach((h, i) => {
      const cell = ws.getCell(2, i + 1);
      cell.value = h;
      cell.font = { name: 'Arial', bold: true, size: 9, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF005670' } };
      cell.border = thinBorder;
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    });
    ws.getRow(2).height = 22;
 
    let rowNum = 3;
    let grandTotalNetCost = 0;
    let grandTotalSell = 0;
    let grandTotalTax = 0;
 
    orders.forEach(order => {
      const clientName = order.clientInfo?.name || 'Unknown';
      const unitNumber = order.clientInfo?.unitNumber || '';
      const orderStatus = order.status || '';
 
      (order.selectedProducts || []).forEach(p => {
        const opts = p.selectedOptions || {};
        const qty = parseFloat(p.quantity) || 1;
        const vendorName = (p.vendor && typeof p.vendor === 'object') ? p.vendor.name : 'HDG Inventory';
 
        // Net cost (purchase price)
        const netUnit = (opts.netCostOverride != null && opts.netCostOverride !== '')
          ? parseFloat(opts.netCostOverride)
          : parseFloat(opts.msrp || 0) * (1 - (parseFloat(opts.discountPercent) || 0) / 100);
        const netTotal = netUnit * qty;
 
        // Sell price
        const msrp = parseFloat(opts.msrp) || 0;
        const markup = parseFloat(opts.markupPercent) || 0;
        const sellUnit = msrp * (1 + markup / 100);
        const sellTotal = sellUnit * qty;
 
        // Sales tax
        const taxRate = parseFloat(opts.salesTaxRate) || 0;
        const tax = taxRate > 0 ? sellTotal * (taxRate / 100) : 0;
        const grandTotal = sellTotal + tax;
 
        grandTotalNetCost += netTotal;
        grandTotalSell += sellTotal;
        grandTotalTax += tax;
 
        // PO# lookup
        const poNumber = (p.product_id && productPoMap.has(p.product_id))
          ? productPoMap.get(p.product_id)
          : (opts.poNumber || '');
 
        const money = (n) => ({ type: 'number', value: n, numFmt: '"$"#,##0.00' });
 
        const rowData = [
          clientName, unitNumber, vendorName, p.name || '', p.product_id || '',
          opts.room || p.category || '', qty,
          money(netUnit), money(netTotal),
          money(sellUnit), money(sellTotal),
          money(tax), money(grandTotal),
          poNumber,
          opts.finish || '', opts.fabric || '', opts.size || '',
          opts.leadTime || '', orderStatus,
        ];
 
        rowData.forEach((val, i) => {
          const cell = ws.getCell(rowNum, i + 1);
          if (val && typeof val === 'object' && 'numFmt' in val) {
            cell.value = val.value;
            cell.numFmt = val.numFmt;
          } else {
            cell.value = val;
          }
          cell.font = dataFont;
          cell.border = thinBorder;
          cell.alignment = wrapTop;
        });
 
        ws.getRow(rowNum).height = 18;
        rowNum++;
      });
    });
 
    // Totals row
    ws.mergeCells(`A${rowNum}:G${rowNum}`);
    ws.getCell(`A${rowNum}`).value = 'TOTAL';
    ws.getCell(`A${rowNum}`).font = { name: 'Arial', bold: true, size: 10 };
    ws.getCell(`A${rowNum}`).alignment = { horizontal: 'right', vertical: 'middle' };
 
    [
      { col: 9, val: grandTotalNetCost },
      { col: 11, val: grandTotalSell },
      { col: 12, val: grandTotalTax },
      { col: 13, val: grandTotalSell + grandTotalTax },
    ].forEach(({ col, val }) => {
      const cell = ws.getCell(rowNum, col);
      cell.value = val;
      cell.numFmt = '"$"#,##0.00';
      cell.font = { name: 'Arial', bold: true, size: 10 };
      cell.border = { top: { style: 'double' } };
    });
 
    ws.getRow(rowNum).height = 22;
 
    const filename = `HDG - All Products Report - ${new Date().toISOString().slice(0,10)}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    await wb.xlsx.write(res);
    res.end();
 
  } catch (error) {
    console.error('❌ generateAllProductsReport error:', error);
    res.status(500).json({ message: error.message });
  }
};

// ─── Bulk PO Export — Excel (2 sheets: Summary + Detail) ────────────────────
const generateBulkExport = async (req, res) => {
  try {
    const ExcelJS = require('exceljs');
    const mongoose = require('mongoose');
    const { orderIds } = req.body;
    if (!Array.isArray(orderIds) || orderIds.length === 0) {
      return res.status(400).json({ message: 'No order IDs provided' });
    }

    const orders = await Order.find({ _id: { $in: orderIds } }).lean();
    orders.sort((a, b) =>
      (a.clientInfo?.unitNumber || '').localeCompare(b.clientInfo?.unitNumber || '', undefined, { numeric: true })
    );

    // Fetch ALL PO versions for each order (vendor can have multiple versions)
    const posByOrder = new Map();
    await Promise.all(orders.map(async (order) => {
      const oid = mongoose.Types.ObjectId.isValid(order._id) ? new mongoose.Types.ObjectId(order._id) : order._id;
      const allPOs = await POVersion.find({ orderId: oid }).sort({ vendorId: 1, version: 1 }).lean();
      posByOrder.set(order._id.toString(), allPOs);
    }));

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Henderson Design Group';

    const thinBorder = {
      top: { style: 'thin' }, left: { style: 'thin' },
      bottom: { style: 'thin' }, right: { style: 'thin' },
    };
    const wrapTop = { vertical: 'top', wrapText: true };
    const money = (n) => ({ value: isNaN(parseFloat(n)) ? 0 : parseFloat(n), numFmt: '"$"#,##0.00' });

    // ── Sheet 1: Summary ──────────────────────────────────────────────────────
    const summaryWs = wb.addWorksheet('Summary');
    // Columns: Client | Unit | Vendor | PO # | Ver | Order Date | PO Status | Total
    [20, 8, 24, 14, 6, 13, 14, 14].forEach((w, i) => { summaryWs.getColumn(i + 1).width = w; });
    summaryWs.mergeCells('A1:H1');
    summaryWs.getCell('A1').value = `Henderson Design Group — Combined PO Export — ${new Date().toLocaleDateString('en-US')}`;
    summaryWs.getCell('A1').font = { name: 'Arial', bold: true, size: 12, color: { argb: 'FF005670' } };
    summaryWs.getCell('A1').alignment = { vertical: 'middle', horizontal: 'left' };
    summaryWs.getRow(1).height = 26;

    ['Client', 'Unit', 'Vendor', 'PO #', 'Ver', 'Order Date', 'PO Status', 'Total PO Cost'].forEach((h, i) => {
      const cell = summaryWs.getCell(2, i + 1);
      cell.value = h;
      cell.font = { name: 'Arial', bold: true, size: 9, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF005670' } };
      cell.border = thinBorder;
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });
    summaryWs.getRow(2).height = 22;
    let summaryRow = 3;
    let grandTotal = 0;

    // ── Sheet 2: Detail ───────────────────────────────────────────────────────
    const DCOLS = [
      'Client', 'Unit', 'Vendor', 'PO #', 'Order Date', 'Account #', 'Rep Name',
      'Product Name', 'SKU', 'Qty',
      'Specs / Description', 'Color / Finish', 'Material / Fabric',
      'Dimensions', 'Lead Time', 'Sidemark',
      'Unit Cost', 'Total Cost',
    ];
    const DWIDTHS = [20, 8, 22, 14, 13, 14, 18, 28, 14, 6, 30, 16, 16, 14, 12, 20, 13, 13];

    const detailWs = wb.addWorksheet('Detail');
    DWIDTHS.forEach((w, i) => { detailWs.getColumn(i + 1).width = w; });
    detailWs.mergeCells(1, 1, 1, DCOLS.length);
    detailWs.getCell('A1').value = `Henderson Design Group — PO Detail — ${new Date().toLocaleDateString('en-US')}`;
    detailWs.getCell('A1').font = { name: 'Arial', bold: true, size: 12, color: { argb: 'FF005670' } };
    detailWs.getCell('A1').alignment = { vertical: 'middle', horizontal: 'left' };
    detailWs.getRow(1).height = 26;
    DCOLS.forEach((h, i) => {
      const cell = detailWs.getCell(2, i + 1);
      cell.value = h;
      cell.font = { name: 'Arial', bold: true, size: 9, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF005670' } };
      cell.border = thinBorder;
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    });
    detailWs.getRow(2).height = 22;
    let detailRow = 3;

    // ── Populate both sheets ──────────────────────────────────────────────────
    orders.forEach(order => {
      const clientName = order.clientInfo?.name || 'Unknown';
      const unitNumber = order.clientInfo?.unitNumber || '';
      const pos = posByOrder.get(order._id.toString()) || [];
      let orderTotal = 0;

      // Client separator row in Detail sheet
      detailWs.mergeCells(detailRow, 1, detailRow, DCOLS.length);
      const clientCell = detailWs.getCell(detailRow, 1);
      clientCell.value = `${clientName}${unitNumber ? '  ·  Unit ' + unitNumber : ''}`;
      clientCell.font = { name: 'Arial', bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
      clientCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF005670' } };
      clientCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
      detailWs.getRow(detailRow).height = 20;
      detailRow++;

      pos.forEach(po => {
        const vendorName = po.vendorInfo?.name || 'Unknown Vendor';
        const poNumber = po.poNumber || '';
        const poVersion = po.version || 1;
        const poStatus = po.status || 'draft';
        const orderDate = po.orderDate ? new Date(po.orderDate).toLocaleDateString('en-US') : '';

        // Vendor/version sub-header in Detail
        detailWs.mergeCells(detailRow, 1, detailRow, DCOLS.length);
        const vhCell = detailWs.getCell(detailRow, 1);
        vhCell.value = `  ${vendorName}${poNumber ? '  ·  PO #: ' + poNumber : ''}  ·  v${poVersion}  ·  ${poStatus.toUpperCase()}`;
        vhCell.font = { name: 'Arial', bold: true, size: 9, color: { argb: 'FFFFFFFF' } };
        vhCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } };
        vhCell.alignment = { vertical: 'middle', horizontal: 'left' };
        detailWs.getRow(detailRow).height = 18;
        detailRow++;

        let poTotal = 0;
        (po.products || []).forEach(p => {
          const qty = parseFloat(p.quantity) || 1;
          const unitCost = parseFloat(p.unitPrice) || 0;
          const totalCost = parseFloat(p.totalPrice) || unitCost * qty;
          poTotal += totalCost;
          const opts = p.selectedOptions || {};

          const rowData = [
            clientName, unitNumber, vendorName, poNumber, orderDate,
            po.accountNumber || '', po.repName || '',
            p.name || '', p.product_id || '', qty,
            opts.specifications || p.description || '',
            opts.finish || '', opts.fabric || '', opts.size || '',
            opts.leadTime || '', opts.sidemark || '',
            money(unitCost), money(totalCost),
          ];
          rowData.forEach((val, i) => {
            const cell = detailWs.getCell(detailRow, i + 1);
            if (val && typeof val === 'object' && 'numFmt' in val) {
              cell.value = val.value; cell.numFmt = val.numFmt;
            } else { cell.value = val; }
            cell.font = { name: 'Arial', size: 9 };
            cell.border = thinBorder;
            cell.alignment = wrapTop;
          });
          detailWs.getRow(detailRow).height = 18;
          detailRow++;
        });

        const shipping = parseFloat(po.shipping) || 0;
        const others = parseFloat(po.others) || 0;
        const savedTotal = parseFloat(po.total) || 0;
        const vendorTotal = savedTotal || (poTotal + shipping + others);
        orderTotal += vendorTotal;

        // PO total row in Detail
        detailWs.mergeCells(detailRow, 1, detailRow, DCOLS.length - 1);
        detailWs.getCell(detailRow, 1).value = `PO Total — ${vendorName} v${poVersion}`;
        detailWs.getCell(detailRow, 1).font = { name: 'Arial', bold: true, size: 9 };
        detailWs.getCell(detailRow, 1).alignment = { horizontal: 'right' };
        const vtCell = detailWs.getCell(detailRow, DCOLS.length);
        vtCell.value = vendorTotal; vtCell.numFmt = '"$"#,##0.00';
        vtCell.font = { name: 'Arial', bold: true, size: 9 };
        vtCell.border = { top: { style: 'thin' } };
        detailWs.getRow(detailRow).height = 16;
        detailRow++;

        // Summary: one row per PO version — use po.status, not order.status
        // Columns: Client | Unit | Vendor | PO # | Ver | Order Date | PO Status | Total
        [clientName, unitNumber, vendorName, poNumber, `v${poVersion}`, orderDate, poStatus, money(vendorTotal)].forEach((val, i) => {
          const cell = summaryWs.getCell(summaryRow, i + 1);
          if (val && typeof val === 'object' && 'numFmt' in val) {
            cell.value = val.value; cell.numFmt = val.numFmt;
          } else { cell.value = val; }
          cell.font = { name: 'Arial', size: 9 };
          cell.border = thinBorder;
          cell.alignment = { vertical: 'middle' };
        });
        summaryWs.getRow(summaryRow).height = 18;
        summaryRow++;
        grandTotal += vendorTotal;
      });

      // Order total row in Detail
      detailWs.mergeCells(detailRow, 1, detailRow, DCOLS.length - 1);
      detailWs.getCell(detailRow, 1).value = `Order Total — ${clientName}${unitNumber ? ' Unit ' + unitNumber : ''}`;
      detailWs.getCell(detailRow, 1).font = { name: 'Arial', bold: true, size: 10 };
      detailWs.getCell(detailRow, 1).alignment = { horizontal: 'right', vertical: 'middle' };
      const otCell = detailWs.getCell(detailRow, DCOLS.length);
      otCell.value = orderTotal; otCell.numFmt = '"$"#,##0.00';
      otCell.font = { name: 'Arial', bold: true, size: 10 };
      otCell.border = { top: { style: 'double' } };
      detailWs.getRow(detailRow).height = 20;
      detailRow++;
    });

    // Grand total in Summary — 8-col layout: label spans cols 1-7, value in col 8
    summaryWs.mergeCells(summaryRow, 1, summaryRow, 7);
    summaryWs.getCell(summaryRow, 1).value = 'GRAND TOTAL';
    summaryWs.getCell(summaryRow, 1).font = { name: 'Arial', bold: true, size: 10 };
    summaryWs.getCell(summaryRow, 1).alignment = { horizontal: 'right', vertical: 'middle' };
    const grandSumCell = summaryWs.getCell(summaryRow, 8);
    grandSumCell.value = grandTotal; grandSumCell.numFmt = '"$"#,##0.00';
    grandSumCell.font = { name: 'Arial', bold: true, size: 10 };
    grandSumCell.border = { top: { style: 'double' } };
    summaryWs.getRow(summaryRow).height = 22;

    const filename = `Alia - Combined PO Export - ${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    await wb.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('❌ generateBulkExport error:', error);
    res.status(500).json({ message: 'Failed to generate bulk PO export', detail: error.message });
  }
};

// ─── Get available vendors for selected orders (for PDF vendor picker) ───────
const getAvailablePOVendors = async (req, res) => {
  try {
    const mongoose = require('mongoose');
    const { orderIds } = req.body;
    if (!Array.isArray(orderIds) || orderIds.length === 0) {
      return res.status(400).json({ message: 'No order IDs provided' });
    }
    const oids = orderIds.map(id => new mongoose.Types.ObjectId(id));
    const allPOs = await POVersion.find({ orderId: { $in: oids } }).sort({ version: -1 }).lean();
    const vendorMap = new Map();
    allPOs.forEach(po => {
      const vid = po.vendorId?.toString();
      if (vid && !vendorMap.has(vid)) {
        vendorMap.set(vid, { vendorId: vid, vendorName: po.vendorInfo?.name || 'Unknown Vendor' });
      }
    });
    const vendors = Array.from(vendorMap.values()).sort((a, b) => a.vendorName.localeCompare(b.vendorName));
    res.json({ success: true, vendors });
  } catch (error) {
    console.error('❌ getAvailablePOVendors error:', error);
    res.status(500).json({ message: error.message });
  }
};

// ─── Bulk PO HTML (selected orders + selected vendor → combined PO PDF) ──────
const generateBulkPO = async (req, res) => {
  try {
    const mongoose = require('mongoose');
    const { orderIds, vendorId } = req.body;
    if (!Array.isArray(orderIds) || orderIds.length === 0) {
      return res.status(400).json({ message: 'No order IDs provided' });
    }
    if (!vendorId) {
      return res.status(400).json({ message: 'No vendor selected' });
    }

    const orders = await Order.find({ _id: { $in: orderIds } }).lean();
    orders.sort((a, b) =>
      (a.clientInfo?.unitNumber || '').localeCompare(b.clientInfo?.unitNumber || '', undefined, { numeric: true })
    );

    const escHtml = (text) => {
      if (!text) return '';
      return String(text)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    };
    const fmtMoney = (n) => {
      const num = parseFloat(n) || 0;
      return '$' + num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    // Fetch ALL PO versions for the selected vendor per order (sorted oldest→newest)
    const vendorOid = new mongoose.Types.ObjectId(vendorId);
    const posByOrder = new Map();
    await Promise.all(orders.map(async (order) => {
      const oid = mongoose.Types.ObjectId.isValid(order._id) ? new mongoose.Types.ObjectId(order._id) : order._id;
      const pos = await POVersion.find({ orderId: oid, vendorId: vendorOid }).sort({ version: 1 }).lean();
      posByOrder.set(order._id.toString(), pos);
    }));

    const printedDate = new Date().toLocaleDateString('en-US');

    const buildPoPage = (po, order) => {
      const vi = po.vendorInfo || {};
      const st = po.shipTo || {};
      const vendorAddrLine = [vi.address?.city, vi.address?.state, vi.address?.zip].filter(Boolean).join(', ');
      const orderDate = po.orderDate ? new Date(po.orderDate).toLocaleDateString('en-US') : '';
      const clientName = po.clientInfo?.name || order.clientInfo?.name || '';
      const subTotal = parseFloat(po.subTotal) || 0;
      const shipping = parseFloat(po.shipping) || 0;
      const others = parseFloat(po.others) || 0;
      const total = parseFloat(po.total) || (subTotal + shipping + others);

      const productRows = (po.products || []).map(p => {
        const opts = p.selectedOptions || {};
        const qty = parseFloat(p.quantity) || 1;
        const unitCost = parseFloat(p.unitPrice) || 0;
        const totalCost = parseFloat(p.totalPrice) || unitCost * qty;
        const imgSrc = opts.uploadedImages?.[0]?.url || opts.image || opts.images?.[0] || null;
        const specs = opts.specifications || p.description || '';
        const sidemark = opts.sidemark || opts.spotName || p.spotName || '';

        return `<tr>
            <td class="img-cell">
              ${imgSrc
                ? `<img src="${escHtml(imgSrc)}" alt="${escHtml(p.name)}" onerror="this.style.display='none'">`
                : '<div class="img-placeholder">No Image</div>'}
            </td>
            <td class="desc-cell">
              <div class="desc-row"><span class="desc-label">Quantity</span><span class="desc-val">${qty} ${opts.units || 'Each'}</span></div>
              ${specs ? `<div class="desc-row"><span class="desc-label">Specs</span><span class="desc-val" style="white-space:pre-wrap">${escHtml(specs).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')}</span></div>` : ''}
              ${p.name ? `<div class="desc-row"><span class="desc-label">Name</span><span class="desc-val">${escHtml(p.name)}</span></div>` : ''}
              ${p.product_id ? `<div class="desc-row"><span class="desc-label">SKU</span><span class="desc-val">${escHtml(p.product_id)}</span></div>` : ''}
              ${opts.size ? `<div class="desc-row"><span class="desc-label">Dimensions</span><span class="desc-val">${escHtml(opts.size)}</span></div>` : ''}
              ${opts.fabric ? `<div class="desc-row"><span class="desc-label">Material</span><span class="desc-val">${escHtml(opts.fabric)}</span></div>` : ''}
              ${opts.finish ? `<div class="desc-row"><span class="desc-label">Color</span><span class="desc-val">${escHtml(opts.finish)}</span></div>` : ''}
              ${opts.leadTime ? `<div class="desc-row"><span class="desc-label">Lead Time</span><span class="desc-val">${escHtml(opts.leadTime)}</span></div>` : ''}
              ${sidemark ? `<div class="sidemark-strip"><span class="desc-label">Sidemark</span> ${escHtml(sidemark)}</div>` : ''}
            </td>
            <td class="price-cell">${fmtMoney(unitCost)}</td>
            <td class="price-cell">${fmtMoney(totalCost)}</td>
          </tr>`;
      }).join('');

      const additionalRows = (po.additionalLines || [])
        .filter(al => al.description || al.amount)
        .map(al => `<tr class="totals-row">
            <td colspan="2"></td>
            <td class="price-cell label">${escHtml(al.lineType || 'Additional')}: ${escHtml(al.description || '')}</td>
            <td class="price-cell">${fmtMoney(al.amount)}</td>
          </tr>`).join('');

      const versionBadge = po.version ? `<span class="version-badge">v${po.version}${po.status ? ' · ' + po.status.toUpperCase() : ''}</span>` : '';

      return `<div class="po-page">
          <div class="co-header">
            <div style="font-size:11px;line-height:1.5;color:#333">
              <div>4343 Royal Place</div>
              <div>Honolulu, HI 96816</div>
              <div>(808) 315-8782</div>
            </div>
            <div style="text-align:right">
              <img src="/images/HDG-Logo.png" alt="Henderson Design Group" class="hdg-logo">
            </div>
          </div>

          <h2 class="po-title">Purchase Order ${versionBadge}</h2>

          <div class="info-grid">
            <div class="info-left">
              <div class="field-label">To:</div>
              ${vi.name ? `<div style="font-weight:500">${escHtml(vi.name)}</div>` : ''}
              ${vi.address?.street ? `<div>${escHtml(vi.address.street)}</div>` : ''}
              ${vendorAddrLine ? `<div>${escHtml(vendorAddrLine)}</div>` : ''}
              ${vi.representativeName ? `<div><span class="field-label">Attention: </span>${escHtml(vi.representativeName)}</div>` : ''}
              ${vi.contactInfo?.phone ? `<div><span class="field-label">Phone: </span>${escHtml(vi.contactInfo.phone)}${vi.contactInfo?.fax ? `  <span class="field-label">Fax: </span>${escHtml(vi.contactInfo.fax)}` : ''}</div>` : ''}

              <div class="field-label" style="margin-top:8px">Ship To:</div>
              ${st.name ? `<div>${escHtml(st.name)}</div>` : ''}
              ${st.address ? `<div>${escHtml(st.address)}</div>` : ''}
              ${st.city ? `<div>${escHtml(st.city)}</div>` : ''}
              ${st.attention ? `<div><span class="field-label">Attention: </span>${escHtml(st.attention)}</div>` : ''}
              ${st.phone ? `<div><span class="field-label">Phone: </span>${escHtml(st.phone)}</div>` : ''}

              ${po.comments ? `<div style="margin-top:6px"><span class="field-label">Comments: </span>${escHtml(po.comments)}</div>` : ''}
              ${po.notes ? `<div><span class="field-label">Notes: </span>${escHtml(po.notes)}</div>` : ''}
            </div>
            <div class="info-right">
              ${[
                ['Order #:', po.poNumber],
                ['Version:', po.version ? `v${po.version}` : null],
                ['Status:', po.status ? po.status.toUpperCase() : null],
                ['Order Date:', orderDate],
                ['Printed Date:', printedDate],
                ['Account Number:', po.accountNumber],
                ['Rep Name:', po.repName],
                ['Rep Phone:', po.repPhone],
                ['Rep Email:', po.repEmail],
                ['Terms:', po.terms],
                ['Client:', clientName],
                ['Estimate #:', po.estimateNumber],
              ].map(([label, val]) => val ? `<div class="detail-row"><span class="field-label">${escHtml(label)}</span><span>${escHtml(val)}</span></div>` : '').join('')}
            </div>
          </div>

          <table class="po-table">
            <thead>
              <tr>
                <th style="width:120px"></th>
                <th>Description</th>
                <th class="price-head" style="width:100px">Unit Cost</th>
                <th class="price-head" style="width:100px">Total Cost</th>
              </tr>
            </thead>
            <tbody>
              ${productRows}
              ${additionalRows}
              <tr class="totals-row"><td colspan="2"></td><td class="price-cell label">Sub Total:</td><td class="price-cell">${fmtMoney(subTotal)}</td></tr>
              ${shipping ? `<tr class="totals-row"><td colspan="2"></td><td class="price-cell label">Shipping:</td><td class="price-cell">${fmtMoney(shipping)}</td></tr>` : ''}
              ${others ? `<tr class="totals-row"><td colspan="2"></td><td class="price-cell label">Others:</td><td class="price-cell">${fmtMoney(others)}</td></tr>` : ''}
              <tr class="totals-row total-final"><td colspan="2"></td><td class="price-cell label">Total:</td><td class="price-cell">${fmtMoney(total)}</td></tr>
            </tbody>
          </table>
        </div>`;
    };

    const poPages = [];
    orders.forEach(order => {
      const pos = posByOrder.get(order._id.toString()) || [];
      pos.forEach(po => {
        poPages.push(buildPoPage(po, order));
      });
    });

    const totalPOs = poPages.length;
    const origin = req.headers.origin || req.headers.referer?.replace(/\/$/, '') || '';

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  ${origin ? `<base href="${origin}/">` : ''}
  <style>
    @page { size: letter portrait; margin: 0.5in; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; font-size: 11px; background: #b8b8b8; }
    @media print {
      body { background: white; }
      .no-print { display: none !important; }
      * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    }
    .no-print { position: fixed; top: 0; left: 0; right: 0; z-index: 999; background: #005670; color: white; padding: 10px 20px; display: flex; align-items: center; justify-content: space-between; font-family: Arial, sans-serif; }
    .print-btn { padding: 8px 18px; background: white; color: #005670; border: none; border-radius: 6px; font-weight: 700; font-size: 13px; cursor: pointer; }
    .pages-wrap { padding: 60px 0 20px; }
    .po-page { background: white; width: 8.5in; min-height: 11in; padding: 0.5in; margin: 0 auto 20px; box-shadow: 0 0 10px rgba(0,0,0,0.15); page-break-after: always; }
    .po-page:last-child { page-break-after: avoid; }
    .co-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; }
    .hdg-logo { height: 40px; width: auto; filter: brightness(0) saturate(100%) invert(21%) sepia(98%) saturate(1160%) hue-rotate(160deg) brightness(92%) contrast(90%); }
    .po-title { font-size: 16px; font-weight: bold; margin: 10px 0 8px; color: #222; border-bottom: 2px solid #333; padding-bottom: 5px; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0; border-bottom: 1px solid #ccc; padding-bottom: 10px; margin-bottom: 10px; }
    .info-left { padding-right: 20px; border-right: 1px solid #ccc; font-size: 11px; line-height: 1.6; }
    .info-right { padding-left: 20px; font-size: 11px; }
    .field-label { font-weight: bold; font-size: 11px; color: #333; }
    .detail-row { display: flex; justify-content: space-between; gap: 8px; padding: 1px 0; }
    .po-table { width: 100%; border-collapse: collapse; font-size: 11px; border: 1px solid #999; table-layout: fixed; }
    .po-table th { background: #666; color: white; padding: 6px 10px; text-align: left; font-weight: 600; font-size: 10px; }
    .price-head { text-align: right; }
    .po-table td { padding: 10px; vertical-align: top; word-wrap: break-word; }
    .po-table tbody tr + tr td { border-top: 1px solid #f0f0f0; }
    .img-cell { width: 120px; text-align: center; vertical-align: middle; padding: 8px; }
    .img-cell img { max-width: 110px; max-height: 110px; object-fit: contain; display: block; margin: 0 auto; }
    .img-placeholder { width: 110px; height: 110px; background: #f5f5f5; display: flex; align-items: center; justify-content: center; font-size: 8px; color: #999; border: 1px solid #eee; margin: 0 auto; }
    .desc-cell { padding: 10px; }
    .desc-row { display: block; padding: 3px 0; font-size: 11px; border-bottom: 1px dotted #eee; }
    .desc-row:last-child { border-bottom: none; }
    .desc-label { font-weight: 700; color: #444; font-size: 10px; text-transform: uppercase; letter-spacing: 0.3px; margin-right: 4px; }
    .desc-label::after { content: ':'; }
    .desc-val { color: #222; font-size: 11px; word-break: break-word; }
    .sidemark-strip { display: block; margin-top: 5px; padding-top: 5px; border-top: 1px dashed #ccc; font-size: 10px; }
    .price-cell { text-align: right; width: 100px; font-size: 11px; white-space: nowrap; }
    .price-cell.label { text-align: right; font-weight: bold; color: #333; font-size: 11px; }
    .totals-row td { border: none !important; padding: 2px 10px; }
    .total-final td { border-top: 2px solid #333 !important; font-weight: bold; font-size: 12px; }
    .version-badge { font-size: 11px; font-weight: normal; background: #e2e8f0; color: #334155; border-radius: 4px; padding: 2px 8px; margin-left: 8px; vertical-align: middle; }
  </style>
</head>
<body>
  <div class="no-print">
    <span style="font-size:14px;font-weight:bold">Combined Purchase Orders — ${totalPOs} PO${totalPOs !== 1 ? 's' : ''} (${orders.length} unit${orders.length !== 1 ? 's' : ''})</span>
    <div style="display:flex;align-items:center;gap:16px">
      <span style="font-size:11px;opacity:0.8">Margins: None · Background Graphics: On · Orientation: Portrait</span>
      <button class="print-btn" onclick="window.print()">Print / Save PDF</button>
    </div>
  </div>
  <div class="pages-wrap">
    ${poPages.join('\n')}
  </div>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (error) {
    console.error('❌ generateBulkPO error:', error);
    res.status(500).json({ message: 'Failed to generate bulk PO' });
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
  generateInstallBinderExcel,
  generateStatusReport,
  getUploadPresignedUrl,
  generateCogExcel,
  generateCogWithBill,
  getLatestConfirmedPOs,
  saveCurrentVersion,
  generateAllProductsReport,
  generateBulkExport,
  generateBulkPO,
  getAvailablePOVendors,
};