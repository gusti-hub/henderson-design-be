const Product = require('../models/Product');
const { upload } = require('../config/s3');
const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { s3Client } = require('../config/s3');

// Get all products with pagination and search
const getProducts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || '';
    const skip = (page - 1) * limit;

    const searchQuery = {
      $or: [
        { product_id: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ]
    };

    const total = await Product.countDocuments(searchQuery);
    const products = await Product.find(searchQuery)
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

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

// controllers/productController.js
const createProduct = async (req, res) => {
  try {
    console.log('Create product request received');
    console.log('Files:', req.files);
    console.log('Body:', req.body);

    const { product_id, name, description, dimension, basePrice } = req.body;
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
      dimension,
      basePrice: parseFloat(basePrice),
      variants: processedVariants
    });

    res.status(201).json(product);
  } catch (error) {
    console.error('Error in createProduct:', error);
    res.status(500).json({ message: error.message });
  }
};

// controllers/productController.js
const updateProduct = async (req, res) => {
  try {
    console.log('Update product request received');
    console.log('Files received:', req.files);
    console.log('Body received:', {
      ...req.body,
      variants: JSON.parse(req.body.variants)
    });

    const productId = req.params.id;
    const { product_id, name, description, dimension, basePrice } = req.body;
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
  bulkDeleteProducts
};