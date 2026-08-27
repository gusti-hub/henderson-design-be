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
  exportClientsToExcel,
  updateProjectSummary
} = require('../controllers/clientController');
const { protect, authorize, hasPermission } = require('../middleware/auth');

// ⚠️ SEMUA specific routes HARUS sebelum /:id

router.get('/stats',         getClientStats);
router.get('/pending',       getPendingClients);
router.get('/pending-count', getPendingCount);
router.get('/floor-plans',   getFloorPlans);
router.get('/export',        protect, exportClientsToExcel);

router.get('/',  protect, hasPermission('view_clients'), getAllClients);
router.post('/', protect, createClient);

router.post('/:id/record-payment', protect, recordPayment);
router.put('/:id/project-summary', protect, updateProjectSummary);

// Parameterized routes PALING BAWAH
router.route('/:id')
  .get(getClientById)
  .put(updateClient)
  .delete(deleteClient);

router.put('/:id/approve', approveClient);
router.put('/:id/reject',  rejectClient);

module.exports = router;