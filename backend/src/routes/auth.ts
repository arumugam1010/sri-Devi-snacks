import express from 'express';
import { prisma } from '../index';
import { generateToken, hashPassword, comparePassword } from '../utils/auth';
import { validateRequest, loginSchema, registerSchema } from '../utils/validation';
import { ApiResponse } from '../types';

const router = express.Router();

// Login
router.post('/login', async (req: express.Request, res: express.Response) => {
  try {
    const { username, password } = validateRequest(loginSchema, req.body);

    // Find user by username
    const user = await prisma.user.findUnique({
      where: { username },
    });

    if (!user || !user.isActive) {
      res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      } as ApiResponse);
      return;
    }

    // Verify password
    if (password !== user.password) {
      res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      } as ApiResponse);
      return;
    }

    // Generate token
    const token = generateToken({
      id: user.id,
      username: user.username,
      email: user.email,
      name: user.name,
      role: user.role,
    });

    // Return user data without password
    const userData = {
      id: user.id,
      name: user.name,
      username: user.username,
      email: user.email,
      role: user.role,
    };

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: userData,
        token,
      },
    } as ApiResponse);
  } catch (error: any) {
    console.error('Login error:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Login failed',
    } as ApiResponse);
  }
});

// Register
router.post('/register', async (req: express.Request, res: express.Response) => {
  try {
    const { name, username, email, password, role = 'USER' } = validateRequest(registerSchema, req.body);

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      res.status(409).json({
        success: false,
        message: 'User already exists with this email',
      } as ApiResponse);
      return;
    }

    // Check if username already exists
    const existingUsername = await prisma.user.findUnique({
      where: { username },
    });

    if (existingUsername) {
      res.status(409).json({
        success: false,
        message: 'Username already exists',
      } as ApiResponse);
      return;
    }

    // Hash password
    // const hashedPassword = await hashPassword(password);

    // Create user
    const user = await prisma.user.create({
      data: {
        name,
        username,
        email,
        password: password,
        role: role as any,
      },
    });

    console.log(`User created with ID: ${user.id} and username: ${user.username}`);

    // Generate token
    const token = generateToken({
      id: user.id,
      username: user.username,
      email: user.email,
      name: user.name,
      role: user.role,
    });

    // Return user data without password
    const userData = {
      id: user.id,
      name: user.name,
      username: user.username,
      email: user.email,
      role: user.role,
    };

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      data: {
        user: userData,
        token,
      },
    } as ApiResponse);
  } catch (error: any) {
    console.error('Registration error:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Registration failed',
    } as ApiResponse);
  }
});

// Verify token
router.get('/verify', async (req: express.Request, res: express.Response) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      res.status(401).json({
        success: false,
        message: 'No token provided',
      } as ApiResponse);
      return;
    }

    const decoded = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    
    // Verify user still exists and is active
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
    });

    if (!user || !user.isActive) {
      res.status(401).json({
        success: false,
        message: 'Invalid token',
      } as ApiResponse);
      return;
    }

    const userData = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    };

    res.json({
      success: true,
      message: 'Token is valid',
      data: { user: userData },
    } as ApiResponse);
  } catch (error: any) {
    console.error('Token verification error:', error);
    res.status(401).json({
      success: false,
      message: 'Invalid token',
    } as ApiResponse);
  }
});

export default router;
