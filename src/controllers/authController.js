// src/controllers/authController.js
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { StatusCodes } = require('http-status-codes');
const { BadRequestError, UnauthenticatedError } = require('../errors');
const Plan = require('../models/plans')


const register = async (req, res) => {
  const userCount = await User.countDocuments({});
  if (userCount === 0) {
    // First user - make them a superadmin
    const user = await User.create({ 
      ...req.body,
      role: 'superadmin' // Force first user to be superadmin
    });
    const token = user.createJWT();
    console.log("new superAdmin created")
    res.status(StatusCodes.CREATED).json({
      user: { name: user.name, email: user.email, role: user.role },
      token
    });
  } else {
    // For subsequent users, we need to add the middleware back
    // You have two options:
    
    // OPTION 1: Add the middleware back to the route
    // In authRoutes.js: router.post('/register', authenticateUser, register);
    
    // OPTION 2: Keep your current setup but modify this controller to handle unauthenticated requests
    // This is what we'll do below:
    
    // Check if there's a token in the header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthenticatedError('Authentication required to register new users');
    }
    
    try {
      // Manually verify the token
      const token = authHeader.split(' ')[1];
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      
      // Check if the user is a superadmin
      if (payload.role !== 'superadmin') {
        throw new UnauthenticatedError('Only superadmins can register new users');
      }
      
      // Create the new user
      const user = await User.create({ ...req.body });
      const newToken = user.createJWT();
      console.log("new admin created")
      res.status(StatusCodes.CREATED).json({
        user: { name: user.name, email: user.email, role: user.role },
        token: newToken
      });
    } catch (error) {
      console.log(error)
      throw new UnauthenticatedError('Authentication invalid');
    }
  }
};



const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new BadRequestError('Please provide email and password');
  }

  const user = await User.findOne({ email }).select('+password');
  if (!user) {
    throw new UnauthenticatedError('Invalid credentials');
  }

  const isPasswordCorrect = await user.comparePassword(password);
  if (!isPasswordCorrect) {
    throw new UnauthenticatedError('Invalid credentials');
  }

  const token = user.createJWT();
  console.log('login successful')
  res.status(StatusCodes.OK).json({
    user: { name: user.name, email: user.email, role: user.role },
    token
  });
};

const updateProfile = async (req, res) => {
  const { name, email, currentPassword, newPassword } = req.body;
  const userId = req.user.userId;

  const user = await User.findById(userId).select('+password');
  if (!user) {
    throw new UnauthenticatedError('User not found');
  }

  // Update basic info
  if (name) user.name = name;
  if (email) user.email = email;

  // Update password if provided
  if (currentPassword && newPassword) {
    const isPasswordCorrect = await user.comparePassword(currentPassword);
    if (!isPasswordCorrect) {
      throw new UnauthenticatedError('Current password is incorrect');
    }
    user.password = newPassword;
  }

  await user.save();
  
  const token = user.createJWT();
  res.status(StatusCodes.OK).json({
    user: { name: user.name, email: user.email, role: user.role },
    token
  });
};

const getProfile = async (req, res) => {
  const user = await User.findById(req.user.userId);
  if (!user) {
    throw new UnauthenticatedError('User not found');
  }
  
  res.status(StatusCodes.OK).json({
    user: { name: user.name, email: user.email, role: user.role }
  });
};


const createPlan = async(req, res)=>{
  try {
    const {plan_name, amount} = req.body
    if(!plan_name && !amount){
      return res.status(400).send("please provide the required fields")
    }
    const plan = await Plan.create({
      plan_name: plan_name,
      amount_range: amount
    })

    if(plan){
      return  res.status(201).send(`${plan.plan_name} contribution plan created successfully`)
    }else{
      res.status(402).send("could not create contribution plan")
    }

  } catch (error) {
    res.status(500).send({message:"internal server error" || error})
  }
}

module.exports = {
  register,
  login,
  updateProfile,
  getProfile,
  createPlan
};