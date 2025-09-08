import express from 'express';
import { prisma } from '../index';
import { authenticateToken, requireUser } from '../middleware/auth';
import { AuthenticatedRequest, ApiResponse } from '../types';
import { validateRequest, createScheduleSchema } from '../utils/validation';

const router = express.Router();

// Get weekly schedule
router.get('/', authenticateToken, async (req: express.Request, res: express.Response) => {
  try {
    const schedules = await prisma.schedule.findMany({
      where: { isActive: true },
      include: {
        shop: true,
      },
      orderBy: [
        { dayOfWeek: 'asc' },
        { shop: { shopName: 'asc' } },
      ],
    });

    // Group by day of week
    const weeklySchedule = {
      MONDAY: [],
      TUESDAY: [],
      WEDNESDAY: [],
      THURSDAY: [],
      FRIDAY: [],
      SATURDAY: [],
      SUNDAY: [],
    };

    schedules.forEach(schedule => {
      (weeklySchedule as any)[schedule.dayOfWeek].push({
        id: schedule.id,
        shop: schedule.shop,
        isActive: schedule.isActive,
        createdAt: schedule.createdAt,
        updatedAt: schedule.updatedAt,
      });
    });

    res.json({
      success: true,
      data: weeklySchedule,
    } as ApiResponse);
  } catch (error: any) {
    console.error('Get schedules error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get schedules',
    } as ApiResponse);
  }
});

// Get schedule by day of week
router.get('/day/:dayOfWeek', authenticateToken, async (req: express.Request, res: express.Response) => {
  try {
    const dayOfWeek = req.params.dayOfWeek.toUpperCase();

    const validDays = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
    if (!validDays.includes(dayOfWeek)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid day of week',
      } as ApiResponse);
    }

    const schedules = await prisma.schedule.findMany({
      where: {
        dayOfWeek: dayOfWeek as any,
        isActive: true,
      },
      include: {
        shop: true,
      },
      orderBy: {
        shop: { shopName: 'asc' },
      },
    });

    return res.json({
      success: true,
      data: schedules,
    } as ApiResponse);
  } catch (error: any) {
    console.error('Get day schedules error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get day schedules',
    } as ApiResponse);
  }
});

// Get schedule by shop ID
router.get('/shop/:shopId', authenticateToken, async (req: express.Request, res: express.Response) => {
  try {
    const shopId = parseInt(req.params.shopId);

    if (isNaN(shopId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid shop ID',
      } as ApiResponse);
    }

    const schedules = await prisma.schedule.findMany({
      where: {
        shopId,
        isActive: true,
      },
      include: {
        shop: true,
      },
      orderBy: {
        dayOfWeek: 'asc',
      },
    });

    return res.json({
      success: true,
      data: schedules,
    } as ApiResponse);
  } catch (error: any) {
    console.error('Get shop schedules error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get shop schedules',
    } as ApiResponse);
  }
});

// Create new schedule
router.post('/', authenticateToken, requireUser, async (req: AuthenticatedRequest, res: express.Response) => {
  try {
    const scheduleData = validateRequest(createScheduleSchema, req.body);

    // Check if schedule already exists for this shop and day
    const existingSchedule = await prisma.schedule.findUnique({
      where: {
        shopId_dayOfWeek: {
          shopId: scheduleData.shopId,
          dayOfWeek: scheduleData.dayOfWeek,
        },
      },
    });

    if (existingSchedule) {
      return res.status(409).json({
        success: false,
        message: 'Schedule already exists for this shop and day',
      } as ApiResponse);
    }

    const schedule = await prisma.schedule.create({
      data: scheduleData,
      include: {
        shop: true,
      },
    });

    return res.status(201).json({
      success: true,
      message: 'Schedule created successfully',
      data: schedule,
    } as ApiResponse);
  } catch (error: any) {
    console.error('Create schedule error:', error);
    return res.status(400).json({
      success: false,
      message: error.message || 'Failed to create schedule',
    } as ApiResponse);
  }
});

