const express = require('express');
const multer = require('multer');
const router = express.Router();
const { protect, restrictToEmails } = require('../middleware/auth');
const {
  listSnapshots,
  getLatestSnapshot,
  getSnapshotById,
  downloadSnapshotFile,
  uploadSnapshot,
} = require('../controllers/financialReviewController');

const FINANCIAL_DASHBOARD_EMAIL = process.env.FINANCIAL_DASHBOARD_EMAIL || 'agustianggaraputra@gmail.com';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const isXlsx = /\.xlsx$/i.test(file.originalname);
    if (!isXlsx) {
      return cb(new Error('Only .xlsx files are allowed'));
    }
    cb(null, true);
  },
});

// Both viewing and updating this resource are restricted to a single account.
router.use(protect, restrictToEmails(FINANCIAL_DASHBOARD_EMAIL));

router.get('/', listSnapshots);
router.get('/latest', getLatestSnapshot);
router.get('/:id', getSnapshotById);
router.get('/:id/download', downloadSnapshotFile);
const handleUpload = (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ message: err.message || 'File upload error' });
    }
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }
    next();
  });
};

router.post('/upload', handleUpload, uploadSnapshot);

module.exports = router;
