const express = require('express');

const { uploadSuccess, deleteUpload } = require('../controllers/upload.controller');
const { createUploadMiddleware, isUploadRuntimeDisabled } = require('../middleware/upload');

const router = express.Router();
if (isUploadRuntimeDisabled()) {
  router.post('/', (_req, res) => {
    return res.status(501).json({
      message:
        'File uploads are not supported on Vercel because the function filesystem is ephemeral. Use object storage such as S3, Cloudinary, or R2.',
    });
  });

  router.delete('/:filename', (_req, res) => {
    return res.status(501).json({
      message:
        'File deletion is not supported on Vercel because uploaded files are not stored on a persistent filesystem.',
    });
  });
} else {
  const upload = createUploadMiddleware();

  router.post('/', upload.single('image'), uploadSuccess);
  router.delete('/:filename', deleteUpload);
}

module.exports = router;

export {};
