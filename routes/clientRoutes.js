const express = require('express');
const router = express.Router();
const {
  getAllClients,
  getPendingClients,
  getPendingCount,
  getFloorPlans,
  getClientById,
  createClient,
  approveClient,
  rejectClient,
  updateClient,
  deleteClient,
  getClientStats,
  recordPayment,
  exportClientsToExcel
} = require('../controllers/clientController');
const { protect, authorize } = require('../middleware/auth');

// ⚠️ SEMUA specific routes HARUS sebelum /:id

router.get('/stats',         getClientStats);
router.get('/pending',       getPendingClients);
router.get('/pending-count', getPendingCount);
router.get('/floor-plans',   getFloorPlans);
router.get('/export',        protect, authorize('admin'), exportClientsToExcel); // ✅ PINDAH KE SINI

router.get('/',  protect, authorize('admin'), getAllClients);
router.post('/', protect, authorize('admin'), createClient);

router.post('/:id/record-payment', protect, authorize('admin'), recordPayment);

// Parameterized routes PALING BAWAH
router.route('/:id')
  .get(getClientById)
  .put(updateClient)
  .delete(deleteClient);

router.put('/:id/approve', approveClient);
router.put('/:id/reject',  rejectClient);

module.exports = router;