 import { z } from 'zod';

// Auth validation schemas
export const loginSchema = z.object({
  username: z.string().min(2, 'Username must be at least 2 characters'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  username: z.string().min(2, 'Username must be at least 2 characters'),
  email: z.string().email('Please provide a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['USER', 'ADMIN']).optional(),
});

// Shop validation schemas
export const createShopSchema = z.object({
  shopName: z.string().min(2, 'Shop name must be at least 2 characters'),
  address: z.string().min(10, 'Address must be at least 10 characters'),
  contact: z.string().min(10, 'Contact must be at least 10 characters'),
  email: z.string().email().optional().or(z.literal('')),
  gstNumber: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});

export const updateShopSchema = createShopSchema.partial();

// Product validation schemas
export const createProductSchema = z.object({
  productName: z.string().min(2, 'Product name must be at least 2 characters'),
  unit: z.string().min(1, 'Unit is required'),
  hsnCode: z.string().min(6, 'HSN code must be at least 6 characters'),
  gst: z.number().min(0).max(100, 'GST must be between 0 and 100'),
  price: z.number().min(0, 'Price cannot be negative').optional(),
});

export const updateProductSchema = createProductSchema.partial();

// Stock validation schemas
export const createStockSchema = z.object({
  productId: z.number().positive('Product ID must be positive'),
  quantity: z.number().min(0, 'Quantity cannot be negative'),
  rate: z.number().min(0, 'Rate cannot be negative'),
});

export const updateStockSchema = z.object({
  quantity: z.number().min(0, 'Quantity cannot be negative').optional(),
  rate: z.number().min(0, 'Rate cannot be negative').optional(),
});

// Shop Product validation schemas
export const createShopProductSchema = z.object({
  shopId: z.number().positive('Shop ID must be positive'),
  productId: z.number().positive('Product ID must be positive'),
  price: z.number().min(0, 'Price cannot be negative'),
});

export const updateShopProductSchema = z.object({
  price: z.number().min(0, 'Price cannot be negative'),
});

// Bill validation schemas
export const createBillSchema = z.object({
  shopId: z.number().positive('Shop ID must be positive'),
  billDate: z.string().datetime().optional(),
  receivedAmount: z.number().min(0, 'Received amount cannot be negative').optional(),
  notes: z.string().optional(),
  applyToPending: z.boolean().optional(),
  items: z.array(z.object({
    productId: z.number().positive('Product ID must be positive'),
    quantity: z.number().min(-999999, 'Quantity cannot be too negative').max(999999, 'Quantity cannot be too large'),
    rate: z.number().min(0, 'Rate cannot be negative'),
    sgst: z.number().min(0, 'SGST cannot be negative').optional(),
    cgst: z.number().min(0, 'CGST cannot be negative').optional(),
    hsnCode: z.string().optional(),
  })).optional().default([]),
});

export const updateBillSchema = z.object({
  receivedAmount: z.number().min(0, 'Received amount cannot be negative').optional(),
  status: z.enum(['PENDING', 'COMPLETED', 'CANCELLED']).optional(),
  notes: z.string().optional(),
});

// Schedule validation schemas
export const createScheduleSchema = z.object({
  shopId: z.number().positive('Shop ID must be positive'),
  dayOfWeek: z.enum(['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']),
});

// Pagination validation
export const paginationSchema = z.object({
  page: z.coerce.number().positive().optional(),
  limit: z.coerce.number().positive().max(100).optional(),
  search: z.string().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

// Validation helper
export const validateRequest = <T>(schema: z.ZodSchema<T>, data: unknown): T => {
  const result = schema.safeParse(data);
  if (!result.success) {
    const errors = result.error.errors.map(err => `${err.path.join('.')}: ${err.message}`);
    throw new Error(`Validation failed: ${errors.join(', ')}`);
  }
  return result.data;
};
