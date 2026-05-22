const Order = require('../models/Order');
const POVersion = require('../models/POVersion');
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

      const opts = product.selectedOptions || {};
      const netCost = (opts.netCostOverride != null && opts.netCostOverride !== '')
        ? parseFloat(opts.netCostOverride)
        : parseFloat(opts.msrp || 0);
      const totalPrice = netCost * (product.quantity || 1);
      vendorMap[vendorId].products.push({ ...product, totalPrice });
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
      data: { orderId, clientInfo: order.clientInfo, vendors: vendorGroups }
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

// ✅ Helper: Build initial shipTo from the first product that has shipping data
const buildShipToFromProducts = (products) => {
  const p = products.find(prod => prod.selectedOptions?.shippingStreet);
  if (!p) return null;
  const opts = p.selectedOptions;
  return {
    name: opts.shipToName || '',
    address: opts.shippingStreet || '',
    city: [opts.shippingCity, opts.shippingState, opts.shippingPostalCode].filter(Boolean).join(', '),
    attention: '',
    phone: opts.shipToPhone || ''
  };
};

// ✅ Helper: Compute net purchase cost from product pricing fields
const computeNetCost = (product) => {
  const opts = product.selectedOptions || {};
  if (opts.netCostOverride != null && opts.netCostOverride !== '') {
    return parseFloat(opts.netCostOverride);
  }
  return parseFloat(opts.msrp || 0);
};

// ─── Helper: Build instance-aware "already PO'd" lookup ─────────────────────
// Problem: multiple order products can share the same product_id (same SKU in 2 rooms).
// A simple Set/map on product_id would wrongly mark ALL instances as "previously ordered"
// even if only 1 was ever in a PO.
//
// Solution: track by ORDER product _id (unique per order line) when available.
// Each order product carries its own _id. PO products store product_id (SKU).
// We match by counting: for each product_id, how many slots did ALL previous POs use?
// That many order-product instances are "previously ordered"; the rest are new.
//
// Returns a function: classifyOrderProducts(orderProducts)
//   → { included: [...], excluded: [...] }  where excluded items have ._prevPoNumber
const buildPrevPoClassifier = (allVersions) => {
  const sorted = [...allVersions].sort((a, b) => a.version - b.version);
  const slotsByKey = {};
 
  sorted.forEach(v => {
    const countInV = {};
    (v.products || []).forEach(p => {
      const key = (p.product_id && p.product_id.trim() !== '')
        ? p.product_id
        : ('name::' + (p.name || '').trim().toLowerCase());
      countInV[key] = (countInV[key] || 0) + 1;
    });
    Object.entries(countInV).forEach(([key, cnt]) => {
      if (!slotsByKey[key] || cnt > slotsByKey[key].count) {
        slotsByKey[key] = { count: cnt, poNumber: v.poNumber || ('v' + v.version) };
      }
    });
  });
 
  return function classifyProducts(orderProducts) {
    const remaining = {};
    Object.entries(slotsByKey).forEach(([key, val]) => {
      remaining[key] = val.count;
    });
 
    const included = [];
    const excluded = [];
 
    orderProducts.forEach(p => {
      const key = (p.product_id && p.product_id.trim() !== '')
        ? p.product_id
        : ('name::' + (p.name || '').trim().toLowerCase());
 
      if (remaining[key] && remaining[key] > 0) {
        remaining[key]--;
        excluded.push({ ...p, _prevPoNumber: slotsByKey[key].poNumber });
      } else {
        included.push(p);
      }
    });
 
    return { included, excluded };
  };
};

