// src/controllers/memberController.js
const Member = require('../models/Member');
const Contribution = require('../models/Contribution');
const { StatusCodes } = require('http-status-codes');
const { BadRequestError, NotFoundError } = require('../errors');
const contributionController = require('./contributionController');
// Create new member
const createMember = async (req, res) => {
  req.body.createdBy = req.user.userId;
  
  const member = await Member.create(req.body);
  res.status(StatusCodes.CREATED).json({ member });
};

// Get all members with pagination
const getAllMembers = async (req, res) => {
  const { category, location, status, search, sort } = req.query;
  const queryObject = {};

  // Apply filters
  if (category) {
    queryObject.category = category;
  }
  
  if (location) {
    queryObject.location = { $regex: location, $options: 'i' };
  }
  
  if (status) {
    queryObject.status = status;
  } else {
    queryObject.status = 'Active'; // Default to only active members
  }
  
  if (search) {
    queryObject.$or = [
      { names: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { phoneNumber: { $regex: search, $options: 'i' } }
    ];
  }

  // Pagination setup
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  // Sorting
  let sortOptions = { registrationDate: -1 };
  if (sort) {
    const sortFields = sort.split(',').join(' ');
    sortOptions = sortFields;
  }

  const members = await Member.find(queryObject).populate({
      path: 'createdBy',
      select: 'name email role' // Only select the fields you want to include
    })
    .sort(sortOptions)
    .skip(skip)
    .limit(limit);

  const totalMembers = await Member.countDocuments(queryObject);
  const numOfPages = Math.ceil(totalMembers / limit);

  res.status(StatusCodes.OK).json({ 
    members, 
    totalMembers, 
    numOfPages, 
    currentPage: page 
  });
};

// Get inactive members
const getInactiveMembers = async (req, res) => {
  const { category, location, search, sort } = req.query;
  const queryObject = { status: 'Inactive' };

  // Apply filters
  if (category) {
    queryObject.category = category;
  }
  
  if (location) {
    queryObject.location = { $regex: location, $options: 'i' };
  }
  
  if (search) {
    queryObject.$or = [
      { names: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { phoneNumber: { $regex: search, $options: 'i' } }
    ];
  }

  // Pagination setup
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  // Sorting
  let sortOptions = { registrationDate: -1 };
  if (sort) {
    const sortFields = sort.split(',').join(' ');
    sortOptions = sortFields;
  }

  const members = await Member.find(queryObject)
    .populate({
      path: 'createdBy',
      select: 'name email role'
    })
    .sort(sortOptions)
    .skip(skip)
    .limit(limit);

  const totalMembers = await Member.countDocuments(queryObject);
  const numOfPages = Math.ceil(totalMembers / limit);

  res.status(StatusCodes.OK).json({ 
    members, 
    totalMembers, 
    numOfPages, 
    currentPage: page 
  });
};

// Get single member
const getMember = async (req, res) => {
  const { id: memberId } = req.params;
  
  const member = await Member.findById(memberId).populate({
    path: 'createdBy',
    select: 'name email role' // Only select the fields you want to include
  });
  
  if (!member) {
    throw new NotFoundError(`No member with id ${memberId}`);
  }
  
  // Get contributions for this member
  const contributions = await Contribution.find({ member: memberId })
    .sort({ contributionDate: -1 });
  
  // Calculate total contributed
  const totalContributed = contributions.reduce((sum, contribution) => sum + contribution.amount, 0);
  
  // Calculate total expected contribution
  const registrationDate = new Date(member.registrationDate);
  const currentDate = new Date();
  const monthsDiff = (currentDate.getFullYear() - registrationDate.getFullYear()) * 12 + 
                     (currentDate.getMonth() - registrationDate.getMonth()) + 1;
  const totalExpected = monthsDiff * member.monthlyContributionAmount;
  
   // Calculate yearly expected contribution
  const totalYearlyExpectedContribution = 12 * member.monthlyContributionAmount;
  // Calculate balance
  const balance = totalExpected - totalContributed;
   // Create a mock request object to pass to getMemberPaymentHistory
  const mockReq = {
    params: { memberId },
    query: {}
  };
  
  // Create a mock response object to capture the response
  const mockRes = {
    status: function(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
    json: function(data) {
      this.data = data;
      return this;
    }
  };
   // Call getMemberPaymentHistory to get the contribution summary
  await contributionController.getMemberPaymentHistory(mockReq, mockRes);
  const contributionSummary = mockRes.data;
  res.status(StatusCodes.OK).json({ 
    member,
    contributionSummary,
    contributions
  });
};

// Update member
const updateMember = async (req, res) => {
  const { id: memberId } = req.params;
  
  const member = await Member.findByIdAndUpdate(
    memberId, 
    req.body, 
    { new: true, runValidators: true }
  );
  
  if (!member) {
    throw new NotFoundError(`No member with id ${memberId}`);
  }
  
  res.status(StatusCodes.OK).json({ member });
};

// Delete member
const deleteMember = async (req, res) => {
  const { id: memberId } = req.params;
  
  const member = await Member.findById(memberId);
  if (!member) {
    throw new NotFoundError(`No member with id ${memberId}`);
  }
  
  // Instead of hard delete, update status to Inactive
  member.status = 'Inactive';
  await member.save();
  
  res.status(StatusCodes.OK).json({ msg: 'Member deactivated successfully' });
};

// Import members from Excel/CSV
const importMembers = async (req, res) => {
  if (!req.file) {
    throw new BadRequestError('Please upload a file');
  }
  
  const filePath = req.file.path;
  const fileExtension = req.file.originalname.split('.').pop().toLowerCase();
  
  try {
    let members = [];
    
    // Process based on file type
    if (fileExtension === 'xlsx' || fileExtension === 'xls') {
      // Handle Excel files
      const xlsx = require('xlsx');
      const workbook = xlsx.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = xlsx.utils.sheet_to_json(worksheet);
      
      members = data.map(row => ({
        names: row.names || row.Names || row.NAME || '',
        category: row.category || row.Category || 'member',
        email: row.email || row.Email || '',
        phoneNumber: row.phoneNumber || row.PhoneNumber || row['Phone Number'] || '',
        location: row.location || row.Location || '',
        registrationDate: row.registrationDate || row.RegistrationDate || new Date(),
        monthlyContributionAmount: Number(row.monthlyContributionAmount || row.MonthlyContributionAmount || 0),
        status: 'Active',
        createdBy: req.user.userId
      }));
    } else if (fileExtension === 'csv') {
      // Handle CSV files
      const fs = require('fs');
      const csv = require('csv-parser');
      
      const parseCSV = () => {
        return new Promise((resolve, reject) => {
          const results = [];
          fs.createReadStream(filePath)
            .pipe(csv())
            .on('data', (data) => results.push(data))
            .on('end', () => resolve(results))
            .on('error', (error) => reject(error));
        });
      };
      
      const data = await parseCSV();
      
      members = data.map(row => ({
        names: row.names || row.Names || row.NAME || '',
        category: row.category || row.Category || 'member',
        email: row.email || row.Email || '',
        phoneNumber: row.phoneNumber || row.PhoneNumber || row['Phone Number'] || '',
        location: row.location || row.Location || '',
        registrationDate: row.registrationDate || row.RegistrationDate || new Date(),
        monthlyContributionAmount: Number(row.monthlyContributionAmount || row.MonthlyContributionAmount || 0),
        status: 'Active',
        createdBy: req.user.userId
      }));
    } else {
      throw new BadRequestError('Unsupported file format. Please upload an Excel (.xlsx, .xls) or CSV file.');
    }
    
    // Validate required fields
    const invalidMembers = members.filter(member => 
      !member.names || !member.phoneNumber || !member.location || !member.monthlyContributionAmount
    );
    
    if (invalidMembers.length > 0) {
      throw new BadRequestError('Some members are missing required fields: names, phoneNumber, location, or monthlyContributionAmount');
    }
    
    // Create members in the database
    const createdMembers = await Member.create(members);
    
    // Clean up the uploaded file
    fs.unlink(filePath, (err) => {
      if (err) console.error('Error deleting file:', err);
    });
    
    res.status(StatusCodes.CREATED).json({ 
      count: createdMembers.length,
      members: createdMembers,
      msg: `Successfully imported ${createdMembers.length} members` 
    });
  } catch (error) {
    // Clean up the uploaded file in case of error
    const fs = require('fs');
    fs.unlink(filePath, (err) => {
      if (err) console.error('Error deleting file:', err);
    });
    
    if (error.name === 'ValidationError') {
      throw new BadRequestError(error.message);
    } else if (error.code === 11000) {
      throw new BadRequestError('Duplicate entries found. Some members may already exist in the database.');
    } else {
      throw new BadRequestError(`Import failed: ${error.message}`);
    }
  }
};

// Bulk create members from JSON data
const bulkCreateMembers = async (req, res) => {
  if (!req.body.members || !Array.isArray(req.body.members) || req.body.members.length === 0) {
    throw new BadRequestError('Please provide an array of members');
  }
  
  const membersData = req.body.members;
  
  try {
    // Prepare members data with createdBy field
    const members = membersData.map(member => ({
      ...member,
      createdBy: req.user.userId,
      status: member.status || 'Active'
    }));
    
    // Validate required fields
    const invalidMembers = members.filter(member => 
      !member.names || !member.phoneNumber || !member.location || !member.monthlyContributionAmount
    );
    
    if (invalidMembers.length > 0) {
      throw new BadRequestError('Some members are missing required fields: names, phoneNumber, location, or monthlyContributionAmount');
    }
    
    // Create members in the database
    const createdMembers = await Member.create(members);
    
    res.status(StatusCodes.CREATED).json({ 
      count: createdMembers.length,
      members: createdMembers,
      msg: `Successfully created ${createdMembers.length} members` 
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      throw new BadRequestError(error.message);
    } else if (error.code === 11000) {
      throw new BadRequestError('Duplicate entries found. Some members may already exist in the database.');
    } else {
      throw new BadRequestError(`Bulk creation failed: ${error.message}`);
    }
  }
};

module.exports = {
  createMember,
  getAllMembers,
  getMember,
  updateMember,
  deleteMember,
  importMembers,
  getInactiveMembers,
  bulkCreateMembers
};