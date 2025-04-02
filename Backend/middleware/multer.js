const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure directories exist
const ensureDirExists = (dir) => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
};

// Configure dynamic storage
const storage = multer.diskStorage({
    destination: function (req, file, callback) {
        let uploadPath = 'uploads/basic/'; // Default path for student-related files

        if (file.fieldname === 'marksheet') {
            uploadPath = 'uploads/academic/'; // Change path for marksheet
        }

        ensureDirExists(uploadPath);
        callback(null, uploadPath);
    },
    filename: function (req, file, callback) {
        const uniqueName = `${Date.now()}-${file.fieldname}${path.extname(file.originalname)}`;
        callback(null, uniqueName);
    }
});

// File filter to enforce file type restrictions
const fileFilter = (req, file, callback) => {
    if (file.fieldname === "resume") {
        // Only accept PDF for resume
        if (file.mimetype !== "application/pdf") {
            return callback(new Error("Resume must be a PDF"), false);
        }
    }
    if (file.fieldname === "marksheet") {
        // Allow only PDF and images for marksheet
        if (!file.mimetype.startsWith("image/") && file.mimetype !== "application/pdf") {
            return callback(new Error("Only images or PDFs are allowed for marksheet"), false);
        }
    }
    callback(null, true);
};

// Multer upload middleware
const upload = multer({
    storage: storage,
    fileFilter: fileFilter
}).fields([
    { name: "profile_pic", maxCount: 1 },
    { name: "signature", maxCount: 1 },
    { name: "resume", maxCount: 1 },
    { name: "marksheet", maxCount: 1 }
]);

module.exports = upload;
