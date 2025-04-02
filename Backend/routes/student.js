// routes/student.js (or wherever this file is located)

var express = require('express');
var router = express.Router();
const mysql = require('../middleware/mysql'); // Your MySQL module
const upload = require('../middleware/multer'); // Your Multer middleware
const validateStudent = require('../middleware/validation'); // Your Joi validation middleware

const fs = require('fs');
const path = require('path');

// --- Configuration ---
// Determine the project root directory relative to this routes file.
// If 'routes' is directly inside the project root alongside 'uploads', '..' is correct.
// Adjust if your directory structure is different (e.g., 'src/routes').
const PROJECT_ROOT = path.join(__dirname, '..'); // Adjust '..' if needed

// --- Helper Function for File Deletion ---
const deleteFile = (relativePathFromDb) => {
    if (!relativePathFromDb) {
        // console.log("No file path provided for deletion attempt."); // Optional logging
        return; // No path stored in DB, nothing to delete
    }

    // relativePathFromDb is expected to be like 'uploads/basic/filename.ext'
    // Construct the full absolute path from the project root
    const fullPath = path.join(PROJECT_ROOT, relativePathFromDb);

    console.log(`Attempting to delete file at: ${fullPath}`); // Log path for debugging
    if (fs.existsSync(fullPath)) {
        try {
            fs.unlinkSync(fullPath);
            console.log(`Successfully deleted old file: ${fullPath}`);
        } catch (err) {
            // Log error but don't necessarily stop the API response
            console.error(`Error deleting file ${fullPath}:`, err);
        }
    } else {
         // Log if the file expected to be there is missing
         console.warn(`File path found in DB but file not found on disk for deletion: ${fullPath}`);
    }
};


// --- API Endpoints ---

// GET /students - Retrieve all active students (No change needed)
router.get('', async (req, res) => {
    // Consider selecting fewer columns for efficiency in list view
    let query = "SELECT student_id, first_name, last_name, email, phone_number, photo FROM student where status = 1";
    try {
        let result = await mysql.exec(query, []); // Pass empty array for values if none
        return res.status(200).json({ success: 1, data: result });
    } catch (error) {
        console.error("Error fetching students:", error);
        return res.status(500).json({ success: 0, message: "Internal Server Error", error: error.message });
    }
});

// GET /students/:id - Retrieve a specific active student (No change needed)
router.get('/:id', async (req, res) => {
    try {
        const student_id = req.params.id;
        if (!student_id || isNaN(student_id)) {
            return res.status(400).json({ success: 0, message: "Please provide a valid numeric student ID" });
        }
        const query = "SELECT * FROM student WHERE student_id = ? AND status = 1";
        const result = await mysql.exec(query, [student_id]);
        if (result.length === 0) {
            return res.status(404).json({ success: 0, message: "No active student found with the given ID" });
        }
        return res.status(200).json({ success: 1, data: result[0] });
    } catch (error) {
        console.error("Error fetching student:", error);
        return res.status(500).json({ success: 0, message: "Internal Server Error", error: error.message });
    }
});


// POST /students/register - Save textual student data ONLY
router.post('/register', async (req, res) => {
    // 1. Validate text data using your Joi schema
    const { error } = validateStudent(req.body); // Call your validator directly
    if (error) {
        // Joi returns all errors because abortEarly is false (default or set)
        return res.status(400).json({
            success: 0,
            message: "Validation Error",
            // Map details to a simpler format if desired
            errors: error.details.map(detail => ({ message: detail.message, field: detail.context.key }))
        });
    }

    try {
        // 2. Extract data from validated body (Joi returns validated value)
        const {
            first_name, middle_name, last_name, date_of_birth, gender,
            email, phone_number, current_addressLine, current_block, current_dist,
            current_state, current_pincode, permanent_addressLine, permanent_block,
            permanent_dist, permanent_state, permanent_pincode
        } = req.body; // Use req.body directly, or error.value if you prefer validated values

        // 3. Prepare data object for insertion
        const studentData = {
            first_name, middle_name: middle_name || null, last_name: last_name || null, // Handle optional fields
            date_of_birth, gender, email, phone_number,
            current_addressLine, current_block, current_dist, current_state, current_pincode,
            permanent_addressLine, permanent_block, permanent_dist, permanent_state, permanent_pincode,
            status: 1 // Default status
            // Intentionally omit photo, signature, resume - they are null/default in DB initially
        };

        // 4. Insert into DB
        const query = "INSERT INTO student SET ?";
        const result = await mysql.exec(query, studentData); // Pass data object

        // 5. Check result and respond
        if (result.affectedRows > 0 && result.insertId) {
            return res.status(201).json({ // 201 Created
                success: 1,
                message: "Student registered successfully! Please upload files separately using the /files/:id endpoint.",
                student_id: result.insertId // Return the new ID
            });
        } else {
            console.error("Failed to insert student data, DB result:", result);
            return res.status(500).json({ success: 0, message: "Failed to register student." });
        }
    } catch (error) {
        console.error("Error registering student:", error);
        if (error.code === 'ER_DUP_ENTRY') { // Handle potential unique constraint errors
            return res.status(409).json({ success: 0, message: "Conflict: Email or phone number may already exist.", error: error.message });
        }
        return res.status(500).json({ success: 0, message: "Internal Server Error", error: error.message });
    }
});


