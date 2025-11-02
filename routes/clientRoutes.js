// clientRoutes.js
const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  getClients,
  getClient,
  createClient,
  updateClient,
  deleteClient,
  approveClient,
  rejectClient,
  getPendingCount,
  getFloorPlans,
  recordDownPayment,
  updateDownPaymentStatus,
  getPaymentSummary
} = require('../controllers/clientController');

// All routes require authentication
router.use(protect);

// Client CRUD routes
router.route('/')
  .get(getClients)
  .post(createClient);

// Floor plans route
router.route('/floor-plans')
  .get(getFloorPlans);

// Pending count route
router.route('/pending-count')
  .get(getPendingCount);

// Client approval/rejection routes
router.route('/:id/approve')
  .put(authorize('admin'), approveClient);

router.route('/:id/reject')
  .put(authorize('admin'), rejectClient);

// Individual client routes
router.route('/:id')
  .get(getClient)
  .put(updateClient)
  .delete(deleteClient);

// In routes/clientRoutes.js
router.post('/:id/record-payment', protect, authorize('admin'), recordDownPayment);
router.put('/:id/payment-status', protect, authorize('admin'), updateDownPaymentStatus);
router.get('/:id/payment-summary', protect, authorize('admin'), getPaymentSummary);

module.exports = router;