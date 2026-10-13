const { pool } = require('../config/db');
const { localDate, isDateString } = require('../utils/dates');

// Sets the donor's last donation date, unless they already have a later one (e.g. an older donation entered late)
const SET_LAST_DONATION =
  'UPDATE donors SET last_donation_date = ? WHERE id = ? AND (last_donation_date IS NULL OR last_donation_date < ?)';

// POST /api/donations - Record a donation with inventory update (TRANSACTION)
async function createDonation(req, res) {
  let connection;
  try {
    connection = await pool.getConnection();
    const { donor_id, donation_date, units_donated, notes } = req.body;

    if (!donor_id || !donation_date) {
      return res.status(400).json({ message: 'Donor and donation date are required.' });
    }

    const units = units_donated === undefined ? 1 : Number(units_donated);
    if (!Number.isInteger(units) || units < 1 || units > 3) {
      return res.status(400).json({ message: 'Units donated must be between 1 and 3.' });
    }

    // Verify donor exists and is active
    const [donorCheck] = await connection.query(
      'SELECT id, full_name, blood_group_id, is_active, is_eligible FROM donors WHERE id = ?', [donor_id]
    );
    if (donorCheck.length === 0) {
      return res.status(404).json({ message: 'Donor not found.' });
    }
    if (!donorCheck[0].is_active) {
      return res.status(400).json({ message: 'Donor is deactivated.' });
    }
    if (!donorCheck[0].is_eligible) {
      return res.status(400).json({ message: 'Donor is currently not eligible to donate.' });
    }

    // The blood goes into stock under the donor's own group, whatever group the form sent
    const blood_group_id = donorCheck[0].blood_group_id;

    // BEGIN TRANSACTION
    await connection.beginTransaction();

    // Insert donation record
    const [donationResult] = await connection.query(
      `INSERT INTO donations (donor_id, blood_group_id, donation_date, units_donated, status, notes, created_by)
       VALUES (?, ?, ?, ?, 'Completed', ?, ?)`,
      [donor_id, blood_group_id, donation_date, units, notes || null, req.admin ? req.admin.id : null]
    );

    // Update inventory - increase units
    await connection.query(
      `UPDATE inventory SET available_units = available_units + ? WHERE blood_group_id = ?`,
      [units, blood_group_id]
    );

    // Update donor's last donation date
    await connection.query(SET_LAST_DONATION, [donation_date, donor_id, donation_date]);

    // COMMIT TRANSACTION
    await connection.commit();

    res.status(201).json({
      message: 'Donation recorded successfully. Inventory updated.',
      id: donationResult.insertId
    });
  } catch (error) {
    // ROLLBACK on failure
    await connection?.rollback().catch(() => {});
    console.error('Create donation error:', error);
    res.status(500).json({ message: 'Failed to record donation.' });
  } finally {
    connection?.release();
  }
}

