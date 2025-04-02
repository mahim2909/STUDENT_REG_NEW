const db = require('../db');
const path = require('path');
const fs = require('fs');
const moment = require('moment');
const { log } = require('console');

// Helper function to process form data
const processFormData = (req) => {
  const basicDetails = {};
  const addressDetails = {};
  const academicDetails = [];

  // Process form data from request body
  Object.keys(req.body).forEach(key => {
    if (key.startsWith('basicDetails.')) {
      const field = key.split('.')[1];
      basicDetails[field] = req.body[key];
    } else if (key.startsWith('addressDetails.')) {
      const field = key.split('.')[1];
      addressDetails[field] = req.body[key];
    } else if (key.startsWith('academicDetails')) {
      // Process academic details array
      // Format: academicDetails[0].class, academicDetails[0].percent, etc.
      const match = key.match(/academicDetails\[(\d+)\]\.(\w+)/);
      if (match) {
        const index = parseInt(match[1]);
        const field = match[2];

        if (!academicDetails[index]) {
          academicDetails[index] = {};
        }

        academicDetails[index][field] = req.body[key];
      }
    }
  });

  // Process file uploads
  const files = {};
  if (req.files) {
    if (req.files.photo && req.files.photo[0]) {
      files.photo = req.files.photo[0].path.replace(/\\/g, '/');
    }

    if (req.files.signature && req.files.signature[0]) {
      files.signature = req.files.signature[0].path.replace(/\\/g, '/');
    }

    if (req.files.resume && req.files.resume[0]) {
      files.resume = req.files.resume[0].path.replace(/\\/g, '/');
    }

    // Process marksheet files
    for (let i = 0; i < 3; i++) {
      const fieldName = `marksheet-${i}`;
      if (req.files[fieldName] && req.files[fieldName][0]) {
        if (!academicDetails[i]) {
          academicDetails[i] = {};
        }
        academicDetails[i].marksheet = req.files[fieldName][0].path.replace(/\\/g, '/');
      }
    }
  }

  return { basicDetails, addressDetails, academicDetails, files };
};

// Helper function to delete files
const deleteFiles = async (files) => {
  if (!files || files.length === 0) return;

  for (const file of files) {
    try {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
      }
    } catch (err) {
      console.error(`Error deleting file ${file}:`, err);
    }
  }
};

