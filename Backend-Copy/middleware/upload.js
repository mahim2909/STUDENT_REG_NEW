const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure upload directories
const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Create subdirectories based on file type
    let uploadPath = uploadDir;
    
    if (file.fieldname === 'photo' || file.fieldname === 'signature') {
      uploadPath = path.join(uploadDir, 'images');
    } else if (file.fieldname === 'resume') {
      uploadPath = path.join(uploadDir, 'documents');
    } else if (file.fieldname.startsWith('marksheet')) {
      uploadPath = path.join(uploadDir, 'marksheets');
    }
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    // Generate a unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

const upload = multer({ storage: storage });

// Define file upload fields for student registration
const uploadFields = [
  { name: 'photo', maxCount: 1 },
  { name: 'signature', maxCount: 1 },
  { name: 'resume', maxCount: 1 },
  { name: 'marksheet-0', maxCount: 1 },
  { name: 'marksheet-1', maxCount: 1 },
  { name: 'marksheet-2', maxCount: 1 }
];

// Helper to process FormData
function processFormData(req) {
  const basicDetails = {};
  const addressDetails = {};
  const academicDetails = [];

  for (const [key, value] of Object.entries(req.body)) {
    if (key.startsWith('basicDetails.')) {
      const field = key.split('.')[1];
      basicDetails[field] = value;
    } else if (key.startsWith('addressDetails.')) {
      const field = key.split('.')[1];
      addressDetails[field] = value;
    } else if (key.startsWith('academicDetails')) {
      // Extract index and field from keys like 'academicDetails[0].class'
      const matches = key.match(/academicDetails\[(\d+)\]\.(\w+)/);
      if (matches) {
        const index = parseInt(matches[1], 10);
        const field = matches[2];
        
        if (!academicDetails[index]) {
          academicDetails[index] = {};
        }
        
        academicDetails[index][field] = value;
      }
    }
  }

  return { basicDetails, addressDetails, academicDetails };
}

module.exports = {
  upload,
  uploadFields,
  uploadDir,
  processFormData
};