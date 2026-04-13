const { body } = require('express-validator');

exports.registerRules = [
  body('username').trim().isLength({ min: 3, max: 30 }).withMessage('Username must be 3-30 characters')
    .matches(/^[a-zA-Z0-9_]+$/).withMessage('Username: letters, numbers, underscores only'),
  body('email').isEmail().withMessage('Valid email required').normalizeEmail(),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
];

exports.loginRules = [
  body('email').isEmail().withMessage('Valid email required').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required'),
];

exports.codeRules = [
  body('code').notEmpty().withMessage('Code is required').isLength({ max: 50000 }).withMessage('Code too long (max 50KB)'),
  body('language').optional().isString(),
];

exports.projectRules = [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 100 }),
];
