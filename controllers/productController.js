const Product = require('../models/Product');
const { parseSku, WOOD_CODES, FABRIC_CODES, OTHER_CODES } = require('../models/Product');
const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { s3Client } = require('../config/s3');

// ─── Build flat product payload from request body ──────────────────────────
const buildProductData = (body, uploadedFile = null) => {
  const skuParsed = parseSku(body.product_id);

  const woodFinish = body.woodFinish || skuParsed.woodFinish || '';
  const fabric     = body.fabric     || skuParsed.fabric     || '';
  const others = (() => {
    if (!body.others) return skuParsed.others;
    if (Array.isArray(body.others)) return body.others;
    try { return JSON.parse(body.others); } catch { return skuParsed.others; }
  })();

  let image = { url: '', key: '' };
  if (uploadedFile) {
    image = { url: uploadedFile.location, key: uploadedFile.key };
  } else if (body.imageUrl) {
    image = { url: body.imageUrl, key: '' };
  } else if (body.image) {
    const parsed = typeof body.image === 'string' ? JSON.parse(body.image) : body.image;
    image = { url: parsed.url || '', key: parsed.key || '' };
  }

  // ─── Price: support both new (buyPrice/sellPrice) and legacy (price) ────
  const sellPrice = parseFloat(body.sellPrice ?? body.price) || 0;
  const buyPrice  = parseFloat(body.buyPrice)  || 0;

  return {
    product_id:        body.product_id,
    name:              body.name,
    description:       body.description       || '',
    category:          body.category          || 'General',
    collection:        body.collection        || 'General',
    package:           (['Lani','Nalu','Mainland'].includes(body.package) ? body.package : ''),
    dimension:         body.dimension         || '',
    colorFinish:       body.colorFinish       || '',
    itemUrl:           body.itemUrl           || '',
    itemClass:         body.itemClass         || '',
    vendorDescription: body.vendorDescription || '',
    buyPrice,
    sellPrice,
    price: sellPrice,  // keep legacy field in sync
    woodFinish,
    fabric,
    others,
    image,
  };
};

// ─── GET all products ──────────────────────────────────────────────────────
const getProducts = async (req, res) => {
  try {
    const page   = Math.max(parseInt(req.query.page)  || 1, 1);
    const limit  = Math.min(Math.max(parseInt(req.query.limit) || 10, 1), 100);
    const search = (req.query.search || '').trim();
    const skip   = (page - 1) * limit;

    const category = (req.query.category || '').trim();
    const pkg       = (req.query.package  || '').trim();

    const query = {};
    if (search) {
      query.$or = [
        { product_id:  { $regex: search, $options: 'i' } },
        { name:        { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { category:    { $regex: search, $options: 'i' } },
      ];
    }
    if (category) query.category = { $regex: category, $options: 'i' };
    if (pkg)      query.package  = pkg;

    const [total, products] = await Promise.all([
      Product.countDocuments(query),
      Product.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('product_id name description vendorDescription category collection package dimension colorFinish itemUrl itemClass buyPrice sellPrice price woodFinish fabric others image uploadedImages')
        .lean()
    ]);

    res.json({ products, total, page, totalPages: Math.ceil(total / limit) });
  } catch (error) {
    console.error('getProducts error:', error);
    res.status(500).json({ message: 'Error fetching products' });
  }
};

// ─── GET single product ────────────────────────────────────────────────────
const getProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    res.json(product);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching product' });
  }
};

// ─── GET basic info (dropdowns) ───────────────────────────────────────────
const getProductsBasicInfo = async (req, res) => {
  try {
    const products = await Product.find()
      .select('_id name product_id category')
      .sort({ createdAt: -1 });
    res.json({ products });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching products' });
  }
};

