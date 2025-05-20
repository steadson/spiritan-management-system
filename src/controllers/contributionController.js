// src/controllers/contributionController.js
const Contribution = require('../models/Contribution');
const Member = require('../models/Member');
// At the top of the file, add this import
const { logActivity } = require('../services/logService');
const { StatusCodes } = require('http-status-codes');
const { BadRequestError, NotFoundError } = require('../errors');

// Record new contribution
const createContribution = async (req, res) => {
  req.body.recordedBy = req.user.userId;
  
  // Check if member exists
  const member = await Member.findById(req.body.member);
  if (!member) {
    throw new NotFoundError(`No member with id ${req.body.member}`);
  }
  
  // Handle multi-month contributions
  if (req.body.numberOfMonths && req.body.numberOfMonths > 1) {
    return handleMultiMonthContribution(req, res, member);
  }
  
  // Format the contribution month to be the first day of the month
  const contributionMonth = new Date(req.body.contributionMonth);
  contributionMonth.setDate(1);
  contributionMonth.setHours(0, 0, 0, 0);
  req.body.contributionMonth = contributionMonth;
  
  // If expectedAmount is not provided, use the member's monthly contribution amount
  if (!req.body.expectedAmount) {
    req.body.expectedAmount = member.monthlyContributionAmount;
  }
  
  // Check if there's already a contribution for this member and month
  const existingContribution = await Contribution.findOne({
    member: req.body.member,
    contributionMonth: contributionMonth
  });
  
  let contribution;
  
  if (existingContribution) {
    // If there's an existing contribution, update it
    const newAmount = existingContribution.amount + Number(req.body.amount);
    const expectedAmount = existingContribution.expectedAmount;
    const isFullPayment = newAmount >= expectedAmount;
    const remainingAmount = Math.max(0, expectedAmount - newAmount);
    const overpaymentAmount = Math.max(0, newAmount - expectedAmount);

    contribution = await Contribution.findByIdAndUpdate(
      existingContribution._id,
      { 
        amount: newAmount,
        isFullPayment,
        remainingAmount,
        overpaymentAmount,
        paymentMethod: req.body.paymentMethod || existingContribution.paymentMethod,
        reference: req.body.reference || existingContribution.reference,
        notes: req.body.notes ? `${existingContribution.notes}; ${req.body.notes}` : existingContribution.notes,
        contributionDate: req.body.contributionDate || new Date()  
      },
      { new: true, runValidators: true }
    );
     logAction = 'update';
    logDescription = `Updated contribution for ${member.names} for ${contributionMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}. Added ${req.body.amount} to existing amount.`;
  } else {
    // Create a new contribution
    // Calculate overpayment for new contributions too
    const expectedAmount = req.body.expectedAmount;
    const amount = Number(req.body.amount);
    req.body.isFullPayment = amount >= expectedAmount;
    req.body.remainingAmount = Math.max(0, expectedAmount - amount);
    req.body.overpaymentAmount = Math.max(0, amount - expectedAmount);
    
    contribution = await Contribution.create(req.body);
    logAction = 'create';
    logDescription = `Created new contribution of ${amount} for ${member.names} for ${contributionMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}.`;
  }
  // Log the activity with related entities
  await logActivity({
    user: req.user.userId,
    action: logAction,
    resourceType: 'contribution',
    resourceId: contribution._id,
    relatedEntities: [
      { entityType: 'member', entityId: member._id },
      { entityType: 'user', entityId: req.user.userId }
    ],
    description: logDescription,
    details: {
      memberId: member._id,
      memberName: member.names,
      amount: req.body.amount,
      contributionMonth: contributionMonth,
      paymentMethod: req.body.paymentMethod
    },
    ipAddress: req.ip
  });
  res.status(StatusCodes.CREATED).json({ contribution });
};

