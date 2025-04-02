const express = require('express');
const router = express.Router();
const mysql = require('../middleware/mysql');
const upload = require('../middleware/multer');
const fs = require('fs');
const path = require('path');
const Joi = require('joi');

// Validation Schema
function validateAcademic(data) {
    const schema = Joi.object({
        student_id: Joi.number().integer().required(),
        class: Joi.string().max(50).required(),
        percent: Joi.number().integer().min(0).max(100).required(),
        board: Joi.string().max(50).required()
    });
    return schema.validate(data, { abortEarly: false });
}

// GET Academic Details by student_id
router.get('/:id', async (req, res) => {
    const  student_id  = req.params.id;
    const query = "SELECT * FROM academic_details WHERE student_id = ?";
    const result = await mysql.exec(query, [student_id]);

    if (result.length === 0) {
        return res.status(404).json({ success: 0, message: "No academic details found" });
    }
    res.json({ success: 1, data: result });
});

// POST Academic Details
router.post('/', upload, async (req, res) => {
    const { error } = validateAcademic(req.body);
    if (error) {
        return res.status(400).json({ success: 0, message: error.details[0].message });
    }

    const { student_id, class: className, percent, board } = req.body;
    const marksheet = req.files?.marksheet ? req.files.marksheet[0].path : 'no file';

    const query = "INSERT INTO academic_details SET ?";
    const result = await mysql.exec(query, { student_id, class: className, percent, board, marksheet });
    res.status(201).json({ success: 1, message: "Academic details added successfully" });
});

// PUT Update Academic Details
router.put('/:id', upload, async (req, res) => {
    const  student_id  = req.params.id;
    const { error } = validateAcademic(req.body);
    if (error) {
        return res.status(400).json({ success: 0, message: error.details[0].message });
    }

    const { class: className, percent, board } = req.body;
    const newMarksheet = req.files?.marksheet ? req.files.marksheet[0].path : null;

    // Get existing marksheet path
    const checkQuery = "SELECT marksheet FROM academic_details WHERE student_id = ? AND class = ?";
    const existing = await mysql.exec(checkQuery, [student_id, className]);

    if (existing.length > 0 && newMarksheet) {
        const oldFilePath = path.join(__dirname, '..', existing[0].marksheet);
        if (fs.existsSync(oldFilePath)) fs.unlinkSync(oldFilePath);
    }

    const updateQuery = "UPDATE academic_details SET percent=?, board=?, marksheet=? WHERE student_id=? AND class=?";
    await mysql.exec(updateQuery, [percent, board, newMarksheet || existing[0].marksheet, student_id, className]);
    res.json({ success: 1, message: "Academic details updated successfully" });
});

// DELETE Academic Details
router.delete('/:id', async (req, res) => {
    const  student_id  = req.params.id;
    const checkQuery = "SELECT marksheet FROM academic_details WHERE student_id = ?";
    const existing = await mysql.exec(checkQuery, [student_id]);

    if (existing.length === 0) {
        return res.status(404).json({ success: 0, message: "No academic details found" });
    }

    existing.forEach(record => {
        if (record.marksheet !== 'no file') {
            const filePath = path.join(__dirname, '..', record.marksheet);
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        }
    });

    const deleteQuery = "DELETE FROM academic_details WHERE student_id = ?";
    await mysql.exec(deleteQuery, [student_id]);
    res.json({ success: 1, message: "Academic details deleted successfully" });
});

module.exports = router;
