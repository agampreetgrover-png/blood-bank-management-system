const { pool } = require('../config/db');

// GET /api/inventory
async function getInventory(req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT i.id, i.blood_group_id, bg.group_name AS blood_group,
              i.available_units, i.last_updated
       FROM inventory i
       INNER JOIN blood_groups bg ON i.blood_group_id = bg.id
       ORDER BY bg.id ASC`
    );

    // Add status based on thresholds
    const inventory = rows.map(item => {
      let status;
      if (item.available_units === 0) {
        status = 'Critical';
      } else if (item.available_units <= 2) {
        status = 'Low Stock';
      } else {
        status = 'Available';
      }
      return { ...item, status };
    });

    res.json(inventory);
  } catch (error) {
    console.error('Get inventory error:', error);
    res.status(500).json({ message: 'Failed to fetch inventory.' });
  }
}

// GET /api/inventory/:bloodGroup (e.g., /api/inventory/O+)
async function getInventoryByBloodGroup(req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT i.id, i.blood_group_id, bg.group_name AS blood_group,
              i.available_units, i.last_updated
       FROM inventory i
       INNER JOIN blood_groups bg ON i.blood_group_id = bg.id
       WHERE bg.group_name = ?`,
      [req.params.bloodGroup]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Blood group not found in inventory.' });
    }

    const item = rows[0];
    let status;
    if (item.available_units === 0) {
      status = 'Critical';
    } else if (item.available_units <= 2) {
      status = 'Low Stock';
    } else {
      status = 'Available';
    }

    res.json({ ...item, status });
  } catch (error) {
    console.error('Get inventory by blood group error:', error);
    res.status(500).json({ message: 'Failed to fetch inventory.' });
  }
}

module.exports = { getInventory, getInventoryByBloodGroup };
