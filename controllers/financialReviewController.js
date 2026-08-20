const { PutObjectCommand } = require('@aws-sdk/client-s3');
const { s3Client, convertToDirectUrl, HARDCODED_CONFIG } = require('../config/s3');
const FinancialReviewSnapshot = require('../models/FinancialReviewSnapshot');
const { parseFinancialReviewWorkbook } = require('../utils/parseFinancialReviewWorkbook');

const listSnapshots = async (req, res) => {
  try {
    const snapshots = await FinancialReviewSnapshot.find({})
      .select('reportDate uploadedBy uploadedByName uploadedAt file createdAt')
      .sort({ reportDate: -1, createdAt: -1 });
    res.json(snapshots);
  } catch (error) {
    console.error('Error listing financial review snapshots:', error);
    res.status(500).json({ message: 'Failed to list financial review snapshots' });
  }
};

const getLatestSnapshot = async (req, res) => {
  try {
    const snapshot = await FinancialReviewSnapshot.findOne({})
      .sort({ reportDate: -1, createdAt: -1 });
    if (!snapshot) {
      return res.status(404).json({ message: 'No financial review snapshot uploaded yet' });
    }
    res.json(snapshot);
  } catch (error) {
    console.error('Error fetching latest financial review snapshot:', error);
    res.status(500).json({ message: 'Failed to fetch latest financial review snapshot' });
  }
};

const getSnapshotById = async (req, res) => {
  try {
    const snapshot = await FinancialReviewSnapshot.findById(req.params.id);
    if (!snapshot) {
      return res.status(404).json({ message: 'Snapshot not found' });
    }
    res.json(snapshot);
  } catch (error) {
    console.error('Error fetching financial review snapshot:', error);
    res.status(500).json({ message: 'Failed to fetch financial review snapshot' });
  }
};

const downloadSnapshotFile = async (req, res) => {
  try {
    const snapshot = await FinancialReviewSnapshot.findById(req.params.id);
    if (!snapshot || !snapshot.file || !snapshot.file.url) {
      return res.status(404).json({ message: 'File not found for this snapshot' });
    }
    res.redirect(snapshot.file.url);
  } catch (error) {
    console.error('Error downloading financial review file:', error);
    res.status(500).json({ message: 'Failed to download financial review file' });
  }
};

const uploadSnapshot = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const { reportDate, sheets } = await parseFinancialReviewWorkbook(req.file.buffer);

    const sanitized = req.file.originalname.replace(/[^a-zA-Z0-9.-]/g, '-');
    const key = `financial-reviews/${Date.now()}-${Math.round(Math.random() * 1e9)}-${sanitized}`;

    await s3Client.send(new PutObjectCommand({
      Bucket: HARDCODED_CONFIG.bucket,
      Key: key,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
    }));

    const snapshot = await FinancialReviewSnapshot.create({
      reportDate: reportDate || new Date(),
      uploadedBy: req.user._id,
      uploadedByName: req.user.name || req.user.email,
      file: {
        filename: req.file.originalname,
        key,
        url: convertToDirectUrl(key),
        size: req.file.size,
      },
      sheets,
    });

    res.status(201).json(snapshot);
  } catch (error) {
    console.error('Error uploading financial review snapshot:', error);
    res.status(500).json({ message: 'Failed to upload financial review snapshot', error: error.message });
  }
};

module.exports = {
  listSnapshots,
  getLatestSnapshot,
  getSnapshotById,
  downloadSnapshotFile,
  uploadSnapshot,
};
