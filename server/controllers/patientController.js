const { pool } = require('../config/db');

// Age 0 (a newborn) is valid, so a missing age can't be tested with !age
const hasAge = (age) => age !== undefined && age !== null && age !== '';
// Whole numbers only: Number(' ') and Number(true) would otherwise pass as 0 and 1
const validAge = (age) => /^\d+$/.test(String(age)) && Number(age) <= 120;

// GET /api/patients
async function getAllPatients(req, res) {
  try {
    const { search, blood_group, status } = req.query;
    let query = `
      SELECT p.*, bg.group_name AS blood_group
      FROM patients p
      INNER JOIN blood_groups bg ON p.blood_group_id = bg.id
      WHERE 1=1
    `;
    const params = [];

    if (search) {
      query += ' AND (p.full_name LIKE ? OR p.phone LIKE ? OR p.hospital LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    if (blood_group) {
      query += ' AND bg.group_name = ?';
      params.push(blood_group);
    }

    if (status === 'active') {
      query += ' AND p.is_active = 1';
    } else if (status === 'inactive') {
      query += ' AND p.is_active = 0';
    }

    query += ' ORDER BY p.created_at DESC';

    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (error) {
    console.error('Get patients error:', error);
    res.status(500).json({ message: 'Failed to fetch patients.' });
  }
}

// GET /api/patients/:id
async function getPatientById(req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT p.*, bg.group_name AS blood_group
       FROM patients p
       INNER JOIN blood_groups bg ON p.blood_group_id = bg.id
       WHERE p.id = ?`,
      [req.params.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Patient not found.' });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error('Get patient error:', error);
    res.status(500).json({ message: 'Failed to fetch patient.' });
  }
}

// POST /api/patients
async function createPatient(req, res) {
  try {
    const { full_name, age, gender, blood_group_id, hospital, doctor_name, phone, address } = req.body;

    if (!full_name || !hasAge(age) || !gender || !blood_group_id || !hospital || !phone) {
      return res.status(400).json({ message: 'Full name, age, gender, blood group, hospital, and phone are required.' });
    }

    if (!validAge(age)) {
      return res.status(400).json({ message: 'Please provide a valid age.' });
    }

    if (!/^\d{10}$/.test(phone)) {
      return res.status(400).json({ message: 'Phone number must be exactly 10 digits.' });
    }

    // Verify blood group
    const [bgCheck] = await pool.query('SELECT id FROM blood_groups WHERE id = ?', [blood_group_id]);
    if (bgCheck.length === 0) {
      return res.status(400).json({ message: 'Invalid blood group.' });
    }

    const [result] = await pool.query(
      `INSERT INTO patients (full_name, age, gender, blood_group_id, hospital, doctor_name, phone, address)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [full_name, age, gender, blood_group_id, hospital, doctor_name || null, phone, address || null]
    );

    res.status(201).json({ message: 'Patient added successfully.', id: result.insertId });
  } catch (error) {
    console.error('Create patient error:', error);
    res.status(500).json({ message: 'Failed to create patient.' });
  }
}

// PUT /api/patients/:id
async function updatePatient(req, res) {
  try {
    const { full_name, age, gender, blood_group_id, hospital, doctor_name, phone, address, is_active } = req.body;

    if (!full_name || !hasAge(age) || !gender || !blood_group_id || !hospital || !phone) {
      return res.status(400).json({ message: 'Full name, age, gender, blood group, hospital, and phone are required.' });
    }

    if (!validAge(age)) {
      return res.status(400).json({ message: 'Please provide a valid age.' });
    }

    if (!/^\d{10}$/.test(phone)) {
      return res.status(400).json({ message: 'Phone number must be exactly 10 digits.' });
    }

    // The admin form doesn't send doctor, address or the active flag, so values left out are kept as they are
    const [result] = await pool.query(
      `UPDATE patients SET full_name = ?, age = ?, gender = ?, blood_group_id = ?,
       hospital = ?, doctor_name = COALESCE(?, doctor_name), phone = ?, address = COALESCE(?, address),
       is_active = COALESCE(?, is_active)
       WHERE id = ?`,
      [full_name, age, gender, blood_group_id, hospital, doctor_name || null, phone,
       address || null, is_active ?? null, req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Patient not found.' });
    }

    res.json({ message: 'Patient updated successfully.' });
  } catch (error) {
    console.error('Update patient error:', error);
    res.status(500).json({ message: 'Failed to update patient.' });
  }
}

// DELETE /api/patients/:id (soft delete)
async function deletePatient(req, res) {
  try {
    const [result] = await pool.query(
      'UPDATE patients SET is_active = 0 WHERE id = ?',
      [req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Patient not found.' });
    }

    res.json({ message: 'Patient deactivated successfully.' });
  } catch (error) {
    console.error('Delete patient error:', error);
    res.status(500).json({ message: 'Failed to deactivate patient.' });
  }
}

module.exports = { getAllPatients, getPatientById, createPatient, updatePatient, deletePatient };
