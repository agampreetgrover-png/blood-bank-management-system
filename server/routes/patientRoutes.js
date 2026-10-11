const express = require('express');
const router = express.Router();
const { getAllPatients, getPatientById, createPatient, updatePatient, deletePatient } = require('../controllers/patientController');
const authMiddleware = require('../middleware/auth');

router.get('/', authMiddleware, getAllPatients);
router.get('/:id', authMiddleware, getPatientById);
router.post('/', authMiddleware, createPatient);
router.put('/:id', authMiddleware, updatePatient);
router.delete('/:id', authMiddleware, deletePatient);

module.exports = router;
