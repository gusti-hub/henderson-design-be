const Product = require('../models/Product');
const Order = require('../models/Order');
const { upload } = require('../config/s3');
const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { s3Client } = require('../config/s3');

// Get all products with pagination and search
const getProducts = async (req, res) => {
  try {
    console.log('REQ', new Date().toISOString(), req.originalUrl);

    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 10, 1), 100);
    const search = (req.query.search || '').trim();
    const skip = (page - 1) * limit;

    const query = search
      ? {
          $or: [
            { product_id: { $regex: search, $options: 'i' } },
            { name: { $regex: search, $options: 'i' } },
            { description: { $regex: search, $options: 'i' } }
          ]
        }
      : {};

    // Parallel execution untuk count dan find
    const [total, products] = await Promise.all([
      Product.countDocuments(query),
      Product.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('product_id name description basePrice variants') // hanya field yang dipakai FE
        .lean()
    ]);
    
    res.json({
      products,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error('Error in getProducts:', error);
    res.status(500).json({ message: 'Error fetching products' });
  }
};


// Create product (standard admin upload)
const createProduct = async (req, res) => {
  try {
    console.log('Create product request received');
    console.log('Files:', req.files);
    console.log('Body:', req.body);

    const { product_id, name, description, dimension, basePrice, category, collection } = req.body;
    let variants = JSON.parse(req.body.variants);

    // Process variants and match with uploaded files
    const processedVariants = variants.map(variant => {
      // If variant has an imageIndex, use the corresponding uploaded file
      if ('imageIndex' in variant && req.files[variant.imageIndex]) {
        const file = req.files[variant.imageIndex];
        return {
          finish: variant.finish || '',
          fabric: variant.fabric || '',
          size: variant.size || '',
          insetPanel: variant.insetPanel || '',
          price: parseFloat(variant.price),
          image: {
            url: file.location,
            key: file.key
          }
        };
      }
      // If variant has existing image data, keep it
      else if (variant.image) {
        return {
          finish: variant.finish || '',
          fabric: variant.fabric || '',
          size: variant.size || '',
          insetPanel: variant.insetPanel || '',
          price: parseFloat(variant.price),
          image: variant.image,
          model: variant.model
        };
      }
      // No image case
      else {
        return {
          finish: variant.finish || '',
          fabric: variant.fabric || '',
          size: variant.size || '',
          insetPanel: variant.insetPanel || '',
          price: parseFloat(variant.price),
          image: null,
          model: null
        };
      }
    });

    const product = await Product.create({
      product_id,
      name,
      description,
      category: category || 'General',
      collection: collection || 'General',
      dimension,
      basePrice: parseFloat(basePrice),
      variants: processedVariants,
      sourceType: 'admin-created'
    });

    res.status(201).json(product);
  } catch (error) {
    console.error('Error in createProduct:', error);
    res.status(500).json({ message: error.message });
  }
};