// ─── CREATE product ────────────────────────────────────────────────────────
const createProduct = async (req, res) => {
  try {
    // Explicit duplicate SKU check before insert
    const skuToCheck = (req.body.product_id || '').trim();
    if (skuToCheck) {
      const existing = await Product.findOne({ product_id: skuToCheck }).lean();
      if (existing)
        return res.status(409).json({ message: `SKU "${skuToCheck}" already exists. Use Edit to update it.` });
    }

    const uploadedFile = req.file || null;
    const data = buildProductData(req.body, uploadedFile);
    const product = await Product.create({ ...data, sourceType: 'admin-created' });
    res.status(201).json(product);
  } catch (error) {
    console.error('createProduct error:', error);
    // Fallback: catch MongoDB E11000 duplicate key error
    if (error.code === 11000) {
      return res.status(409).json({ message: `SKU "${req.body.product_id}" already exists. Use Edit to update it.` });
    }
    res.status(500).json({ message: error.message });
  }
};

// ─── UPDATE product ────────────────────────────────────────────────────────
const updateProduct = async (req, res) => {
  try {
    const existing = await Product.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: 'Product not found' });

    const uploadedFile = req.file || null;
    const data = buildProductData(req.body, uploadedFile);

    if (!uploadedFile && !req.body.imageUrl && !req.body.image) {
      data.image = existing.image;
    }

    if (uploadedFile && existing.image?.key) {
      try {
        await s3Client.send(new DeleteObjectCommand({
          Bucket: process.env.SPACES_BUCKET, Key: existing.image.key
        }));
      } catch (err) {
        console.error('S3 delete old image error:', err);
      }
    }

    const updated = await Product.findByIdAndUpdate(req.params.id, data, { new: true });
    res.json(updated);
  } catch (error) {
    console.error('updateProduct error:', error);
    res.status(500).json({ message: error.message });
  }
};

// ─── DELETE product ────────────────────────────────────────────────────────
const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    if (product.image?.key) {
      try {
        await s3Client.send(new DeleteObjectCommand({
          Bucket: process.env.SPACES_BUCKET, Key: product.image.key
        }));
      } catch (err) {
        console.error('S3 delete error:', err);
      }
    }

    await Product.deleteOne({ _id: req.params.id });
    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting product' });
  }
};

// ─── Escape special regex characters to prevent MongoServerError 51091 ──────
const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ─── BULK DELETE ───────────────────────────────────────────────────────────
const bulkDeleteProducts = async (req, res) => {
  try {
    const { product_ids, filters } = req.body;

    let query;
    if (filters && Array.isArray(filters) && filters.length > 0) {
      const orConditions = filters.map(row => {
        const and = {};
        if (row.product_id) and.product_id = { $regex: `^${escapeRegex(row.product_id.trim())}$`, $options: 'i' };
        if (row.name)       and.name       = { $regex: `^${escapeRegex(row.name.trim())}$`,       $options: 'i' };
        if (row.category)   and.category   = { $regex: `^${escapeRegex(row.category.trim())}$`,   $options: 'i' };
        return and;
      }).filter(cond => Object.keys(cond).length > 0);

      if (!orConditions.length)
        return res.status(400).json({ message: 'No valid filter criteria provided' });

      query = orConditions.length === 1 ? orConditions[0] : { $or: orConditions };
    } else if (product_ids && Array.isArray(product_ids) && product_ids.length) {
      query = { product_id: { $in: product_ids } };
    } else {
      return res.status(400).json({ message: 'Provide either filters or product_ids' });
    }

    const products = await Product.find(query);
    if (!products.length)
      return res.json({ message: 'No matching products found', deletedCount: 0 });

    await Promise.all(products.map(async p => {
      if (p.image?.key) {
        try {
          await s3Client.send(new DeleteObjectCommand({
            Bucket: process.env.SPACES_BUCKET, Key: p.image.key
          }));
        } catch (err) { console.error('S3 delete error:', err); }
      }
    }));

    const result = await Product.deleteMany(query);
    res.json({ message: 'Products deleted successfully', deletedCount: result.deletedCount });
  } catch (error) {
    console.error('bulkDeleteProducts error:', error);
    res.status(500).json({ message: 'Error deleting products', error: error.message });
  }
};

