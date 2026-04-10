// config/s3.js - COMPLETE VERSION WITH DIRECT URLS (NO CDN)
const { S3Client } = require('@aws-sdk/client-s3');
const multer = require('multer');
const multerS3 = require('multer-s3');
const path = require('path');
const { PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

// ✅ HARDCODED CONFIGURATION
const HARDCODED_CONFIG = {
  region: 'sfo3',
  bucket: 'hale-project',
  accessKeyId: 'DO00JTQD8XWPQHHGTJ7K',
  secretAccessKey: 'Mij6txNAamFqYtbjyJZQo3z4I6ey3//o/TNlBLkEzpo',
  endpoint: 'https://sfo3.digitaloceanspaces.com'
};

console.log('✅ S3 Configuration (Direct URLs - No CDN):', {
  region: HARDCODED_CONFIG.region,
  endpoint: HARDCODED_CONFIG.endpoint,
  bucket: HARDCODED_CONFIG.bucket,
  forcePathStyle: true,
  urlFormat: `https://${HARDCODED_CONFIG.bucket}.${HARDCODED_CONFIG.region}.digitaloceanspaces.com/`
});

// ✅ Initialize S3 Client
const s3Client = new S3Client({
  endpoint: HARDCODED_CONFIG.endpoint,
  region: HARDCODED_CONFIG.region,
  credentials: {
    accessKeyId: HARDCODED_CONFIG.accessKeyId,
    secretAccessKey: HARDCODED_CONFIG.secretAccessKey
  },
  forcePathStyle: true,  // ✅ Required for Digital Ocean
  maxAttempts: 3
});

// ===================================
// HELPER FUNCTIONS
// ===================================

// ✅ Generate unique filename
const generateUniqueFilename = (originalname, prefix = '') => {
  const sanitized = originalname.replace(/[^a-zA-Z0-9.-]/g, '-');
  const timestamp = Date.now();
  const random = Math.round(Math.random() * 1E9);
  const ext = path.extname(sanitized);
  const name = path.basename(sanitized, ext);
  return `${prefix}${timestamp}-${random}-${name}${ext}`;
};

// ✅ Convert S3 key to direct public URL (NO CDN - real-time)
const convertToDirectUrl = (key) => {
  return `https://${HARDCODED_CONFIG.bucket}.${HARDCODED_CONFIG.region}.digitaloceanspaces.com/${key}`;
};

// ===================================
// PRODUCT IMAGES STORAGE
// ===================================
const productImageStorage = multerS3({
  s3: s3Client,
  bucket: HARDCODED_CONFIG.bucket,
  contentType: multerS3.AUTO_CONTENT_TYPE,
  key: function (req, file, cb) {
    const filename = generateUniqueFilename(file.originalname, 'product-');
    const key = `product-images/${filename}`;
    console.log('📤 Uploading product image:', key);
    cb(null, key);
  },
  metadata: function (req, file, cb) {
    cb(null, { 
      fieldName: file.fieldname,
      originalName: file.originalname,
      uploadedAt: new Date().toISOString()
    });
  }
});

const uploadProductImages = multer({
  storage: productImageStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB per image
    files: 10 // Max 10 images
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed (jpeg, jpg, png, gif, webp)'));
    }
  }
}).array('images', 10);

// ===================================
// FLOOR PLAN STORAGE
// ===================================
const floorPlanStorage = multerS3({
  s3: s3Client,
  bucket: HARDCODED_CONFIG.bucket,
  contentType: multerS3.AUTO_CONTENT_TYPE,
  key: function (req, file, cb) {
    const filename = generateUniqueFilename(file.originalname, 'floorplan-');
    const key = `floor-plans/${filename}`;
    console.log('📤 Uploading floor plan:', key);
    cb(null, key);
  },
  metadata: function (req, file, cb) {
    cb(null, { 
      fieldName: file.fieldname,
      originalName: file.originalname,
      orderId: req.params.orderId,
      uploadedAt: new Date().toISOString()
    });
  }
});

const uploadFloorPlan = multer({
  storage: floorPlanStorage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 1
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|pdf|dwg|dxf|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    
    if (extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image or CAD files are allowed (jpeg, jpg, png, pdf, dwg, dxf)'));
    }
  }
}).single('floorPlan');

// ===================================
// PAYMENT PROOF STORAGE
// ===================================
const paymentProofStorage = multerS3({
  s3: s3Client,
  bucket: HARDCODED_CONFIG.bucket,
  contentType: multerS3.AUTO_CONTENT_TYPE,
  key: function (req, file, cb) {
    const filename = generateUniqueFilename(file.originalname, 'payment-');
    const key = `payment-proofs/${filename}`;
    console.log('📤 Uploading payment proof:', key);
    cb(null, key);
  },
  metadata: function (req, file, cb) {
    cb(null, { 
      fieldName: file.fieldname,
      orderId: req.params.id,
      installmentIndex: req.body.installmentIndex,
      uploadedAt: new Date().toISOString()
    });
  }
});