const createProductFromCustomOrder = async (req, res) => {
  try {
    console.log('📦 createProductFromCustomOrder called');

    const { orderId, productData } = req.body;

    // ✅ Better validation with detailed error
    if (!orderId) {
      console.error('❌ Missing orderId in request body');
      console.log('Request body keys:', Object.keys(req.body));
      return res.status(400).json({
        success: false,
        message: 'Order ID is required',
        received: req.body
      });
    }

    if (!productData) {
      return res.status(400).json({
        success: false,
        message: 'Product data is required'
      });
    }

    // Validation
    if (!productData.name || !productData.product_id) {
      return res.status(400).json({
        success: false,
        message: 'Product name and product_id are required'
      });
    }

    console.log(`📦 Creating product: ${productData.name} for order: ${orderId}`);

    // Check if product_id already exists
    const existingProduct = await Product.findOne({ 
      product_id: productData.product_id 
    });

    if (existingProduct) {
      console.warn(`⚠️ Product ID already exists: ${productData.product_id}`);
      return res.status(400).json({
        success: false,
        message: `Product ID ${productData.product_id} already exists. Using existing product.`,
        data: existingProduct // Return existing product
      });
    }

    // Prepare custom attributes
    const customAttributes = new Map();
    if (productData.customAttributes) {
      Object.entries(productData.customAttributes).forEach(([key, value]) => {
        customAttributes.set(key, value);
      });
    }

    // Prepare images array from URLs
    const images = (productData.images || []).map((url, index) => ({
      url,
      alt: productData.name,
      isPrimary: index === 0
    }));

    // Prepare uploaded images (from base64)
    const uploadedImages = [];
    if (productData.uploadedImages && Array.isArray(productData.uploadedImages)) {
      productData.uploadedImages.forEach((img, idx) => {
        try {
          let base64Data = img.data;
          
          // Remove data URL prefix if present
          if (typeof base64Data === 'string' && base64Data.includes('base64,')) {
            base64Data = base64Data.split('base64,')[1];
          }
          
          if (base64Data && typeof base64Data === 'string') {
            uploadedImages.push({
              filename: img.filename || `image_${idx}.jpg`,
              contentType: img.contentType || 'image/jpeg',
              data: Buffer.from(base64Data, 'base64'),
              size: img.size || 0,
              uploadedAt: new Date()
            });
          }
        } catch (imgError) {
          console.error(`Error processing uploaded image ${idx}:`, imgError.message);
        }
      });
    }

    console.log(`✅ Processed ${uploadedImages.length} uploaded images`);

    // Create single variant with manual input data
    const defaultVariant = {
      finish: productData.finish || '',
      fabric: productData.fabric || '',
      size: productData.size || '',
      insetPanel: '',
      price: parseFloat(productData.unitPrice) || 0,
      image: images[0] ? { url: images[0].url } : null,
      inStock: true,
      isDefault: true
    };

    // Create product
    const product = await Product.create({
      product_id: productData.product_id,
      name: productData.name,
      category: productData.category || 'Custom',
      collection: 'Custom Orders',
      description: productData.specifications || '',
      dimension: productData.size || '',
      basePrice: parseFloat(productData.unitPrice) || 0,
      sourceType: 'custom-order',
      createdFromOrder: orderId,
      customAttributes,
      variants: [defaultVariant],
      images,
      uploadedImages
    });

    console.log('✅ Product created from custom order:', product._id);

    res.status(201).json({
      success: true,
      data: product
    });

  } catch (error) {
    console.error('❌ Error creating product from custom order:', error);
    res.status(500).json({
      success: false,
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// ✅ NEW: Update custom attributes
const updateCustomAttributes = async (req, res) => {
  try {
    const { productId } = req.params;
    const { customAttributes } = req.body;

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Update custom attributes
    if (customAttributes) {
      Object.entries(customAttributes).forEach(([key, value]) => {
        product.customAttributes.set(key, value);
      });
    }

    await product.save();

    res.json({
      success: true,
      data: product
    });

  } catch (error) {
    console.error('Error updating custom attributes:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Update product (standard admin update)
const updateProduct = async (req, res) => {
  try {
    console.log('Update product request received');
    console.log('Files received:', req.files);
    console.log('Body received:', {
      ...req.body,
      variants: JSON.parse(req.body.variants)
    });

    const productId = req.params.id;
    const { product_id, name, description, dimension, basePrice, category, collection } = req.body;
    let variants = JSON.parse(req.body.variants);

    // Find existing product
    const existingProduct = await Product.findById(productId);
    if (!existingProduct) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Process variants and match with uploaded files
    const processedVariants = variants.map((variant, index) => {
      // Case 1: New file upload for this variant
      if ('imageIndex' in variant && req.files?.[variant.imageIndex]) {
        const file = req.files[variant.imageIndex];
        console.log(`Processing new file upload for variant ${index}:`, file);
        return {
          finish: variant.finish || '',
          fabric: variant.fabric || '',
          size: variant.size || '',
          insetPanel: variant.insetPanel || '',
          price: parseFloat(variant.price),
          image: {
            url: file.location,
            key: file.key
          }
        };
      }
      // Case 2: Keeping existing image
      else if (variant.image?.url && variant.image?.key) {
        console.log(`Keeping existing image for variant ${index}:`, variant.image);
        return {
          finish: variant.finish || '',
          fabric: variant.fabric || '',
          size: variant.size || '',
          insetPanel: variant.insetPanel || '',
          price: parseFloat(variant.price),
          image: variant.image
        };
      }
      // Case 3: No image (either deleted or never had one)
      else {
        console.log(`No image for variant ${index}`);
        return {
          finish: variant.finish || '',
          fabric: variant.fabric || '',
          size: variant.size || '',
          insetPanel: variant.insetPanel || '',
          price: parseFloat(variant.price),
          image: null
        };
      }
    });

    console.log('Processed variants:', processedVariants);

    const updatedProduct = await Product.findByIdAndUpdate(
      productId,
      {
        product_id,
        name,
        description,
        category: category || existingProduct.category,
        collection: collection || existingProduct.collection,
        dimension,
        basePrice: parseFloat(basePrice),
        variants: processedVariants
      },
      { new: true }
    );

    console.log('Product updated successfully:', updatedProduct);
    res.json(updatedProduct);

  } catch (error) {
    console.error('Error in updateProduct:', error);
    res.status(500).json({ 
      message: 'Error updating product', 
      error: error.message,
      stack: error.stack 
    });
  }
};

// Delete product
const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Delete all variant images from S3
    await Promise.all(product.variants.map(async (variant) => {
      if (variant.image?.key) {
        try {
          await s3Client.send(new DeleteObjectCommand({
            Bucket: process.env.SPACES_BUCKET,
            Key: variant.image.key
          }));
        } catch (error) {
          console.error('Error deleting image:', error);
        }
      }
    }));

    await Product.deleteOne({ _id: req.params.id });
    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Error in deleteProduct:', error);
    res.status(500).json({ message: 'Error deleting product' });
  }
};

// Get single product
const getProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    res.json(product);
  } catch (error) {
    console.error('Error in getProduct:', error);
    res.status(500).json({ message: 'Error fetching product' });
  }
};

// Get products basic info
const getProductsBasicInfo = async (req, res) => {
  try {
    const products = await Product.find()
      .select('_id name product_id') // Only select necessary fields
      .sort({ createdAt: -1 });
    
    res.json({ products });
  } catch (error) {
    console.error('Error in getProductsBasicInfo:', error);
    res.status(500).json({ message: 'Error fetching products' });
  }
};

// Get product variants
const getProductVariants = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Get all variants for this product
    const variants = product.variants;
    
    res.json({
      variants,
      basePrice: product.basePrice,
      description: product.description,
    });
  } catch (error) {
    console.error('Error in getProductVariants:', error);
    res.status(500).json({ message: 'Error fetching product variants' });
  }
};

// Bulk delete products
const bulkDeleteProducts = async (req, res) => {
  try {
    const { product_ids } = req.body;
    
    if (!Array.isArray(product_ids) || product_ids.length === 0) {
      return res.status(400).json({ message: 'Product IDs array is required' });
    }

    // Find all products first
    const products = await Product.find({ product_id: { $in: product_ids } });
    
    // Delete all variant images from S3
    await Promise.all(products.flatMap(product => 
      product.variants.map(async (variant) => {
        if (variant.image?.key) {
          try {
            await s3Client.send(new DeleteObjectCommand({
              Bucket: process.env.SPACES_BUCKET,
              Key: variant.image.key
            }));
          } catch (error) {
            console.error('Error deleting image:', error);
          }
        }
      })
    ));

    // Delete the products
    const result = await Product.deleteMany({ product_id: { $in: product_ids } });

    res.json({ 
      message: 'Products deleted successfully',
      deletedCount: result.deletedCount 
    });
  } catch (error) {
    console.error('Error in bulkDeleteProducts:', error);
    res.status(500).json({ message: 'Error deleting products' });
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
  createProductFromCustomOrder, // ✅ NEW
  updateCustomAttributes // ✅ NEW
};