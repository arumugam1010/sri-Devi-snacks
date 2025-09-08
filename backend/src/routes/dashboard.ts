import express from 'express';
import { prisma } from '../index';
import { authenticateToken } from '../middleware/auth';
import { ApiResponse } from '../types';

const router = express.Router();

// Get dashboard statistics
router.get('/stats', authenticateToken, async (req: express.Request, res: express.Response) => {
  try {
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));
    
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const startOfYesterday = new Date(yesterday.setHours(0, 0, 0, 0));
    const endOfYesterday = new Date(yesterday.setHours(23, 59, 59, 999));

    // Get all statistics in parallel
    const [
      totalShops,
      activeShops,
      totalProducts,
      activeProducts,
      todaysBills,
      yesterdaysBills,
      todaysRevenue,
      yesterdaysRevenue,
      pendingBills,
      totalRevenue,
      lowStockItems,
      totalStock,
    ] = await Promise.all([
      // Shop stats
      prisma.shop.count(),
      prisma.shop.count({ where: { status: 'ACTIVE' } }),
      
      // Product stats
      prisma.product.count(),
      prisma.product.count(),
      
      // Today's bills
      prisma.bill.count({
        where: {
          billDate: {
            gte: startOfDay,
            lte: endOfDay,
          },
        },
      }),
      
      // Yesterday's bills
      prisma.bill.count({
        where: {
          billDate: {
            gte: startOfYesterday,
            lte: endOfYesterday,
          },
        },
      }),
      
      // Today's revenue
      prisma.bill.aggregate({
        where: {
          billDate: {
            gte: startOfDay,
            lte: endOfDay,
          },
        },
        _sum: {
          totalAmount: true,
        },
      }),
      
      // Yesterday's revenue
      prisma.bill.aggregate({
        where: {
          billDate: {
            gte: startOfYesterday,
            lte: endOfYesterday,
          },
        },
        _sum: {
          totalAmount: true,
        },
      }),
      
      // Pending bills
      prisma.bill.count({
        where: { status: 'PENDING' },
      }),
      
      // Total revenue
      prisma.bill.aggregate({
        _sum: {
          totalAmount: true,
        },
      }),
      
      // Low stock items (threshold: 10)
      prisma.stock.count({
        where: {
          quantity: {
            lte: 10,
          },
        },
      }),
      
      // Total stock value
      prisma.stock.aggregate({
        _sum: {
          quantity: true,
        },
      }),
    ]);

    // Calculate percentage changes
    const billsChange = yesterdaysBills > 0 
      ? ((todaysBills - yesterdaysBills) / yesterdaysBills * 100) 
      : 0;
      
    const revenueChange = (yesterdaysRevenue._sum.totalAmount || 0) > 0 
      ? (((todaysRevenue._sum.totalAmount || 0) - (yesterdaysRevenue._sum.totalAmount || 0)) / (yesterdaysRevenue._sum.totalAmount || 0) * 100)
      : 0;

    const stats = {
      shops: {
        total: totalShops,
        active: activeShops,
        inactive: totalShops - activeShops,
      },
      products: {
        total: totalProducts,
        active: activeProducts,
        inactive: totalProducts - activeProducts,
      },
      bills: {
        today: todaysBills,
        yesterday: yesterdaysBills,
        pending: pendingBills,
        change: parseFloat(billsChange.toFixed(1)),
      },
      revenue: {
        today: todaysRevenue._sum.totalAmount || 0,
        yesterday: yesterdaysRevenue._sum.totalAmount || 0,
        total: totalRevenue._sum.totalAmount || 0,
        change: parseFloat(revenueChange.toFixed(1)),
      },
      stock: {
        lowStockItems,
        totalItems: totalStock._sum.quantity || 0,
      },
    };

    res.json({
      success: true,
      data: stats,
    } as ApiResponse);
  } catch (error: any) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get dashboard statistics',
    } as ApiResponse);
  }
});

// Get recent bills
router.get('/recent-bills', authenticateToken, async (req: express.Request, res: express.Response) => {
  try {
    const { limit = 5 } = req.query;
    const billLimit = Math.min(parseInt(limit as string) || 5, 20);

    const recentBills = await prisma.bill.findMany({
      take: billLimit,
      orderBy: { createdAt: 'desc' },
      include: {
        shop: {
          select: {
            id: true,
            shopName: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            billItems: true,
          },
        },
      },
    });

    res.json({
      success: true,
      data: recentBills,
    } as ApiResponse);
  } catch (error: any) {
    console.error('Get recent bills error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get recent bills',
    } as ApiResponse);
  }
});