// PUT /students/files/:id - Upload/Update files for an existing student
router.put('/files/:id', upload, async (req, res) => { // Use your 'upload' middleware
    const student_id = req.params.id;

    // 1. Validate ID
    if (!student_id || isNaN(student_id)) {
        // If ID is invalid, Multer might have already saved files; we need to clean up.
        if (req.files?.profile_pic) deleteFile(req.files.profile_pic[0].path);
        if (req.files?.signature) deleteFile(req.files.signature[0].path);
        if (req.files?.resume) deleteFile(req.files.resume[0].path);
        if (req.files?.marksheet) deleteFile(req.files.marksheet[0].path); // Include marksheet if handled
        return res.status(400).json({ success: 0, message: "Please provide a valid numeric student ID in the URL" });
    }

    // 2. Check if files were actually uploaded in this request
    if (!req.files || Object.keys(req.files).length === 0) {
        return res.status(400).json({ success: 0, message: "No files were uploaded in this request." });
    }

    try {
        // 3. Check if the student exists and get existing file paths
        // Fetch paths for all files handled by this endpoint
        const checkQuery = "SELECT photo, signature, resume FROM student WHERE student_id = ? AND status = 1"; // Added marksheet_path (assuming column name)
        const existingStudentResult = await mysql.exec(checkQuery, [student_id]);

        if (existingStudentResult.length === 0) {
            // If student not found, delete the newly uploaded files
            if (req.files.profile_pic) deleteFile(req.files.profile_pic[0].path);
            if (req.files.signature) deleteFile(req.files.signature[0].path);
            if (req.files.resume) deleteFile(req.files.resume[0].path);
            if (req.files.marksheet) deleteFile(req.files.marksheet[0].path);
            return res.status(404).json({ success: 0, message: "Active student not found with the given ID!" });
        }

        const existingFiles = existingStudentResult[0];
        const updatedFilePaths = {}; // Store paths to update in DB

        // 4. Process uploaded files, delete old ones, prepare update object
        if (req.files.profile_pic) {
            const newPath = req.files.profile_pic[0].path;
            deleteFile(existingFiles.photo); // Delete old file using path from DB
            updatedFilePaths.photo = newPath; // Store relative path from Multer
        }
        if (req.files.signature) {
            const newPath = req.files.signature[0].path;
            deleteFile(existingFiles.signature);
            updatedFilePaths.signature = newPath;
        }
        if (req.files.resume) {
            const newPath = req.files.resume[0].path;
            deleteFile(existingFiles.resume);
            updatedFilePaths.resume = newPath;
        }
        // Handle marksheet - assuming DB column is 'marksheet_path'
        if (req.files.marksheet) {
            const newPath = req.files.marksheet[0].path; // Path will be uploads/academic/...
            deleteFile(existingFiles.marksheet_path); // Delete old marksheet
            updatedFilePaths.marksheet_path = newPath; // Update DB column
        }


        // 5. Update the database record if new paths exist
        if (Object.keys(updatedFilePaths).length > 0) {
            const updateQuery = "UPDATE student SET ? WHERE student_id = ?";
            const updateResult = await mysql.exec(updateQuery, [updatedFilePaths, student_id]);

            if (updateResult.affectedRows >= 0) { // Use >= 0 as affectedRows can be 0 if paths were same
                return res.status(200).json({
                    success: 1,
                    message: "Files processed and student record updated successfully!",
                    updated_files: updatedFilePaths
                });
            } else {
                 // This case indicates a DB error during update
                 console.error("Failed to update student file paths in DB, result:", updateResult);
                 // Don't delete newly uploaded files here, as they might be the intended state
                return res.status(500).json({ success: 0, message: "Failed to update student record with file paths." });
            }
        } else {
             // This case should not be reached due to the check at the beginning, but as a safeguard:
             return res.status(400).json({ success: 0, message: "No file data processed to update." });
        }

    } catch (error) {
        console.error(`Error updating files for student ID ${student_id}:`, error);
         // If error occurs after upload but before/during DB update,
         // it's safer *not* to delete the newly uploaded files automatically,
         // as the user might want them. Manual cleanup might be needed if DB fails.
         // Consider logging the paths of uploaded files in case of error: console.error("Uploaded files during error:", req.files);
        return res.status(500).json({ success: 0, message: "Internal Server Error during file update", error: error.message });
    }
});


