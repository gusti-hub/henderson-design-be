const Product = require('../models/Product');
const { parseSku, WOOD_CODES, FABRIC_CODES, OTHER_CODES } = require('../models/Product');
const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { s3Client } = require('../config/s3');

// ─── Build flat product payload from request body ──────────────────────────
const buildProductData = (body, uploadedFile = null) => {
  const skuParsed = parseSku(body.product_id);

  // Merge: explicit body values win over SKU-parsed
  const woodFinish = body.woodFinish || skuParsed.woodFinish || '';
  const fabric     = body.fabric     || skuParsed.fabric     || '';
  const others = (() => {
    if (!body.others) return skuParsed.others;
    if (Array.isArray(body.others)) return body.others;
    try { return JSON.parse(body.others); } catch { return skuParsed.others; }
  })();

  // Image: S3 upload > explicit URL in body
  let image = { url: '', key: '' };
  if (uploadedFile) {
    image = { url: uploadedFile.location, key: uploadedFile.key };
  } else if (body.imageUrl) {
    image = { url: body.imageUrl, key: '' };
  } else if (body.image) {
    // Accept JSON string { url, key }
    const parsed = typeof body.image === 'string' ? JSON.parse(body.image) : body.image;
    image = { url: parsed.url || '', key: parsed.key || '' };
  }

  return {
    product_id:  body.product_id,
    name:        body.name,
    description: body.description  || '',
    category:    body.category     || 'General',
    collection:  body.collection   || 'General',
    package:     (['Lani','Nalu','Mainland'].includes(body.package) ? body.package : ''),
    dimension:   body.dimension    || '',
    colorFinish:       body.colorFinish       || '',
    itemUrl:           body.itemUrl           || '',
    itemClass:         body.itemClass         || '',
    vendorDescription: body.vendorDescription || '',
    price:       parseFloat(body.price) || 0,
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
        .select('product_id name description vendorDescription category collection package dimension colorFinish itemUrl itemClass price woodFinish fabric others image uploadedImages')
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
    const uploadedFile = req.file || null;  // single file upload
    const data = buildProductData(req.body, uploadedFile);

    const product = await Product.create({ ...data, sourceType: 'admin-created' });
    res.status(201).json(product);
  } catch (error) {
    console.error('createProduct error:', error);
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

    // If no new image provided, keep existing
    if (!uploadedFile && !req.body.imageUrl && !req.body.image) {
      data.image = existing.image;
    }

    // Delete old S3 image if replaced
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

// ─── BULK DELETE ───────────────────────────────────────────────────────────
// Accepts either:
//   { product_ids: ['SKU1', 'SKU2'] }           — legacy, SKU-only
//   { filters: [{ product_id, name, category }] } — new, multi-field match
const bulkDeleteProducts = async (req, res) => {
  try {
    const { product_ids, filters } = req.body;

    // Build MongoDB $or query from filters array
    // Each filter row = AND within the row (all provided fields must match)
    // Multiple rows = OR between rows
    let query;

    if (filters && Array.isArray(filters) && filters.length > 0) {
      const orConditions = filters.map(row => {
        const and = {};
        if (row.product_id) and.product_id = { $regex: `^${row.product_id.trim()}$`, $options: 'i' };
        if (row.name)       and.name       = { $regex: `^${row.name.trim()}$`,       $options: 'i' };
        if (row.category)   and.category   = { $regex: `^${row.category.trim()}$`,   $options: 'i' };
        return and;
      }).filter(cond => Object.keys(cond).length > 0);

      if (!orConditions.length)
        return res.status(400).json({ message: 'No valid filter criteria provided' });

      query = orConditions.length === 1 ? orConditions[0] : { $or: orConditions };

    } else if (product_ids && Array.isArray(product_ids) && product_ids.length) {
      // Legacy: delete by SKU array
      query = { product_id: { $in: product_ids } };

    } else {
      return res.status(400).json({ message: 'Provide either filters or product_ids' });
    }

    // Find matching products first (for S3 cleanup)
    const products = await Product.find(query);

    if (!products.length)
      return res.json({ message: 'No matching products found', deletedCount: 0 });

    // Delete S3 images
    await Promise.all(products.map(async p => {
      if (p.image?.key) {
        try {
          await s3Client.send(new DeleteObjectCommand({
            Bucket: process.env.SPACES_BUCKET, Key: p.image.key
          }));
        } catch (err) {
          console.error('S3 delete error:', err);
        }
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

    // Image from uploadedImages or direct URL
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

    const product = await Product.create({
      product_id:       productData.product_id,
      name:             productData.name,
      category:         productData.category     || 'Custom',
      collection:       'Custom Orders',
      description:      productData.specifications || '',
      dimension:        productData.size          || '',
      price:            parseFloat(productData.unitPrice) || 0,
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

// ─── GET product variants (kept for backward compat — returns self) ────────
const getProductVariants = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    // Return product itself as single "variant" for any code still calling this
    res.json({
      variants: [product],
      basePrice: product.price,
      description: product.description
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching product' });
  }
};


// ─── GET unique categories (for filter dropdowns) ─────────────────────────
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
};