// GET /api/donations
async function getAllDonations(req, res) {
  try {
    const { search, blood_group, status, start_date, end_date } = req.query;
    let query = `
      SELECT dn.*, d.full_name AS donor_name, d.phone AS donor_phone, bg.group_name AS blood_group,
             a.name AS recorded_by
      FROM donations dn
      INNER JOIN donors d ON dn.donor_id = d.id
      INNER JOIN blood_groups bg ON dn.blood_group_id = bg.id
      LEFT JOIN admins a ON dn.created_by = a.id
      WHERE 1=1
    `;
    const params = [];

    if (search) {
      query += ' AND (d.full_name LIKE ? OR d.phone LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    if (blood_group) {
      query += ' AND bg.group_name = ?';
      params.push(blood_group);
    }

    if (status) {
      query += ' AND dn.status = ?';
      params.push(status);
    }

    if (start_date) {
      query += ' AND dn.donation_date >= ?';
      params.push(start_date);
    }

    if (end_date) {
      query += ' AND dn.donation_date <= ?';
      params.push(end_date);
    }

    query += ' ORDER BY dn.donation_date DESC, dn.created_at DESC';

    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (error) {
    console.error('Get donations error:', error);
    res.status(500).json({ message: 'Failed to fetch donations.' });
  }
}

// GET /api/donations/:id
async function getDonationById(req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT dn.*, d.full_name AS donor_name, d.phone AS donor_phone, bg.group_name AS blood_group,
              a.name AS recorded_by
       FROM donations dn
       INNER JOIN donors d ON dn.donor_id = d.id
       INNER JOIN blood_groups bg ON dn.blood_group_id = bg.id
       LEFT JOIN admins a ON dn.created_by = a.id
       WHERE dn.id = ?`,
      [req.params.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Donation record not found.' });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error('Get donation error:', error);
    res.status(500).json({ message: 'Failed to fetch donation.' });
  }
}

// POST /api/donations/public-signup - Public portal registration & donation appointment
async function publicDonationSignup(req, res) {
  let connection;
  try {
    connection = await pool.getConnection();
    const {
      full_name,
      age,
      gender,
      blood_group_id,
      email,
      address,
      donation_date,
      notes,
      only_register_donor
    } = req.body;

    // Form validation
    if (!full_name || !age || !gender || !blood_group_id) {
      return res.status(400).json({
        message: 'Full name, age, gender and blood group are required.'
      });
    }

    const ageNum = parseInt(age, 10);
    if (isNaN(ageNum) || ageNum < 18 || ageNum > 65) {
      return res.status(400).json({
        message: 'Donor age must be between 18 and 65 years.'
      });
    }

    const scheduledDate = donation_date || localDate();
    if (!only_register_donor && (!isDateString(scheduledDate) || scheduledDate < localDate())) {
      return res.status(400).json({ message: 'Choose a donation date from today onwards.' });
    }

    // The booking always uses the mobile number on the logged-in account, never one typed into the form
    const [[account]] = await connection.query('SELECT phone FROM users WHERE id = ? AND is_active = 1', [req.user.id]);
    if (!account) {
      return res.status(401).json({ message: 'Please log in to continue.' });
    }
    const cleanPhone = account.phone;

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return res.status(400).json({
        message: 'Please provide a valid email address.'
      });
    }

    // Verify blood group
    const [bgCheck] = await connection.query(
      'SELECT id, group_name FROM blood_groups WHERE id = ?',
      [blood_group_id]
    );
    if (bgCheck.length === 0) {
      return res.status(400).json({ message: 'Invalid blood group selected.' });
    }
    const bloodGroupName = bgCheck[0].group_name;

    await connection.beginTransaction();

    // A donor profile belongs to one account. If a donor with this mobile number exists but isn't
    // linked to this account (e.g. registered at the desk), only staff may link it. The website
    // must never let someone take over another person's donor record.
    const [existingDonors] = await connection.query(
      'SELECT id, full_name, is_active, is_eligible, last_donation_date FROM donors WHERE user_id = ?',
      [req.user.id]
    );
    if (existingDonors.length === 0) {
      const [samePhone] = await connection.query('SELECT id FROM donors WHERE phone = ?', [cleanPhone]);
      if (samePhone.length > 0) {
        await connection.rollback();
        return res.status(409).json({
          message: 'A donor with your mobile number is already registered with us. Call or visit the blood bank to link it to your account.'
        });
      }
    }

    let donorId;
    if (existingDonors.length > 0) {
      const donor = existingDonors[0];
      if (!donor.is_active) {
        await connection.rollback();
        return res.status(400).json({
          message: 'This donor record is deactivated. Please contact blood bank administration.'
        });
      }
      if (!donor.is_eligible) {
        await connection.rollback();
        return res.status(400).json({
          message: 'Donor profile is currently marked ineligible for donation.'
        });
      }

      // Check last donation interval (minimum 90 days required) when booking a donation.
      // last_donation_date comes back as local midnight, so it is compared as a local calendar date.
      if (!only_register_donor && donor.last_donation_date) {
        const lastDate = new Date(donor.last_donation_date);
        const nextEligible = new Date(lastDate);
        nextEligible.setDate(nextEligible.getDate() + 90);
        if (scheduledDate < localDate(nextEligible)) {
          await connection.rollback();
          return res.status(400).json({
            message: `A minimum 90-day interval is required between donations. Last donation was on ${localDate(lastDate)}. Next eligible date is ${localDate(nextEligible)}.`
          });
        }
      }

      donorId = donor.id;
      // Update donor contact details and blood group if provided
      await connection.query(
        `UPDATE donors SET full_name = ?, age = ?, gender = ?, blood_group_id = ?, email = ?, address = ?
         WHERE id = ?`,
        [full_name.trim(), ageNum, gender, blood_group_id, email ? email.trim() : null, address ? address.trim() : null, donorId]
      );
    } else {
      // Create new donor
      const [insertDonor] = await connection.query(
        `INSERT INTO donors (full_name, age, gender, blood_group_id, phone, email, address, is_eligible, is_active, user_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, 1, ?)`,
        [full_name.trim(), ageNum, gender, blood_group_id, cleanPhone, email ? email.trim() : null, address ? address.trim() : null,
         req.user.id]
      );
      donorId = insertDonor.insertId;
    }

    let donationId = null;

    if (!only_register_donor) {
      // Check for existing pending donation
      const [pendingCheck] = await connection.query(
        'SELECT id, donation_date FROM donations WHERE donor_id = ? AND status = "Pending"',
        [donorId]
      );

      if (pendingCheck.length > 0) {
        // Update the existing pending donation date and notes
        donationId = pendingCheck[0].id;
        await connection.query(
          `UPDATE donations SET blood_group_id = ?, donation_date = ?, notes = ? WHERE id = ?`,
          [blood_group_id, scheduledDate, notes ? notes.trim() : 'Public online appointment', donationId]
        );
      } else {
        // Insert new pending donation
        const [insertDonation] = await connection.query(
          `INSERT INTO donations (donor_id, blood_group_id, donation_date, units_donated, status, notes, created_by)
           VALUES (?, ?, ?, 1, 'Pending', ?, NULL)`,
          [donorId, blood_group_id, scheduledDate, notes ? notes.trim() : 'Public online appointment']
        );
        donationId = insertDonation.insertId;
      }
    }

    await connection.commit();

    res.status(201).json({
      success: true,
      message: only_register_donor
        ? 'Thank you! You are successfully registered as a volunteer blood donor.'
        : 'Thank you! Your blood donation appointment has been successfully scheduled.',
      donor_id: donorId,
      donation_id: donationId,
      donor_name: full_name.trim(),
      blood_group: bloodGroupName,
      scheduled_date: scheduledDate,
      status: only_register_donor ? 'Registered' : 'Pending'
    });
  } catch (error) {
    await connection?.rollback().catch(() => {});
    console.error('Public donation signup error:', error);
    res.status(500).json({ message: 'Failed to process blood donation sign-up.' });
  } finally {
    connection?.release();
  }
}

// PUT /api/donations/:id/complete - Admin verifies and completes a pending donation (TRANSACTION)
async function completePendingDonation(req, res) {
  let connection;
  try {
    connection = await pool.getConnection();
    const donationId = req.params.id;

    await connection.beginTransaction();

    // Locked, so a double click or two staff at once can't add the same units to stock twice
    const [donationRows] = await connection.query(
      'SELECT * FROM donations WHERE id = ? FOR UPDATE',
      [donationId]
    );

    if (donationRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'Donation record not found.' });
    }

    const donation = donationRows[0];
    if (donation.status !== 'Pending') {
      await connection.rollback();
      return res.status(400).json({ message: `Only pending donations can be completed. This one is ${donation.status.toLowerCase()}.` });
    }

    // Mark completed
    await connection.query(
      `UPDATE donations SET status = 'Completed', created_by = ? WHERE id = ?`,
      [req.admin ? req.admin.id : null, donationId]
    );

    // Increase blood inventory
    await connection.query(
      `UPDATE inventory SET available_units = available_units + ? WHERE blood_group_id = ?`,
      [donation.units_donated, donation.blood_group_id]
    );

    // Update donor's last donation date
    await connection.query(SET_LAST_DONATION, [donation.donation_date, donation.donor_id, donation.donation_date]);

    await connection.commit();

    res.json({
      message: 'Donation verified and completed successfully. Inventory updated.',
      id: donationId
    });
  } catch (error) {
    await connection?.rollback().catch(() => {});
    console.error('Complete donation error:', error);
    res.status(500).json({ message: 'Failed to complete donation.' });
  } finally {
    connection?.release();
  }
}

// PUT /api/donations/:id/reject - Admin marks a pending donation as rejected
async function rejectPendingDonation(req, res) {
  try {
    const donationId = req.params.id;
    const { reason } = req.body;

    const [donationRows] = await pool.query(
      'SELECT * FROM donations WHERE id = ?',
      [donationId]
    );

    if (donationRows.length === 0) {
      return res.status(404).json({ message: 'Donation record not found.' });
    }

    const donation = donationRows[0];
    if (donation.status !== 'Pending') {
      return res.status(400).json({ message: `Only pending donations can be rejected. This one is ${donation.status.toLowerCase()}.` });
    }

    const updatedNotes = reason
      ? `${donation.notes ? donation.notes + ' | ' : ''}Rejected: ${reason}`
      : donation.notes;

    // Only while still pending, in case it was completed in the meantime
    const [result] = await pool.query(
      `UPDATE donations SET status = 'Rejected', notes = ? WHERE id = ? AND status = 'Pending'`,
      [updatedNotes, donationId]
    );
    if (result.affectedRows === 0) {
      return res.status(409).json({ message: 'This donation was just updated by someone else. Refresh and try again.' });
    }

    res.json({ message: 'Donation request marked as rejected.' });
  } catch (error) {
    console.error('Reject donation error:', error);
    res.status(500).json({ message: 'Failed to update donation status.' });
  }
}

// DELETE /api/donations/:id - Remove pending or invalid donation record
async function deleteDonation(req, res) {
  try {
    const [rows] = await pool.query('SELECT status FROM donations WHERE id = ?', [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Donation record not found.' });
    }

    if (rows[0].status === 'Completed') {
      return res.status(400).json({
        message: 'Completed donations cannot be deleted as they are part of the permanent inventory audit trail.'
      });
    }

    await pool.query('DELETE FROM donations WHERE id = ?', [req.params.id]);
    res.json({ message: 'Donation record removed successfully.' });
  } catch (error) {
    console.error('Delete donation error:', error);
    res.status(500).json({ message: 'Failed to delete donation record.' });
  }
}

module.exports = {
  createDonation,
  getAllDonations,
  getDonationById,
  publicDonationSignup,
  completePendingDonation,
  rejectPendingDonation,
  deleteDonation
};
