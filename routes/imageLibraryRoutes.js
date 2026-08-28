const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { listImages, getPresignedUrl, deleteImage } = require('../controllers/imageLibraryController');

router.use(protect);

router.get('/', listImages);
router.post('/presigned-url', getPresignedUrl);
router.delete('/:key(*)', deleteImage);

module.exports = router;
