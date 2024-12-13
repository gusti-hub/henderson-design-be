// controllers/productController.js
const Product = require('../models/Product');

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
        { name: { $regex: search, $options: 'i' } }
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
    console.log('Received body:', req.body); // Debug log
    console.log('Received files:', req.files); // Debug log

    const { product_id, name, basePrice } = req.body;
    let variants;

    try {
      // Parse variants if it's a string, otherwise use it directly
      variants = typeof req.body.variants === 'string' 
        ? JSON.parse(req.body.variants) 
        : req.body.variants;
    } catch (error) {
      console.error('Error parsing variants:', error);
      return res.status(400).json({ message: 'Invalid variants data' });
    }

    // Map variants with images
    const processedVariants = variants.map((variant, index) => {
      const variantImage = req.files?.[index];
      return {
        finish: variant.finish || '',
        fabric: variant.fabric || '',
        price: parseFloat(variant.price),
        image: variantImage ? {
          data: variantImage.buffer,
          contentType: variantImage.mimetype
        } : null
      };
    });

    // Create new product
    const product = await Product.create({
      product_id,
      name,
      basePrice: parseFloat(basePrice),
      variants: processedVariants
    });

    res.status(201).json(product);
  } catch (error) {
    console.error('Error in createProduct:', error);
    res.status(500).json({ message: error.message });
  }
};

// Update product
const updateProduct = async (req, res) => {
  try {
    console.log('Update request body:', req.body); // Debug log
    console.log('Update files:', req.files); // Debug log

    const { product_id, name, basePrice, variants } = req.body;
    const productId = req.params.id;

    // Find the product first
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Parse variants data
    const variantsData = JSON.parse(variants || '[]');
    
    // Process variants with images
    const processedVariants = variantsData.map((variant, index) => {
      const variantImage = req.files?.[index];
      return {
        finish: variant.finish || '',
        fabric: variant.fabric || '',
        price: parseFloat(variant.price),
        image: variantImage ? {
          data: variantImage.buffer,
          contentType: variantImage.mimetype
        } : variant.image // Keep existing image if no new one uploaded
      };
    });

    // Update the product
    const updatedProduct = await Product.findByIdAndUpdate(
      productId,
      {
        product_id,
        name,
        basePrice: parseFloat(basePrice),
        variants: processedVariants
      },
      { new: true } // Return updated document
    );

    res.json(updatedProduct);
  } catch (error) {
    console.error('Error in updateProduct:', error); // Debug log
    res.status(500).json({ message: 'Error updating product' });
  }
};

// Delete product
const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

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
      basePrice: product.basePrice
    });
  } catch (error) {
    console.error('Error in getProductVariants:', error);
    res.status(500).json({ message: 'Error fetching product variants' });
  }
};

module.exports = {
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  getProductsBasicInfo,
  getProductVariants
};