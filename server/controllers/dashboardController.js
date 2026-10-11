const { pool } = require('../config/db');

// GET /api/dashboard/stats
async function getDashboardStats(req, res) {
  try {
    // Total blood units in inventory
    const [totalUnits] = await pool.query(
      'SELECT SUM(available_units) AS total_units FROM inventory'
    );

    // Total active donors
    const [totalDonors] = await pool.query(
      'SELECT COUNT(*) AS total_donors FROM donors WHERE is_active = 1'
    );

    // Total active patients
    const [totalPatients] = await pool.query(
      'SELECT COUNT(*) AS total_patients FROM patients WHERE is_active = 1'
    );

    // Pending requests
    const [pendingRequests] = await pool.query(
      "SELECT COUNT(*) AS pending_requests FROM blood_requests WHERE status = 'Pending'"
    );

    // Total donations
    const [totalDonations] = await pool.query(
      "SELECT COUNT(*) AS total_donations FROM donations WHERE status = 'Completed'"
    );

    // Total blood issues
    const [totalIssues] = await pool.query(
      'SELECT COUNT(*) AS total_issues FROM blood_issues'
    );

    // Inventory with status (for critical blood groups display)
    const [inventory] = await pool.query(
      `SELECT bg.group_name AS blood_group, i.available_units
       FROM inventory i
       INNER JOIN blood_groups bg ON i.blood_group_id = bg.id
       ORDER BY bg.id ASC`
    );

    // Recent donations (last 5)
    const [recentDonations] = await pool.query(
      `SELECT dn.id, d.full_name AS donor_name, bg.group_name AS blood_group,
              dn.units_donated, dn.donation_date, dn.status
       FROM donations dn
       INNER JOIN donors d ON dn.donor_id = d.id
       INNER JOIN blood_groups bg ON dn.blood_group_id = bg.id
       ORDER BY dn.donation_date DESC, dn.created_at DESC
       LIMIT 5`
    );

    // Recent requests (last 5)
    const [recentRequests] = await pool.query(
      `SELECT br.id, p.full_name AS patient_name, bg.group_name AS blood_group,
              br.units_required, br.urgency, br.status, br.request_date, br.hospital
       FROM blood_requests br
       INNER JOIN patients p ON br.patient_id = p.id
       INNER JOIN blood_groups bg ON br.blood_group_id = bg.id
       ORDER BY br.created_at DESC
       LIMIT 5`
    );

    // Recent issues (last 5)
    const [recentIssues] = await pool.query(
      `SELECT bi.id, p.full_name AS patient_name, bg.group_name AS blood_group,
              bi.units_issued, bi.issue_date
       FROM blood_issues bi
       INNER JOIN patients p ON bi.patient_id = p.id
       INNER JOIN blood_groups bg ON bi.blood_group_id = bg.id
       ORDER BY bi.issue_date DESC, bi.created_at DESC
       LIMIT 5`
    );

    // Blood group-wise donation count
    const [donationsByGroup] = await pool.query(
      `SELECT bg.group_name AS blood_group, COUNT(dn.id) AS donation_count,
              SUM(dn.units_donated) AS total_units
       FROM blood_groups bg
       LEFT JOIN donations dn ON bg.id = dn.blood_group_id AND dn.status = 'Completed'
       GROUP BY bg.id, bg.group_name
       ORDER BY bg.id ASC`
    );

    res.json({
      stats: {
        total_units: totalUnits[0].total_units || 0,
        total_donors: totalDonors[0].total_donors,
        total_patients: totalPatients[0].total_patients,
        pending_requests: pendingRequests[0].pending_requests,
        total_donations: totalDonations[0].total_donations,
        total_issues: totalIssues[0].total_issues
      },
      inventory,
      recentDonations,
      recentRequests,
      recentIssues,
      donationsByGroup
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ message: 'Failed to fetch dashboard statistics.' });
  }
}

// GET /api/blood-groups
async function getBloodGroups(req, res) {
  try {
    const [rows] = await pool.query('SELECT id, group_name FROM blood_groups ORDER BY id ASC');
    res.json(rows);
  } catch (error) {
    console.error('Get blood groups error:', error);
    res.status(500).json({ message: 'Failed to fetch blood groups.' });
  }
}

module.exports = { getDashboardStats, getBloodGroups };
