import express from 'express';
import { prisma } from '../index';
import { authenticateToken, requireUser } from '../middleware/auth';
import { AuthenticatedRequest, ApiResponse, PaginatedResponse } from '../types';
import { validateRequest, createProductSchema, updateProductSchema, paginationSchema, createShopProductSchema, updateShopProductSchema } from '../utils/validation';

const router = express.Router();

// Get all products
router.get('/', authenticateToken, async (req: express.Request, res: express.Response) => {
  try {
    const { page = 1, limit = 10, search = '', sortBy = 'createdAt', sortOrder = 'desc' } =
      validateRequest(paginationSchema, req.query);

    const skip = (page - 1) * limit;

    const where = search
      ? {
          OR: [
            { productName: { contains: search, mode: 'insensitive' as const } },
            { unit: { contains: search, mode: 'insensitive' as const } },
            { hsnCode: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: {
          stocks: true,
          shopProducts: {
            include: {
              shop: true,
            },
          },
          _count: {
            select: {
              billItems: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      prisma.product.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: products,
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
    console.error('Get products error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get products',
    } as ApiResponse);
  }
});

// Get product by ID
router.get('/:id', authenticateToken, async (req: express.Request, res: express.Response) => {
  try {
    const productId = parseInt(req.params.id);

    if (isNaN(productId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID',
      } as ApiResponse);
    }

    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        stocks: true,
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
        _count: {
          select: {
            billItems: true,
          },
        },
      },
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      } as ApiResponse);
    }

    return res.json({
      success: true,
      data: product,
    } as ApiResponse);
  } catch (error: any) {
    console.error('Get product error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get product',
    } as ApiResponse);
  }
});

// Create new product
router.post('/', authenticateToken, requireUser, async (req: AuthenticatedRequest, res: express.Response) => {
  try {
    const productData = validateRequest(createProductSchema, req.body);

    const product = await prisma.product.create({
      data: productData,
      include: {
        stocks: true,
        shopProducts: true,
      },
    });

    console.log(`Product created with ID: ${product.id} and name: ${product.productName}`);

    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: product,
    } as ApiResponse);
  } catch (error: any) {
    console.error('Create product error:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to create product',
    } as ApiResponse);
  }
});

// Update product
router.put('/:id', authenticateToken, requireUser, async (req: express.Request, res: express.Response) => {
  try {
    const productId = parseInt(req.params.id);

    if (isNaN(productId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID',
      } as ApiResponse);
    }

    const productData = validateRequest(updateProductSchema, req.body);

    const product = await prisma.product.update({
      where: { id: productId },
      data: productData,
      include: {
        stocks: true,
        shopProducts: true,
      },
    });

    return res.json({
      success: true,
      message: 'Product updated successfully',
      data: product,
    } as ApiResponse);
  } catch (error: any) {
    console.error('Update product error:', error);

    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      } as ApiResponse);
    }

    return res.status(400).json({
      success: false,
      message: error.message || 'Failed to update product',
    } as ApiResponse);
  }
});

// Delete product
router.delete('/:id', authenticateToken, requireUser, async (req: express.Request, res: express.Response) => {
  try {
    const productId = parseInt(req.params.id);

    if (isNaN(productId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID',
      } as ApiResponse);
    }

    // Check if product has bill items
    const billItemCount = await prisma.billItem.count({
      where: { productId },
    });

    if (billItemCount > 0) {
      return res.status(409).json({
        success: false,
        message: 'Cannot delete product with existing bill items. Deactivate instead.',
      } as ApiResponse);
    }

    await prisma.product.delete({
      where: { id: productId },
    });

    return res.json({
      success: true,
      message: 'Product deleted successfully',
    } as ApiResponse);
  } catch (error: any) {
    console.error('Delete product error:', error);

    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      } as ApiResponse);
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to delete product',
    } as ApiResponse);
  }
});

// Create shop product pricing
router.post('/shop-pricing', authenticateToken, requireUser, async (req: AuthenticatedRequest, res: express.Response) => {
  try {
    const shopProductData = validateRequest(createShopProductSchema, req.body);

    const shopProduct = await prisma.shopProduct.create({
      data: shopProductData,
      include: {
        shop: true,
        product: true,
      },
    });

    console.log(`Shop product pricing created with ID: ${shopProduct.id} for shop: ${shopProduct.shop.shopName} and product: ${shopProduct.product.productName}`);

    return res.status(201).json({
      success: true,
      message: 'Shop product pricing created successfully',
      data: shopProduct,
    } as ApiResponse);
  } catch (error: any) {
    console.error('Create shop product error:', error);

    if (error.code === 'P2002') {
      return res.status(409).json({
        success: false,
        message: 'Product pricing already exists for this shop',
      } as ApiResponse);
    }

    return res.status(400).json({
      success: false,
      message: error.message || 'Failed to create shop product pricing',
    } as ApiResponse);
  }
});

// Update shop product pricing
router.put('/shop-pricing/:id', authenticateToken, requireUser, async (req: express.Request, res: express.Response) => {
  try {
    const shopProductId = parseInt(req.params.id);

    if (isNaN(shopProductId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid shop product ID',
      } as ApiResponse);
    }

    const shopProductData = validateRequest(updateShopProductSchema, req.body);

    const shopProduct = await prisma.shopProduct.update({
      where: { id: shopProductId },
      data: shopProductData,
      include: {
        shop: true,
        product: true,
      },
    });

    return res.json({
      success: true,
      message: 'Shop product pricing updated successfully',
      data: shopProduct,
    } as ApiResponse);
  } catch (error: any) {
    console.error('Update shop product error:', error);

    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: 'Shop product pricing not found',
      } as ApiResponse);
    }

    return res.status(400).json({
      success: false,
      message: error.message || 'Failed to update shop product pricing',
    } as ApiResponse);
  }
});

// Delete shop product pricing
router.delete('/shop-pricing/:id', authenticateToken, requireUser, async (req: express.Request, res: express.Response) => {
  try {
    const shopProductId = parseInt(req.params.id);

    if (isNaN(shopProductId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid shop product ID',
      } as ApiResponse);
    }

    await prisma.shopProduct.delete({
      where: { id: shopProductId },
    });

    return res.json({
      success: true,
      message: 'Shop product pricing deleted successfully',
    } as ApiResponse);
  } catch (error: any) {
    console.error('Delete shop product error:', error);

    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: 'Shop product pricing not found',
      } as ApiResponse);
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to delete shop product pricing',
    } as ApiResponse);
  }
});

export default router;
