// routes/academic.js

const express = require('express');
const router = express.Router();
const mysql = require('../middleware/mysql');
const upload = require('../middleware/multer'); // Your Multer middleware
const fs = require('fs');
const path = require('path');
const Joi = require('joi');

// --- Configuration ---
// Consistent project root finding (assuming this file is in 'routes' dir)
const PROJECT_ROOT = path.join(__dirname, '..'); // Adjust '..' if needed

// --- Helper Function for File Deletion --- (Copied from student.js - consider moving to utils.js)
const deleteFile = (relativePathFromDb) => {
    if (!relativePathFromDb || relativePathFromDb === 'no file') { // Check against default
        return;
    }
    const fullPath = path.join(PROJECT_ROOT, relativePathFromDb);
    // console.log(`Attempting to delete academic file at: ${fullPath}`); // Debug log
    if (fs.existsSync(fullPath)) {
        try {
            fs.unlinkSync(fullPath);
            console.log(`Successfully deleted old academic file: ${fullPath}`);
        } catch (err) {
            console.error(`Error deleting academic file ${fullPath}:`, err);
        }
    } else {
         console.warn(`Academic file path found in DB but file not found on disk: ${fullPath}`);
    }
};


// Validation Schema
function validateAcademic(data) {
    const schema = Joi.object({
        // student_id is required in the body for POST/PUT based on current logic
        student_id: Joi.number().integer().required(),
        class: Joi.string().max(50).required(),
        percent: Joi.number().min(0).max(100).required(), // Keep integer() or allow float? percent can be float. Removing integer() for flexibility.
        board: Joi.string().max(50).required()
    });
    // Return all errors
    return schema.validate(data, { abortEarly: false });
}

// GET Academic Details by student_id
router.get('/:id', async (req, res) => {
    const student_id = req.params.id;

    // Validate ID
    if (!student_id || isNaN(student_id)) {
        return res.status(400).json({ success: 0, message: "Invalid Student ID format." });
    }

    try {
        const query = "SELECT * FROM academic_details WHERE student_id = ?";
        const result = await mysql.exec(query, [student_id]);

        if (result.length === 0) {
            // It's okay if a student has no academic details yet, maybe return empty array instead of 404?
            // return res.status(404).json({ success: 0, message: "No academic details found for this student ID" });
             return res.status(200).json({ success: 1, data: [] }); // Return empty data array
        }
        res.status(200).json({ success: 1, data: result });
    } catch (error) {
        console.error(`Error fetching academic details for student ID ${student_id}:`, error);
        res.status(500).json({ success: 0, message: "Internal Server Error", error: error.message });
    }
});

// POST Academic Details
router.post('/', upload, async (req, res) => { // Added upload middleware
    // 1. Validate request body
    const { error, value } = validateAcademic(req.body); // Use validated value
    if (error) {
        // Cleanup potentially uploaded file if validation fails
        if (req.files?.marksheet) deleteFile(req.files.marksheet[0].path);
        return res.status(400).json({
            success: 0,
            message: "Validation Error",
            errors: error.details.map(detail => ({ message: detail.message, field: detail.context.key }))
        });
    }

    // Use validated values from 'value' object
    const { student_id, class: className, percent, board } = value;

    // 2. Determine marksheet path (ensure column length is sufficient in DB!)
    // Use the default 'no file' if not uploaded, matching the table default logic
    const marksheetPath = req.files?.marksheet ? req.files.marksheet[0].path : 'no file';

    // *** REMINDER: Ensure `marksheet` column in `academic_details` is VARCHAR(255) or similar ***
    if (marksheetPath !== 'no file' && marksheetPath.length > 255) { // Example check length
         console.warn(`Potential Path Length Issue: Marksheet path (${marksheetPath.length} chars) might exceed typical DB column limits.`);
         // Optional: You could truncate or handle this, but increasing DB column size is better.
    }

    try {
        // 3. Prepare data for insertion
        const academicData = {
            student_id,
            class: className, // Use 'className' as 'class' is a reserved keyword
            percent,
            board,
            marksheet: marksheetPath
        };

        // 4. Insert into database
        const query = "INSERT INTO academic_details SET ?";
        const result = await mysql.exec(query, academicData);

        // 5. Respond with success
        res.status(201).json({
            success: 1,
            message: "Academic details added successfully",
            // Optionally return the inserted data or ID if needed (composite key makes ID tricky)
            // inserted_id: result.insertId // This won't be useful for composite key
        });

    } catch (error) {
        console.error("Error adding academic details:", error);

        // Cleanup uploaded file if DB insert fails
        if (req.files?.marksheet) deleteFile(req.files.marksheet[0].path);

        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ success: 0, message: `Conflict: Academic details for class '${className}' already exist for this student.` });
        }
        if (error.code === 'ER_NO_REFERENCED_ROW' || error.code === 'ER_NO_REFERENCED_ROW_2') {
             return res.status(400).json({ success: 0, message: `Bad Request: Student ID ${student_id} does not exist.` });
        }
         if (error.code === 'ER_DATA_TOO_LONG') {
             console.error("DATABASE ERROR: Data too long for column - likely 'marksheet'. Increase column size in DB.");
             return res.status(400).json({ success: 0, message: "Bad Request: Provided data too long for a field (check marksheet path length vs DB column size)." });
        }
        res.status(500).json({ success: 0, message: "Internal Server Error", error: error.message });
    }
});

