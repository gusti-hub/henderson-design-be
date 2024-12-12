const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  getClients,
  getClient,
  createClient,
  updateClient,
  deleteClient,
  getFloorPlans
} = require('../controllers/clientController');

// Protected routes
router.use(protect);

// Client routes
router.route('/')
  .get(getClients)
  .post(createClient);

// Floor Plan
router.route('/floor-plans')
.get(getFloorPlans);

router.route('/:id')
  .get(getClient)
  .put(updateClient)
  .delete(deleteClient);

module.exports = router;