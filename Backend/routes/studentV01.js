var express = require('express');
var router = express.Router();
const mysql = require('../middleware/mysql');
const upload = require('../middleware/multer');
const validateStudent = require('../middleware/validation');

const fs = require('fs');
const path = require('path');



router.get('', async (req, res) => {
    let query = "SELECT * FROM student where status = 1";
    let values = [];
    let result = await mysql.exec(query, values);
    if (result.length == 0) {
        console.log("No data found");
    }
    return res.json(result);
});

router.get('/:id', async (req, res) => {
    try {
        const student_id = req.params.id;

        if (!student_id || isNaN(student_id)) {
            return res.status(400).json({ success: 0, message: "Please provide a valid numeric student ID" });
        }

        const query = "SELECT * FROM student WHERE student_id = ? AND status = 1";
        const result = await mysql.exec(query, [student_id]);

        if (result.length === 0) {
            return res.status(404).json({ success: 0, message: "No student found with the given ID" });
        }

        return res.status(200).json({ success: 1, data: result[0] });

    } catch (error) {
        console.error("Error fetching student:", error);
        return res.status(500).json({ success: 0, message: "Internal Server Error", error: error.message });
    }
});


router.post('', upload, async (req, res) => {
    const { error } = validateStudent(req.body, 'POST');
    if (error) {
        return res.status(400).json({ success: 0, message: "Validation Error", errors: error.details });
    }
    try {
        if (!req.files || Object.keys(req.files).length === 0) {
            return res.status(400).json({ success: 0, message: "No files uploaded!" });
        }

        const photoPath = req.files.profile_pic ? req.files.profile_pic[0].path : null;
        const signaturePath = req.files.signature ? req.files.signature[0].path : null;
        const resumePath = req.files.resume ? req.files.resume[0].path : null;

        const {
            first_name, middle_name, last_name, date_of_birth, gender,
            email, phone_number, current_addressLine, current_block, current_dist,
            current_state, current_pincode, permanent_addressLine, permanent_block,
            permanent_dist, permanent_state, permanent_pincode
        } = req.body;

        const data = {
            first_name, middle_name, last_name, date_of_birth, gender,
            email, phone_number, current_addressLine, current_block, current_dist,
            current_state, current_pincode, permanent_addressLine, permanent_block,
            permanent_dist, permanent_state, permanent_pincode, photo: photoPath,
            signature: signaturePath, resume: resumePath
        };

        Object.keys(data).forEach(key => {
            if (data[key] === undefined) delete data[key];
        });

        const query = "INSERT INTO student SET ?";

        const result = await mysql.exec(query, data);

        if (result.affectedRows > 0) {
            return res.status(200).json({ success: 1, message: "Student registered successfully!" });
        } else {
            return res.status(500).json({ success: 0, message: "Failed to insert data." });
        }
    } catch (error) {
        console.error("Error:", error);
        return res.status(500).json({ success: 0, message: "Internal Server Error", error: error.message });
    }
});



router.put('/:id', upload, async (req, res) => {
    const { error } = validateStudent(req.body, 'POST');
    if (error) {
        return res.status(400).json({ success: 0, message: "Validation Error", errors: error.details });
    }
    if (!req.params.id) {
        return res.status(404).json({ success: 0, message: "Please provide a valid ID" });
    }

    try {
        const student_id = req.params.id;

        const checkQuery = "SELECT * FROM student WHERE student_id = ? AND status = 1";
        const existingStudent = await mysql.exec(checkQuery, [student_id]);

        if (existingStudent.length === 0) {
            return res.status(404).json({ success: 0, message: "Student not found or inactive!" });
        }

        const newFiles = {
            photo: req.files.profile_pic?.[0]?.path,
            signature: req.files.signature?.[0]?.path,
            resume: req.files.resume?.[0]?.path
        };

        Object.keys(newFiles).forEach(field => {
            if (newFiles[field] && existingStudent[0][field]) {
                const oldFilePath = path.join(__dirname, '..', 'uploads', path.basename(existingStudent[0][field]));

                if (fs.existsSync(oldFilePath)) fs.unlinkSync(oldFilePath);
            }
        });


        const updatedData = {
            ...req.body,
            ...newFiles
        };

        Object.keys(updatedData).forEach(key => {
            if (!updatedData[key]) delete updatedData[key];
        });

        const updateQuery = "UPDATE student SET ? WHERE student_id = ?";
        const result = await mysql.exec(updateQuery, [updatedData, student_id]);

        return res.status(result.affectedRows > 0 ? 200 : 500).json({
            success: result.affectedRows > 0 ? 1 : 0,
            message: result.affectedRows > 0 ? "Student updated successfully!" : "Failed to update student data."
        });

    } catch (error) {
        console.error("Error:", error);
        return res.status(500).json({ success: 0, message: "Internal Server Error", error: error.message });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        const student_id = req.params.id;

        if (!student_id || isNaN(student_id)) {
            return res.status(400).json({ success: 0, message: "Please provide a valid numeric student ID" });
        }

        const checkQuery = "SELECT * FROM student WHERE student_id = ? AND status = 1";
        const existingStudent = await mysql.exec(checkQuery, [student_id]);

        if (existingStudent.length === 0) {
            return res.status(404).json({ success: 0, message: "No student found with the given ID" });
        }

        const updateQuery = "UPDATE student SET status = 0 WHERE student_id = ?";
        const result = await mysql.exec(updateQuery, [student_id]);

        if (result.affectedRows > 0) {
            return res.status(200).json({ success: 1, message: "Student record has been deleted (soft delete)" });
        } else {
            return res.status(500).json({ success: 0, message: "Failed to delete student record" });
        }

    } catch (error) {
        console.error("Error deleting student:", error);
        return res.status(500).json({ success: 0, message: "Internal Server Error", error: error.message });
    }
});



module.exports = router;
