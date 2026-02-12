const Order = require('../models/Order');
const POVersion = require('../models/POversion');
const Vendor = require('../models/Vendor');

// ✅ GET vendors for an order (grouped products by vendor)
// @route GET /api/orders/:orderId/po/vendors
const getOrderVendors = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findById(orderId)
      .populate('selectedProducts.vendor', 'name vendorCode address contactInfo representativeName accountNumber')
      .lean();

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const products = order.selectedProducts || [];

    // Group products by vendor
    const vendorMap = {};

    products.forEach((product) => {
      const vendorId = product.vendor?._id?.toString() || 'no-vendor';
      const vendorName = product.vendor?.name || 'No Vendor Assigned';

      if (!vendorMap[vendorId]) {
        vendorMap[vendorId] = {
          vendorId: vendorId === 'no-vendor' ? null : vendorId,
          vendorName,
          vendorInfo: product.vendor || null,
          products: [],
          totalAmount: 0,
          productCount: 0
        };
      }

      const totalPrice = (product.unitPrice || 0) * (product.quantity || 1);
      vendorMap[vendorId].products.push({
        ...product,
        totalPrice
      });
      vendorMap[vendorId].totalAmount += totalPrice;
      vendorMap[vendorId].productCount += 1;
    });

    // Check existing PO versions for each vendor
    const vendorGroups = await Promise.all(
      Object.values(vendorMap).map(async (group) => {
        if (group.vendorId) {
          const latestPO = await POVersion.findOne(
            { orderId, vendorId: group.vendorId },
            { version: 1, status: 1, poNumber: 1, createdAt: 1 },
            { sort: { version: -1 } }
          ).lean();

          group.latestPO = latestPO || null;
        }
        return group;
      })
    );

    res.json({
      success: true,
      data: {
        orderId,
        clientInfo: order.clientInfo,
        vendors: vendorGroups
      }
    });

  } catch (error) {
    console.error('❌ Error getOrderVendors:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ Helper: Map Vendor model to PO vendorInfo format
const mapVendorToInfo = (vendor) => {
  if (!vendor) return {};

  return {
    name: vendor.name || '',
    vendorCode: vendor.vendorCode || '',
    representativeName: vendor.representativeName || '',
    website: vendor.website || '',
    address: {
      street: vendor.address?.street || '',
      city: vendor.address?.city || '',
      state: vendor.address?.state || '',
      zip: vendor.address?.zip || '',
      country: vendor.address?.country || ''
    },
    contactInfo: {
      phone: vendor.contactInfo?.phone || '',
      email: vendor.contactInfo?.email || '',
      fax: vendor.contactInfo?.fax || ''
    },
    accountNumber: vendor.accountNumber || ''
  };
};

// ✅ GET or CREATE PO for a specific vendor
// @route GET /api/orders/:orderId/po/:vendorId/:version?
const getPurchaseOrder = async (req, res) => {
  try {
    const { orderId, vendorId } = req.params;
    const version = req.params.version || 'latest';

    let poVersion;

    if (version === 'latest') {
      poVersion = await POVersion.findOne(
        { orderId, vendorId },
        {},
        { sort: { version: -1 } }
      ).populate('createdBy', 'name email').lean();
    } else {
      poVersion = await POVersion.findOne(
        { orderId, vendorId, version: parseInt(version) }
      ).populate('createdBy', 'name email').lean();
    }

    // If no PO exists, create initial version from order data
    if (!poVersion) {
      const order = await Order.findById(orderId)
        .populate('selectedProducts.vendor')
        .populate('user', 'name email')
        .lean();

      if (!order) {
        return res.status(404).json({ success: false, message: 'Order not found' });
      }

      // Get vendor info
      const vendor = await Vendor.findById(vendorId).lean();
      if (!vendor) {
        return res.status(404).json({ success: false, message: 'Vendor not found' });
      }

      // Filter products for this vendor
      const vendorProducts = (order.selectedProducts || []).filter(
        (p) => p.vendor?._id?.toString() === vendorId || p.vendor?.toString() === vendorId
      );

      if (vendorProducts.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'No products found for this vendor in this order'
        });
      }

      // Build product list with descriptions
      const poProducts = vendorProducts.map((product) => {
        const specs = [];
        if (product.selectedOptions?.specifications) specs.push(product.selectedOptions.specifications);
        if (product.selectedOptions?.finish) specs.push(`Finish: ${product.selectedOptions.finish}`);
        if (product.selectedOptions?.fabric) specs.push(`Fabric: ${product.selectedOptions.fabric}`);
        if (product.selectedOptions?.size) specs.push(`Size: ${product.selectedOptions.size}`);
        if (product.selectedOptions?.insetPanel) specs.push(`Inset Panel: ${product.selectedOptions.insetPanel}`);

        const totalPrice = (product.unitPrice || 0) * (product.quantity || 1);

        return {
          product_id: product.product_id || '',
          name: product.name || '',
          category: product.category || '',
          spotName: product.spotName || '',
          quantity: product.quantity || 1,
          unitPrice: product.unitPrice || 0,
          totalPrice,
          description: specs.join('\n') || '',
          selectedOptions: {
            finish: product.selectedOptions?.finish || '',
            fabric: product.selectedOptions?.fabric || '',
            size: product.selectedOptions?.size || '',
            insetPanel: product.selectedOptions?.insetPanel || '',
            specifications: product.selectedOptions?.specifications || '',
            image: product.selectedOptions?.image || '',
            images: product.selectedOptions?.images || [],
            notes: product.selectedOptions?.notes || '',
            poNumber: product.selectedOptions?.poNumber || '',
          }
        };
      });

      const subTotal = poProducts.reduce((sum, p) => sum + p.totalPrice, 0);

      // Generate PO Number
      const clientCode = order.clientInfo?.name?.substring(0, 3)?.toUpperCase() || 'HDG';
      const dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, '');
      const poNumber = `${clientCode}-${dateStr}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;

      // ✅ Map vendor info correctly
      const vendorInfo = mapVendorToInfo(vendor);

      // Create initial PO version
      poVersion = await POVersion.create({
        orderId,
        vendorId,
        version: 1,
        poNumber,
        orderDate: new Date(),
        accountNumber: vendor.accountNumber || '',
        repName: vendor.representativeName || '',
        repPhone: vendor.contactInfo?.phone || '',
        repEmail: vendor.contactInfo?.email || '',
        terms: vendor.termsAndPayment?.terms || '',
        estimateNumber: '',
        shipTo: {
          name: 'HFS - SF (SHIP TO ONLY) - PRIMARY',
          address: '2964 Alvarado Street',
          city: 'San Leandro, CA 94577',
          attention: '',
          phone: '(800) 576-7621'
        },
        clientInfo: order.clientInfo || {},
        vendorInfo,
        products: poProducts,
        subTotal,
        shipping: 0,
        others: 0,
        total: subTotal,
        comments: '',
        notes: '',
        versionNotes: 'Initial PO version (auto-generated)',
        status: 'draft',
        createdBy: req.user.id
      });

      poVersion = poVersion.toObject();
    }

    res.json({
      success: true,
      data: poVersion
    });

  } catch (error) {
    console.error('❌ Error getPurchaseOrder:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ UPDATE existing PO version
// @route PUT /api/orders/:orderId/po/:vendorId
const updatePurchaseOrder = async (req, res) => {
  try {
    const { orderId, vendorId } = req.params;
    const { version, products, vendorInfo, shipTo, comments, notes, 
            poNumber, accountNumber, repName, repPhone, repEmail, 
            terms, estimateNumber, shipping, others, status, clientInfo } = req.body;

    const poVersion = await POVersion.findOne({ orderId, vendorId, version });

    if (!poVersion) {
      return res.status(404).json({ success: false, message: 'PO version not found' });
    }

    // Update fields
    if (products) {
      poVersion.products = products;
      poVersion.subTotal = products.reduce((sum, p) => sum + (p.totalPrice || 0), 0);
    }
    if (vendorInfo) poVersion.vendorInfo = vendorInfo;
    if (shipTo) poVersion.shipTo = shipTo;
    if (clientInfo) poVersion.clientInfo = clientInfo;
    if (comments !== undefined) poVersion.comments = comments;
    if (notes !== undefined) poVersion.notes = notes;
    if (poNumber !== undefined) poVersion.poNumber = poNumber;
    if (accountNumber !== undefined) poVersion.accountNumber = accountNumber;
    if (repName !== undefined) poVersion.repName = repName;
    if (repPhone !== undefined) poVersion.repPhone = repPhone;
    if (repEmail !== undefined) poVersion.repEmail = repEmail;
    if (terms !== undefined) poVersion.terms = terms;
    if (estimateNumber !== undefined) poVersion.estimateNumber = estimateNumber;
    if (shipping !== undefined) poVersion.shipping = shipping;
    if (others !== undefined) poVersion.others = others;
    if (status) poVersion.status = status;

    // Recalculate total
    poVersion.total = poVersion.subTotal + (poVersion.shipping || 0) + (poVersion.others || 0);

    await poVersion.save();

    // ✅ Sync PO number back to order products
    if (products && products.length > 0 && poNumber) {
      try {
        const order = await Order.findById(orderId);
        if (order) {
          let changed = false;
          products.forEach((poProduct) => {
            const orderProduct = order.selectedProducts.find(
              (p) => p.product_id === poProduct.product_id && p.name === poProduct.name
            );
            if (orderProduct) {
              if (!orderProduct.selectedOptions) orderProduct.selectedOptions = {};
              if (orderProduct.selectedOptions.poNumber !== poNumber) {
                orderProduct.selectedOptions.poNumber = poNumber;
                changed = true;
              }
            }
          });
          if (changed) await order.save();
        }
      } catch (syncError) {
        console.error('⚠️ Error syncing PO number to order:', syncError);
      }
    }

    res.json({
      success: true,
      data: poVersion
    });

  } catch (error) {
    console.error('❌ Error updatePurchaseOrder:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ CREATE new PO version
// @route POST /api/orders/:orderId/po/:vendorId/new-version
const createPOVersion = async (req, res) => {
  try {
    const { orderId, vendorId } = req.params;
    const { products, vendorInfo, shipTo, comments, notes, versionNotes,
            poNumber, accountNumber, repName, repPhone, repEmail, 
            terms, estimateNumber, shipping, others, clientInfo } = req.body;

    if (!versionNotes?.trim()) {
      return res.status(400).json({ success: false, message: 'Version notes are required' });
    }

    // Get next version number
    const latestVersion = await POVersion.findOne(
      { orderId, vendorId },
      { version: 1 },
      { sort: { version: -1 } }
    );
    const nextVersion = (latestVersion?.version || 0) + 1;

    const subTotal = (products || []).reduce((sum, p) => sum + (p.totalPrice || 0), 0);
    const total = subTotal + (parseFloat(shipping) || 0) + (parseFloat(others) || 0);

    const newPO = await POVersion.create({
      orderId,
      vendorId,
      version: nextVersion,
      poNumber: poNumber || latestVersion?.poNumber || '',
      orderDate: new Date(),
      accountNumber: accountNumber || '',
      repName: repName || '',
      repPhone: repPhone || '',
      repEmail: repEmail || '',
      terms: terms || '',
      estimateNumber: estimateNumber || '',
      shipTo: shipTo || {},
      clientInfo: clientInfo || {},
      vendorInfo: vendorInfo || {},
      products: products || [],
      subTotal,
      shipping: parseFloat(shipping) || 0,
      others: parseFloat(others) || 0,
      total,
      comments: comments || '',
      notes: notes || '',
      versionNotes,
      status: 'draft',
      createdBy: req.user.id
    });

    res.json({
      success: true,
      data: newPO
    });

  } catch (error) {
    console.error('❌ Error createPOVersion:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ GET all PO versions for a vendor
// @route GET /api/orders/:orderId/po/:vendorId/versions/all
const getAllPOVersions = async (req, res) => {
  try {
    const { orderId, vendorId } = req.params;

    const versions = await POVersion.find(
      { orderId, vendorId },
      { products: 0 }
    )
      .populate('createdBy', 'name email')
      .sort({ version: -1 })
      .lean();

    res.json({
      success: true,
      data: versions
    });

  } catch (error) {
    console.error('❌ Error getAllPOVersions:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ GET all POs for an order (all vendors)
// @route GET /api/orders/:orderId/po/all
const getAllPOsForOrder = async (req, res) => {
  try {
    const { orderId } = req.params;

    const pos = await POVersion.find({ orderId })
      .populate('vendorId', 'name vendorCode')
      .populate('createdBy', 'name email')
      .sort({ vendorId: 1, version: -1 })
      .lean();

    // Group by vendor, keep only latest version
    const vendorPOs = {};
    pos.forEach((po) => {
      const vId = po.vendorId?._id?.toString() || 'unknown';
      if (!vendorPOs[vId]) {
        vendorPOs[vId] = po;
      }
    });

    res.json({
      success: true,
      data: Object.values(vendorPOs)
    });

  } catch (error) {
    console.error('❌ Error getAllPOsForOrder:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getOrderVendors,
  getPurchaseOrder,
  updatePurchaseOrder,
  createPOVersion,
  getAllPOVersions,
  getAllPOsForOrder
};