// PUT /students/:id - Update textual data ONLY for an existing student
router.put('/:id', async (req, res) => { // NO 'upload' middleware here
    const student_id = req.params.id;

    // 1. Validate ID
    if (!student_id || isNaN(student_id)) {
        return res.status(400).json({ success: 0, message: "Please provide a valid numeric student ID" });
    }

    // 2. Validate incoming text data using your Joi schema
    const { error } = validateStudent(req.body);
    if (error) {
         return res.status(400).json({
             success: 0,
             message: "Validation Error",
             errors: error.details.map(detail => ({ message: detail.message, field: detail.context.key }))
         });
    }

    try {
        // 3. Check if student exists (optional but good practice)
        const checkQuery = "SELECT student_id FROM student WHERE student_id = ? AND status = 1";
        const existingStudent = await mysql.exec(checkQuery, [student_id]);
        if (existingStudent.length === 0) {
            return res.status(404).json({ success: 0, message: "Active student not found with the given ID!" });
        }

        // 4. Prepare update data object from validated body
        // Joi schema ensures we only have the expected text fields
        const updateData = req.body; // Use the validated body directly

        // Optional: Remove keys if value is null/undefined if you want PATCH-like behavior with PUT
        Object.keys(updateData).forEach(key => {
            // Adjust condition based on how you want to handle null/empty strings
            if (updateData[key] === undefined) {
                delete updateData[key];
            } else if (updateData[key] === '') { // Decide if empty string should mean 'delete' or 'set to empty'
                 updateData[key] = null; // Example: Treat empty string as NULL
            }
        });


        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({ success: 0, message: "No valid textual data provided for update." });
        }


        // 5. Execute update query
        const updateQuery = "UPDATE student SET ? WHERE student_id = ?";
        const result = await mysql.exec(updateQuery, [updateData, student_id]);

        if (result.affectedRows > 0) { // Or check result.changedRows > 0 if you only want to confirm changes
             return res.status(200).json({
                 success: 1,
                 message: "Student text data updated successfully!"
             });
        } else {
            // This could mean the student exists but no data was changed, or DB error
             return res.status(200).json({ // Return 200 OK even if no rows changed
                success: 1, // Indicate operation succeeded even if no change
                message: "Student found, but no textual data requires updating."
                // You could also use status 304 Not Modified if data was identical
            });
        }

    } catch (error) {
        console.error(`Error updating text data for student ID ${student_id}:`, error);
        if (error.code === 'ER_DUP_ENTRY') {
             return res.status(409).json({ success: 0, message: "Conflict: Email or phone number may already exist for another student.", error: error.message });
        }
        return res.status(500).json({ success: 0, message: "Internal Server Error during text data update", error: error.message });
    }
});


// DELETE /students/:id - Soft delete a student (No change needed)
router.delete('/:id', async (req, res) => {
    try {
        const student_id = req.params.id;
        if (!student_id || isNaN(student_id)) {
            return res.status(400).json({ success: 0, message: "Please provide a valid numeric student ID" });
        }
        const updateQuery = "UPDATE student SET status = 0 WHERE student_id = ? AND status = 1";
        const result = await mysql.exec(updateQuery, [student_id]);
        if (result.affectedRows > 0) {
            return res.status(200).json({ success: 1, message: "Student record has been marked as inactive (soft delete)" });
        } else {
            return res.status(404).json({ success: 0, message: "No active student found with the given ID to delete" });
        }
    } catch (error) {
        console.error("Error deleting student:", error);
        return res.status(500).json({ success: 0, message: "Internal Server Error", error: error.message });
    }
});

// Export the router
module.exports = router;