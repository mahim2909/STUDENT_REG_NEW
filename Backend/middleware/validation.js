const Joi = require('joi');

function validateStudent(student) {
    const schema = Joi.object({
        first_name: Joi.string().max(50).required(),
        middle_name: Joi.string().max(50).allow(null, ''),
        last_name: Joi.string().max(50).allow(null, ''),
        date_of_birth: Joi.date().iso().required(),
        gender: Joi.string().valid('Male', 'Female', 'Other').required(),
        email: Joi.string().email().max(100).required(),
        phone_number: Joi.string().pattern(/^[0-9]{10,15}$/).required(),
        current_addressLine: Joi.string().max(50).required(),
        current_block: Joi.string().max(50).required(),
        current_dist: Joi.string().max(50).required(),
        current_state: Joi.string().max(50).required(),
        current_pincode: Joi.number().integer().min(100000).max(999999).required(),
        permanent_addressLine: Joi.string().max(50).required(),
        permanent_block: Joi.string().max(50).required(),
        permanent_dist: Joi.string().max(50).required(),
        permanent_state: Joi.string().max(50).required(),
        permanent_pincode: Joi.number().integer().min(100000).max(999999).required(),
    });

    return schema.validate(student, { abortEarly: false });
}

module.exports = validateStudent;
