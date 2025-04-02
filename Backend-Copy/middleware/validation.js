// middlewares/validation.js
const Joi = require('joi');
const path = require('path');

// Define validation schema for student
const studentSchema = Joi.object({
  basicDetails: Joi.object({
    first_name: Joi.string().required().max(50),
    middle_name: Joi.string().allow('').max(50),
    last_name: Joi.string().required().max(50),
    date_of_birth: Joi.date().required(),
    gender: Joi.string().required(),
    email: Joi.string().required().email(),
    phone_number: Joi.string().required().pattern(/^[6-9][0-9]{9}$/)
  }),
  
  addressDetails: Joi.object({
    current_addressLine: Joi.string().required().max(100),
    current_block: Joi.string().required().max(50),
    current_dist: Joi.string().required().max(50),
    current_state: Joi.string().required().max(50),
    current_pincode: Joi.string().required().pattern(/^[0-9]{6}$/),
    sameAsCurrent: Joi.boolean(),
    permanent_addressLine: Joi.string().required().max(100),
    permanent_block: Joi.string().required().max(50),
    permanent_dist: Joi.string().required().max(50),
    permanent_state: Joi.string().required().max(50),
    permanent_pincode: Joi.string().required().pattern(/^[0-9]{6}$/)
  }),
  
  academicDetails: Joi.array().items(
    Joi.object({
      class: Joi.string().required(),
      percent: Joi.number().required().min(0).max(100),
      board: Joi.string().required()
    })
  ).min(3) // At least 3 academic records (10th, 12th, UG)
});

// Middleware to validate student data
const validateStudent = (req, res, next) => {
  // Process form data from request
  const formData = processFormData(req);
  
  // Validate the data
  const { error } = studentSchema.validate(formData, { abortEarly: false });
  
  if (error) {
    // Format validation errors
    const errorDetails = error.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message
    }));
    
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errorDetails
    });
  }
  
  // Check for required files in creation mode
  if (!req.path.includes('update')) {
    // File validation for new student creation
    if (!req.files.photo || !req.files.photo[0]) {
      return res.status(400).json({
        success: false,
        message: 'Photo is required'
      });
    }
    
    if (!req.files.signature || !req.files.signature[0]) {
      return res.status(400).json({
        success: false,
        message: 'Signature is required'
      });
    }
    
    if (!req.files.resume || !req.files.resume[0]) {
      return res.status(400).json({
        success: false,
        message: 'Resume is required'
      });
    }
  }
  
  next();
};

// Helper to process FormData - same as in upload.js
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
  validateStudent
};