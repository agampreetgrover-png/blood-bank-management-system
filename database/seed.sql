-- ============================================
-- Blood Bank Management System
-- Seed Data
-- ============================================

USE blood_bank_db;

-- ============================================
-- Insert Blood Groups
-- ============================================
INSERT INTO blood_groups (group_name, description) VALUES
('A+',  'A Positive'),
('A-',  'A Negative'),
('B+',  'B Positive'),
('B-',  'B Negative'),
('AB+', 'AB Positive'),
('AB-', 'AB Negative'),
('O+',  'O Positive'),
('O-',  'O Negative');

-- ============================================
-- Insert Admin (password: admin123)
-- Hash generated with bcrypt, 10 rounds
-- ============================================
INSERT INTO admins (name, email, password) VALUES
('Dr. Rajesh Kumar', 'admin@bloodbank.com', '$2b$10$ULV/5vGWQRo9vZiOStsFAuJkK7PmJ3/ZGoWMqhdC5ofPivCy.ni46');

-- ============================================
-- Initialize Inventory for all blood groups
-- ============================================
INSERT INTO inventory (blood_group_id, available_units) VALUES
(1, 12),  -- A+
(2, 3),   -- A-
(3, 8),   -- B+
(4, 1),   -- B-
(5, 5),   -- AB+
(6, 0),   -- AB-
(7, 15),  -- O+
(8, 2);   -- O-

-- ============================================
-- Insert Donors
-- ============================================
INSERT INTO donors (full_name, date_of_birth, age, gender, blood_group_id, phone, email, address, last_donation_date, is_eligible) VALUES
('Rahul Sharma',      '1998-03-15', 28, 'Male',   7, '9876543210', 'rahul.sharma@email.com',    '45 MG Road, Bengaluru, Karnataka',          '2026-09-15', 1),
('Ananya Singh',      '1995-07-22', 31, 'Female', 1, '9876543211', 'ananya.singh@email.com',    '12 Civil Lines, New Delhi',                  '2026-08-20', 1),
('Arjun Mehta',       '2000-01-10', 26, 'Male',   3, '9876543212', 'arjun.mehta@email.com',     '78 FC Road, Pune, Maharashtra',              '2026-07-10', 1),
('Priya Verma',       '1997-11-05', 29, 'Female', 2, '9876543213', 'priya.verma@email.com',     '34 Ashok Nagar, Jaipur, Rajasthan',          '2026-09-01', 1),
('Vikram Patel',      '1993-06-18', 33, 'Male',   5, '9876543214', 'vikram.patel@email.com',    '90 SG Highway, Ahmedabad, Gujarat',          '2026-06-25', 1),
('Sneha Reddy',       '1999-09-28', 27, 'Female', 7, '9876543215', 'sneha.reddy@email.com',     '56 Banjara Hills, Hyderabad, Telangana',     '2026-08-12', 1),
('Amit Joshi',        '1996-04-12', 30, 'Male',   4, '9876543216', 'amit.joshi@email.com',      '23 Model Town, Lucknow, Uttar Pradesh',      '2026-05-30', 1),
('Kavita Nair',       '2001-12-03', 24, 'Female', 1, '9876543217', 'kavita.nair@email.com',     '67 Marine Drive, Kochi, Kerala',              '2026-09-20', 1),
('Deepak Gupta',      '1994-08-20', 32, 'Male',   8, '9876543218', 'deepak.gupta@email.com',    '11 Rajpur Road, Dehradun, Uttarakhand',      '2026-07-15', 1),
('Meera Iyer',        '1998-02-14', 28, 'Female', 3, '9876543219', 'meera.iyer@email.com',      '89 Anna Salai, Chennai, Tamil Nadu',          '2026-08-28', 1),
('Rohan Chatterjee',  '1997-05-30', 29, 'Male',   6, '9876543220', 'rohan.chatterjee@email.com','45 Park Street, Kolkata, West Bengal',        '2026-04-10', 1),
('Sanya Kapoor',      '2000-10-08', 26, 'Female', 5, '9876543221', 'sanya.kapoor@email.com',    '32 Sector 17, Chandigarh',                    '2026-09-05', 1);

