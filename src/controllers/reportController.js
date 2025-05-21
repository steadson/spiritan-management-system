// src/controllers/reportController.js
const Member = require('../models/Member');
const Contribution = require('../models/Contribution');
const { StatusCodes } = require('http-status-codes');

// Get overall summary stats
const getOverallStats = async (req, res) => {
  // Count total members
  const totalMembers = await Member.countDocuments({ status: 'Active' });
  
  // Get total contributions
  const contributionsAggregate = await Contribution.aggregate([
    {
      $group: {
        _id: null,
        totalAmount: { $sum: '$amount' },
        count: { $sum: 1 }
      }
    }
  ]);
  
  const totalContributions = contributionsAggregate[0]?.totalAmount || 0;
  const contributionCount = contributionsAggregate[0]?.count || 0;
  
  // Get monthly stats for the last 6 months
  const today = new Date();
  const sixMonthsAgo = new Date(today.setMonth(today.getMonth() - 6));
  
  const monthlyStats = await Contribution.aggregate([
    {
      $match: {
        contributionDate: { $gte: sixMonthsAgo }
      }
    },
    {
      $group: {
        _id: { 
          year: { $year: '$contributionDate' },
          month: { $month: '$contributionDate' }
        },
        totalAmount: { $sum: '$amount' },
        count: { $sum: 1 }
      }
    },
    {
      $sort: { '_id.year': 1, '_id.month': 1 }
    }
  ]);
  
  // Format monthly stats
  const formattedMonthlyStats = monthlyStats.map(stat => {
    return {
      year: stat._id.year,
      month: stat._id.month,
      totalAmount: stat.totalAmount,
      count: stat.count
    };
  });
  
  // Get members with outstanding balances
  const members = await Member.find({ status: 'Active' });
  
  let membersWithBalance = [];
  for (const member of members) {
    // Get total contributions for this member
    const contributionsAggregate = await Contribution.aggregate([
      {
        $match: { member: member._id }
      },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$amount' }
        }
      }
    ]);
    
    const totalContributed = contributionsAggregate[0]?.totalAmount || 0;
    
    // Calculate expected contribution
    const registrationDate = new Date(member.registrationDate);
    const currentDate = new Date();
    const monthsDiff = (currentDate.getFullYear() - registrationDate.getFullYear()) * 12 + 
                       (currentDate.getMonth() - registrationDate.getMonth()) + 1;
    const totalExpected = monthsDiff * member.monthlyContributionAmount;
    
    // Calculate balance
    const balance = totalExpected - totalContributed;
    
    if (balance > 0) {
      membersWithBalance.push({
        id: member._id,
        names: member.names,
        email: member.email,
        phoneNumber: member.phoneNumber,
        totalExpected,
        totalContributed,
        balance
      });
    }
  }
  
  // Sort by highest balance first
  membersWithBalance.sort((a, b) => b.balance - a.balance);
  
  // Take top 10
  const topOwingMembers = membersWithBalance.slice(0, 10);
  
  res.status(StatusCodes.OK).json({
    summary: {
      totalMembers,
      totalContributions,
      contributionCount,
      averageContribution: contributionCount > 0 ? totalContributions / contributionCount : 0,
      membersWithOutstandingBalance: membersWithBalance.length
    },
    monthlyStats: formattedMonthlyStats,
    topOwingMembers
  });
};

