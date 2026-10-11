-- ============================================
-- Blood Bank Management System
-- Database Schema
-- ============================================

CREATE DATABASE IF NOT EXISTS blood_bank_db;
USE blood_bank_db;

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS blood_issues, blood_requests, donations, inventory, patients, donors, users, admins, blood_groups;
SET FOREIGN_KEY_CHECKS = 1;

-- ============================================
-- Table: blood_groups
-- Master table for all 8 standard blood groups
-- ============================================
CREATE TABLE blood_groups (
    id INT AUTO_INCREMENT PRIMARY KEY,
    group_name VARCHAR(5) NOT NULL UNIQUE,
    description VARCHAR(100) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- Table: admins
-- Admin users who manage the system
-- ============================================
CREATE TABLE admins (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    is_active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ============================================
-- Table: users
-- Public website accounts (donors / people requesting blood)
-- ============================================
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(150) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    phone VARCHAR(15) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    blood_group_id INT DEFAULT NULL,
    is_active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (blood_group_id) REFERENCES blood_groups(id)
);

-- ============================================
-- Table: donors
-- People who donate blood
-- ============================================
CREATE TABLE donors (
    id INT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(150) NOT NULL,
    date_of_birth DATE DEFAULT NULL,
    age INT NOT NULL,
    gender ENUM('Male', 'Female', 'Other') NOT NULL,
    blood_group_id INT NOT NULL,
    phone VARCHAR(15) NOT NULL,
    email VARCHAR(100) DEFAULT NULL,
    address TEXT DEFAULT NULL,
    last_donation_date DATE DEFAULT NULL,
    is_eligible TINYINT(1) DEFAULT 1,
    is_active TINYINT(1) DEFAULT 1,
    user_id INT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (blood_group_id) REFERENCES blood_groups(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT chk_donor_age CHECK (age >= 18 AND age <= 65)
);

-- ============================================
-- Table: patients
-- People who need blood
-- ============================================
CREATE TABLE patients (
    id INT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(150) NOT NULL,
    age INT NOT NULL,
    gender ENUM('Male', 'Female', 'Other') NOT NULL,
    blood_group_id INT NOT NULL,
    hospital VARCHAR(200) NOT NULL,
    doctor_name VARCHAR(150) DEFAULT NULL,
    phone VARCHAR(15) NOT NULL,
    address TEXT DEFAULT NULL,
    is_active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (blood_group_id) REFERENCES blood_groups(id),
    CONSTRAINT chk_patient_age CHECK (age >= 0 AND age <= 120)
);

-- ============================================
-- Table: inventory
-- Current blood stock for each blood group
-- ============================================
CREATE TABLE inventory (
    id INT AUTO_INCREMENT PRIMARY KEY,
    blood_group_id INT NOT NULL UNIQUE,
    available_units INT NOT NULL DEFAULT 0,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (blood_group_id) REFERENCES blood_groups(id),
    CONSTRAINT chk_units_non_negative CHECK (available_units >= 0)
);

-- ============================================
-- Table: donations
-- Records of blood donations by donors
-- ============================================
CREATE TABLE donations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    donor_id INT NOT NULL,
    blood_group_id INT NOT NULL,
    donation_date DATE NOT NULL,
    units_donated INT NOT NULL DEFAULT 1,
    status ENUM('Completed', 'Rejected', 'Pending') DEFAULT 'Completed',
    notes TEXT DEFAULT NULL,
    created_by INT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (donor_id) REFERENCES donors(id),
    FOREIGN KEY (blood_group_id) REFERENCES blood_groups(id),
    FOREIGN KEY (created_by) REFERENCES admins(id),
    CONSTRAINT chk_donation_units CHECK (units_donated > 0 AND units_donated <= 3)
);

-- ============================================
-- Table: blood_requests
-- Requests for blood from patients
-- ============================================
CREATE TABLE blood_requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    patient_id INT NOT NULL,
    blood_group_id INT NOT NULL,
    units_required INT NOT NULL DEFAULT 1,
    hospital VARCHAR(200) NOT NULL,
    request_date DATE NOT NULL,
    urgency ENUM('Normal', 'Urgent', 'Critical') DEFAULT 'Normal',
    status ENUM('Pending', 'Approved', 'Fulfilled', 'Rejected') DEFAULT 'Pending',
    notes TEXT DEFAULT NULL,
    created_by INT DEFAULT NULL,
    user_id INT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (blood_group_id) REFERENCES blood_groups(id),
    FOREIGN KEY (created_by) REFERENCES admins(id),
    CONSTRAINT chk_request_units CHECK (units_required > 0 AND units_required <= 10)
);

-- ============================================
-- Table: blood_issues
-- Records of blood issued to patients
-- ============================================
CREATE TABLE blood_issues (
    id INT AUTO_INCREMENT PRIMARY KEY,
    request_id INT DEFAULT NULL,
    patient_id INT NOT NULL,
    blood_group_id INT NOT NULL,
    units_issued INT NOT NULL DEFAULT 1,
    issue_date DATE NOT NULL,
    notes TEXT DEFAULT NULL,
    issued_by INT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (request_id) REFERENCES blood_requests(id),
    FOREIGN KEY (patient_id) REFERENCES patients(id),
    FOREIGN KEY (blood_group_id) REFERENCES blood_groups(id),
    FOREIGN KEY (issued_by) REFERENCES admins(id),
    CONSTRAINT chk_issue_units CHECK (units_issued > 0)
);

-- ============================================
-- Indexes for performance
-- ============================================
CREATE INDEX idx_donors_blood_group ON donors(blood_group_id);
CREATE INDEX idx_donors_phone ON donors(phone);
CREATE INDEX idx_patients_blood_group ON patients(blood_group_id);
CREATE INDEX idx_donations_donor ON donations(donor_id);
CREATE INDEX idx_donations_date ON donations(donation_date);
CREATE INDEX idx_requests_patient ON blood_requests(patient_id);
CREATE INDEX idx_requests_status ON blood_requests(status);
CREATE INDEX idx_issues_patient ON blood_issues(patient_id);
CREATE INDEX idx_issues_date ON blood_issues(issue_date);
