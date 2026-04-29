// routes/productRoutes.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { 
  handleProductImagesUpload
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
  updateCustomAttributes,
  getProductCategories,
  bulkUpdatePreview,
  bulkUpdateProducts,
  exportAllProducts
} = require('../controllers/productController');

router.use(protect);

// ── Static routes (harus di atas /:id) ────────────────────────────────────
router.get('/basic-info',            getProductsBasicInfo);
router.get('/categories',            getProductCategories);
router.get('/export/all',            exportAllProducts);
router.post('/bulk-delete',          bulkDeleteProducts);
router.post('/bulk-update/preview',  bulkUpdatePreview);
router.put('/bulk-update',           bulkUpdateProducts);
router.post('/custom-order-product', createProductFromCustomOrder);

// ── Collection route ───────────────────────────────────────────────────────
router.route('/')
  .get(getProducts)
  .post(handleProductImagesUpload, createProduct);

// ── Dynamic :id routes (harus paling bawah) ───────────────────────────────
router.get('/:id/variants',              getProductVariants);
router.put('/:id/custom-attributes',     updateCustomAttributes);

router.route('/:id')
  .get(getProduct)
  .put(handleProductImagesUpload, updateProduct)
  .delete(deleteProduct);

module.exports = router;