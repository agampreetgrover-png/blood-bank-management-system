const { pool } = require('../config/db');
const { stockStatus } = require('../utils/stock');

const INVENTORY_SELECT = `SELECT i.id, i.blood_group_id, bg.group_name AS blood_group,
              i.available_units, i.last_updated
       FROM inventory i
       INNER JOIN blood_groups bg ON i.blood_group_id = bg.id`;

const withStatus = (item) => ({ ...item, status: stockStatus(item.available_units) });

// GET /api/inventory
async function getInventory(req, res) {
  try {
    const [rows] = await pool.query(`${INVENTORY_SELECT} ORDER BY bg.id ASC`);
    res.json(rows.map(withStatus));
  } catch (error) {
    console.error('Get inventory error:', error);
    res.status(500).json({ message: 'Failed to fetch inventory.' });
  }
}

// GET /api/inventory/:bloodGroup (e.g., /api/inventory/O+)
async function getInventoryByBloodGroup(req, res) {
  try {
    const [rows] = await pool.query(`${INVENTORY_SELECT} WHERE bg.group_name = ?`, [req.params.bloodGroup]);

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Blood group not found in inventory.' });
    }

    res.json(withStatus(rows[0]));
  } catch (error) {
    console.error('Get inventory by blood group error:', error);
    res.status(500).json({ message: 'Failed to fetch inventory.' });
  }
}

module.exports = { getInventory, getInventoryByBloodGroup };
