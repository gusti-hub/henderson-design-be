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
  bulkDeleteProducts
} = require('../controllers/productController');

// Protected routes
router.use(protect);

router.get('/basic-info', protect, getProductsBasicInfo);
router.get('/:id/variants', protect, getProductVariants);

// Product routes
router.route('/')
  .get(getProducts)
  .post(handleUpload, createProduct);

router.route('/:id')
  .get(getProduct)
  .put(handleUpload, updateProduct)
  .delete(deleteProduct);

router.post('/bulk-delete', protect, bulkDeleteProducts);

module.exports = router;