const pool = require('../config/db');
const path = require('path');
const { uploadDir, processFormData } = require('../middleware/upload');

// Get all students
exports.getAllStudents = async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT student_id, first_name, middle_name, last_name, email, phone_number FROM student WHERE status = 1'
    );
    
    res.json(rows);
  } catch (error) {
    console.error('Error fetching students:', error);
    res.status(500).json({ message: 'Failed to fetch students', error: error.message });
  }
};

// Get student by ID
exports.getStudentById = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get student details
    const [students] = await pool.query(
      'SELECT * FROM student WHERE student_id = ?',
      [id]
    );
    
    if (!students.length) {
      return res.status(404).json({ message: 'Student not found' });
    }
    
    const student = students[0];
    
    // Get academic details
    const [academics] = await pool.query(
      'SELECT class, percent, board, marksheet FROM academic_details WHERE student_id = ?',
      [id]
    );
    
    // Add academics to student object
    student.academics = academics;
    
    res.json(student);
  } catch (error) {
    console.error('Error fetching student details:', error);
    res.status(500).json({ message: 'Failed to fetch student details', error: error.message });
  }
};

// Create new student
exports.createStudent = async (req, res) => {
  let connection;
  
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    
    const { basicDetails, addressDetails, academicDetails } = processFormData(req);
    
    // Prepare file paths for database
    let photoPath = null;
    let signaturePath = null;
    let resumePath = null;
    
    if (req.files.photo && req.files.photo[0]) {
      photoPath = path.relative(uploadDir, req.files.photo[0].path).replace(/\\/g, '/');
    }
    
    if (req.files.signature && req.files.signature[0]) {
      signaturePath = path.relative(uploadDir, req.files.signature[0].path).replace(/\\/g, '/');
    }
    
    if (req.files.resume && req.files.resume[0]) {
      resumePath = path.relative(uploadDir, req.files.resume[0].path).replace(/\\/g, '/');
    }
    
    // Insert student record
    const [result] = await connection.query(
      `INSERT INTO student (
        first_name, middle_name, last_name, date_of_birth, gender, email, phone_number,
        current_addressLine, current_block, current_dist, current_state, current_pincode,
        permanent_addressLine, permanent_block, permanent_dist, permanent_state, permanent_pincode,
        photo, signature, resume
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        basicDetails.first_name, basicDetails.middle_name, basicDetails.last_name,
        basicDetails.date_of_birth, basicDetails.gender, basicDetails.email, basicDetails.phone_number,
        addressDetails.current_addressLine, addressDetails.current_block, addressDetails.current_dist,
        addressDetails.current_state, addressDetails.current_pincode,
        addressDetails.permanent_addressLine, addressDetails.permanent_block, addressDetails.permanent_dist,
        addressDetails.permanent_state, addressDetails.permanent_pincode,
        photoPath, signaturePath, resumePath
      ]
    );
    
    const studentId = result.insertId;
    
    // Insert academic details
    for (let i = 0; i < academicDetails.length; i++) {
      const academic = academicDetails[i];
      let marksheetPath = null;
      
      const marksheetFile = req.files[`marksheet-${i}`];
      if (marksheetFile && marksheetFile[0]) {
        marksheetPath = path.relative(uploadDir, marksheetFile[0].path).replace(/\\/g, '/');
      }
      
      await connection.query(
        'INSERT INTO academic_details (student_id, class, percent, board, marksheet) VALUES (?, ?, ?, ?, ?)',
        [studentId, academic.class, academic.percent, academic.board, marksheetPath || 'no file']
      );
    }
    
    await connection.commit();
    
    res.status(201).json({
      message: 'Student registered successfully',
      student_id: studentId
    });
  } catch (error) {
    if (connection) await connection.rollback();
    
    console.error('Error registering student:', error);
    res.status(500).json({ message: 'Failed to register student', error: error.message });
  } finally {
    if (connection) connection.release();
  }
};

// Update student
exports.updateStudent = async (req, res) => {
  let connection;
  
  try {
    const { id } = req.params;
    connection = await pool.getConnection();
    await connection.beginTransaction();
    
    const { basicDetails, addressDetails, academicDetails } = processFormData(req);
    
    // Get existing student data to check what files to update
    const [existingStudents] = await connection.query(
      'SELECT photo, signature, resume FROM student WHERE student_id = ?',
      [id]
    );
    
    if (!existingStudents.length) {
      return res.status(404).json({ message: 'Student not found' });
    }
    
    const existing = existingStudents[0];
    
    // Update file paths only if new files were uploaded
    let photoPath = existing.photo;
    let signaturePath = existing.signature;
    let resumePath = existing.resume;
    
    if (req.files.photo && req.files.photo[0]) {
      photoPath = path.relative(uploadDir, req.files.photo[0].path).replace(/\\/g, '/');
    }
    
    if (req.files.signature && req.files.signature[0]) {
      signaturePath = path.relative(uploadDir, req.files.signature[0].path).replace(/\\/g, '/');
    }
    
    if (req.files.resume && req.files.resume[0]) {
      resumePath = path.relative(uploadDir, req.files.resume[0].path).replace(/\\/g, '/');
    }
    
    // Update student record
    await connection.query(
      `UPDATE student SET
        first_name = ?, middle_name = ?, last_name = ?, date_of_birth = ?, gender = ?, 
        email = ?, phone_number = ?,
        current_addressLine = ?, current_block = ?, current_dist = ?, current_state = ?, current_pincode = ?,
        permanent_addressLine = ?, permanent_block = ?, permanent_dist = ?, permanent_state = ?, permanent_pincode = ?,
        photo = ?, signature = ?, resume = ?
      WHERE student_id = ?`,
      [
        basicDetails.first_name, basicDetails.middle_name, basicDetails.last_name,
        basicDetails.date_of_birth, basicDetails.gender, basicDetails.email, basicDetails.phone_number,
        addressDetails.current_addressLine, addressDetails.current_block, addressDetails.current_dist,
        addressDetails.current_state, addressDetails.current_pincode,
        addressDetails.permanent_addressLine, addressDetails.permanent_block, addressDetails.permanent_dist,
        addressDetails.permanent_state, addressDetails.permanent_pincode,
        photoPath, signaturePath, resumePath, id
      ]
    );
    
    // Update academic details - first delete existing records
    await connection.query('DELETE FROM academic_details WHERE student_id = ?', [id]);
    
    // Insert updated academic details
    for (let i = 0; i < academicDetails.length; i++) {
      const academic = academicDetails[i];
      
      // Get existing marksheet path if available from previous fetch
      const [existingAcademics] = await connection.query(
        'SELECT marksheet FROM academic_details WHERE student_id = ? AND class = ?',
        [id, academic.class]
      );
      
      let marksheetPath = existingAcademics.length ? existingAcademics[0].marksheet : 'no file';
      
      const marksheetFile = req.files[`marksheet-${i}`];
      if (marksheetFile && marksheetFile[0]) {
        marksheetPath = path.relative(uploadDir, marksheetFile[0].path).replace(/\\/g, '/');
      }
      
      await connection.query(
        'INSERT INTO academic_details (student_id, class, percent, board, marksheet) VALUES (?, ?, ?, ?, ?)',
        [id, academic.class, academic.percent, academic.board, marksheetPath]
      );
    }
    
    await connection.commit();
    
    res.json({
      message: 'Student updated successfully',
      student_id: id
    });
  } catch (error) {
    if (connection) await connection.rollback();
    
    console.error('Error updating student:', error);
    res.status(500).json({ message: 'Failed to update student', error: error.message });
  } finally {
    if (connection) connection.release();
  }
};

// Delete student
exports.deleteStudent = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Soft delete - just update status to 0
    await pool.query(
      'UPDATE student SET status = 0 WHERE student_id = ?',
      [id]
    );
    
    res.json({ message: 'Student deleted successfully' });
  } catch (error) {
    console.error('Error deleting student:', error);
    res.status(500).json({ message: 'Failed to delete student', error: error.message });
  }
};