const uploadPaymentProof = multer({
  storage: paymentProofStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
    files: 1
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|pdf/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image or PDF files are allowed for payment proof'));
    }
  }
}).single('paymentProof');

// ===================================
// ERROR HANDLING WRAPPERS
// ===================================

// ✅ Product Images Upload Handler
const handleProductImagesUpload = (req, res, next) => {
  uploadProductImages(req, res, function(err) {
    if (err) {
      console.error('❌ Product images upload error:', {
        name: err.name,
        message: err.message,
        code: err.code
      });

      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            success: false,
            message: 'File size too large (max 5MB per image)',
            error: err.message
          });
        }
        if (err.code === 'LIMIT_FILE_COUNT') {
          return res.status(400).json({
            success: false,
            message: 'Too many files (max 10 images)',
            error: err.message
          });
        }
        return res.status(400).json({
          success: false,
          message: 'File upload error',
          error: err.message,
          code: err.code
        });
      }

      return res.status(500).json({
        success: false,
        message: 'Error uploading to storage',
        error: err.message
      });
    }

    // ✅ Convert URLs to direct format (no CDN)
    if (req.files && req.files.length > 0) {
      req.files = req.files.map(file => ({
        ...file,
        location: convertToDirectUrl(file.key)
      }));
      console.log(`✅ Uploaded ${req.files.length} product image(s) with direct URLs`);
      req.files.forEach((file, idx) => {
        console.log(`   ${idx + 1}. ${file.location}`);
      });
    }

    next();
  });
};

// ✅ Floor Plan Upload Handler
const handleFloorPlanUpload = (req, res, next) => {
  uploadFloorPlan(req, res, function(err) {
    if (err) {
      console.error('❌ Floor plan upload error:', {
        name: err.name,
        message: err.message,
        code: err.code
      });

      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            success: false,
            message: 'File size too large (max 10MB)',
            error: err.message
          });
        }
        return res.status(400).json({
          success: false,
          message: 'File upload error',
          error: err.message,
          code: err.code
        });
      }

      return res.status(500).json({
        success: false,
        message: 'Error uploading floor plan',
        error: err.message
      });
    }

    // ✅ Convert URL to direct format (no CDN)
    if (req.file) {
      req.file.location = convertToDirectUrl(req.file.key);
      console.log('✅ Floor plan uploaded successfully (direct URL):');
      console.log('   URL:', req.file.location);
      console.log('   Key:', req.file.key);
      console.log('   Size:', (req.file.size / 1024).toFixed(2), 'KB');
    } else {
      console.warn('⚠️ No file found in request after upload');
    }

    next();
  });
};

// ✅ Payment Proof Upload Handler
const handlePaymentProofUpload = (req, res, next) => {
  uploadPaymentProof(req, res, function(err) {
    if (err) {
      console.error('❌ Payment proof upload error:', {
        name: err.name,
        message: err.message,
        code: err.code
      });

      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            success: false,
            message: 'File size too large (max 5MB)',
            error: err.message
          });
        }
        return res.status(400).json({
          success: false,
          message: 'File upload error',
          error: err.message,
          code: err.code
        });
      }

      return res.status(500).json({
        success: false,
        message: 'Error uploading payment proof',
        error: err.message
      });
    }

    // ✅ Convert URL to direct format (no CDN)
    if (req.file) {
      req.file.location = convertToDirectUrl(req.file.key);
      console.log('✅ Payment proof uploaded successfully (direct URL):');
      console.log('   URL:', req.file.location);
    }

    next();
  });
};

const generatePresignedUploadUrl = async ({ folder, filename, contentType }) => {
  const sanitized = filename.replace(/[^a-zA-Z0-9.-]/g, '-');
  const key = `${folder}/${Date.now()}-${Math.round(Math.random() * 1e9)}-${sanitized}`;

  const command = new PutObjectCommand({
    Bucket: HARDCODED_CONFIG.bucket,
    Key: key,
    ContentType: contentType,
    ACL: 'public-read',
  });

  const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 });
  const publicUrl = convertToDirectUrl(key);

  return { uploadUrl, key, publicUrl };
};

// ===================================
// EXPORTS
// ===================================
module.exports = { 
  s3Client,
  handleProductImagesUpload,
  handleFloorPlanUpload,
  handlePaymentProofUpload,
  // ✅ Export helper for use in controllers if needed
  convertToDirectUrl,
  generatePresignedUploadUrl,
  HARDCODED_CONFIG
};