// Controller methods
module.exports = {
  // Register a new student
  registerStudent: async (req, res) => {
    console.log(req.body);
    try {
      const { basicDetails, addressDetails, academicDetails, files } = processFormData(req);

      // Validate required fields
      if (!basicDetails.first_name || !basicDetails.date_of_birth || !basicDetails.gender ||
        !basicDetails.email || !basicDetails.phone_number) {
        return res.status(400).json({ message: 'Required basic details are missing' });
      }
      const formattedDOB = moment(basicDetails.date_of_birth).format("YYYY-MM-DD");
      console.log(formattedDOB);
      // Insert student data into the database using a transaction
      const result = await db.executeTransaction(async (connection) => {
        // Insert into student table
        const studentResult = await connection.query(
          `INSERT INTO student (
            first_name, middle_name, last_name, date_of_birth,
            gender, email, phone_number,
            current_addressLine, current_block, current_dist, current_state, current_pincode,
            permanent_addressLine, permanent_block, permanent_dist, permanent_state, permanent_pincode,
            photo, signature, resume, status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
          [
            basicDetails.first_name,
            basicDetails.middle_name || '',
            basicDetails.last_name || '',
            formattedDOB,
            basicDetails.gender,
            basicDetails.email,
            basicDetails.phone_number,
            addressDetails.current_addressLine,
            addressDetails.current_block,
            addressDetails.current_dist,
            addressDetails.current_state,
            addressDetails.current_pincode,
            addressDetails.permanent_addressLine,
            addressDetails.permanent_block,
            addressDetails.permanent_dist,
            addressDetails.permanent_state,
            addressDetails.permanent_pincode,
            files.photo || null,
            files.signature || null,
            files.resume || null
          ]
        );

        const studentId = studentResult.insertId;

        // Insert academic details
        for (const academic of academicDetails) {
          if (academic && academic.class && academic.percent && academic.board) {
            await connection.query(
              `INSERT INTO academic_details (student_id, class, percent, board, marksheet)
               VALUES (?, ?, ?, ?, ?)`,
              [
                studentId,
                academic.class,
                academic.percent,
                academic.board,
                academic.marksheet || 'no file'
              ]
            );
          }
        }

        return studentId;
      });

      res.status(201).json({
        message: 'Student registered successfully',
        studentId: Number(result)
      });
    } catch (error) {
      console.error('Error in student registration:', error);

      // Delete uploaded files in case of error
      if (req.files) {
        const filesToDelete = [];
        Object.values(req.files).forEach(fileArr => {
          fileArr.forEach(file => filesToDelete.push(file.path));
        });
        await deleteFiles(filesToDelete);
      }

      res.status(500).json({
        message: 'Failed to register student',
        error: error.message
      });
    }
  },

  // Get all students
  getAllStudents: async (req, res) => {
    try {
      const students = await db.query(
        `SELECT s.*, 
          GROUP_CONCAT(CONCAT(a.class, ':', a.percent, ':', a.board) SEPARATOR '|') as academic_info
         FROM student s
         LEFT JOIN academic_details a ON s.student_id = a.student_id
         WHERE s.status = 1
         GROUP BY s.student_id
         ORDER BY s.student_id DESC`
      );

      // Process the result to format academic details
      const formattedStudents = students.map(student => {
        const academic = {};

        if (student.academic_info) {
          const academicInfo = student.academic_info.split('|');
          academicInfo.forEach(info => {
            const [className, percent, board] = info.split(':');
            academic[className] = { percent, board };
          });
        }

        delete student.academic_info;
        return { ...student, academic };
      });

      res.status(200).json(formattedStudents);
    } catch (error) {
      console.error('Error fetching students:', error);
      res.status(500).json({
        message: 'Failed to fetch students',
        error: error.message
      });
    }
  },

  // Get a student by ID
  getStudentById: async (req, res) => {
    try {
      const { id } = req.params;

      // Get student basic details
      const student = await db.query(
        `SELECT * FROM student WHERE student_id = ? AND status = 1`,
        [id]
      );

      if (student.length === 0) {
        return res.status(404).json({ message: 'Student not found' });
      }

      // Get academic details
      const academicDetails = await db.query(
        `SELECT class, percent, board, marksheet FROM academic_details 
         WHERE student_id = ?`,
        [id]
      );

      res.status(200).json({
        ...student[0],
        academicDetails
      });
    } catch (error) {
      console.error('Error fetching student by ID:', error);
      res.status(500).json({
        message: 'Failed to fetch student details',
        error: error.message
      });
    }
  },

  // Update a student's details
  updateStudent: async (req, res) => {
    try {
      const { id } = req.params;
      const { basicDetails, addressDetails, academicDetails, files } = processFormData(req);

      // Verify student exists
      const existingStudent = await db.query(
        'SELECT * FROM student WHERE student_id = ? AND status = 1',
        [id]
      );

      if (existingStudent.length === 0) {
        return res.status(404).json({ message: 'Student not found' });
      }

      const student = existingStudent[0];
      const oldFiles = [];

      // Track files to potentially delete
      if (files.photo && student.photo) oldFiles.push(student.photo);
      if (files.signature && student.signature) oldFiles.push(student.signature);
      if (files.resume && student.resume) oldFiles.push(student.resume);

      // Update student data in a transaction
      await db.executeTransaction(async (connection) => {
        // Update student basic and address details
        await connection.query(
          `UPDATE student SET
            first_name = ?, middle_name = ?, last_name = ?, date_of_birth = ?,
            gender = ?, email = ?, phone_number = ?,
            current_addressLine = ?, current_block = ?, current_dist = ?, current_state = ?, current_pincode = ?,
            permanent_addressLine = ?, permanent_block = ?, permanent_dist = ?, permanent_state = ?, permanent_pincode = ?,
            photo = COALESCE(?, photo), signature = COALESCE(?, signature), resume = COALESCE(?, resume)
           WHERE student_id = ?`,
          [
            basicDetails.first_name,
            basicDetails.middle_name || '',
            basicDetails.last_name || '',
            basicDetails.date_of_birth,
            basicDetails.gender,
            basicDetails.email,
            basicDetails.phone_number,
            addressDetails.current_addressLine,
            addressDetails.current_block,
            addressDetails.current_dist,
            addressDetails.current_state,
            addressDetails.current_pincode,
            addressDetails.permanent_addressLine,
            addressDetails.permanent_block,
            addressDetails.permanent_dist,
            addressDetails.permanent_state,
            addressDetails.permanent_pincode,
            files.photo || null,
            files.signature || null,
            files.resume || null,
            id
          ]
        );

        // Get current academic details
        const currentAcademicDetails = await connection.query(
          'SELECT class, marksheet FROM academic_details WHERE student_id = ?',
          [id]
        );

        // Create a map for easier lookup
        const academicMap = {};
        currentAcademicDetails.forEach(detail => {
          academicMap[detail.class] = detail.marksheet;
        });

        // Update academic details
        for (const academic of academicDetails) {
          if (academic && academic.class && academic.percent && academic.board) {
            // Check if class exists to decide whether to update or insert
            const classExists = await connection.query(
              'SELECT 1 FROM academic_details WHERE student_id = ? AND class = ?',
              [id, academic.class]
            );

            // Track old marksheet file to delete if updated
            if (academic.marksheet && academicMap[academic.class] && academicMap[academic.class] !== 'no file') {
              oldFiles.push(academicMap[academic.class]);
            }

            if (classExists.length > 0) {
              // Update existing academic record
              await connection.query(
                `UPDATE academic_details SET
                  percent = ?, board = ?, marksheet = COALESCE(?, marksheet)
                 WHERE student_id = ? AND class = ?`,
                [
                  academic.percent,
                  academic.board,
                  academic.marksheet || null,
                  id,
                  academic.class
                ]
              );
            } else {
              // Insert new academic record
              await connection.query(
                `INSERT INTO academic_details (student_id, class, percent, board, marksheet)
                 VALUES (?, ?, ?, ?, ?)`,
                [
                  id,
                  academic.class,
                  academic.percent,
                  academic.board,
                  academic.marksheet || 'no file'
                ]
              );
            }
          }
        }
      });

      // Delete old files after successful update
      await deleteFiles(oldFiles);

      res.status(200).json({
        message: 'Student information updated successfully',
        studentId: id
      });
    } catch (error) {
      console.error('Error updating student:', error);

      // Delete newly uploaded files in case of error
      if (req.files) {
        const filesToDelete = [];
        Object.values(req.files).forEach(fileArr => {
          fileArr.forEach(file => filesToDelete.push(file.path));
        });
        await deleteFiles(filesToDelete);
      }

      res.status(500).json({
        message: 'Failed to update student information',
        error: error.message
      });
    }
  },

  // Delete a student (soft delete)
  deleteStudent: async (req, res) => {
    try {
      const { id } = req.params;

      // Check if student exists
      const student = await db.query(
        'SELECT * FROM student WHERE student_id = ? AND status = 1',
        [id]
      );

      if (student.length === 0) {
        return res.status(404).json({ message: 'Student not found' });
      }

      // Soft delete by setting status to 0
      await db.query(
        'UPDATE student SET status = 0 WHERE student_id = ?',
        [id]
      );

      res.status(200).json({
        message: 'Student deleted successfully',
        studentId: id
      });
    } catch (error) {
      console.error('Error deleting student:', error);
      res.status(500).json({
        message: 'Failed to delete student',
        error: error.message
      });
    }
  }
};