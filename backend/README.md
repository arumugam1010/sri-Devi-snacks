# Billing System Backend API

A comprehensive backend API for a billing system built with Node.js, TypeScript, PostgreSQL, and Prisma.

## Features

- 🔐 JWT Authentication & Authorization
- 🏪 Shop Management with Weekly Scheduling
- 📦 Product Management with HSN codes and GST
- 💰 Shop-specific Product Pricing
- 📊 Stock Management with Low Stock Alerts
- 🧾 Bill Generation with Auto Stock Updates
- 📈 Dashboard Analytics and Reports
- 🔍 Search and Pagination
- 📝 Type-safe API with Zod validation
- 🛡️ Security with Helmet, CORS, and Input Validation

## Tech Stack

- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL
- **ORM**: Prisma
- **Authentication**: JWT with bcryptjs
- **Validation**: Zod
- **Security**: Helmet, CORS
- **Logging**: Morgan

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `GET /api/auth/verify` - Verify JWT token

### Users
- `GET /api/users/profile` - Get current user profile
- `GET /api/users` - Get all users (Admin only)
- `GET /api/users/:id` - Get user by ID (Admin only)
- `PATCH /api/users/:id/status` - Update user status (Admin only)

### Shops
- `GET /api/shops` - Get all shops with pagination
- `GET /api/shops/:id` - Get shop by ID
- `POST /api/shops` - Create new shop
- `PUT /api/shops/:id` - Update shop
- `DELETE /api/shops/:id` - Delete shop
- `GET /api/shops/:id/products` - Get shop products with pricing

### Products
- `GET /api/products` - Get all products with pagination
- `GET /api/products/:id` - Get product by ID
- `POST /api/products` - Create new product
- `PUT /api/products/:id` - Update product
- `DELETE /api/products/:id` - Delete product
- `POST /api/products/shop-pricing` - Create shop product pricing
- `PUT /api/products/shop-pricing/:id` - Update shop product pricing
- `DELETE /api/products/shop-pricing/:id` - Delete shop product pricing

### Stock Management
- `GET /api/stocks` - Get all stocks with pagination
- `GET /api/stocks/:id` - Get stock by ID
- `GET /api/stocks/product/:productId` - Get stock by product ID
- `POST /api/stocks` - Create new stock entry
- `PUT /api/stocks/:id` - Update stock
- `PATCH /api/stocks/:id/adjust` - Adjust stock quantity
- `DELETE /api/stocks/:id` - Delete stock
- `GET /api/stocks/alerts/low-stock` - Get low stock alerts

### Bills
- `GET /api/bills` - Get all bills with pagination
- `GET /api/bills/:id` - Get bill by ID
- `POST /api/bills` - Create new bill
- `PUT /api/bills/:id` - Update bill
- `DELETE /api/bills/:id` - Delete bill
- `GET /api/bills/shop/:shopId` - Get bills by shop ID
- `GET /api/bills/status/pending` - Get pending bills

### Schedules
- `GET /api/schedules` - Get weekly schedule
- `GET /api/schedules/day/:dayOfWeek` - Get schedule by day
- `GET /api/schedules/shop/:shopId` - Get schedule by shop
- `POST /api/schedules` - Create new schedule
- `PATCH /api/schedules/:id/status` - Update schedule status
- `DELETE /api/schedules/:id` - Delete schedule
- `POST /api/schedules/bulk-assign` - Assign shop to multiple days
- `POST /api/schedules/bulk-remove` - Remove shop from multiple days

### Dashboard
- `GET /api/dashboard/stats` - Get dashboard statistics
- `GET /api/dashboard/recent-bills` - Get recent bills
- `GET /api/dashboard/top-shops` - Get top shops by revenue
- `GET /api/dashboard/top-products` - Get top products by sales
- `GET /api/dashboard/sales-trend` - Get sales trend data
- `GET /api/dashboard/low-stock` - Get low stock alerts

## Installation & Setup

### Prerequisites

- Node.js (v18 or higher)
- PostgreSQL (v13 or higher)
- npm or yarn

### 1. Clone and Install Dependencies

```bash
cd backend
npm install
```

### 2. Environment Setup

Copy the environment file and configure your database:

```bash
cp env.example .env
```

Update `.env` with your configuration:

```env
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/billing_system"

# JWT
JWT_SECRET="your-super-secret-jwt-key-here"
JWT_EXPIRES_IN="24h"

# Server
PORT=3001
NODE_ENV=development

# CORS
FRONTEND_URL="http://localhost:5173"
```

### 3. Database Setup

```bash
# Generate Prisma client
npm run db:generate

# Push schema to database (for development)
npm run db:push

# OR run migrations (for production)
npm run db:migrate

# Seed the database with sample data
npm run db:seed
```

### 4. Development

```bash
# Start development server with hot reload
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

### 5. Database Management

```bash
# Open Prisma Studio (database GUI)
npm run db:studio

# Reset database
npx prisma migrate reset

# Generate new migration
npx prisma migrate dev --name your_migration_name
```

## Database Schema

The database includes the following main entities:

- **Users**: System users with role-based access
- **Shops**: Customer shops with contact information
- **Products**: Product catalog with HSN codes and GST
- **ShopProducts**: Shop-specific product pricing
- **Stock**: Inventory management
- **Bills**: Invoice generation with line items
- **BillItems**: Individual items in bills
- **Schedules**: Weekly delivery schedules

## Authentication

The API uses JWT tokens for authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your_jwt_token>
```

### Default Users (after seeding)

- **Admin**: admin@billing.com / admin123
- **User**: user@billing.com / user123

## API Response Format

### Success Response
```json
{
  "success": true,
  "message": "Operation successful",
  "data": { ... }
}
```

### Error Response
```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error info"
}
```

### Paginated Response
```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 100,
    "totalPages": 10,
    "hasNext": true,
    "hasPrev": false
  }
}
```

## Development Notes

### Database Relationships
- Users can create multiple bills
- Shops can have multiple products with different pricing
- Products can be in stock and sold across multiple bills
- Schedules define which shops are visited on which days
- Bills automatically update stock quantities

### Security Features
- Password hashing with bcrypt
- JWT token authentication
- Input validation with Zod
- SQL injection prevention with Prisma
- CORS configuration
- Rate limiting ready (can be added)

### Performance Considerations
- Database indexing on frequently queried fields
- Pagination for large datasets
- Efficient joins with Prisma include
- Transaction support for data consistency

## Production Deployment

1. Set `NODE_ENV=production`
2. Use a proper PostgreSQL database
3. Configure secure JWT secret
4. Enable SSL for database connections
5. Set up proper logging
6. Configure reverse proxy (nginx)
7. Set up monitoring and error tracking

## Support

For issues and questions, please check the API documentation and ensure your environment is properly configured.