-- ============================================
-- Insert Patients
-- ============================================
INSERT INTO patients (full_name, age, gender, blood_group_id, hospital, doctor_name, phone, address) VALUES
('Suresh Yadav',      45, 'Male',   7, 'AIIMS Delhi',                          'Dr. Meena Kumari',   '9988776601', '22 Dwarka, New Delhi'),
('Lakshmi Devi',      60, 'Female', 1, 'Apollo Hospital, Chennai',             'Dr. Venkatesh Rao',  '9988776602', '15 T. Nagar, Chennai'),
('Manish Tiwari',     35, 'Male',   3, 'Fortis Hospital, Bengaluru',           'Dr. Sunil Reddy',    '9988776603', '78 Koramangala, Bengaluru'),
('Radha Krishnan',    28, 'Female', 8, 'Safdarjung Hospital, Delhi',           'Dr. Anil Sharma',    '9988776604', '45 Saket, New Delhi'),
('Pankaj Mishra',     52, 'Male',   2, 'Medanta Hospital, Gurugram',           'Dr. Priya Malhotra', '9988776605', '12 DLF Phase 3, Gurugram'),
('Nandini Rao',       38, 'Female', 5, 'Manipal Hospital, Bengaluru',          'Dr. Kiran Kumar',    '9988776606', '90 Indiranagar, Bengaluru'),
('Rajendra Prasad',   65, 'Male',   4, 'Sir Ganga Ram Hospital, Delhi',        'Dr. Neha Gupta',     '9988776607', '33 Karol Bagh, New Delhi'),
('Geeta Bhatt',       42, 'Female', 7, 'KEM Hospital, Mumbai',                 'Dr. Ashish Patil',   '9988776608', '56 Dadar, Mumbai');

-- ============================================
-- Insert Donations
-- ============================================
INSERT INTO donations (donor_id, blood_group_id, donation_date, units_donated, status, notes, created_by) VALUES
(1,  7, '2026-09-15', 1, 'Completed', 'Regular donation, no complications',           1),
(2,  1, '2026-08-20', 1, 'Completed', 'First-time donor, went smoothly',              1),
(3,  3, '2026-07-10', 2, 'Completed', 'Double unit donation',                         1),
(4,  2, '2026-09-01', 1, 'Completed', 'Regular donor',                                1),
(5,  5, '2026-06-25', 1, 'Completed', 'Donated during blood drive',                   1),
(6,  7, '2026-08-12', 1, 'Completed', 'Walk-in donation',                             1),
(7,  4, '2026-05-30', 1, 'Completed', 'Donated at camp',                              1),
(8,  1, '2026-09-20', 1, 'Completed', 'Regular donor',                                1),
(9,  8, '2026-07-15', 1, 'Completed', 'Rare blood type donation',                     1),
(10, 3, '2026-08-28', 1, 'Completed', 'Referred by a friend',                         1);

-- ============================================
-- Insert Blood Requests
-- ============================================
INSERT INTO blood_requests (patient_id, blood_group_id, units_required, hospital, request_date, urgency, status, notes, created_by) VALUES
(1, 7, 2, 'AIIMS Delhi',                   '2026-10-01', 'Urgent',   'Fulfilled', 'Surgery scheduled',                  1),
(2, 1, 1, 'Apollo Hospital, Chennai',      '2026-10-02', 'Normal',   'Fulfilled', 'Post-operative requirement',         1),
(3, 3, 3, 'Fortis Hospital, Bengaluru',    '2026-10-03', 'Critical', 'Approved',  'Accident case, urgent need',         1),
(4, 8, 1, 'Safdarjung Hospital, Delhi',    '2026-10-04', 'Urgent',   'Pending',   'Awaiting surgery date confirmation', 1),
(5, 2, 2, 'Medanta Hospital, Gurugram',    '2026-10-05', 'Normal',   'Pending',   'Planned transfusion',                1),
(6, 5, 1, 'Manipal Hospital, Bengaluru',   '2026-10-06', 'Normal',   'Approved',  'Routine procedure',                  1);

-- ============================================
-- Insert Blood Issues
-- ============================================
INSERT INTO blood_issues (request_id, patient_id, blood_group_id, units_issued, issue_date, notes, issued_by) VALUES
(1, 1, 7, 2, '2026-10-01', 'Issued for emergency surgery',           1),
(2, 2, 1, 1, '2026-10-02', 'Issued for post-op recovery',            1);
