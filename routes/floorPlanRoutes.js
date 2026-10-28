const express = require('express');
const router  = express.Router();
const { protect } = require('../middleware/auth');
const {
  getUploadUrl,
  getFloorPlans,
  createFloorPlan,
  updatePins,
  deleteFloorPlan,
  getClientProducts,
  generateInstallBinderExcelForClient,
} = require('../controllers/floorPlanController');
const { generateFieldPack } = require('../controllers/fieldPackController');
const { generateInternalBinder } = require('../controllers/internalBinderController');

router.post('/upload-url',              protect,getUploadUrl);
router.get ('/:clientUserId',           protect,getFloorPlans);
router.get ('/:clientUserId/products',  protect,getClientProducts);
router.get ('/:clientUserId/pdf',       protect,generateInternalBinder);   // Install Binder PDF = internal Standards Review format
router.get ('/:clientUserId/excel',     protect,generateInstallBinderExcelForClient);
router.get ('/:clientUserId/field-pack', protect,generateFieldPack);
router.post('/:clientUserId',           protect,createFloorPlan);
router.put ('/:id/pins',                protect,updatePins);
router.delete('/:id',                   protect,deleteFloorPlan);

module.exports = router;
