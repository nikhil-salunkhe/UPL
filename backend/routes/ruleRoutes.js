const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const {
  getRules,
  getAllRules,
  createRule,
  updateRule,
  deleteRule
} = require('../controllers/ruleController');

router.get('/', getRules);
router.get('/all', auth, getAllRules);
router.post('/', auth, createRule);
router.put('/:id', auth, updateRule);
router.delete('/:id', auth, deleteRule);

module.exports = router;
