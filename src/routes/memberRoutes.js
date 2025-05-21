// src/routes/memberRoutes.js
const express = require('express');
const router = express.Router();
const { 
  createMember, 
  getAllMembers, 
  getMember, 
  updateMember, 
  deleteMember,
  importMembers,
  getInactiveMembers,
  bulkCreateMembers
} = require('../controllers/memberController');
const { auth } = require('../middleware/auth');
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });

// Member routes
router.route('/')
  .post(auth, createMember)
  .get(auth, getAllMembers);

router.get('/inactive', auth, getInactiveMembers);
router.post('/bulk', auth, bulkCreateMembers);
router.route('/import')
  .post(auth, upload.single('file'), importMembers);

router.route('/:id')
  .get(auth, getMember)
  .patch(auth, updateMember)
  .delete(auth, deleteMember);

module.exports = router;
