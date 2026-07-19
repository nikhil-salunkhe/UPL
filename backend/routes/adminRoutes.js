const express = require('express');
const { loginAdmin, seedAdmin } = require('../controllers/adminController');
const router = express.Router();

router.post('/login', loginAdmin);
router.post('/seed', seedAdmin);

module.exports = router;
