const express = require('express');

const { uploadSuccess, deleteUpload } = require('../controllers/upload.controller');
const { createUploadMiddleware, isUploadRuntimeDisabled } = require('../middleware/upload');
const { protect, requireRole } = require('../middleware/auth');

const router = express.Router();
if (isUploadRuntimeDisabled()) {
  router.post('/', protect, requireRole('ADMIN'), (_req, res) => {
    return res.status(501).json({
      message:
        'File uploads are not supported on Vercel because the function filesystem is ephemeral. Use object storage such as S3, Cloudinary, or R2.',
    });
  });

  router.delete('/:filename', protect, requireRole('ADMIN'), (_req, res) => {
    return res.status(501).json({
      message:
        'File deletion is not supported on Vercel because uploaded files are not stored on a persistent filesystem.',
    });
  });
} else {
  const upload = createUploadMiddleware();

  router.post('/', protect, requireRole('ADMIN'), upload.single('image'), uploadSuccess);
  router.delete('/:filename', protect, requireRole('ADMIN'), deleteUpload);
}

module.exports = router;

export {};