// Handle multi-month contributions
const handleMultiMonthContribution = async (req, res, member) => {
  const { numberOfMonths, contributionMonth, amount } = req.body;
  const totalAmount = Number(amount);
  const monthlyAmount = member.monthlyContributionAmount;
  const startMonth = new Date(contributionMonth);
  startMonth.setDate(1);
  startMonth.setHours(0, 0, 0, 0);
  
  // Calculate how many full months can be covered
  const fullMonthsCovered = Math.floor(totalAmount / monthlyAmount);
  const remainingAmount = totalAmount % monthlyAmount;
  
  const contributions = [];
  let amountLeft = totalAmount;
  
  // Create contributions for each month
  for (let i = 0; i < numberOfMonths && i < fullMonthsCovered + 1; i++) {
    const currentMonth = new Date(startMonth);
    currentMonth.setMonth(startMonth.getMonth() + i);
    
    // For the last month that might be partially covered
    let monthAmount = i < fullMonthsCovered ? monthlyAmount : remainingAmount;
    
    if (monthAmount <= 0) break;
    
    // Check if there's already a contribution for this month
    const existingContribution = await Contribution.findOne({
      member: req.body.member,
      contributionMonth: currentMonth
    });
    
    if (existingContribution) {
      // Update existing contribution
      const newAmount = existingContribution.amount + monthAmount;
      const isFullPayment = newAmount >= monthlyAmount;
      const monthRemainingAmount = Math.max(0, monthlyAmount - newAmount);
      const overpaymentAmount = Math.max(0, newAmount - monthlyAmount);
      
      const updatedContribution = await Contribution.findByIdAndUpdate(
        existingContribution._id,
        {
          amount: newAmount,
          isFullPayment,
          remainingAmount: monthRemainingAmount,
          overpaymentAmount,
          paymentMethod: req.body.paymentMethod || existingContribution.paymentMethod,
          reference: req.body.reference || existingContribution.reference,
          notes: req.body.notes ? `${existingContribution.notes}; Multi-month payment (${i+1}/${numberOfMonths})` : existingContribution.notes,
          contributionDate: req.body.contributionDate || new Date()
        },
        { new: true, runValidators: true }
      );
      
      contributions.push(updatedContribution);
    } else {
      // Create new contribution
      const isFullPayment = monthAmount >= monthlyAmount;
      const monthRemainingAmount = Math.max(0, monthlyAmount - monthAmount);
      const overpaymentAmount = Math.max(0, monthAmount - monthlyAmount);
      
      const newContribution = await Contribution.create({
        member: req.body.member,
        amount: monthAmount,
        expectedAmount: monthlyAmount,
        contributionMonth: currentMonth,
        contributionDate: req.body.contributionDate || new Date(),
        paymentMethod: req.body.paymentMethod,
        reference: req.body.reference,
        notes: req.body.notes ? `${req.body.notes}; Multi-month payment (${i+1}/${numberOfMonths})` : `Multi-month payment (${i+1}/${numberOfMonths})`,
        recordedBy: req.body.recordedBy,
        isFullPayment,
        remainingAmount: monthRemainingAmount,
        overpaymentAmount
      });
      
      contributions.push(newContribution);
    }
    
    amountLeft -= monthAmount;
  }
  
  res.status(StatusCodes.CREATED).json({ 
    contributions,
    totalAmount,
    monthsCovered: contributions.length,
    message: `Successfully recorded payment for ${contributions.length} months`
  });
};
// Get all contributions with pagination and filters
const getAllContributions = async (req, res) => {
  const { member, startDate, endDate, sort } = req.query;
  const queryObject = {};
  
  // Apply filters
  if (member) {
    queryObject.member = member;
  }
  
  if (startDate && endDate) {
    queryObject.contributionDate = {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    };
  } else if (startDate) {
    queryObject.contributionDate = { $gte: new Date(startDate) };
  } else if (endDate) {
    queryObject.contributionDate = { $lte: new Date(endDate) };
  }
  
  // Pagination setup
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;
  const skip = (page - 1) * limit;
  
  // Sorting
  let sortOptions = { contributionDate: -1 };
  if (sort) {
    const sortFields = sort.split(',').join(' ');
    sortOptions = sortFields;
  }
  
  const contributions = await Contribution.find(queryObject)
    .populate({
      path: 'member',
      select: 'names email phoneNumber category'
    })
    .sort(sortOptions)
    .skip(skip)
    .limit(limit);
  
  const totalContributions = await Contribution.countDocuments(queryObject);
  const numOfPages = Math.ceil(totalContributions / limit);
  
  res.status(StatusCodes.OK).json({
    contributions,
    totalContributions,
    numOfPages,
    currentPage: page
  });
};

// Get contribution by ID
const getContribution = async (req, res) => {
  const { id: contributionId } = req.params;
  
  const contribution = await Contribution.findById(contributionId)
    .populate({
      path: 'member',
      select: 'names email phoneNumber category monthlyContributionAmount'
    })
    .populate({
      path: 'recordedBy',
      select: 'name email'
    });
  
  if (!contribution) {
    throw new NotFoundError(`No contribution with id ${contributionId}`);
  }
  
  res.status(StatusCodes.OK).json({ contribution });
};

