const { s3Client, generatePresignedUploadUrl, HARDCODED_CONFIG } = require('../config/s3');
const { ListObjectsV2Command, DeleteObjectCommand } = require('@aws-sdk/client-s3');

const FOLDER = 'image-library';

const listImages = async (req, res) => {
  try {
    const command = new ListObjectsV2Command({
      Bucket: HARDCODED_CONFIG.bucket,
      Prefix: `${FOLDER}/`,
    });
    const data = await s3Client.send(command);
    const images = (data.Contents || [])
      .filter(obj => obj.Key !== `${FOLDER}/`)
      .map(obj => ({
        key:          obj.Key,
        name:         obj.Key.split('/').pop(),
        url:          `https://${HARDCODED_CONFIG.bucket}.${HARDCODED_CONFIG.region}.digitaloceanspaces.com/${obj.Key}`,
        size:         obj.Size,
        lastModified: obj.LastModified,
      }))
      .sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified));
    res.json({ images });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getPresignedUrl = async (req, res) => {
  try {
    const { filename, contentType } = req.body;
    if (!filename || !contentType)
      return res.status(400).json({ message: 'filename and contentType are required' });
    const result = await generatePresignedUploadUrl({ folder: FOLDER, filename, contentType });
    res.json({ uploadUrl: result.uploadUrl, key: result.key, publicUrl: result.publicUrl });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const deleteImage = async (req, res) => {
  try {
    const key = decodeURIComponent(req.params.key);
    if (!key.startsWith(`${FOLDER}/`))
      return res.status(400).json({ message: 'Invalid key' });
    await s3Client.send(new DeleteObjectCommand({ Bucket: HARDCODED_CONFIG.bucket, Key: key }));
    res.json({ message: 'Deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { listImages, getPresignedUrl, deleteImage };
