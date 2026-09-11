const Role = require('../models/Role');

const ALL_ACTIONS = [
  'view_dashboard',
  'view_orders',
  'view_expenses',
  'view_vendors',
  'manage_vendors',
  'view_users',
  'view_clients',
  'view_products',
  'view_product_mapping',
  'view_financial_review',
  'view_role_management',
  'view_logistic_tracker',
];


const getRoles = async (req, res) => {
  try {
    const roles = await Role.find().sort({ name: 1 });
    res.json(roles);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getAllActions = (req, res) => {
  res.json(ALL_ACTIONS);
};

const createRole = async (req, res) => {
  try {
    const { name, description, permissions } = req.body;
    if (!name) return res.status(400).json({ message: 'Role name is required' });
    const exists = await Role.findOne({ name });
    if (exists) return res.status(409).json({ message: 'Role name already exists' });
    const role = await Role.create({ name, description: description || '', permissions: permissions || [] });
    res.status(201).json(role);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const updateRole = async (req, res) => {
  try {
    const role = await Role.findById(req.params.id);
    if (!role) return res.status(404).json({ message: 'Role not found' });
    const { name, description, permissions } = req.body;
    if (!role.isSystem && name) role.name = name;
    if (description !== undefined) role.description = description;
    if (permissions) role.permissions = permissions;
    await role.save();
    res.json(role);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const deleteRole = async (req, res) => {
  try {
    const role = await Role.findById(req.params.id);
    if (!role) return res.status(404).json({ message: 'Role not found' });
    if (role.isSystem) return res.status(403).json({ message: 'System roles cannot be deleted' });
    await role.deleteOne();
    res.json({ message: 'Role deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { getRoles, getAllActions, createRole, updateRole, deleteRole };
