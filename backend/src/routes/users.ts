import express from 'express';
import { prisma } from '../index';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import { AuthenticatedRequest, ApiResponse, PaginatedResponse } from '../types';
import { validateRequest, paginationSchema } from '../utils/validation';

const router = express.Router();

// Get current user profile
router.get('/profile', authenticateToken, async (req: AuthenticatedRequest, res: express.Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      } as ApiResponse);
    }

    return res.json({
      success: true,
      data: user,
    } as ApiResponse);
  } catch (error: any) {
    console.error('Get profile error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get user profile',
    } as ApiResponse);
  }
});

router.get('/', authenticateToken, requireAdmin, async (req: express.Request, res: express.Response) => {
  try {
    const { page = 1, limit = 10, search = '', sortBy = 'createdAt', sortOrder = 'desc' } =
      validateRequest(paginationSchema, req.query);

    const skip = (page - 1) * limit;

    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { email: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      prisma.user.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return res.json({
      success: true,
      data: users,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    } as PaginatedResponse<any>);
  } catch (error: any) {
    console.error('Get users error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get users',
    } as ApiResponse);
  }
});

router.get('/:id', authenticateToken, requireAdmin, async (req: express.Request, res: express.Response) => {
  try {
    const userId = parseInt(req.params.id);

    if (isNaN(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID',
      } as ApiResponse);
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      } as ApiResponse);
    }

    return res.json({
      success: true,
      data: user,
    } as ApiResponse);
  } catch (error: any) {
    console.error('Get user error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get user',
    } as ApiResponse);
  }
});

router.patch('/:id/status', authenticateToken, requireAdmin, async (req: express.Request, res: express.Response) => {
  try {
    const userId = parseInt(req.params.id);
    const { isActive } = req.body;

    if (isNaN(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID',
      } as ApiResponse);
    }

    if (typeof isActive !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'isActive must be a boolean',
      } as ApiResponse);
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: { isActive },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        updatedAt: true,
      },
    });

    return res.json({
      success: true,
      message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
      data: user,
    } as ApiResponse);
  } catch (error: any) {
    console.error('Update user status error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update user status',
    } as ApiResponse);
  }
});

export default router;
