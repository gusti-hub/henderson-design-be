// config/s3.js
const { S3Client } = require('@aws-sdk/client-s3');
const multer = require('multer');
const multerS3 = require('multer-s3');

// Add debug logging
console.log('S3 Configuration:', {
  region: process.env.SPACES_REGION,
  endpoint: `https://${process.env.SPACES_REGION}.digitaloceanspaces.com`,
  bucket: process.env.SPACES_BUCKET
});

const s3Client = new S3Client({
  endpoint: `https://${process.env.SPACES_REGION}.digitaloceanspaces.com`,
  region: process.env.SPACES_REGION,
  credentials: {
    accessKeyId: process.env.SPACES_KEY,
    secretAccessKey: process.env.SPACES_SECRET
  },
  forcePathStyle: false,
  // Add these options for better error handling
  maxAttempts: 3,
  logger: console
});

const storageConfig = multerS3({
  s3: s3Client,
  bucket: process.env.SPACES_BUCKET,
  acl: 'public-read',
  key: function (req, file, cb) {
    // Sanitize filename
    const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '-');
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const key = `product-images/${uniqueSuffix}-${sanitizedName}`;
    console.log('Generated key:', key);
    cb(null, key);
  },
  metadata: function (req, file, cb) {
    cb(null, { fieldName: file.fieldname });
  }
});

// Create upload middleware with error handling
const uploadMiddleware = multer({
  storage: storageConfig,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 10 // Maximum 10 files
  }
}).array('images');

// Wrap upload in promise for better error handling
const handleUpload = (req, res, next) => {
  uploadMiddleware(req, res, function(err) {
    console.log('Upload attempt started');
    
    if (err) {
      console.error('Upload error details:', {
        name: err.name,
        message: err.message,
        stack: err.stack,
        code: err.code
      });

      if (err instanceof multer.MulterError) {
        return res.status(400).json({
          message: 'File upload error',
          error: err.message,
          code: err.code
        });
      }

      // Log more details about the S3 error
      if (err.$metadata) {
        console.error('S3 Error Metadata:', {
          httpStatusCode: err.$metadata.httpStatusCode,
          requestId: err.$metadata.requestId,
          attempts: err.$metadata.attempts
        });
      }

      return res.status(500).json({
        message: 'Error uploading to Digital Ocean Spaces',
        error: err.message,
        details: err.stack
      });
    }

    if (!req.files) {
      console.log('No files were uploaded');
    } else {
      console.log('Files uploaded successfully:', req.files.map(f => ({
        fieldname: f.fieldname,
        key: f.key,
        location: f.location
      })));
    }

    next();
  });
};

module.exports = { s3Client, handleUpload };