const express = require('express');
const router = express.Router();
const {
  createDonation,
  getAllDonations,
  getDonationById,
  publicDonationSignup,
  completePendingDonation,
  rejectPendingDonation,
  deleteDonation
} = require('../controllers/donationController');
const authMiddleware = require('../middleware/auth');
const { userAuth } = require('../middleware/userAuth');

// Donors book from their own account, so the booking is linked to them
router.post('/public-signup', userAuth, publicDonationSignup);

// Admin-protected routes
router.get('/', authMiddleware, getAllDonations);
router.get('/:id', authMiddleware, getDonationById);
router.post('/', authMiddleware, createDonation);
router.put('/:id/complete', authMiddleware, completePendingDonation);
router.put('/:id/reject', authMiddleware, rejectPendingDonation);
router.delete('/:id', authMiddleware, deleteDonation);

module.exports = router;
