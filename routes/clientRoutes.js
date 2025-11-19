const express = require('express');
const router = express.Router();
const {
  getAllClients,
  getPendingClients,
  getPendingCount,
  getFloorPlans,
  getClientById,
  createClient,      // ✅ ADDED
  approveClient,
  rejectClient,
  updateClient,
  deleteClient,
  getClientStats,
  recordPayment
} = require('../controllers/clientController');
const { protect, authorize } = require('../middleware/auth');


// ⚠️ CRITICAL: Specific routes MUST come BEFORE parameterized routes

// 1. Statistics route
router.get('/stats', getClientStats);

// 2. Pending clients route
router.get('/pending', getPendingClients);

// 3. Pending count route
router.get('/pending-count', getPendingCount);

// 4. Floor plans route
router.get('/floor-plans', getFloorPlans);

router.get('/', protect, authorize('admin'), getAllClients);

// 6. Create new client
router.post('/', protect, authorize('admin'), createClient);

router.post('/:id/record-payment', protect, authorize('admin'), recordPayment);

// 7. Parameterized routes AFTER all specific routes
router.route('/:id')
  .get(getClientById)
  .put(updateClient)
  .delete(deleteClient);

// 8. Action routes on specific ID
router.put('/:id/approve', approveClient);
router.put('/:id/reject', rejectClient);

module.exports = router;