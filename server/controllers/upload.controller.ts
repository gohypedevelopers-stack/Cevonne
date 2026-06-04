import {
  UPLOADS_DIR,
  buildUploadUrl,
  ensureUploadsDir,
  ensureUploadFileExists,
  removeUploadFile,
} from "../services/upload.service";

const cjsModule = { exports: {} as Record<string, any> };
const exports = cjsModule.exports as Record<string, any>;

if (!process.env.VERCEL) {
  void ensureUploadsDir().catch((error) => {
    console.warn('Failed to prepare uploads directory', error);
  });
}

const uploadSuccess = (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded' });
  }

  const fileUrl = buildUploadUrl(`${req.protocol}://${req.get('host')}`, req.file.filename);
  return res.status(201).json({
    url: fileUrl,
    filename: req.file.filename,
    originalName: req.file.originalname,
    size: req.file.size,
  });
};

const deleteUpload = (req, res) => {
  const filename = req.params.filename;
  if (!ensureUploadFileExists(filename)) {
    return res.status(404).json({ message: 'File not found' });
  }

  removeUploadFile(filename);
  return res.status(204).send();
};

cjsModule.exports = {
  uploadSuccess,
  deleteUpload,
};

export default cjsModule.exports;
