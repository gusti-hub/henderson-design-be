// routes/locationMappings.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  getMappings,
  getMapping,
  createMapping,
  updateMapping,
  deleteMapping,
  getLocationProducts
} = require('../controllers/locationMappingController');

// Protect all routes
router.use(protect);

// Main CRUD routes
router.route('/')
  .get(getMappings)
  .post(createMapping);

// Get products for location
router.get('/products', getLocationProducts);

router.route('/:id')
  .get(getMapping)
  .put(updateMapping)
  .delete(deleteMapping);

module.exports = router;