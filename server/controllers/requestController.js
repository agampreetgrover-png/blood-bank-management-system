const { pool } = require('../config/db');
const { URGENCIES } = require('../utils/validation');

// 'Fulfilled' is only set by issuing blood (POST /api/issues), so stock always matches what was given out
const EDITABLE_STATUSES = ['Pending', 'Approved', 'Rejected'];
const validUnits = (units) => Number.isInteger(Number(units)) && units >= 1 && units <= 10;

// GET /api/requests
async function getAllRequests(req, res) {
  try {
    const { search, blood_group, status, urgency, start_date, end_date } = req.query;
    let query = `
      SELECT br.*, p.full_name AS patient_name, bg.group_name AS blood_group,
             a.name AS created_by_name
      FROM blood_requests br
      INNER JOIN patients p ON br.patient_id = p.id
      INNER JOIN blood_groups bg ON br.blood_group_id = bg.id
      LEFT JOIN admins a ON br.created_by = a.id
      WHERE 1=1
    `;
    const params = [];

    if (search) {
      query += ' AND (p.full_name LIKE ? OR br.hospital LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm);
    }

    if (blood_group) {
      query += ' AND bg.group_name = ?';
      params.push(blood_group);
    }

    if (status) {
      query += ' AND br.status = ?';
      params.push(status);
    }

    if (urgency) {
      query += ' AND br.urgency = ?';
      params.push(urgency);
    }

    if (start_date) {
      query += ' AND br.request_date >= ?';
      params.push(start_date);
    }

    if (end_date) {
      query += ' AND br.request_date <= ?';
      params.push(end_date);
    }

    query += " ORDER BY FIELD(br.urgency, 'Critical', 'Urgent', 'Normal'), br.created_at DESC";

    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (error) {
    console.error('Get requests error:', error);
    res.status(500).json({ message: 'Failed to fetch blood requests.' });
  }
}

// GET /api/requests/:id
async function getRequestById(req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT br.*, p.full_name AS patient_name, p.phone AS patient_phone,
              bg.group_name AS blood_group, a.name AS created_by_name
       FROM blood_requests br
       INNER JOIN patients p ON br.patient_id = p.id
       INNER JOIN blood_groups bg ON br.blood_group_id = bg.id
       LEFT JOIN admins a ON br.created_by = a.id
       WHERE br.id = ?`,
      [req.params.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Blood request not found.' });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error('Get request error:', error);
    res.status(500).json({ message: 'Failed to fetch blood request.' });
  }
}

// POST /api/requests
async function createRequest(req, res) {
  try {
    const { patient_id, blood_group_id, units_required, hospital, request_date, urgency, notes } = req.body;

    if (!patient_id || !blood_group_id || !units_required || !hospital || !request_date) {
      return res.status(400).json({ message: 'Patient, blood group, units, hospital, and request date are required.' });
    }

    if (!validUnits(units_required)) {
      return res.status(400).json({ message: 'Units required must be between 1 and 10.' });
    }

    if (urgency && !URGENCIES.includes(urgency)) {
      return res.status(400).json({ message: 'Invalid urgency level.' });
    }

    // Verify patient exists
    const [patientCheck] = await pool.query('SELECT id FROM patients WHERE id = ?', [patient_id]);
    if (patientCheck.length === 0) {
      return res.status(404).json({ message: 'Patient not found.' });
    }

    // Verify blood group
    const [bgCheck] = await pool.query('SELECT id FROM blood_groups WHERE id = ?', [blood_group_id]);
    if (bgCheck.length === 0) {
      return res.status(400).json({ message: 'Invalid blood group.' });
    }

    const [result] = await pool.query(
      `INSERT INTO blood_requests (patient_id, blood_group_id, units_required, hospital, request_date, urgency, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [patient_id, blood_group_id, units_required, hospital, request_date,
       urgency || 'Normal', notes || null, req.admin ? req.admin.id : null]
    );

    res.status(201).json({ message: 'Blood request created successfully.', id: result.insertId });
  } catch (error) {
    console.error('Create request error:', error);
    res.status(500).json({ message: 'Failed to create blood request.' });
  }
}

// PUT /api/requests/:id
async function updateRequest(req, res) {
  try {
    const { status, urgency, notes, units_required } = req.body;

    if (status && !EDITABLE_STATUSES.includes(status)) {
      return res.status(400).json({
        message: 'Status can be set to Pending, Approved or Rejected. A request becomes Fulfilled when blood is issued for it.'
      });
    }
    if (urgency && !URGENCIES.includes(urgency)) {
      return res.status(400).json({ message: 'Invalid urgency level.' });
    }
    if (units_required && !validUnits(units_required)) {
      return res.status(400).json({ message: 'Units required must be between 1 and 10.' });
    }

    // A fulfilled request already has blood issued against it. Reopening it would let it be issued again.
    const [check] = await pool.query('SELECT status FROM blood_requests WHERE id = ?', [req.params.id]);
    if (check.length === 0) {
      return res.status(404).json({ message: 'Blood request not found.' });
    }
    if (check[0].status === 'Fulfilled') {
      return res.status(400).json({ message: 'A fulfilled request can no longer be changed.' });
    }

    // Build dynamic update
    const updates = [];
    const params = [];

    if (status) {
      updates.push('status = ?');
      params.push(status);
    }

    if (urgency) {
      updates.push('urgency = ?');
      params.push(urgency);
    }

    if (notes !== undefined) {
      updates.push('notes = ?');
      params.push(notes);
    }

    if (units_required) {
      updates.push('units_required = ?');
      params.push(units_required);
    }

    if (updates.length === 0) {
      return res.status(400).json({ message: 'No fields to update.' });
    }

    params.push(req.params.id);

    // Checked again here in case blood was issued for it since the check above
    const [result] = await pool.query(
      `UPDATE blood_requests SET ${updates.join(', ')} WHERE id = ? AND status <> 'Fulfilled'`,
      params
    );

    if (result.affectedRows === 0) {
      return res.status(400).json({ message: 'A fulfilled request can no longer be changed.' });
    }

    res.json({ message: 'Blood request updated successfully.' });
  } catch (error) {
    console.error('Update request error:', error);
    res.status(500).json({ message: 'Failed to update blood request.' });
  }
}

// DELETE /api/requests/:id
async function deleteRequest(req, res) {
  try {
    // Only allow deleting pending requests
    const [check] = await pool.query('SELECT status FROM blood_requests WHERE id = ?', [req.params.id]);
    if (check.length === 0) {
      return res.status(404).json({ message: 'Blood request not found.' });
    }
    if (check[0].status === 'Fulfilled') {
      return res.status(400).json({ message: 'Cannot delete a fulfilled request.' });
    }

    await pool.query('DELETE FROM blood_requests WHERE id = ?', [req.params.id]);

    res.json({ message: 'Blood request deleted successfully.' });
  } catch (error) {
    console.error('Delete request error:', error);
    res.status(500).json({ message: 'Failed to delete blood request.' });
  }
}

module.exports = { getAllRequests, getRequestById, createRequest, updateRequest, deleteRequest };