// Get members with outstanding balances
const getMembersWithOutstandingBalances = async (req, res) => {
  const { minBalance, sort } = req.query;
  const minBalanceValue = Number(minBalance) || 0;
  
  // Get all active members
  const members = await Member.find({ status: 'Active' });
  
  let membersWithBalance = [];
  for (const member of members) {
    // Get total contributions for this member
    const contributionsAggregate = await Contribution.aggregate([
      {
        $match: { member: member._id }
      },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$amount' }
        }
      }
    ]);
    
    const totalContributed = contributionsAggregate[0]?.totalAmount || 0;
    
    // Calculate expected contribution
    const registrationDate = new Date(member.registrationDate);
    const currentDate = new Date();
    const monthsDiff = (currentDate.getFullYear() - registrationDate.getFullYear()) * 12 + 
                       (currentDate.getMonth() - registrationDate.getMonth()) + 1;
    const totalExpected = monthsDiff * member.monthlyContributionAmount;
    
    // Calculate balance
    const balance = totalExpected - totalContributed;
    
    if (balance >= minBalanceValue) {
      membersWithBalance.push({
        id: member._id,
        names: member.names,
        email: member.email,
        phoneNumber: member.phoneNumber,
        category: member.category,
        location: member.location,
        registrationDate: member.registrationDate,
        monthlyContributionAmount: member.monthlyContributionAmount,
        totalExpected,
        totalContributed,
        balance,
        monthsBehind: Math.floor(balance / member.monthlyContributionAmount)
      });
    }
  }
  
  // Apply sorting
  if (sort === 'balance') {
    membersWithBalance.sort((a, b) => b.balance - a.balance);
  } else if (sort === 'monthsBehind') {
    membersWithBalance.sort((a, b) => b.monthsBehind - a.monthsBehind);
  } else if (sort === 'alphabetical') {
    membersWithBalance.sort((a, b) => a.names.localeCompare(b.names));
  }
  
  res.status(StatusCodes.OK).json({
    count: membersWithBalance.length,
    members: membersWithBalance
  });
};

// Get monthly contribution report
const getMonthlyContributionReport = async (req, res) => {
  const { year, month } = req.query;
  
  if (!year || !month) {
    throw new BadRequestError('Please provide year and month');
  }
  
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0); // Last day of the month
  
  // Get contributions for the specified month
  const contributions = await Contribution.find({
    contributionDate: {
      $gte: startDate,
      $lte: endDate
    }
  }).populate({
    path: 'member',
    select: 'names email phoneNumber category'
  });
  
  // Calculate total contribution for the month
  const totalAmount = contributions.reduce((sum, contribution) => sum + contribution.amount, 0);
  
  // Group by member
  const memberMap = {};
  contributions.forEach(contribution => {
    const memberId = contribution.member._id.toString();
    if (!memberMap[memberId]) {
      memberMap[memberId] = {
        member: {
          id: contribution.member._id,
          names: contribution.member.names,
          email: contribution.member.email,
          phoneNumber: contribution.member.phoneNumber,
          category: contribution.member.category
        },
        totalAmount: 0,
        contributions: []
      };
    }
    
    memberMap[memberId].totalAmount += contribution.amount;
    memberMap[memberId].contributions.push({
      id: contribution._id,
      amount: contribution.amount,
      date: contribution.contributionDate,
      paymentMethod: contribution.paymentMethod,
      reference: contribution.reference
    });
  });
  
  const memberContributions = Object.values(memberMap);
  
  res.status(StatusCodes.OK).json({
    month: month,
    year: year,
    totalContributions: contributions.length,
    totalAmount: totalAmount,
    memberContributions: memberContributions
  });
};

// Get yearly contribution report
const getYearlyContributionReport = async (req, res) => {
  const { year } = req.query;
  
  if (!year) {
    throw new BadRequestError('Please provide year');
  }
  
  const startDate = new Date(year, 0, 1); // January 1
  const endDate = new Date(year, 11, 31); // December 31
  
  // Get contributions for the year grouped by month
  const monthlyContributions = await Contribution.aggregate([
    {
      $match: {
        contributionDate: {
          $gte: startDate,
          $lte: endDate
        }
      }
    },
    {
      $group: {
        _id: { month: { $month: '$contributionDate' } },
        totalAmount: { $sum: '$amount' },
        count: { $sum: 1 }
      }
    },
    {
      $sort: { '_id.month': 1 }
    }
  ]);
  
  // Format the response
  const months = [];
  for (let i = 1; i <= 12; i++) {
    const month = monthlyContributions.find(m => m._id.month === i);
    months.push({
      month: i,
      totalAmount: month ? month.totalAmount : 0,
      count: month ? month.count : 0
    });
  }
  
  // Calculate yearly total
  const yearlyTotal = months.reduce((sum, month) => sum + month.totalAmount, 0);
  const contributionCount = months.reduce((sum, month) => sum + month.count, 0);
  
  res.status(StatusCodes.OK).json({
    year: year,
    totalAmount: yearlyTotal,
    totalContributions: contributionCount,
    monthlyBreakdown: months
  });
};

module.exports = {
  getOverallStats,
  getMembersWithOutstandingBalances,
  getMonthlyContributionReport,
  getYearlyContributionReport
};
