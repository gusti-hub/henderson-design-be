const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  getVendors,
  getVendorById,
  createVendor,
  updateVendor,
  deleteVendor,
  getVendorStats
} = require('../controllers/vendorController');

// All routes are protected
router.use(protect);

// Stats route - harus di atas /:id route
router.get('/stats', getVendorStats);

// CRUD routes
router.get('/', getVendors);
router.post('/', createVendor);
router.get('/:id', getVendorById);
router.put('/:id', updateVendor);
router.delete('/:id', deleteVendor);

module.exports = router;