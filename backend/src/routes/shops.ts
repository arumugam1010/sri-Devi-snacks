import express from 'express';
import { prisma } from '../index';
import { authenticateToken, requireUser } from '../middleware/auth';
import { AuthenticatedRequest, ApiResponse, PaginatedResponse } from '../types';
import { validateRequest, createShopSchema, updateShopSchema, paginationSchema } from '../utils/validation';

const router = express.Router();

// Get all shops
router.get('/', authenticateToken, async (req: express.Request, res: express.Response) => {
  try {
    const { page = 1, limit = 10, search = '', sortBy = 'createdAt', sortOrder = 'desc' } =
      validateRequest(paginationSchema, req.query);

    const skip = (page - 1) * limit;

    const where = search
      ? {
          OR: [
            { shopName: { contains: search, mode: 'insensitive' as const } },
            { address: { contains: search, mode: 'insensitive' as const } },
            { contact: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [shops, total] = await Promise.all([
      prisma.shop.findMany({
        where,
        include: {
          shopProducts: {
            include: {
              product: true,
            },
          },
          schedules: true,
          _count: {
            select: {
              bills: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      prisma.shop.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: shops,
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
    console.error('Get shops error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get shops',
    } as ApiResponse);
  }
});

// Get shop by ID
router.get('/:id', authenticateToken, async (req: express.Request, res: express.Response) => {
  try {
    const shopId = parseInt(req.params.id);

    if (isNaN(shopId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid shop ID',
      } as ApiResponse);
    }

    const shop = await prisma.shop.findUnique({
      where: { id: shopId },
      include: {
        shopProducts: {
          include: {
            product: true,
          },
        },
        schedules: true,
        bills: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: {
            billItems: {
              include: {
                product: true,
              },
            },
          },
        },
        _count: {
          select: {
            bills: true,
          },
        },
      },
    });

    if (!shop) {
      return res.status(404).json({
        success: false,
        message: 'Shop not found',
      } as ApiResponse);
    }

    return res.json({
      success: true,
      data: shop,
    } as ApiResponse);
  } catch (error: any) {
    console.error('Get shop error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get shop',
    } as ApiResponse);
  }
});

// Create new shop
router.post('/', authenticateToken, requireUser, async (req: AuthenticatedRequest, res: express.Response) => {
  try {
    const shopData = validateRequest(createShopSchema, req.body);

    const shop = await prisma.shop.create({
      data: {
        ...shopData,
        status: shopData.status || 'ACTIVE',
      },
      include: {
        shopProducts: true,
        schedules: true,
      },
    });

    console.log(`Shop created with ID: ${shop.id} and name: ${shop.shopName}`);

    res.status(201).json({
      success: true,
      message: 'Shop created successfully',
      data: shop,
    } as ApiResponse);
  } catch (error: any) {
    console.error('Create shop error:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to create shop',
    } as ApiResponse);
  }
});

// Update shop
router.put('/:id', authenticateToken, requireUser, async (req: express.Request, res: express.Response) => {
  try {
    const shopId = parseInt(req.params.id);

    if (isNaN(shopId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid shop ID',
      } as ApiResponse);
    }

    const shopData = validateRequest(updateShopSchema, req.body);

    const shop = await prisma.shop.update({
      where: { id: shopId },
      data: shopData,
      include: {
        shopProducts: true,
        schedules: true,
      },
    });

    return res.json({
      success: true,
      message: 'Shop updated successfully',
      data: shop,
    } as ApiResponse);
  } catch (error: any) {
    console.error('Update shop error:', error);

    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: 'Shop not found',
      } as ApiResponse);
    }

    return res.status(400).json({
      success: false,
      message: error.message || 'Failed to update shop',
    } as ApiResponse);
  }
});

// Delete shop
router.delete('/:id', authenticateToken, requireUser, async (req: express.Request, res: express.Response) => {
  try {
    const shopId = parseInt(req.params.id);

    if (isNaN(shopId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid shop ID',
      } as ApiResponse);
    }

    // Check if shop has bills
    const billCount = await prisma.bill.count({
      where: { shopId },
    });

    if (billCount > 0) {
      return res.status(409).json({
        success: false,
        message: 'Cannot delete shop with existing bills. Deactivate instead.',
      } as ApiResponse);
    }

    await prisma.shop.delete({
      where: { id: shopId },
    });

    return res.json({
      success: true,
      message: 'Shop deleted successfully',
    } as ApiResponse);
  } catch (error: any) {
    console.error('Delete shop error:', error);

    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: 'Shop not found',
      } as ApiResponse);
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to delete shop',
    } as ApiResponse);
  }
});

// Get shop products with pricing
router.get('/:id/products', authenticateToken, async (req: express.Request, res: express.Response) => {
  try {
    const shopId = parseInt(req.params.id);

    if (isNaN(shopId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid shop ID',
      } as ApiResponse);
    }

    const shopProducts = await prisma.shopProduct.findMany({
      where: { shopId },
      include: {
        shop: true,
        product: {
          include: {
            stocks: true,
          },
        },
      },
    });

    return res.json({
      success: true,
      data: shopProducts,
    } as ApiResponse);
  } catch (error: any) {
    console.error('Get shop products error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get shop products',
    } as ApiResponse);
  }
});

export default router;