// PUT Update Academic Details (using /:id as student_id)
router.put('/:id', upload, async (req, res) => { // Added upload middleware
    const student_id = req.params.id;

     // 1. Validate student_id from URL param
    if (!student_id || isNaN(student_id)) {
        // Cleanup potentially uploaded file
        if (req.files?.marksheet) deleteFile(req.files.marksheet[0].path);
        return res.status(400).json({ success: 0, message: "Invalid Student ID format in URL." });
    }

    // 2. Validate request body (requires class, percent, board; student_id is needed but comes from URL now)
    // We need to modify validation or handle student_id separately
     const { error, value } = validateAcademic({...req.body, student_id }); // Inject student_id for validation
     if (error) {
         // Cleanup potentially uploaded file
         if (req.files?.marksheet) deleteFile(req.files.marksheet[0].path);
         return res.status(400).json({
             success: 0,
             message: "Validation Error",
             errors: error.details.map(detail => ({ message: detail.message, field: detail.context.key }))
         });
     }

    const { class: className, percent, board } = value; // Get validated values
    const newMarksheetPath = req.files?.marksheet ? req.files.marksheet[0].path : null; // null if not uploaded in this request

    // *** REMINDER: Ensure `marksheet` column in `academic_details` is VARCHAR(255) or similar ***
    if (newMarksheetPath && newMarksheetPath.length > 255) { // Example check length
         console.warn(`Potential Path Length Issue: Marksheet path (${newMarksheetPath.length} chars) might exceed typical DB column limits.`);
    }

    let oldMarksheetPath = null;

    try {
        // 3. Check if record exists and get old marksheet path (needed for deletion)
        const checkQuery = "SELECT marksheet FROM academic_details WHERE student_id = ? AND class = ?";
        const existingResult = await mysql.exec(checkQuery, [student_id, className]);

        if (existingResult.length === 0) {
             // Cleanup potentially uploaded file if record doesn't exist
             if (req.files?.marksheet) deleteFile(req.files.marksheet[0].path);
            return res.status(404).json({ success: 0, message: `Academic details not found for student ${student_id} and class ${className}.` });
        }
        oldMarksheetPath = existingResult[0].marksheet; // Store for potential deletion later

        // 4. Determine the final marksheet path for the UPDATE query
        // Use new path if uploaded, otherwise keep the old path
        const finalMarksheetPath = newMarksheetPath !== null ? newMarksheetPath : oldMarksheetPath;

        // 5. Perform the update
        const updateQuery = "UPDATE academic_details SET percent = ?, board = ?, marksheet = ? WHERE student_id = ? AND class = ?";
        const updateResult = await mysql.exec(updateQuery, [percent, board, finalMarksheetPath, student_id, className]);

        // 6. Check if update was successful
        if (updateResult.affectedRows > 0) {
            // 7. Delete the old file ONLY if a new file was successfully uploaded and differs from old one
            if (newMarksheetPath !== null && oldMarksheetPath !== newMarksheetPath) {
                deleteFile(oldMarksheetPath); // Delete the file corresponding to the old path
            }
            res.status(200).json({ success: 1, message: "Academic details updated successfully" });
        } else {
             // This means the record existed, but nothing changed (or update failed silently - less likely)
             // Cleanup the newly uploaded file if it wasn't used (e.g., data was identical)
             if (newMarksheetPath !== null && newMarksheetPath !== finalMarksheetPath) {
                 deleteFile(newMarksheetPath);
             }
            res.status(200).json({ success: 1, message: "Academic details found, but no changes were applied." });
        }

    } catch (error) {
        console.error(`Error updating academic details for student ID ${student_id}, class ${className}:`, error);
        // Cleanup uploaded file if DB update fails AFTER file was processed
        // Avoid deleting if the error is something recoverable or related to the old file state
        if (newMarksheetPath !== null && error.code !== 'ENOENT') { // Avoid deleting if error is file not found
             deleteFile(newMarksheetPath);
        }

         if (error.code === 'ER_DATA_TOO_LONG') {
             console.error("DATABASE ERROR: Data too long for column - likely 'marksheet'. Increase column size in DB.");
             return res.status(400).json({ success: 0, message: "Bad Request: Provided data too long for a field (check marksheet path length vs DB column size)." });
        }
        res.status(500).json({ success: 0, message: "Internal Server Error", error: error.message });
    }
});

// DELETE Academic Details for a student_id (all records for that student)
router.delete('/:id', async (req, res) => {
    const student_id = req.params.id;

     // 1. Validate ID
    if (!student_id || isNaN(student_id)) {
        return res.status(400).json({ success: 0, message: "Invalid Student ID format." });
    }

    try {
        // 2. Find all records and their marksheet paths first (for deletion)
        const checkQuery = "SELECT marksheet FROM academic_details WHERE student_id = ?";
        const recordsToDelete = await mysql.exec(checkQuery, [student_id]);

        if (recordsToDelete.length === 0) {
            return res.status(404).json({ success: 0, message: "No academic details found for this student ID to delete." });
        }

        // 3. Delete the actual records from the database
        const deleteQuery = "DELETE FROM academic_details WHERE student_id = ?";
        const deleteResult = await mysql.exec(deleteQuery, [student_id]);

        // 4. If DB deletion was successful, delete associated files
        if (deleteResult.affectedRows > 0) {
            recordsToDelete.forEach(record => {
                deleteFile(record.marksheet); // Use the helper function
            });
            res.status(200).json({ success: 1, message: `Successfully deleted ${deleteResult.affectedRows} academic record(s).` });
        } else {
             // Should not happen if checkQuery found records, but as a safeguard
             res.status(404).json({ success: 0, message: "Academic details found but failed to delete." });
        }

    } catch (error) {
        console.error(`Error deleting academic details for student ID ${student_id}:`, error);
        // If deletion fails, files are not removed. Manual cleanup might be needed.
        res.status(500).json({ success: 0, message: "Internal Server Error", error: error.message });
    }
});

module.exports = router;