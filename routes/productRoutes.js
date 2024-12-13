
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const multer = require('multer');
const {
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  getProductsBasicInfo,
  getProductVariants
} = require('../controllers/productController');

// Configure multer for memory storage (for MongoDB blob storage)
const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
    limits: {
      fileSize: 5 * 1024 * 1024 // 5MB limit
    }
}).array('images', 10); // Allow up to 10 images

// Protected routes
router.use(protect);

// Wrap the upload middleware to handle errors
const handleUpload = (req, res, next) => {
    upload(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        return res.status(400).json({ message: `Upload error: ${err.message}` });
      } else if (err) {
        return res.status(500).json({ message: `Server error: ${err.message}` });
      }
      next();
    });
};

router.get('/basic-info', protect, getProductsBasicInfo);

// Product variants - for customization modal
router.get('/:id/variants', protect, getProductVariants);

// Product routes
router.route('/')
  .get(getProducts)
  .post(handleUpload, createProduct);

router.route('/:id')
  .get(getProduct)
  .put(handleUpload, updateProduct)
  .delete(deleteProduct);

module.exports = router;