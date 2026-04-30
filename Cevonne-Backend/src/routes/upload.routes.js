const express = require('express');
const multer = require('multer');
const path = require('node:path');
const crypto = require('node:crypto');

const { uploadSuccess, deleteUpload } = require('../controllers/upload.controller');

const router = express.Router();
const isVercel = Boolean(process.env.VERCEL);

const uploadsDir = path.join(__dirname, '../../uploads');

if (isVercel) {
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
  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, uploadsDir);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname);
      const name = path.basename(file.originalname, ext);
      const unique = crypto.randomUUID();
      cb(null, `${name}-${unique}${ext}`);
    },
  });

  const upload = multer({
    storage,
    limits: {
      fileSize: 5 * 1024 * 1024,
    },
  });

  router.post('/', upload.single('image'), uploadSuccess);
  router.delete('/:filename', deleteUpload);
}

module.exports = router;
