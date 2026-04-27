// routes/expenseRoutes.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  getExpenses,
  getExpense,
  createExpense,
  updateExpense,
  deleteExpense,
} = require('../controllers/expenseController');

router.use(protect);

router.get('/',          getExpenses);    // GET /api/expenses?orderId=xxx
router.post('/',         createExpense);  // POST /api/expenses
router.get('/:id',       getExpense);     // GET /api/expenses/:id
router.put('/:id',       updateExpense);  // PUT /api/expenses/:id
router.delete('/:id',    deleteExpense);  // DELETE /api/expenses/:id

module.exports = router;