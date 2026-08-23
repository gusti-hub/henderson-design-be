const express = require('express');
const router = express.Router();
const { protect, hasPermission } = require('../middleware/auth');
const { getRoles, getAllActions, createRole, updateRole, deleteRole } = require('../controllers/roleController');

router.use(protect);

router.get('/actions', getAllActions);
router.get('/', getRoles);
router.post('/', hasPermission('view_role_management'), createRole);
router.put('/:id', hasPermission('view_role_management'), updateRole);
router.delete('/:id', hasPermission('view_role_management'), deleteRole);

module.exports = router;