// ─── CREATE from custom order ──────────────────────────────────────────────
const createProductFromCustomOrder = async (req, res) => {
  try {
    const { orderId, productData } = req.body;
    if (!orderId || !productData?.name || !productData?.product_id)
      return res.status(400).json({ success: false, message: 'orderId, name and product_id required' });

    const existing = await Product.findOne({ product_id: productData.product_id });
    if (existing)
      return res.status(400).json({ success: false, message: `Product ID ${productData.product_id} already exists`, data: existing });

    const customAttributes = new Map();
    if (productData.customAttributes)
      Object.entries(productData.customAttributes).forEach(([k, v]) => customAttributes.set(k, v));

    const firstImage = productData.uploadedImages?.[0] || productData.images?.[0];
    const image = firstImage?.url
      ? { url: firstImage.url, key: firstImage.key || '' }
      : { url: '', key: '' };

    const uploadedImages = (productData.uploadedImages || [])
      .filter(img => img.url)
      .map(img => ({
        filename:    img.filename    || 'unknown',
        contentType: img.contentType || 'image/jpeg',
        url:         img.url,
        key:         img.key         || '',
        size:        img.size        || 0,
        uploadedAt:  img.uploadedAt  || new Date()
      }));

    const skuParsed = parseSku(productData.product_id);
    const sellPrice = parseFloat(productData.sellPrice ?? productData.unitPrice) || 0;
    const buyPrice  = parseFloat(productData.buyPrice) || 0;

    const product = await Product.create({
      product_id:       productData.product_id,
      name:             productData.name,
      category:         productData.category     || 'Custom',
      collection:       'Custom Orders',
      description:      productData.specifications || '',
      dimension:        productData.size          || '',
      sellPrice,
      buyPrice,
      price:            sellPrice,
      woodFinish:       productData.woodFinish    || skuParsed.woodFinish || '',
      fabric:           productData.fabric        || skuParsed.fabric     || '',
      others:           productData.others        || skuParsed.others     || [],
      image,
      uploadedImages,
      customAttributes,
      sourceType:       'custom-order',
      createdFromOrder: orderId,
    });

    res.status(201).json({ success: true, data: product });
  } catch (error) {
    console.error('createProductFromCustomOrder error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── UPDATE custom attributes ──────────────────────────────────────────────
const updateCustomAttributes = async (req, res) => {
  try {
    const product = await Product.findById(req.params.productId);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    if (req.body.customAttributes)
      Object.entries(req.body.customAttributes).forEach(([k, v]) => product.customAttributes.set(k, v));
    await product.save();
    res.json({ success: true, data: product });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── GET product variants ──────────────────────────────────────────────────
const getProductVariants = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    res.json({
      variants: [product],
      basePrice: product.sellPrice ?? product.price,
      description: product.description
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching product' });
  }
};

// ─── GET unique categories ─────────────────────────────────────────────────
const getProductCategories = async (req, res) => {
  try {
    const categories = await Product.distinct('category', { category: { $nin: ['', null, 'General'] } });
    const sorted = categories.filter(Boolean).sort((a, b) => a.localeCompare(b));
    res.json({ categories: sorted });
  } catch (error) {
    console.error('getProductCategories error:', error);
    res.status(500).json({ message: 'Error fetching categories' });
  }
};

const buildUpdatePayloadFromRow = (row) => {
  const payload = {};

  const str = (v) => (v !== undefined && v !== null ? String(v).trim() : undefined);
  const num = (v) => { const n = parseFloat(v); return isNaN(n) ? undefined : n; };
  const arr = (v) => {
    if (!v && v !== 0) return undefined;
    const s = String(v).trim();
    if (!s) return [];
    return s.split(',').map(x => x.trim()).filter(Boolean);
  };

  const VALID_PACKAGES = ['', 'Lani', 'Nalu', 'Mainland'];

  if (row.name              !== undefined) payload.name              = str(row.name);
  if (row.description       !== undefined) payload.description       = str(row.description);
  if (row.vendorDescription !== undefined) payload.vendorDescription = str(row.vendorDescription);
  if (row.category          !== undefined) payload.category          = str(row.category) || 'General';
  if (row.collection        !== undefined) payload.collection        = str(row.collection) || 'General';
  if (row.dimension         !== undefined) payload.dimension         = str(row.dimension);
  if (row.colorFinish       !== undefined) payload.colorFinish       = str(row.colorFinish);
  if (row.itemUrl           !== undefined) payload.itemUrl           = str(row.itemUrl);
  if (row.itemClass         !== undefined) payload.itemClass         = str(row.itemClass);
  if (row.woodFinish        !== undefined) payload.woodFinish        = str(row.woodFinish);
  if (row.fabric            !== undefined) payload.fabric            = str(row.fabric);

  // ─── Price ───────────────────────────────────────────────────────────────
  if (row.sellPrice !== undefined) {
    const p = num(row.sellPrice);
    if (p !== undefined) { payload.sellPrice = p; payload.price = p; }
  } else if (row.price !== undefined) {
    // legacy column support
    const p = num(row.price);
    if (p !== undefined) { payload.sellPrice = p; payload.price = p; }
  }
  if (row.buyPrice !== undefined) {
    const p = num(row.buyPrice);
    if (p !== undefined) payload.buyPrice = p;
  }

  if (row.package !== undefined) {
    const pkg = str(row.package);
    payload.package = VALID_PACKAGES.includes(pkg) ? pkg : '';
  }

  if (row.others !== undefined) {
    payload.others = arr(row.others) ?? [];
  }

  if (row.imageUrl !== undefined && str(row.imageUrl)) {
    payload.image = { url: str(row.imageUrl), key: '' };
  }

  return payload;
};

const diffProduct = (existing, payload) => {
  const changes = {};

  const strEq = (a, b) => String(a ?? '').trim() === String(b ?? '').trim();
  const numEq = (a, b) => {
    const na = parseFloat(a), nb = parseFloat(b);
    return isNaN(na) && isNaN(nb) ? true : na === nb;
  };
  const arrEq = (a, b) => JSON.stringify([...(a || [])].sort()) === JSON.stringify([...(b || [])].sort());

  const numFields = ['sellPrice', 'buyPrice', 'price'];
  const arrFields = ['others'];

  for (const [key, newVal] of Object.entries(payload)) {
    if (key === 'image') {
      const oldUrl = existing.image?.url ?? '';
      const newUrl = newVal?.url ?? '';
      if (!strEq(oldUrl, newUrl)) changes['imageUrl'] = { old: oldUrl, new: newUrl };
      continue;
    }
    const oldVal = existing[key];
    let equal;
    if (numFields.includes(key))      equal = numEq(oldVal, newVal);
    else if (arrFields.includes(key)) equal = arrEq(oldVal, newVal);
    else                              equal = strEq(oldVal, newVal);
    if (!equal) changes[key] = { old: oldVal, new: newVal };
  }

  return changes;
};

const bulkUpdatePreview = async (req, res) => {
  try {
    const { rows } = req.body;
    if (!Array.isArray(rows) || !rows.length)
      return res.status(400).json({ message: 'rows array is required' });

    const skuMap = {};
    rows.forEach(r => { if (r.product_id) skuMap[r.product_id.trim()] = r; });
    const uniqueRows = Object.values(skuMap);

    const skus = uniqueRows.map(r => r.product_id.trim());
    // Case-insensitive lookup so Excel-edited SKUs still match
    const existing = await Product.find({
      product_id: { $in: skus.map(s => new RegExp(`^${escapeRegex(s)}$`, 'i')) }
    }).lean();
    const existingMap = {};
    // Key the map by UPPERCASE so lookup is always case-insensitive
    existing.forEach(p => { existingMap[p.product_id.toUpperCase()] = p; });

    const preview = uniqueRows.map(row => {
      const sku = row.product_id.trim();
      const doc = existingMap[sku.toUpperCase()];
      if (!doc) return { product_id: sku, name: row.name || '', notFound: true, changes: {} };

      const payload = buildUpdatePayloadFromRow(row);
      const changes = diffProduct(doc, payload);

      // For skipped rows: include the identical field values so the UI can explain why
      let identical = null;
      if (!Object.keys(changes).length) {
        identical = {};
        for (const [key, val] of Object.entries(payload)) {
          if (key === 'image') {
            identical['imageUrl'] = doc.image?.url ?? '';
          } else {
            identical[key] = doc[key] ?? '';
          }
        }
      }

      return { product_id: sku, name: doc.name, _id: doc._id, notFound: false, changes, identical };
    });

    res.json({ preview });
  } catch (error) {
    console.error('bulkUpdatePreview error:', error);
    res.status(500).json({ message: error.message });
  }
};

const bulkUpdateProducts = async (req, res) => {
  try {
    const { rows } = req.body;
    if (!Array.isArray(rows) || !rows.length)
      return res.status(400).json({ message: 'rows array is required' });

    const skuMap = {};
    rows.forEach(r => { if (r.product_id) skuMap[r.product_id.trim()] = r; });
    const uniqueRows = Object.values(skuMap);

    const skus = uniqueRows.map(r => r.product_id.trim());
    // Case-insensitive lookup
    const existing = await Product.find({
      product_id: { $in: skus.map(s => new RegExp(`^${escapeRegex(s)}$`, 'i')) }
    }).lean();
    const existingMap = {};
    existing.forEach(p => { existingMap[p.product_id.toUpperCase()] = p; });

    let updatedCount  = 0;
    let skippedCount  = 0;
    let notFoundCount = 0;
    const errors      = [];

    await Promise.all(uniqueRows.map(async (row) => {
      const sku = row.product_id.trim();
      const doc = existingMap[sku.toUpperCase()];

      if (!doc) { notFoundCount++; return; }

      try {
        const payload = buildUpdatePayloadFromRow(row);
        const changes = diffProduct(doc, payload);

        if (!Object.keys(changes).length) { skippedCount++; return; }

        const update = {};
        for (const key of Object.keys(changes)) {
          if (key === 'imageUrl') update.image = payload.image;
          else update[key] = payload[key];
        }
        update.updatedAt = new Date();

        await Product.updateOne({ _id: doc._id }, { $set: update });
        updatedCount++;
      } catch (err) {
        errors.push({ product_id: sku, message: err.message });
      }
    }));

    res.json({ message: 'Bulk update complete', updatedCount, skippedCount, notFoundCount, errors });
  } catch (error) {
    console.error('bulkUpdateProducts error:', error);
    res.status(500).json({ message: error.message });
  }
};

const exportAllProducts = async (req, res) => {
  try {
    const products = await Product.find()
      .sort({ createdAt: -1 })
      .select('product_id name description vendorDescription category collection package dimension colorFinish itemUrl itemClass buyPrice sellPrice price woodFinish fabric others image')
      .lean();

    res.json({ products, total: products.length });
  } catch (error) {
    console.error('exportAllProducts error:', error);
    res.status(500).json({ message: 'Error exporting products' });
  }
};

module.exports = {
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  getProductsBasicInfo,
  getProductVariants,
  bulkDeleteProducts,
  createProductFromCustomOrder,
  updateCustomAttributes,
  getProductCategories,
  bulkUpdatePreview,
  bulkUpdateProducts,
  exportAllProducts
};