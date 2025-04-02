const express = require('express');
const router = express.Router();
const studentController = require('../controllers/student.controller');
const { studentUpload, handleMulterError } = require('../middleware/upload.middleware');

// Route for student registration
router.post('/register',
  studentUpload,
  handleMulterError,
  studentController.registerStudent
);

// Route to get all students
router.get('/', studentController.getAllStudents);

// Route to get a specific student by ID
router.get('/:id', studentController.getStudentById);

// Route to update a student's details
router.put('/:id',
  studentUpload,
  handleMulterError,
  studentController.updateStudent
);

// Route to delete a student
router.delete('/:id', studentController.deleteStudent);

module.exports = router;