import express from 'express';
import { prisma } from '../index';
import { authenticateToken, requireUser } from '../middleware/auth';
import { AuthenticatedRequest, ApiResponse, PaginatedResponse } from '../types';
import { validateRequest, createStockSchema, updateStockSchema, paginationSchema } from '../utils/validation';

const router = express.Router();

// Get all stocks
router.get('/', authenticateToken, async (req: express.Request, res: express.Response) => {
  try {
    const { page = 1, limit = 10, search = '', sortBy = 'updatedAt', sortOrder = 'desc' } =
      validateRequest(paginationSchema, req.query);

    const skip = (page - 1) * limit;

    const where = search
      ? {
          product: {
            OR: [
              { productName: { contains: search, mode: 'insensitive' as const } },
              { unit: { contains: search, mode: 'insensitive' as const } },
              { hsnCode: { contains: search, mode: 'insensitive' as const } },
            ],
          },
        }
      : {};

    const [stocks, total] = await Promise.all([
      prisma.stock.findMany({
        where,
        include: {
          product: true,
        },
        skip,
        take: limit,
        orderBy: sortBy === 'productName'
          ? { product: { productName: sortOrder } }
          : { [sortBy]: sortOrder },
      }),
      prisma.stock.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: stocks,
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
    console.error('Get stocks error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get stocks',
    } as ApiResponse);
  }
});

// Get stock by ID
router.get('/:id', authenticateToken, async (req: express.Request, res: express.Response) => {
  try {
    const stockId = parseInt(req.params.id);

    if (isNaN(stockId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid stock ID',
      } as ApiResponse);
    }

    const stock = await prisma.stock.findUnique({
      where: { id: stockId },
      include: {
        product: {
          include: {
            shopProducts: {
              include: {
                shop: true,
              },
            },
            billItems: {
              take: 10,
              orderBy: { createdAt: 'desc' },
              include: {
                bill: {
                  include: {
                    shop: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!stock) {
      return res.status(404).json({
        success: false,
        message: 'Stock not found',
      } as ApiResponse);
    }

    return res.json({
      success: true,
      data: stock,
    } as ApiResponse);
  } catch (error: any) {
    console.error('Get stock error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get stock',
    } as ApiResponse);
  }
});

// Get stock by product ID
router.get('/product/:productId', authenticateToken, async (req: express.Request, res: express.Response) => {
  try {
    const productId = parseInt(req.params.productId);

    if (isNaN(productId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID',
      } as ApiResponse);
    }

    const stock = await prisma.stock.findUnique({
      where: { productId },
      include: {
        product: true,
      },
    });

    if (!stock) {
      return res.status(404).json({
        success: false,
        message: 'Stock not found for this product',
      } as ApiResponse);
    }

    return res.json({
      success: true,
      data: stock,
    } as ApiResponse);
  } catch (error: any) {
    console.error('Get stock by product error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get stock',
    } as ApiResponse);
  }
});

// Create new stock entry
router.post('/', authenticateToken, requireUser, async (req: AuthenticatedRequest, res: express.Response) => {
  try {
    const stockData = validateRequest(createStockSchema, req.body);

    // Check if stock already exists for this product
    const existingStock = await prisma.stock.findUnique({
      where: { productId: stockData.productId },
    });

    if (existingStock) {
      return res.status(409).json({
        success: false,
        message: 'Stock already exists for this product. Use update instead.',
      } as ApiResponse);
    }

    const stock = await prisma.stock.create({
      data: stockData,
      include: {
        product: true,
      },
    });

    console.log(`Stock created with ID: ${stock.id} for product: ${stock.product.productName} with quantity: ${stock.quantity}`);

    return res.status(201).json({
      success: true,
      message: 'Stock created successfully',
      data: stock,
    } as ApiResponse);
  } catch (error: any) {
    console.error('Create stock error:', error);
    return res.status(400).json({
      success: false,
      message: error.message || 'Failed to create stock',
    } as ApiResponse);
  }
});

// Update stock
router.put('/:id', authenticateToken, requireUser, async (req: express.Request, res: express.Response) => {
  try {
    const stockId = parseInt(req.params.id);

    if (isNaN(stockId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid stock ID',
      } as ApiResponse);
    }

    const stockData = validateRequest(updateStockSchema, req.body);

    const stock = await prisma.stock.update({
      where: { id: stockId },
      data: stockData,
      include: {
        product: true,
      },
    });

    return res.json({
      success: true,
      message: 'Stock updated successfully',
      data: stock,
    } as ApiResponse);
  } catch (error: any) {
    console.error('Update stock error:', error);

    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: 'Stock not found',
      } as ApiResponse);
    }

    return res.status(400).json({
      success: false,
      message: error.message || 'Failed to update stock',
    } as ApiResponse);
  }
});

// Adjust stock quantity (for stock movements)
router.patch('/:id/adjust', authenticateToken, requireUser, async (req: express.Request, res: express.Response) => {
  try {
    const stockId = parseInt(req.params.id);
    const { adjustment, reason } = req.body;

    if (isNaN(stockId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid stock ID',
      } as ApiResponse);
    }

    if (typeof adjustment !== 'number') {
      return res.status(400).json({
        success: false,
        message: 'Adjustment must be a number',
      } as ApiResponse);
    }

    // Get current stock
    const currentStock = await prisma.stock.findUnique({
      where: { id: stockId },
      include: { product: true },
    });

    if (!currentStock) {
      return res.status(404).json({
        success: false,
        message: 'Stock not found',
      } as ApiResponse);
    }

    const newQuantity = Math.max(0, currentStock.quantity + adjustment);

    const stock = await prisma.stock.update({
      where: { id: stockId },
      data: { quantity: newQuantity },
      include: {
        product: true,
      },
    });

    return res.json({
      success: true,
      message: `Stock ${adjustment > 0 ? 'increased' : 'decreased'} successfully`,
      data: {
        ...stock,
        adjustment,
        reason: reason || 'Manual adjustment',
        previousQuantity: currentStock.quantity,
      },
    } as ApiResponse);
  } catch (error: any) {
    console.error('Adjust stock error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to adjust stock',
    } as ApiResponse);
  }
});

// Delete stock
router.delete('/:id', authenticateToken, requireUser, async (req: express.Request, res: express.Response) => {
  try {
    const stockId = parseInt(req.params.id);

    if (isNaN(stockId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid stock ID',
      } as ApiResponse);
    }

    await prisma.stock.delete({
      where: { id: stockId },
    });

    return res.json({
      success: true,
      message: 'Stock deleted successfully',
    } as ApiResponse);
  } catch (error: any) {
    console.error('Delete stock error:', error);

    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: 'Stock not found',
      } as ApiResponse);
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to delete stock',
    } as ApiResponse);
  }
});

// Get low stock items
router.get('/alerts/low-stock', authenticateToken, async (req: express.Request, res: express.Response) => {
  try {
    const { threshold = 10 } = req.query;
    const lowStockThreshold = parseInt(threshold as string) || 10;

    const lowStockItems = await prisma.stock.findMany({
      where: {
        quantity: {
          lte: lowStockThreshold,
        },
      },
      include: {
        product: true,
      },
      orderBy: {
        quantity: 'asc',
      },
    });

    res.json({
      success: true,
      data: lowStockItems,
      meta: {
        threshold: lowStockThreshold,
        count: lowStockItems.length,
      },
    } as ApiResponse);
  } catch (error: any) {
    console.error('Get low stock error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get low stock items',
    } as ApiResponse);
  }
});

export default router;