// Update schedule status
router.patch('/:id/status', authenticateToken, requireUser, async (req: express.Request, res: express.Response) => {
  try {
    const scheduleId = parseInt(req.params.id);
    const { isActive } = req.body;

    if (isNaN(scheduleId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid schedule ID',
      } as ApiResponse);
    }

    if (typeof isActive !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'isActive must be a boolean',
      } as ApiResponse);
    }

    const schedule = await prisma.schedule.update({
      where: { id: scheduleId },
      data: { isActive },
      include: {
        shop: true,
      },
    });

    return res.json({
      success: true,
      message: `Schedule ${isActive ? 'activated' : 'deactivated'} successfully`,
      data: schedule,
    } as ApiResponse);
  } catch (error: any) {
    console.error('Update schedule status error:', error);

    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: 'Schedule not found',
      } as ApiResponse);
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to update schedule status',
    } as ApiResponse);
  }
});

// Delete schedule
router.delete('/:id', authenticateToken, requireUser, async (req: express.Request, res: express.Response) => {
  try {
    const scheduleId = parseInt(req.params.id);

    if (isNaN(scheduleId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid schedule ID',
      } as ApiResponse);
    }

    await prisma.schedule.delete({
      where: { id: scheduleId },
    });

    return res.json({
      success: true,
      message: 'Schedule deleted successfully',
    } as ApiResponse);
  } catch (error: any) {
    console.error('Delete schedule error:', error);

    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: 'Schedule not found',
      } as ApiResponse);
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to delete schedule',
    } as ApiResponse);
  }
});

// Assign shop to multiple days
router.post('/bulk-assign', authenticateToken, requireUser, async (req: AuthenticatedRequest, res: express.Response) => {
  try {
    const { shopId, daysOfWeek } = req.body;

    if (!shopId || !Array.isArray(daysOfWeek) || daysOfWeek.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'shopId and daysOfWeek array are required',
      } as ApiResponse);
    }

    const validDays = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
    const invalidDays = daysOfWeek.filter(day => !validDays.includes(day.toUpperCase()));

    if (invalidDays.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Invalid days: ${invalidDays.join(', ')}`,
      } as ApiResponse);
    }

    // Create schedules in transaction
    const schedules = await prisma.$transaction(async (tx) => {
      const createdSchedules = [];

      for (const day of daysOfWeek) {
        try {
          const schedule = await tx.schedule.create({
            data: {
              shopId: parseInt(shopId),
              dayOfWeek: day.toUpperCase() as any,
            },
            include: {
              shop: true,
            },
          });
          createdSchedules.push(schedule);
        } catch (error: any) {
          // Skip if schedule already exists (unique constraint violation)
          if (error.code !== 'P2002') {
            throw error;
          }
        }
      }

      return createdSchedules;
    });

    return res.status(201).json({
      success: true,
      message: `Assigned shop to ${schedules.length} days`,
      data: schedules,
    } as ApiResponse);
  } catch (error: any) {
    console.error('Bulk assign schedule error:', error);
    return res.status(400).json({
      success: false,
      message: error.message || 'Failed to assign shop to days',
    } as ApiResponse);
  }
});

// Remove shop from multiple days
router.post('/bulk-remove', authenticateToken, requireUser, async (req: AuthenticatedRequest, res: express.Response) => {
  try {
    const { shopId, daysOfWeek } = req.body;

    if (!shopId || !Array.isArray(daysOfWeek) || daysOfWeek.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'shopId and daysOfWeek array are required',
      } as ApiResponse);
    }

    const result = await prisma.schedule.deleteMany({
      where: {
        shopId: parseInt(shopId),
        dayOfWeek: {
          in: daysOfWeek.map(day => day.toUpperCase()) as any[],
        },
      },
    });

    return res.json({
      success: true,
      message: `Removed shop from ${result.count} days`,
      data: { removedCount: result.count },
    } as ApiResponse);
  } catch (error: any) {
    console.error('Bulk remove schedule error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to remove shop from days',
    } as ApiResponse);
  }
  
});
export default router;
