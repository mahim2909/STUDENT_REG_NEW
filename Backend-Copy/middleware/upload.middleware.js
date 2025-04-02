const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Create upload directories if they don't exist
const createDirectory = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

const uploadDirs = {
  profile: 'uploads/profiles',
  signature: 'uploads/signatures',
  resume: 'uploads/resumes',
  marksheet: 'uploads/marksheets'
};

// Create all required directories
Object.values(uploadDirs).forEach(createDirectory);

// Configure storage for different file types
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let uploadPath;

    if (file.fieldname === 'photo') {
      uploadPath = uploadDirs.profile;
    } else if (file.fieldname === 'signature') {
      uploadPath = uploadDirs.signature;
    } else if (file.fieldname === 'resume') {
      uploadPath = uploadDirs.resume;
    } else if (file.fieldname.startsWith('marksheet-')) {
      uploadPath = uploadDirs.marksheet;
    } else {
      uploadPath = 'uploads/other';
      createDirectory(uploadPath);
    }

    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + extension);
  }
});

// File filters
const fileFilter = (req, file, cb) => {
  if (file.fieldname === 'photo' || file.fieldname === 'signature') {
    // Accept images only
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed for photos and signatures!'), false);
    }
  } else if (file.fieldname === 'resume') {
    // Accept PDFs only
    if (file.mimetype !== 'application/pdf') {
      return cb(new Error('Only PDF files are allowed for resumes!'), false);
    }
  } else if (file.fieldname.startsWith('marksheet-')) {
    // Accept images and PDFs for marksheets
    if (!file.mimetype.startsWith('image/') && file.mimetype !== 'application/pdf') {
      return cb(new Error('Only image or PDF files are allowed for marksheets!'), false);
    }
  }
  cb(null, true);
};

// Configure limits
const limits = {
  fileSize: 5 * 1024 * 1024, // 5MB
};

// Create multer upload instance
const upload = multer({
  storage,
  fileFilter,
  limits
});

// Configure middleware for handling student registration files
const studentUpload = upload.fields([
  { name: 'photo', maxCount: 1 },
  { name: 'signature', maxCount: 1 },
  { name: 'resume', maxCount: 1 },
  { name: 'marksheet-0', maxCount: 1 },
  { name: 'marksheet-1', maxCount: 1 },
  { name: 'marksheet-2', maxCount: 1 }
]);

// Error handling middleware for multer
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    // A Multer error occurred when uploading
    console.error('Multer error:', err);
    return res.status(400).json({
      message: `File upload error: ${err.message}`
    });
  } else if (err) {
    // An unknown error occurred
    console.error('Unknown error during file upload:', err);
    return res.status(500).json({
      message: `Error during file upload: ${err.message}`
    });
  }

  // No error
  next();
};

module.exports = {
  studentUpload,
  handleMulterError
};