// routes/productRoutes.js - UPDATED
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { 
  handleProductImagesUpload  // ✅ CORRECT name from new s3.js
} = require('../config/s3');
const {
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  getProductsBasicInfo,
  getProductVariants,
  bulkDeleteProducts,
  createProductFromCustomOrder,
  updateCustomAttributes
} = require('../controllers/productController');

// Protected routes
router.use(protect);

// ✅ Static/specific routes FIRST
router.get('/basic-info', getProductsBasicInfo);
router.post('/bulk-delete', bulkDeleteProducts);

// ✅ Custom order routes
router.post('/custom-order-product', createProductFromCustomOrder);

// ✅ Routes with specific patterns
router.get('/:id/variants', getProductVariants);
router.put('/:id/custom-attributes', updateCustomAttributes);

// ✅ Main collection route - use handleProductImagesUpload
router.route('/')
  .get(getProducts)
  .post(handleProductImagesUpload, createProduct);

// ✅ Dynamic ID routes LAST
router.route('/:id')
  .get(getProduct)
  .put(handleProductImagesUpload, updateProduct)
  .delete(deleteProduct);

module.exports = router;