// Update contribution
const updateContribution = async (req, res) => {
  const { id: contributionId } = req.params;
  
  // Get the existing contribution
  const existingContribution = await Contribution.findById(contributionId);
  if (!existingContribution) {
    throw new NotFoundError(`No contribution with id ${contributionId}`);
  }
  
  // If amount is being updated, recalculate isFullPayment and remainingAmount
  if (req.body.amount !== undefined) {
  const newAmount = Number(req.body.amount);
  const expectedAmount = req.body.expectedAmount !== undefined ? 
    Number(req.body.expectedAmount) : existingContribution.expectedAmount;
  
  req.body.isFullPayment = newAmount >= expectedAmount;
  req.body.remainingAmount = Math.max(0, expectedAmount - newAmount);
  req.body.overpaymentAmount = Math.max(0, newAmount - expectedAmount);
}else if (req.body.expectedAmount !== undefined) {
    // If only expectedAmount is being updated
    const expectedAmount = Number(req.body.expectedAmount);
    req.body.isFullPayment = existingContribution.amount >= expectedAmount;
    req.body.remainingAmount = Math.max(0, expectedAmount - existingContribution.amount);
  }
  
  // Update the contribution
  const contribution = await Contribution.findByIdAndUpdate(
    contributionId,
    req.body,
    { new: true, runValidators: true }
  );
   // Log the activity with related entities
  await logActivity({
    user: req.user.userId,
    action: 'update',
    resourceType: 'contribution',
    resourceId: contributionId,
    relatedEntities: [
      { entityType: 'member', entityId: existingContribution.member._id },
      { entityType: 'user', entityId: req.user.userId }
    ],
    description: `Updated contribution for ${existingContribution.member.names} from ${existingContribution.contributionMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}.`,
    details: {
      memberId: existingContribution.member._id,
      memberName: existingContribution.member.names,
      updatedFields: Object.keys(req.body),
      oldValues: Object.keys(req.body).reduce((acc, key) => {
        acc[key] = existingContribution[key];
        return acc;
      }, {}),
      newValues: req.body
    },
    ipAddress: req.ip
  });
  
  res.status(StatusCodes.OK).json({ contribution });
};

// Delete contribution
const deleteContribution = async (req, res) => {
  const { id: contributionId } = req.params;
  
  const contribution = await Contribution.findById(contributionId);
  if (!contribution) {
    throw new NotFoundError(`No contribution with id ${contributionId}`);
  }
  
  await contribution.remove();
  // Log the activity with related entities
  await logActivity({
    user: req.user.userId,
    action: 'delete',
    resourceType: 'contribution',
    resourceId: contributionId,
    relatedEntities: [
      { entityType: 'member', entityId: contribution.member._id },
      { entityType: 'user', entityId: req.user.userId }
    ],
    description: `Deleted contribution for ${contribution.member.names} from ${contribution.contributionMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}.`,
    details: {
      memberId: contribution.member._id,
      memberName: contribution.member.names,
      amount: contribution.amount,
      contributionMonth: contribution.contributionMonth
    },
    ipAddress: req.ip
  });
  res.status(StatusCodes.OK).json({ msg: 'Contribution removed successfully' });
};