// Get top shops by revenue
router.get('/top-shops', authenticateToken, async (req: express.Request, res: express.Response) => {
  try {
    const { limit = 5, period = '30' } = req.query;
    const shopLimit = Math.min(parseInt(limit as string) || 5, 10);
    const periodDays = parseInt(period as string) || 30;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - periodDays);

    const topShops = await prisma.shop.findMany({
      include: {
        bills: {
          where: {
            billDate: {
              gte: startDate,
            },
            status: {
              not: 'CANCELLED',
            },
          },
          select: {
            totalAmount: true,
          },
        },
        _count: {
          select: {
            bills: {
              where: {
                billDate: {
                  gte: startDate,
                },
                status: {
                  not: 'CANCELLED',
                },
              },
            },
          },
        },
      },
    });

    // Calculate revenue and sort by it
    const shopsWithRevenue = topShops
      .map(shop => ({
        id: shop.id,
        shopName: shop.shopName,
        address: shop.address,
        contact: shop.contact,
        billsCount: shop._count.bills,
        totalRevenue: shop.bills.reduce((sum, bill) => sum + bill.totalAmount, 0),
      }))
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, shopLimit);

    res.json({
      success: true,
      data: shopsWithRevenue,
      meta: {
        period: `Last ${periodDays} days`,
        limit: shopLimit,
      },
    } as ApiResponse);
  } catch (error: any) {
    console.error('Get top shops error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get top shops',
    } as ApiResponse);
  }
});

// Get top products by sales
router.get('/top-products', authenticateToken, async (req: express.Request, res: express.Response) => {
  try {
    const { limit = 5, period = '30' } = req.query;
    const productLimit = Math.min(parseInt(limit as string) || 5, 10);
    const periodDays = parseInt(period as string) || 30;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - periodDays);

    const topProducts = await prisma.product.findMany({
      include: {
        billItems: {
          where: {
            bill: {
              billDate: {
                gte: startDate,
              },
              status: {
                not: 'CANCELLED',
              },
            },
          },
          select: {
            quantity: true,
            amount: true,
          },
        },
      },
    });

    // Calculate sales and sort by quantity sold
    const productsWithSales = topProducts
      .map(product => ({
        id: product.id,
        productName: product.productName,
        unit: product.unit,
        hsnCode: product.hsnCode,
        quantitySold: product.billItems.reduce((sum, item) => sum + item.quantity, 0),
        totalRevenue: product.billItems.reduce((sum, item) => sum + item.amount, 0),
        salesCount: product.billItems.length,
      }))
      .sort((a, b) => b.quantitySold - a.quantitySold)
      .slice(0, productLimit);

    res.json({
      success: true,
      data: productsWithSales,
      meta: {
        period: `Last ${periodDays} days`,
        limit: productLimit,
      },
    } as ApiResponse);
  } catch (error: any) {
    console.error('Get top products error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get top products',
    } as ApiResponse);
  }
});

// Get sales trend (daily revenue for last 30 days)
router.get('/sales-trend', authenticateToken, async (req: express.Request, res: express.Response) => {
  try {
    const { days = '30' } = req.query;
    const trendDays = Math.min(parseInt(days as string) || 30, 90);

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - trendDays);
    startDate.setHours(0, 0, 0, 0);

    const salesData = await prisma.bill.groupBy({
      by: ['billDate'],
      where: {
        billDate: {
          gte: startDate,
        },
        status: {
          not: 'CANCELLED',
        },
      },
      _sum: {
        totalAmount: true,
      },
      _count: {
        id: true,
      },
      orderBy: {
        billDate: 'asc',
      },
    });

    // Fill missing dates with zero values
    const trend = [];
    const currentDate = new Date(startDate);
    const endDate = new Date();

    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const dayData = salesData.find(data => 
        data.billDate.toISOString().split('T')[0] === dateStr
      );

      trend.push({
        date: dateStr,
        revenue: dayData?._sum.totalAmount || 0,
        billsCount: dayData?._count.id || 0,
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    res.json({
      success: true,
      data: trend,
      meta: {
        period: `Last ${trendDays} days`,
        totalDays: trend.length,
      },
    } as ApiResponse);
  } catch (error: any) {
    console.error('Get sales trend error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get sales trend',
    } as ApiResponse);
  }
});

// Get low stock alerts
router.get('/low-stock', authenticateToken, async (req: express.Request, res: express.Response) => {
  try {
    const { threshold = '10' } = req.query;
    const stockThreshold = parseInt(threshold as string) || 10;

    const lowStockItems = await prisma.stock.findMany({
      where: {
        quantity: {
          lte: stockThreshold,
        },
      },
      include: {
        product: {
          select: {
            id: true,
            productName: true,
            unit: true,
          },
        },
      },
      orderBy: {
        quantity: 'asc',
      },
    });

    res.json({
      success: true,
      data: lowStockItems,
      meta: {
        threshold: stockThreshold,
        count: lowStockItems.length,
      },
    } as ApiResponse);
  } catch (error: any) {
    console.error('Get low stock alerts error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get low stock alerts',
    } as ApiResponse);
  }
});

export default router;
