const { pool } = require('../config/db');

// GET /api/donors
async function getAllDonors(req, res) {
  try {
    const { search, blood_group, status } = req.query;
    let query = `
      SELECT d.*, bg.group_name AS blood_group
      FROM donors d
      INNER JOIN blood_groups bg ON d.blood_group_id = bg.id
      WHERE 1=1
    `;
    const params = [];

    if (search) {
      query += ' AND (d.full_name LIKE ? OR d.phone LIKE ? OR d.email LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    if (blood_group) {
      query += ' AND bg.group_name = ?';
      params.push(blood_group);
    }

    if (status === 'active') {
      query += ' AND d.is_active = 1';
    } else if (status === 'inactive') {
      query += ' AND d.is_active = 0';
    }

    query += ' ORDER BY d.created_at DESC';

    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (error) {
    console.error('Get donors error:', error);
    res.status(500).json({ message: 'Failed to fetch donors.' });
  }
}

// GET /api/donors/:id
async function getDonorById(req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT d.*, bg.group_name AS blood_group
       FROM donors d
       INNER JOIN blood_groups bg ON d.blood_group_id = bg.id
       WHERE d.id = ?`,
      [req.params.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Donor not found.' });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error('Get donor error:', error);
    res.status(500).json({ message: 'Failed to fetch donor.' });
  }
}

// POST /api/donors
async function createDonor(req, res) {
  try {
    const { full_name, date_of_birth, age, gender, blood_group_id, phone, email, address } = req.body;

    // Validation
    if (!full_name || !age || !gender || !blood_group_id || !phone) {
      return res.status(400).json({ message: 'Full name, age, gender, blood group, and phone are required.' });
    }

    if (age < 18 || age > 65) {
      return res.status(400).json({ message: 'Donor age must be between 18 and 65.' });
    }

    if (!/^\d{10}$/.test(phone)) {
      return res.status(400).json({ message: 'Phone number must be exactly 10 digits.' });
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: 'Please provide a valid email address.' });
    }

    // Check blood group exists
    const [bgCheck] = await pool.query('SELECT id FROM blood_groups WHERE id = ?', [blood_group_id]);
    if (bgCheck.length === 0) {
      return res.status(400).json({ message: 'Invalid blood group.' });
    }

    // Check duplicate phone
    const [phoneCheck] = await pool.query('SELECT id FROM donors WHERE phone = ?', [phone]);
    if (phoneCheck.length > 0) {
      return res.status(409).json({ message: 'A donor with this phone number already exists.' });
    }

    const [result] = await pool.query(
      `INSERT INTO donors (full_name, date_of_birth, age, gender, blood_group_id, phone, email, address)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [full_name, date_of_birth || null, age, gender, blood_group_id, phone, email || null, address || null]
    );

    res.status(201).json({ message: 'Donor registered successfully.', id: result.insertId });
  } catch (error) {
    console.error('Create donor error:', error);
    res.status(500).json({ message: 'Failed to create donor.' });
  }
}

// PUT /api/donors/:id
async function updateDonor(req, res) {
  try {
    const { full_name, date_of_birth, age, gender, blood_group_id, phone, email, address, is_eligible, is_active } = req.body;

    if (!full_name || !age || !gender || !blood_group_id || !phone) {
      return res.status(400).json({ message: 'Full name, age, gender, blood group, and phone are required.' });
    }

    if (age < 18 || age > 65) {
      return res.status(400).json({ message: 'Donor age must be between 18 and 65.' });
    }

    if (!/^\d{10}$/.test(phone)) {
      return res.status(400).json({ message: 'Phone number must be exactly 10 digits.' });
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: 'Please provide a valid email address.' });
    }

    // Check duplicate phone (exclude current donor)
    const [phoneCheck] = await pool.query('SELECT id FROM donors WHERE phone = ? AND id != ?', [phone, req.params.id]);
    if (phoneCheck.length > 0) {
      return res.status(409).json({ message: 'Another donor with this phone number already exists.' });
    }

    const [result] = await pool.query(
      `UPDATE donors SET full_name = ?, date_of_birth = ?, age = ?, gender = ?, blood_group_id = ?,
       phone = ?, email = ?, address = ?, is_eligible = ?, is_active = ?
       WHERE id = ?`,
      [full_name, date_of_birth || null, age, gender, blood_group_id, phone, email || null, address || null,
       is_eligible !== undefined ? is_eligible : 1, is_active !== undefined ? is_active : 1, req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Donor not found.' });
    }

    res.json({ message: 'Donor updated successfully.' });
  } catch (error) {
    console.error('Update donor error:', error);
    res.status(500).json({ message: 'Failed to update donor.' });
  }
}

// DELETE /api/donors/:id (soft delete)
async function deleteDonor(req, res) {
  try {
    const [result] = await pool.query(
      'UPDATE donors SET is_active = 0 WHERE id = ?',
      [req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Donor not found.' });
    }

    res.json({ message: 'Donor deactivated successfully.' });
  } catch (error) {
    console.error('Delete donor error:', error);
    res.status(500).json({ message: 'Failed to deactivate donor.' });
  }
}

module.exports = { getAllDonors, getDonorById, createDonor, updateDonor, deleteDonor };
