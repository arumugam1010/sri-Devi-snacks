import express from 'express';
import { prisma } from '../index';
import { authenticateToken, requireUser } from '../middleware/auth';
import { AuthenticatedRequest, ApiResponse, PaginatedResponse } from '../types';
import { validateRequest, createBillSchema, updateBillSchema, paginationSchema } from '../utils/validation';

const router = express.Router();

// Generate bill number
const generateBillNumber = async (): Promise<string> => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');

  const prefix = `BILL${year}${month}${day}`;

  // Get the count of bills created today
  const startOfDay = new Date(today.setHours(0, 0, 0, 0));
  const endOfDay = new Date(today.setHours(23, 59, 59, 999));

  const billCount = await prisma.bill.count({
    where: {
      createdAt: {
        gte: startOfDay,
        lte: endOfDay,
      },
    },
  });

  const sequence = String(billCount + 1).padStart(4, '0');
  return `${prefix}${sequence}`;
};

// Get all bills
router.get('/', authenticateToken, async (req: AuthenticatedRequest, res: express.Response) => {
  try {
    const { page = 1, limit = 10, search = '', sortBy = 'createdAt', sortOrder = 'desc' } =
      validateRequest(paginationSchema, req.query);

    const skip = (page - 1) * limit;

    const where = search
      ? {
          OR: [
            { billNumber: { contains: search, mode: 'insensitive' as const } },
            { shop: { shopName: { contains: search, mode: 'insensitive' as const } } },
            { notes: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [bills, total] = await Promise.all([
      prisma.bill.findMany({
        where,
        include: {
          shop: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          billItems: {
            include: {
              product: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: sortBy === 'shopName'
          ? { shop: { shopName: sortOrder } }
          : { [sortBy]: sortOrder },
      }),
      prisma.bill.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: bills,
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
    console.error('Get bills error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get bills',
    } as ApiResponse);
  }
});

// Get bill by ID
router.get('/:id', authenticateToken, async (req: express.Request, res: express.Response) => {
  try {
    const billId = parseInt(req.params.id);

    if (isNaN(billId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid bill ID',
      } as ApiResponse);
    }

    const bill = await prisma.bill.findUnique({
      where: { id: billId },
      include: {
        shop: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        billItems: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!bill) {
      return res.status(404).json({
        success: false,
        message: 'Bill not found',
      } as ApiResponse);
    }

    return res.json({
      success: true,
      data: bill,
    } as ApiResponse);
  } catch (error: any) {
    console.error('Get bill error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get bill',
    } as ApiResponse);
  }
});

// Create new bill
router.post('/', authenticateToken, requireUser, async (req: AuthenticatedRequest, res: express.Response) => {
  try {
    const billData = validateRequest(createBillSchema, req.body);
    const userId = req.user!.id;

    // Generate unique bill number
    const billNumber = await generateBillNumber();

  // Calculate totals
  let totalAmount = 0;
  const billItems = (billData.items || []).map(item => {
    const amount = Math.round((item.quantity * item.rate) * 100) / 100;
    const sgst = item.sgst || 0;
    const cgst = item.cgst || 0;
    totalAmount += amount + sgst + cgst;
    return {
      productId: item.productId,
      quantity: item.quantity,
      rate: item.rate,
      amount,
      sgst,
      cgst,
    };
  });

  const receivedAmount = Math.round((billData.receivedAmount || 0) * 100) / 100;
  const pendingAmount = Math.round((totalAmount - receivedAmount) * 100) / 100;
  const isPaymentBill = (billData.items || []).length === 0 && receivedAmount > 0;
  const shouldApplyToPending = isPaymentBill && billData.applyToPending === true;

  // Create bill with items in a transaction
  const bill = await prisma.$transaction(async (tx) => {
    // Create the bill
    const newBill = await tx.bill.create({
      data: {
        billNumber,
        shopId: billData.shopId,
        userId,
        billDate: billData.billDate ? new Date(billData.billDate) : new Date(),
        totalAmount,
        receivedAmount,
        pendingAmount,
        status: pendingAmount <= 0 ? 'COMPLETED' : 'PENDING',
        notes: billData.notes,
      },
    });

    console.log(`Bill created with ID: ${newBill.id} and Bill Number: ${billNumber}`);

    if (shouldApplyToPending) {
      console.log(`Applying payment of ₹${receivedAmount} to pending bills for shop ${billData.shopId}`);

      const pendingBills = await tx.bill.findMany({
        where: {
          shopId: billData.shopId,
          status: 'PENDING',
        },
        orderBy: {
          billDate: 'asc',
        },
      });

      let remainingPayment = receivedAmount;

      for (const pendingBill of pendingBills) {
        if (remainingPayment <= 0) break;

        const paymentAmount = Math.min(remainingPayment, pendingBill.pendingAmount);
        const newReceivedAmount = Math.round((pendingBill.receivedAmount + paymentAmount) * 100) / 100;
        const newPendingAmount = Math.round((pendingBill.pendingAmount - paymentAmount) * 100) / 100;
        const newStatus = newPendingAmount <= 0 ? 'COMPLETED' : 'PENDING';

        await tx.bill.update({
          where: { id: pendingBill.id },
          data: {
            receivedAmount: newReceivedAmount,
            pendingAmount: newPendingAmount,
            status: newStatus as any,
          },
        });

        console.log(`Applied ₹${paymentAmount} to bill ${pendingBill.id}, new status: ${newStatus}`);
        remainingPayment = Math.round((remainingPayment - paymentAmount) * 100) / 100;
      }

      console.log(`Payment application completed. Remaining payment: ₹${remainingPayment}`);
    } else if (isPaymentBill && !shouldApplyToPending) {
      console.log(`Payment bill created but payment not applied to pending bills (applyToPending=false)`);
    } else {
      await tx.billItem.createMany({
        data: billItems.map(item => ({
          billId: newBill.id,
          ...item,
        })),
      });

      for (const item of (billData.items || [])) {
        if (item.quantity > 0) {
          // Only reduce stock for positive quantity items (sales)
          const stock = await tx.stock.findUnique({
            where: { productId: item.productId },
          });

          if (stock) {
            await tx.stock.update({
              where: { productId: item.productId },
              data: {
                quantity: Math.max(0, stock.quantity - item.quantity),
              },
            });
          }
        }
        // Note: Negative quantity items (returns) are treated as wastage and do not affect stock
      }
    }

    return newBill;
  });

    // Fetch the complete bill with relations
    const completeBill = await prisma.bill.findUnique({
      where: { id: bill.id },
      include: {
        shop: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        billItems: {
          include: {
            product: true,
          },
        },
      },
    });

    res.status(201).json({
      success: true,
      message: 'Bill created successfully',
      data: completeBill,
    } as ApiResponse);
  } catch (error: any) {
    console.error('Create bill error:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to create bill',
    } as ApiResponse);
  }
});

// Update bill
router.put('/:id', authenticateToken, requireUser, async (req: express.Request, res: express.Response) => {
  try {
    const billId = parseInt(req.params.id);

    if (isNaN(billId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid bill ID',
      } as ApiResponse);
    }

    const billData = validateRequest(updateBillSchema, req.body);

    // Get current bill
    const currentBill = await prisma.bill.findUnique({
      where: { id: billId },
    });

    if (!currentBill) {
      return res.status(404).json({
        success: false,
        message: 'Bill not found',
      } as ApiResponse);
    }

    // Calculate new pending amount if receivedAmount is updated
    let updateData: any = { ...billData };

    if (billData.receivedAmount !== undefined) {
      const roundedReceivedAmount = Math.round(billData.receivedAmount * 100) / 100;
      const pendingAmount = Math.round((currentBill.totalAmount - roundedReceivedAmount) * 100) / 100;
      updateData.receivedAmount = roundedReceivedAmount;
      updateData.pendingAmount = pendingAmount;

      // Update status based on pending amount
      if (pendingAmount <= 0 && currentBill.status !== 'CANCELLED') {
        updateData.status = 'COMPLETED';
      } else if (pendingAmount > 0 && currentBill.status !== 'CANCELLED') {
        updateData.status = 'PENDING';
      }
    }

    const bill = await prisma.bill.update({
      where: { id: billId },
      data: updateData,
      include: {
        shop: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        billItems: {
          include: {
            product: true,
          },
        },
      },
    });

    return res.json({
      success: true,
      message: 'Bill updated successfully',
      data: bill,
    } as ApiResponse);
  } catch (error: any) {
    console.error('Update bill error:', error);

    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: 'Bill not found',
      } as ApiResponse);
    }

    return res.status(400).json({
      success: false,
      message: error.message || 'Failed to update bill',
    } as ApiResponse);
  }
});

// Delete bill
router.delete('/:id', authenticateToken, requireUser, async (req: express.Request, res: express.Response) => {
  try {
    const billId = parseInt(req.params.id);

    if (isNaN(billId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid bill ID',
      } as ApiResponse);
    }

    // Get bill with items to restore stock
    const bill = await prisma.bill.findUnique({
      where: { id: billId },
      include: {
        billItems: true,
      },
    });

    if (!bill) {
      return res.status(404).json({
        success: false,
        message: 'Bill not found',
      } as ApiResponse);
    }

    // Delete bill and restore stock in a transaction
    await prisma.$transaction(async (tx) => {
      // Restore stock quantities
      for (const item of bill.billItems) {
        const stock = await tx.stock.findUnique({
          where: { productId: item.productId },
        });

        if (stock) {
          await tx.stock.update({
            where: { productId: item.productId },
            data: {
              quantity: stock.quantity + item.quantity,
            },
          });
        }
      }

      // Delete the bill (bill items will be deleted due to cascade)
      await tx.bill.delete({
        where: { id: billId },
      });
    });

    return res.json({
      success: true,
      message: 'Bill deleted successfully',
    } as ApiResponse);
  } catch (error: any) {
    console.error('Delete bill error:', error);

    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: 'Bill not found',
      } as ApiResponse);
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to delete bill',
    } as ApiResponse);
  }
});

// Get bills by shop ID
router.get('/shop/:shopId', authenticateToken, async (req: express.Request, res: express.Response) => {
  try {
    const shopId = parseInt(req.params.shopId);

    if (isNaN(shopId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid shop ID',
      } as ApiResponse);
    }

    const { page = 1, limit = 10 } = validateRequest(paginationSchema, req.query);
    const skip = (page - 1) * limit;

    const [bills, total] = await Promise.all([
      prisma.bill.findMany({
        where: { shopId },
        include: {
          shop: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          billItems: {
            include: {
              product: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.bill.count({ where: { shopId } }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return res.json({
      success: true,
      data: bills,
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
    console.error('Get shop bills error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get shop bills',
    } as ApiResponse);
  }
});

// Get pending bills
router.get('/status/pending', authenticateToken, async (req: express.Request, res: express.Response) => {
  try {
    const bills = await prisma.bill.findMany({
      where: { status: 'PENDING' },
      include: {
        shop: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        billItems: {
          include: {
            product: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({
      success: true,
      data: bills,
    } as ApiResponse);
  } catch (error: any) {
    console.error('Get pending bills error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get pending bills',
    } as ApiResponse);
  }
});

export default router;
