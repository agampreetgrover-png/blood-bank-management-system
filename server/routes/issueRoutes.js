const express = require('express');
const router = express.Router();
const { createIssue, getAllIssues, getIssueById } = require('../controllers/issueController');
const authMiddleware = require('../middleware/auth');

router.get('/', authMiddleware, getAllIssues);
router.get('/:id', authMiddleware, getIssueById);
router.post('/', authMiddleware, createIssue);

module.exports = router;
