import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsRoot = path.join(__dirname, '..', '..', 'storage', 'uploads');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const folder = req.query.folder || '';
    const dest = folder ? path.join(uploadsRoot, folder) : uploadsRoot;
    fs.mkdirSync(dest, { recursive: true });
    cb(null, dest);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp|svg/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    if (ext && mime) return cb(null, true);
    cb(new Error('Only image files (jpg, png, gif, webp, svg) are allowed'));
  }
});

const router = Router();

router.post('/', upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No image file provided' });
  }
  const folder = req.query.folder || '';
  const url = folder ? `/storage/uploads/${folder}/${req.file.filename}` : `/storage/uploads/${req.file.filename}`;
  res.json({ url, filename: req.file.filename });
});

router.post('/multiple', upload.array('images', 10), (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ message: 'No image files provided' });
  }
  const folder = req.query.folder || '';
  const files = req.files.map((f) => ({
    url: folder ? `/storage/uploads/${folder}/${f.filename}` : `/storage/uploads/${f.filename}`,
    filename: f.filename
  }));
  res.json({ files });
});

export default router;
