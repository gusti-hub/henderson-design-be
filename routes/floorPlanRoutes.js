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
  generatePDF,
} = require('../controllers/floorPlanController');

router.post('/upload-url',              protect,getUploadUrl);
router.get ('/:clientUserId',           protect,getFloorPlans);
router.get ('/:clientUserId/products',  protect,getClientProducts);
router.get ('/:clientUserId/pdf',       protect,generatePDF);
router.post('/:clientUserId',           protect,createFloorPlan);
router.put ('/:id/pins',                protect,updatePins);
router.delete('/:id',                   protect,deleteFloorPlan);

module.exports = router;
