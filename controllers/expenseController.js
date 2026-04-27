// controllers/expenseController.js
const Expense = require('../models/Expense');

// ─── GET all expenses for an order ───────────────────────────────────────────
const getExpenses = async (req, res) => {
  try {
    const { orderId } = req.query;
    if (!orderId) return res.status(400).json({ message: 'orderId required' });

    const expenses = await Expense.find({ orderId })
      .sort({ createdAt: -1 })
      .lean();

    // Expose _id as id for frontend
    const mapped = expenses.map(inv => ({ ...inv, id: inv._id.toString() }));
    res.json({ expenses: mapped });
  } catch (error) {
    console.error('getExpenses error:', error);
    res.status(500).json({ message: error.message });
  }
};

// ─── GET single expense ───────────────────────────────────────────────────────
const getExpense = async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.id).lean();
    if (!expense) return res.status(404).json({ message: 'Expense not found' });
    res.json({ ...expense, id: expense._id.toString() });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── CREATE expense ───────────────────────────────────────────────────────────
const createExpense = async (req, res) => {
  try {
    const { orderId, expenseNumber, expenseDate, projectName, clientInfo, lines, taxRate, notes, status } = req.body;

    if (!orderId) return res.status(400).json({ message: 'orderId is required' });

    const expense = await Expense.create({
      orderId,
      expenseNumber: expenseNumber || `I-${Date.now().toString().slice(-6)}`,
      expenseDate:   expenseDate   || new Date().toISOString().split('T')[0],
      projectName:   projectName   || '',
      clientInfo:    clientInfo    || {},
      lines:         (lines || []).map(l => ({
        date:        l.date        || '',
        serviceType: l.serviceType || 'custom',
        description: l.description || '',
        hours:       parseFloat(l.hours)  || 1,
        rate:        parseFloat(l.rate)   || 0,
        amount:      parseFloat(l.amount) || 0,
        unit:        l.unit        || 'hr',
      })),
      taxRate: parseFloat(taxRate) || 4.5,
      notes:   notes  || '',
      status:  status || 'draft',
      createdBy: req.user?.id,
    });

    res.status(201).json({ ...expense.toJSON(), id: expense._id.toString() });
  } catch (error) {
    console.error('createExpense error:', error);
    res.status(500).json({ message: error.message });
  }
};

// ─── UPDATE expense ───────────────────────────────────────────────────────────
const updateExpense = async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.id);
    if (!expense) return res.status(404).json({ message: 'Expense not found' });

    const { expenseNumber, expenseDate, projectName, clientInfo, lines, taxRate, notes, status } = req.body;

    if (expenseNumber !== undefined) expense.expenseNumber = expenseNumber;
    if (expenseDate   !== undefined) expense.expenseDate   = expenseDate;
    if (projectName   !== undefined) expense.projectName   = projectName;
    if (clientInfo    !== undefined) expense.clientInfo    = clientInfo;
    if (taxRate       !== undefined) expense.taxRate       = parseFloat(taxRate);
    if (notes         !== undefined) expense.notes         = notes;
    if (status        !== undefined) expense.status        = status;
    if (lines         !== undefined) {
      expense.lines = lines.map(l => ({
        date:        l.date        || '',
        serviceType: l.serviceType || 'custom',
        description: l.description || '',
        hours:       parseFloat(l.hours)  || 1,
        rate:        parseFloat(l.rate)   || 0,
        amount:      parseFloat(l.amount) || 0,
        unit:        l.unit        || 'hr',
      }));
    }

    await expense.save();
    res.json({ ...expense.toJSON(), id: expense._id.toString() });
  } catch (error) {
    console.error('updateExpense error:', error);
    res.status(500).json({ message: error.message });
  }
};

// ─── DELETE expense ───────────────────────────────────────────────────────────
const deleteExpense = async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.id);
    if (!expense) return res.status(404).json({ message: 'Expense not found' });
    await Expense.deleteOne({ _id: req.params.id });
    res.json({ message: 'Expense deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getExpenses, getExpense, createExpense, updateExpense, deleteExpense };