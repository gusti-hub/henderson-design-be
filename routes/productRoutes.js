const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const multer = require('multer');
const { handleUpload } = require('../config/s3');
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

// ✅ IMPORTANT: All routes must be AFTER router.use(protect)
// but SPECIFIC routes must come BEFORE dynamic routes (/:id)

// Protected routes - require authentication
router.use(protect);

// ✅ STEP 1: Static/specific routes FIRST (before /:id)
router.get('/basic-info', getProductsBasicInfo);
router.post('/bulk-delete', bulkDeleteProducts);

// ✅ STEP 2: Custom order routes (specific paths before /:id)
router.post('/custom-order-product', createProductFromCustomOrder);

// ✅ STEP 3: Routes with specific patterns (before /:id)
router.get('/:id/variants', getProductVariants);
router.put('/:id/custom-attributes', updateCustomAttributes);

// ✅ STEP 4: Main collection route
router.route('/')
  .get(getProducts)
  .post(handleUpload, createProduct);

// ✅ STEP 5: Dynamic ID routes LAST (catches everything else)
router.route('/:id')
  .get(getProduct)
  .put(handleUpload, updateProduct)
  .delete(deleteProduct);

module.exports = router;