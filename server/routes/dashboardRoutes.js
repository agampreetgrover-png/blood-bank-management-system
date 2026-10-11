const express = require('express');
const router = express.Router();
const { getDashboardStats, getBloodGroups } = require('../controllers/dashboardController');
const authMiddleware = require('../middleware/auth');

router.get('/stats', authMiddleware, getDashboardStats);
router.get('/blood-groups', getBloodGroups);

module.exports = router;
