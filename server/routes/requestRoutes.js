const express = require('express');
const router = express.Router();
const { getAllRequests, getRequestById, createRequest, updateRequest, deleteRequest } = require('../controllers/requestController');
const authMiddleware = require('../middleware/auth');

router.get('/', authMiddleware, getAllRequests);
router.get('/:id', authMiddleware, getRequestById);
router.post('/', authMiddleware, createRequest);
router.put('/:id', authMiddleware, updateRequest);
router.delete('/:id', authMiddleware, deleteRequest);

module.exports = router;