// Get member payment history with enhanced summary
// Get member payment history with enhanced summary
const getMemberPaymentHistory = async (req, res) => {
  const { memberId } = req.params;
  
  // Check if member exists
  const member = await Member.findById(memberId);
  if (!member) {
    throw new NotFoundError(`No member with id ${memberId}`);
  }
  
  const { startDate, endDate, sort } = req.query;
  const queryObject = { member: memberId };
  
  // Apply date filters
  if (startDate && endDate) {
    queryObject.contributionDate = {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    };
  } else if (startDate) {
    queryObject.contributionDate = { $gte: new Date(startDate) };
  } else if (endDate) {
    queryObject.contributionDate = { $lte: new Date(endDate) };
  }
  
  // Sorting
  let sortOptions = { contributionDate: -1 };
  if (sort) {
    const sortFields = sort.split(',').join(' ');
    sortOptions = sortFields;
  }
  
  const contributions = await Contribution.find(queryObject)
    .sort(sortOptions);
  
  // Calculate total contributed (historic)
  const totalHistoricContributed = contributions.reduce((sum, contribution) => sum + contribution.amount, 0);
  
  // Calculate total expected based on the sum of expected amounts for each month
  const totalMonthlyExpected = contributions.reduce((sum, contribution) => sum + contribution.expectedAmount, 0);
  
  // // Calculate total remaining
  // const totalRemaining = contributions.reduce((sum, contribution) => sum + contribution.remainingAmount, 0);
  
  // // Calculate total excesses (overpayments)
  // const totalExcesses = contributions.reduce((sum, contribution) => sum + (contribution.overpaymentAmount || 0), 0);
  
  // Calculate expected contribution from registration to present
  const registrationDate = new Date(member.registrationDate);
  const currentDate = new Date();
  const monthsDiff = (currentDate.getFullYear() - registrationDate.getFullYear()) * 12 + 
                     (currentDate.getMonth() - registrationDate.getMonth()) + 1;
  const totalLifetimeExpected = monthsDiff * member.monthlyContributionAmount;
  
  // Calculate yearly expected contribution
  const currentYear = currentDate.getFullYear();
  const startOfYear = new Date(currentYear, 0, 1);
  const monthsThisYear = currentDate.getMonth() + 1;
  const totalYearlyExpectedContribution = 12 * member.monthlyContributionAmount;
  const yearToDateExpectedContribution = monthsThisYear * member.monthlyContributionAmount;
  
  // Calculate contributions for current year
  const yearContributions = contributions.filter(c => {
    const contribDate = new Date(c.contributionDate);
    return contribDate.getFullYear() === currentYear;
  });
  
  const yearToDateContributed = yearContributions.reduce((sum, contribution) => sum + contribution.amount, 0);
  
  // Calculate monthly balance
  const currentMonth = currentDate.getMonth();
  const currentMonthContributions = contributions.filter(c => {
    const contribDate = new Date(c.contributionMonth);
    return contribDate.getMonth() === currentMonth && contribDate.getFullYear() === currentYear;
  });
  
  const currentMonthContributed = currentMonthContributions.reduce((sum, contribution) => sum + contribution.amount, 0);
  const monthlyBalance = member.monthlyContributionAmount - currentMonthContributed;
  
  // Calculate yearly balance
  const yearlyBalance = totalYearlyExpectedContribution - yearToDateContributed;
  
  // Group contributions by month for a better summary
  const monthlyContributions = {};
  contributions.forEach(contribution => {
    const month = new Date(contribution.contributionMonth);
    const monthKey = `${month.getFullYear()}-${month.getMonth() + 1}`;
    
    if (!monthlyContributions[monthKey]) {
      monthlyContributions[monthKey] = {
        month: month,
        expectedAmount: contribution.expectedAmount,
        paidAmount: contribution.amount,
        isFullyPaid: contribution.isFullPayment,
        remainingAmount: contribution.remainingAmount,
        overpaymentAmount: contribution.overpaymentAmount || 0,
        contributionId: contribution._id
      };
    }
  });
  
  // Calculate overall balance (from registration to present)
  const totalLifetimeBalance = totalLifetimeExpected - totalHistoricContributed;
  
  res.status(StatusCodes.OK).json({
    member: {
      id: member._id,
      names: member.names,
      email: member.email,
      phoneNumber: member.phoneNumber,
      registrationDate: member.registrationDate,
      currentMonthlyContributionAmount: member.monthlyContributionAmount
    },
    
    summary: {
      // Overall contribution stats with renamed fields
      totalHistoricContributed,
      totalMonthlyExpected,
      // totalRemaining,
      // totalExcesses,
      
      // Monthly balance
      monthlyBalance,
      isMonthlyOwing: monthlyBalance > 0,
      
      // Yearly balance
      yearlyBalance,
      isYearlyOwing: yearlyBalance > 0,
      
      // Lifetime stats (from registration to present)
      totalLifetimeExpected,
      totalLifetimeBalance,
      // isLifetimeOwing: totalLifetimeBalance > 0,
      
      // Current year stats
      totalYearlyExpectedContribution,
      yearToDateExpectedContribution,
      yearToDateContributed,
      yearlyTargetRemaining: totalYearlyExpectedContribution - yearToDateContributed,
      isYearlyTargetReached: yearToDateContributed >= totalYearlyExpectedContribution,
      
      // Month stats
      monthsContributed: Object.keys(monthlyContributions).length,
      fullyPaidMonths: Object.values(monthlyContributions).filter(m => m.isFullyPaid).length,
      
      // Current tracking period
      presentDate: currentDate,
      presentMonth: currentDate.getMonth() + 1,
      presentYear: currentDate.getFullYear()
    },
    monthlyContributions: Object.values(monthlyContributions),
    contributions
  });
};

module.exports = {
  createContribution,
  getAllContributions,
  getContribution,
  updateContribution,
  deleteContribution,
  getMemberPaymentHistory
};