// ─── Helper: Build product entry from order product ───────────────────────────
const buildPoProductFromOrder = (orderProduct) => {
  const opts = orderProduct.selectedOptions || {};
  const specs = [];
  if (opts.vendorDescription) specs.push(opts.vendorDescription);
  else if (opts.specifications) specs.push(opts.specifications);
  if (opts.finish) specs.push(`Finish: ${opts.finish}`);
  if (opts.fabric) specs.push(`Fabric: ${opts.fabric}`);
  if (opts.size) specs.push(`Size: ${opts.size}`);

  const netCost = computeNetCost(orderProduct);
  const qty = orderProduct.quantity || 1;

  return {
    product_id: orderProduct.product_id || '',
    name: orderProduct.name || '',
    category: orderProduct.category || '',
    spotName: orderProduct.spotName || '',
    quantity: qty,
    unitPrice: netCost,
    totalPrice: netCost * qty,
    description: specs.join('\n') || '',
    selectedOptions: {
      finish: opts.finish || '',
      fabric: opts.fabric || '',
      size: opts.size || '',
      insetPanel: opts.insetPanel || '',
      specifications: opts.specifications || '',
      vendorDescription: opts.vendorDescription || '',
      image: opts.image || '',
      images: opts.images || [],
      notes: opts.notes || '',
      poNumber: opts.poNumber || '',
      sidemark: opts.sidemark || '',
      uploadedImages: (opts.uploadedImages || []).map(img => ({
        filename: img.filename || '',
        contentType: img.contentType || '',
        url: img.url || '',
        key: img.key || '',
        size: img.size || 0,
        uploadedAt: img.uploadedAt || new Date(),
      })),
      units: opts.units || 'Each',
      msrp: parseFloat(opts.msrp) || 0,
      discountPercent: opts.discountPercent || 0,
      netCostOverride: opts.netCostOverride ?? null,
      markupPercent: opts.markupPercent || 0,
      shipToName: opts.shipToName || '',
      shippingStreet: opts.shippingStreet || '',
      shippingCity: opts.shippingCity || '',
      shippingState: opts.shippingState || '',
      shippingPostalCode: opts.shippingPostalCode || '',
      shipToPhone: opts.shipToPhone || '',
    }
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

    // ── Always sync PO products with latest order data ─────────────────────
    if (poVersion) {
      try {
        const order = await Order.findById(orderId)
          .populate('selectedProducts.vendor')
          .lean();

        if (order) {
          const vendorProducts = (order.selectedProducts || []).filter(
            (p) => p.vendor?._id?.toString() === vendorId || p.vendor?.toString() === vendorId
          );

          const orderProductMap = {};
          vendorProducts.forEach(p => {
            if (p.product_id) orderProductMap[p.product_id] = p;
          });

          const poProductMap = {};
          (poVersion.products || []).forEach(p => {
            if (p.product_id) poProductMap[p.product_id] = p;
          });

          // Rebuild products list:
          // ONLY update products that are already in the PO — do NOT add new ones.
          // New products from order go to availableToAdd, not into the PO automatically.
          const syncedProducts = (poVersion.products || []).map(existingPoProduct => {
            const orderProduct = orderProductMap[existingPoProduct.product_id];
            if (!orderProduct) return existingPoProduct; // product removed from order — keep as-is

            const opts = orderProduct.selectedOptions || {};
            const netCost = computeNetCost(orderProduct);
            const qty = orderProduct.quantity || 1;

            return {
              ...existingPoProduct,
              name: orderProduct.name || existingPoProduct.name,
              category: orderProduct.category || existingPoProduct.category,
              quantity: qty,
              unitPrice: netCost,
              totalPrice: netCost * qty,
              selectedOptions: {
                ...existingPoProduct.selectedOptions,
                finish: opts.finish || '',
                fabric: opts.fabric || '',
                size: opts.size || '',
                specifications: opts.specifications || '',
                vendorDescription: opts.vendorDescription || '',
                image: opts.image || '',
                images: opts.images || [],
                uploadedImages: (opts.uploadedImages || []).map(img => ({
                  filename: img.filename || '', contentType: img.contentType || '',
                  url: img.url || '', key: img.key || '',
                  size: img.size || 0, uploadedAt: img.uploadedAt || new Date(),
                })),
                msrp: parseFloat(opts.msrp) || 0,
                netCostOverride: opts.netCostOverride ?? null,
                units: opts.units || 'Each',
                sidemark: opts.sidemark || '',
                shipToName: opts.shipToName || '',
                shippingStreet: opts.shippingStreet || '',
                shippingCity: opts.shippingCity || '',
                shippingState: opts.shippingState || '',
                shippingPostalCode: opts.shippingPostalCode || '',
                shipToPhone: opts.shipToPhone || '',
              }
            };
          });

          const subTotal = syncedProducts.reduce((sum, p) => sum + (p.totalPrice || 0), 0);

          let vendorTerms = poVersion.terms || '';
          let vendorRepName = poVersion.repName || '';
          let vendorRepPhone = poVersion.repPhone || '';
          let vendorRepEmail = poVersion.repEmail || '';
          let vendorAccountNumber = poVersion.accountNumber || '';
          let vendorInfoLatest = poVersion.vendorInfo || {};

          try {
            const latestVendor = await Vendor.findById(vendorId).lean();
            if (latestVendor) {
              vendorTerms = latestVendor.termsAndPayment?.terms || '';
              vendorRepName = latestVendor.representativeName || '';
              vendorRepPhone = latestVendor.contactInfo?.phone || '';
              vendorRepEmail = latestVendor.contactInfo?.email || '';
              vendorAccountNumber = latestVendor.accountNumber || '';
              vendorInfoLatest = mapVendorToInfo(latestVendor);
            }
          } catch (vendorErr) {
            console.warn('⚠️ Could not fetch vendor for sync:', vendorErr.message);
          }

          let shipToLatest = poVersion.shipTo || {};
          const orderProductWithShipping = vendorProducts.find(
            p => p.selectedOptions?.shippingStreet || p.selectedOptions?.shipToName
          );
          if (orderProductWithShipping) {
            const opts = orderProductWithShipping.selectedOptions;
            shipToLatest = {
              name: opts.shipToName || '',
              address: opts.shippingStreet || '',
              city: [opts.shippingCity, opts.shippingState, opts.shippingPostalCode].filter(Boolean).join(', '),
              attention: '',
              phone: opts.shipToPhone || '',
            };
          }

          if (version === 'latest') {
            // Only update vendor info, rep details, shipTo — NOT the products list.
            // Products list is the source of truth for what's included in this PO version.
            // Pricing/spec updates are applied in-memory above and returned to frontend,
            // but not persisted here so we don't accidentally re-add excluded products.
            await POVersion.findByIdAndUpdate(poVersion._id, {
              terms: vendorTerms,
              repName: vendorRepName,
              repPhone: vendorRepPhone,
              repEmail: vendorRepEmail,
              accountNumber: vendorAccountNumber,
              vendorInfo: vendorInfoLatest,
              shipTo: shipToLatest,
            });
          }

          poVersion = {
            ...poVersion,
            products: syncedProducts,
            subTotal,
            terms: vendorTerms,
            repName: vendorRepName,
            repPhone: vendorRepPhone,
            repEmail: vendorRepEmail,
            accountNumber: vendorAccountNumber,
            vendorInfo: vendorInfoLatest,
            shipTo: shipToLatest,
          };
        }
      } catch (syncErr) {
        console.error('⚠️ PO sync warning:', syncErr.message);
      }
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

      const vendor = await Vendor.findById(vendorId).lean();
      if (!vendor) {
        return res.status(404).json({ success: false, message: 'Vendor not found' });
      }

      const vendorProducts = (order.selectedProducts || []).filter(
        (p) => p.vendor?._id?.toString() === vendorId || p.vendor?.toString() === vendorId
      );

      if (vendorProducts.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'No products found for this vendor in this order'
        });
      }

      const poProducts = vendorProducts.map(buildPoProductFromOrder);
      const subTotal = poProducts.reduce((sum, p) => sum + p.totalPrice, 0);

      const clientCode = order.clientInfo?.name?.substring(0, 3)?.toUpperCase() || 'HDG';
      const dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, '');
      const poNumber = `${clientCode}-${dateStr}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;

      const vendorInfo = mapVendorToInfo(vendor);
      const shipTo = buildShipToFromProducts(vendorProducts) || {
        name: '', address: '', city: '', attention: '', phone: ''
      };

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
        shipTo,
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

    // ── Attach "available to add" products ────────────────────────────────────
    // Products in order for this vendor that are NOT in the current PO version.
    // Also attaches _prevPoNumber badge if the product appeared in a previous version.
    try {
      const [order, allVersions] = await Promise.all([
        Order.findById(orderId).populate('selectedProducts.vendor').lean(),
        POVersion.find({ orderId, vendorId }).lean(),
      ]);
      if (order) {
        const vendorProducts = (order.selectedProducts || []).filter(
          (p) => p.vendor?._id?.toString() === vendorId || p.vendor?.toString() === vendorId
        );

        // Classify ALL vendor products using instance-aware classifier
        const classify = buildPrevPoClassifier(allVersions);
        const { included: newOnes, excluded: prevOnes } = classify(vendorProducts);

        // From "new" ones, keep only those not already in current PO
        const currentPoProductIds = new Set(
          (poVersion.products || []).map(p => p.product_id).filter(Boolean)
        );

        // availableToAdd = products not in this PO version
        // Split into: already-in-PO-but-removed (prevOnes not in current), and truly-new
        const availableToAdd = [
          // Previously ordered items not in current PO version
          ...prevOnes,
          // New items (never PO'd) not in current PO version
          ...newOnes.filter(p => !currentPoProductIds.has(p.product_id)),
        ];

        // Auto-populate: if this PO version has 0 products but there are new items,
        // add them automatically (fixes the case where createPOVersion saved an empty PO)
        if ((poVersion.products || []).length === 0 && newOnes.length > 0) {
          poVersion.products = newOnes;
          poVersion._autoPopulated = true;
          // Save to DB so next load is consistent
          try {
            const subTotal = newOnes.reduce((s, p) => s + (p.totalPrice || 0), 0);
            await POVersion.findByIdAndUpdate(poVersion._id, {
              products: newOnes,
              subTotal,
              total: subTotal + (poVersion.shipping || 0) + (poVersion.others || 0),
            });
          } catch (_) {}
          // Re-filter availableToAdd to only show prevOnes (new ones now in PO)
          poVersion.availableToAdd = prevOnes;
        } else {
          poVersion.availableToAdd = availableToAdd;
        }
      }
    } catch (_) {}

    res.json({ success: true, data: poVersion });

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
    const {
      version, products, vendorInfo, shipTo, comments, notes,
      poNumber, accountNumber, repName, repPhone, repEmail,
      terms, estimateNumber, shipping, others, status, clientInfo
    } = req.body;

    const poVersion = await POVersion.findOne({ orderId, vendorId, version });
    if (!poVersion) {
      return res.status(404).json({ success: false, message: 'PO version not found' });
    }

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
    if (req.body.additionalLines !== undefined) {
      poVersion.additionalLines = req.body.additionalLines;
    }
    if (status) poVersion.status = status;

    poVersion.total = poVersion.subTotal + (poVersion.shipping || 0) + (poVersion.others || 0);
    await poVersion.save();

    // Sync PO number back to order products
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

    res.json({ success: true, data: poVersion });

  } catch (error) {
    console.error('❌ Error updatePurchaseOrder:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ CREATE new PO version
// NEW BEHAVIOUR: products that were already in the PREVIOUS PO version for this vendor
// are EXCLUDED by default — frontend receives `excludedProducts` array so user can add them back.
// @route POST /api/orders/:orderId/po/:vendorId/new-version
const createPOVersion = async (req, res) => {
  try {
    const { orderId, vendorId } = req.params;
    const {
      products, vendorInfo, shipTo, comments, notes, versionNotes,
      poNumber, accountNumber, repName, repPhone, repEmail,
      terms, estimateNumber, shipping, others, clientInfo
    } = req.body;

    if (!versionNotes?.trim()) {
      return res.status(400).json({ success: false, message: 'Version notes are required' });
    }

    const latestVersion = await POVersion.findOne(
      { orderId, vendorId },
      {},
      { sort: { version: -1 } }
    ).lean();
    const nextVersion = (latestVersion?.version || 0) + 1;

    // Build product list for the new version.
    // `products === null` (or not sent) → auto-compute: exclude what was already in prev version.
    // `products` explicitly provided → use as-is (user manually chose what to include).
    //
    // Duplicate product_id handling: if product X appears 3x in order and 2x in prev PO,
    // then 1 instance is new (not in prev PO) → include it; the 2 prev instances → excludedFromPrev.
    let finalProducts = [];
    let excludedFromPrev = [];
    const autoCompute = products == null; // null/undefined = auto; [] or array = explicit

    if (autoCompute) {
      try {
        const [order, allVersions] = await Promise.all([
          Order.findById(orderId).populate('selectedProducts.vendor').lean(),
          // Fetch ALL versions for this vendor — include products field
          POVersion.find({ orderId, vendorId }).lean(),
        ]);

        if (order) {
          const allVendorProducts = (order.selectedProducts || []).filter(
            (p) => p.vendor?._id?.toString() === vendorId || p.vendor?.toString() === vendorId
          );

          const classify = buildPrevPoClassifier(allVersions);
          const { included, excluded } = classify(allVendorProducts);
          finalProducts.push(...included);
          excludedFromPrev.push(...excluded);

          console.log(`[createPOVersion] vendor products: ${allVendorProducts.length} | new→PO: ${finalProducts.length} | excluded: ${excludedFromPrev.length}`);
        }
      } catch (e) {
        console.warn('⚠️ Could not compute excluded products:', e.message);
      }
    } else {
      finalProducts = products; // explicit list from frontend
    }

    const subTotal = finalProducts.reduce((sum, p) => sum + (p.totalPrice || 0), 0);
    const total = subTotal + (parseFloat(shipping) || 0) + (parseFloat(others) || 0);

    // Always generate a fresh PO number for each new version — never inherit from previous
    const _order = await Order.findById(orderId).select('clientInfo').lean();
    const _clientCode = _order?.clientInfo?.name?.substring(0, 3)?.toUpperCase() || 'HDG';
    const _dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, '');
    const _newPoNumber = `${_clientCode}-${_dateStr}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;

    const newPO = await POVersion.create({
      orderId,
      vendorId,
      version: nextVersion,
      poNumber: _newPoNumber,
      orderDate: new Date(),
      accountNumber: accountNumber || latestVersion?.accountNumber || '',
      repName: repName || latestVersion?.repName || '',
      repPhone: repPhone || latestVersion?.repPhone || '',
      repEmail: repEmail || latestVersion?.repEmail || '',
      terms: terms || latestVersion?.terms || '',
      estimateNumber: estimateNumber || '',
      shipTo: shipTo || latestVersion?.shipTo || {},
      clientInfo: clientInfo || latestVersion?.clientInfo || {},
      vendorInfo: vendorInfo || latestVersion?.vendorInfo || {},
      products: finalProducts,
      additionalLines: [],
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

    const responseData = newPO.toObject();
    responseData.excludedProducts = excludedFromPrev; // products from prev PO, not included by default

    res.json({ success: true, data: responseData });

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

    res.json({ success: true, data: versions });

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

    const vendorPOs = {};
    pos.forEach((po) => {
      const vId = po.vendorId?._id?.toString() || 'unknown';
      if (!vendorPOs[vId]) vendorPOs[vId] = po;
    });

    res.json({ success: true, data: Object.values(vendorPOs) });

  } catch (error) {
    console.error('❌ Error getAllPOsForOrder:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ UPDATE PO status
// @route PUT /api/orders/:orderId/po/:vendorId/status
const updatePOStatus = async (req, res) => {
  try {
    const { orderId, vendorId } = req.params;
    const { version, status } = req.body;

    const validStatuses = ['draft', 'sent', 'confirmed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const po = await POVersion.findOne({ orderId, vendorId, version });
    if (!po) return res.status(404).json({ success: false, message: 'PO version not found' });

    if (po.status === 'confirmed') {
      return res.status(400).json({ success: false, message: 'Confirmed PO cannot be changed. Create a new version instead.' });
    }

    po.status = status;
    await po.save();

    res.json({ success: true, status, version: po.version });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ NEW: Get available (unincluded) products for a PO version
// @route GET /api/orders/:orderId/po/:vendorId/:version/available-products
// Returns order products for this vendor that are NOT in the specified PO version
const getAvailableProducts = async (req, res) => {
  try {
    const { orderId, vendorId } = req.params;
    const version = parseInt(req.params.version) || null;

    const [order, poVersion] = await Promise.all([
      Order.findById(orderId).populate('selectedProducts.vendor').lean(),
      version
        ? POVersion.findOne({ orderId, vendorId, version }).lean()
        : POVersion.findOne({ orderId, vendorId }, {}, { sort: { version: -1 } }).lean(),
    ]);

    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    const vendorProducts = (order.selectedProducts || []).filter(
      (p) => p.vendor?._id?.toString() === vendorId || p.vendor?.toString() === vendorId
    );

    const allVersions = await POVersion.find({ orderId, vendorId }).lean();
    const classify = buildPrevPoClassifier(allVersions);
    const { included: newOnes, excluded: prevOnes } = classify(vendorProducts);
const currentPoCount = new Map();
    (poVersion?.products || []).forEach(p => {
      const key = (p.product_id && p.product_id.trim() !== '')
        ? p.product_id
        : ('name::' + (p.name || '').trim().toLowerCase());
      currentPoCount.set(key, (currentPoCount.get(key) || 0) + 1);
    });
    const currentPoRemaining = new Map(currentPoCount);
    const isInCurrentPo = (p) => {
      const key = (p.product_id && p.product_id.trim() !== '')
        ? p.product_id
        : ('name::' + (p.name || '').trim().toLowerCase());
      const rem = currentPoRemaining.get(key) || 0;
      if (rem > 0) { currentPoRemaining.set(key, rem - 1); return true; }
      return false;
    };
    const available = [
      ...prevOnes,
      ...newOnes.filter(p => !isInCurrentPo(p)),
    ];

    res.json({ success: true, data: available });
  } catch (error) {
    console.error('❌ Error getAvailableProducts:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getOrderVendors,
  getPurchaseOrder,
  updatePurchaseOrder,
  createPOVersion,
  getAllPOVersions,
  getAllPOsForOrder,
  updatePOStatus,
  getAvailableProducts,
};