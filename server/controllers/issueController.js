const { pool } = require('../config/db');

// POST /api/issues - Issue blood with inventory check (TRANSACTION)
async function createIssue(req, res) {
  let connection;
  try {
    connection = await pool.getConnection();
    const { request_id, patient_id, blood_group_id, issue_date, notes } = req.body;

    if (!patient_id || !blood_group_id || !req.body.units_issued || !issue_date) {
      return res.status(400).json({ message: 'Patient, blood group, units, and issue date are required.' });
    }

    const units_issued = Number(req.body.units_issued);
    if (!Number.isInteger(units_issued) || units_issued < 1) {
      return res.status(400).json({ message: 'Units issued must be a whole number of at least 1.' });
    }

    // BEGIN TRANSACTION
    await connection.beginTransaction();

    // Issuing against a request fulfils it, so the request has to still be open and match what is issued.
    // The row is locked so the same request can't be dispensed twice at the same time.
    if (request_id) {
      const [[request]] = await connection.query(
        'SELECT patient_id, blood_group_id, status FROM blood_requests WHERE id = ? FOR UPDATE',
        [request_id]
      );
      if (!request) {
        await connection.rollback();
        return res.status(404).json({ message: 'Blood request not found.' });
      }
      if (request.status !== 'Pending' && request.status !== 'Approved') {
        await connection.rollback();
        return res.status(400).json({ message: `This request is already ${request.status.toLowerCase()}.` });
      }
      if (request.patient_id !== Number(patient_id) || request.blood_group_id !== Number(blood_group_id)) {
        await connection.rollback();
        return res.status(400).json({ message: 'Patient and blood group must match the request.' });
      }
    }

    // Check inventory availability
    const [invCheck] = await connection.query(
      `SELECT i.available_units, bg.group_name
       FROM inventory i
       INNER JOIN blood_groups bg ON i.blood_group_id = bg.id
       WHERE i.blood_group_id = ?
       FOR UPDATE`,
      [blood_group_id]
    );

    if (invCheck.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'Blood group not found in inventory.' });
    }

    const available = invCheck[0].available_units;
    const groupName = invCheck[0].group_name;

    if (available < units_issued) {
      await connection.rollback();
      return res.status(400).json({
        message: `Insufficient ${groupName} blood available. Available: ${available} unit(s). Requested: ${units_issued} unit(s).`
      });
    }

    // Verify patient exists
    const [patientCheck] = await connection.query('SELECT id FROM patients WHERE id = ?', [patient_id]);
    if (patientCheck.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'Patient not found.' });
    }

    // Insert blood issue record
    const [issueResult] = await connection.query(
      `INSERT INTO blood_issues (request_id, patient_id, blood_group_id, units_issued, issue_date, notes, issued_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [request_id || null, patient_id, blood_group_id, units_issued, issue_date,
       notes || null, req.admin ? req.admin.id : null]
    );

    // Decrease inventory
    await connection.query(
      'UPDATE inventory SET available_units = available_units - ? WHERE blood_group_id = ?',
      [units_issued, blood_group_id]
    );

    // If linked to a request, update request status to Fulfilled
    if (request_id) {
      await connection.query(
        "UPDATE blood_requests SET status = 'Fulfilled' WHERE id = ?",
        [request_id]
      );
    }

    // COMMIT TRANSACTION
    await connection.commit();

    res.status(201).json({
      message: 'Blood issued successfully. Inventory updated.',
      id: issueResult.insertId
    });
  } catch (error) {
    // ROLLBACK on failure
    await connection?.rollback().catch(() => {});
    console.error('Create issue error:', error);
    res.status(500).json({ message: 'Failed to issue blood.' });
  } finally {
    connection?.release();
  }
}

// GET /api/issues
async function getAllIssues(req, res) {
  try {
    const { search, blood_group, start_date, end_date } = req.query;
    let query = `
      SELECT bi.*, p.full_name AS patient_name, bg.group_name AS blood_group,
             a.name AS issued_by_name, br.hospital, br.urgency
      FROM blood_issues bi
      INNER JOIN patients p ON bi.patient_id = p.id
      INNER JOIN blood_groups bg ON bi.blood_group_id = bg.id
      LEFT JOIN admins a ON bi.issued_by = a.id
      LEFT JOIN blood_requests br ON bi.request_id = br.id
      WHERE 1=1
    `;
    const params = [];

    if (search) {
      query += ' AND p.full_name LIKE ?';
      params.push(`%${search}%`);
    }

    if (blood_group) {
      query += ' AND bg.group_name = ?';
      params.push(blood_group);
    }

    if (start_date) {
      query += ' AND bi.issue_date >= ?';
      params.push(start_date);
    }

    if (end_date) {
      query += ' AND bi.issue_date <= ?';
      params.push(end_date);
    }

    query += ' ORDER BY bi.issue_date DESC, bi.created_at DESC';

    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (error) {
    console.error('Get issues error:', error);
    res.status(500).json({ message: 'Failed to fetch blood issues.' });
  }
}

// GET /api/issues/:id
async function getIssueById(req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT bi.*, p.full_name AS patient_name, p.phone AS patient_phone,
              bg.group_name AS blood_group, a.name AS issued_by_name,
              br.hospital, br.urgency, br.status AS request_status
       FROM blood_issues bi
       INNER JOIN patients p ON bi.patient_id = p.id
       INNER JOIN blood_groups bg ON bi.blood_group_id = bg.id
       LEFT JOIN admins a ON bi.issued_by = a.id
       LEFT JOIN blood_requests br ON bi.request_id = br.id
       WHERE bi.id = ?`,
      [req.params.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Blood issue record not found.' });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error('Get issue error:', error);
    res.status(500).json({ message: 'Failed to fetch blood issue.' });
  }
}

module.exports = { createIssue, getAllIssues, getIssueById };
