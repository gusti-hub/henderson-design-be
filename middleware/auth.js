const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Role = require('../models/Role');

const ALL_PERMISSIONS = [
  'view_dashboard', 'view_orders', 'view_expenses', 'view_vendors',
  'view_users', 'view_clients', 'view_products', 'view_product_mapping',
  'view_financial_review', 'view_role_management', 'view_logistic_tracker',
];

const resolvePermissions = async (user) => {
  if (user.role === 'admin') return ALL_PERMISSIONS;
  if (user.role === 'user') return [];
  const role = await Role.findOne({ name: user.role });
  return role ? role.permissions : [];
};

const protect = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }
    if (!token) return res.status(401).json({ message: 'Not authorized, no token' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id).select('-password');
    if (!req.user) return res.status(401).json({ message: 'User not found' });

    req.user.permissions = await resolvePermissions(req.user);
    next();
  } catch (error) {
    console.error('Error in auth middleware:', error);
    res.status(401).json({ message: 'Not authorized, token failed' });
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        message: `User role ${req.user.role} is not authorized to access this route`,
      });
    }
    next();
  };
};

const hasPermission = (action) => {
  return (req, res, next) => {
    if (!req.user.permissions.includes(action)) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }
    next();
  };
};

const restrictToEmails = (...emails) => {
  return (req, res, next) => {
    if (!emails.includes(req.user.email)) {
      return res.status(403).json({ message: 'You are not authorized to access this resource' });
    }
    next();
  };
};

module.exports = { protect, authorize, hasPermission, restrictToEmails };
