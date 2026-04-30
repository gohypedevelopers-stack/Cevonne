const fs = require('node:fs');
const path = require('node:path');

const uploadsDir = path.join(__dirname, '../../uploads');

function ensureUploadsDir() {
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
}

ensureUploadsDir();

const getUploadUrl = (req, filename) => {
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  return `${baseUrl}/uploads/${filename}`;
};

const uploadSuccess = (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded' });
  }

  const fileUrl = getUploadUrl(req, req.file.filename);
  return res.status(201).json({
    url: fileUrl,
    filename: req.file.filename,
    originalName: req.file.originalname,
    size: req.file.size,
  });
};

const deleteUpload = (req, res) => {
  const filename = req.params.filename;
  const filepath = path.join(uploadsDir, filename);
  if (!fs.existsSync(filepath)) {
    return res.status(404).json({ message: 'File not found' });
  }

  fs.unlinkSync(filepath);
  return res.status(204).send();
};

module.exports = {
  uploadSuccess,
  deleteUpload,
};
