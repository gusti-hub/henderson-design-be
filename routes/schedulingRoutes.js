// routes/schedulingRoutes.js
const express = require('express');
const router = express.Router();

const {
  getAvailabilityConfig,
  getAvailableDates,
  getAvailableSlots,
  bookAppointment,
  getAppointment,
  cancelAppointment
} = require('../controllers/schedulingController');

// FE kamu sudah pakai:
router.get('/config', getAvailabilityConfig);
router.get('/available-dates', getAvailableDates);
router.get('/available-slots', getAvailableSlots);
router.post('/book', bookAppointment);

// extra (kalau mau dipakai nanti)
router.get('/appointment/:id', getAppointment);
router.put('/cancel/:id', cancelAppointment);

module.exports = router;
