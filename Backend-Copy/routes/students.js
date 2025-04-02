const express = require('express');
const router = express.Router();
const { upload, uploadFields } = require('../middleware/upload');
const studentController = require('../controllers/studentController');

// GET all students
router.get('/', studentController.getAllStudents);

// GET student by ID
router.get('/:id', studentController.getStudentById);

// POST new student
router.post('/', upload.fields(uploadFields), studentController.createStudent);

// PUT update student
router.put('/:id', upload.fields(uploadFields), studentController.updateStudent);

// DELETE student
router.delete('/:id', studentController.deleteStudent);

module.exports = router;