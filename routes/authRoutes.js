const express = require('express');
const { googleSignIn } = require('../controllers/authController');
const { googleSignInValidation } = require('../middlewares/validators');
const validate = require('../middlewares/validate');

const router = express.Router();

router.post('/google', googleSignInValidation, validate, googleSignIn);

module.exports = router;
