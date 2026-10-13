const { pool } = require('../config/db');
const { localDate, isDateString } = require('../utils/dates');

function stockStatus(units) {
  if (units === 0) return 'Critical';
  if (units <= 2) return 'Low Stock';
  return 'Available';
}

// GET /api/public/overview - Aggregate figures for the public website (no personal data)
async function getPublicOverview(req, res) {
  try {
    const [[units]] = await pool.query('SELECT COALESCE(SUM(available_units), 0) AS total_units FROM inventory');
    const [[donors]] = await pool.query('SELECT COUNT(*) AS total_donors FROM donors WHERE is_active = 1');
    const [[donations]] = await pool.query("SELECT COUNT(*) AS total_donations FROM donations WHERE status = 'Completed'");
    const [[fulfilled]] = await pool.query("SELECT COUNT(*) AS fulfilled_requests FROM blood_requests WHERE status = 'Fulfilled'");

    const [inventory] = await pool.query(
      `SELECT bg.group_name AS blood_group, i.available_units, i.last_updated
       FROM inventory i
       INNER JOIN blood_groups bg ON i.blood_group_id = bg.id
       ORDER BY bg.id ASC`
    );

    res.json({
      total_units: Number(units.total_units),
      total_donors: donors.total_donors,
      total_donations: donations.total_donations,
      fulfilled_requests: fulfilled.fulfilled_requests,
      inventory: inventory.map((item) => ({ ...item, status: stockStatus(item.available_units) }))
    });
  } catch (error) {
    console.error('Public overview error:', error);
    res.status(500).json({ message: 'Failed to load blood bank overview.' });
  }
}

// POST /api/public/blood-request - Public blood request (creates patient + pending request in a TRANSACTION)
async function createPublicBloodRequest(req, res) {
  let connection;
  try {
    connection = await pool.getConnection();
    const {
      patient_name,
      age,
      gender,
      blood_group_id,
      units_required,
      hospital,
      doctor_name,
      contact_name,
      phone,
      required_date,
      urgency,
      notes
    } = req.body;

    if (!patient_name || age === undefined || age === '' || !gender || !blood_group_id || !units_required || !hospital || !phone) {
      return res.status(400).json({
        message: 'Patient name, age, gender, blood group, units, hospital, and contact phone are required.'
      });
    }

    const ageNum = parseInt(age, 10);
    if (isNaN(ageNum) || ageNum < 0 || ageNum > 120) {
      return res.status(400).json({ message: 'Patient age must be between 0 and 120.' });
    }

    const unitsNum = parseInt(units_required, 10);
    if (isNaN(unitsNum) || unitsNum < 1 || unitsNum > 10) {
      return res.status(400).json({ message: 'Units required must be between 1 and 10.' });
    }

    if (!['Male', 'Female', 'Other'].includes(gender)) {
      return res.status(400).json({ message: 'Invalid gender.' });
    }

    const urgencyValue = urgency || 'Normal';
    if (!['Normal', 'Urgent', 'Critical'].includes(urgencyValue)) {
      return res.status(400).json({ message: 'Invalid urgency level.' });
    }

    const cleanPhone = String(phone).replace(/[\s-]/g, '');
    if (!/^\d{10}$/.test(cleanPhone)) {
      return res.status(400).json({ message: 'Phone number must be a valid 10-digit mobile number.' });
    }

    const [bgCheck] = await connection.query('SELECT id, group_name FROM blood_groups WHERE id = ?', [blood_group_id]);
    if (bgCheck.length === 0) {
      return res.status(400).json({ message: 'Invalid blood group selected.' });
    }

    const requestDate = required_date || localDate();
    if (!isDateString(requestDate) || requestDate < localDate()) {
      return res.status(400).json({ message: 'Choose a needed-by date from today onwards.' });
    }

    const noteParts = ['Submitted via public website'];
    if (contact_name && contact_name.trim()) noteParts.push(`Contact person: ${contact_name.trim()}`);
    if (notes && notes.trim()) noteParts.push(notes.trim());

    await connection.beginTransaction();

    const [patientResult] = await connection.query(
      `INSERT INTO patients (full_name, age, gender, blood_group_id, hospital, doctor_name, phone)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [patient_name.trim(), ageNum, gender, blood_group_id, hospital.trim(), doctor_name ? doctor_name.trim() : null, cleanPhone]
    );

    const [requestResult] = await connection.query(
      `INSERT INTO blood_requests (patient_id, blood_group_id, units_required, hospital, request_date, urgency, status, notes, created_by, user_id)
       VALUES (?, ?, ?, ?, ?, ?, 'Pending', ?, NULL, ?)`,
      [patientResult.insertId, blood_group_id, unitsNum, hospital.trim(), requestDate, urgencyValue, noteParts.join(' | '),
       req.user.id]
    );

    await connection.commit();

    res.status(201).json({
      message: 'Your blood request has been submitted. Our team will contact you shortly.',
      request_id: requestResult.insertId,
      reference: `REQ-${requestResult.insertId}`,
      patient_name: patient_name.trim(),
      blood_group: bgCheck[0].group_name,
      units_required: unitsNum,
      hospital: hospital.trim(),
      urgency: urgencyValue,
      request_date: requestDate,
      status: 'Pending'
    });
  } catch (error) {
    await connection?.rollback().catch(() => {});
    console.error('Public blood request error:', error);
    res.status(500).json({ message: 'Failed to submit blood request.' });
  } finally {
    connection?.release();
  }
}

module.exports = { getPublicOverview, createPublicBloodRequest };
