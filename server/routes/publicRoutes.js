const express = require('express');
const router = express.Router();
const { userAuth } = require('../middleware/userAuth');
const { getPublicOverview, createPublicBloodRequest } = require('../controllers/publicController');

// Stock overview is open to everyone. Requests are tied to the account that makes them,
// so that only that account (and staff) can see them later.
router.get('/overview', getPublicOverview);
router.post('/blood-request', userAuth, createPublicBloodRequest);

module.exports = router;
