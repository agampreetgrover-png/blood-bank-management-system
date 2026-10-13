const express = require('express');
const router = express.Router();
const { getAllDonors, getDonorById, createDonor, updateDonor, deleteDonor } = require('../controllers/donorController');
const authMiddleware = require('../middleware/auth');

// Admin-protected routes. Public donors register through POST /api/donations/public-signup, which needs a user account.
router.get('/', authMiddleware, getAllDonors);
router.get('/:id', authMiddleware, getDonorById);
router.post('/', authMiddleware, createDonor);
router.put('/:id', authMiddleware, updateDonor);
router.delete('/:id', authMiddleware, deleteDonor);

module.exports = router;
