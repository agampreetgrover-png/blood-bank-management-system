const express = require('express');
const router = express.Router();
const { getInventory, getInventoryByBloodGroup } = require('../controllers/inventoryController');

// Inventory can be public for blood availability check
router.get('/', getInventory);
router.get('/:bloodGroup', getInventoryByBloodGroup);

module.exports = router;
