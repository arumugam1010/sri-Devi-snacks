# Backend Setup Instructions

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Configuration
Copy the environment file and update it with your database credentials:
```bash
copy env.example .env  # Windows
# OR
cp env.example .env    # Linux/Mac
```

Edit `.env` file:
```env
DATABASE_URL="postgresql://username:password@localhost:5432/billing_system"
JWT_SECRET="your-super-secret-jwt-key-minimum-32-characters-long"
```

### 3. Database Setup

#### Option A: PostgreSQL (Recommended for Production)
1. Install PostgreSQL
2. Create a database named `billing_system`
3. Update the DATABASE_URL in `.env`
4. Run migrations:
```bash
npm run db:migrate
npm run db:seed
```

#### Option B: SQLite (Quick Testing)
For quick testing, you can change the database provider in `prisma/schema.prisma`:
```prisma
datasource db {
  provider = "sqlite"
  url      = "file:./dev.db"
}
```

Then run:
```bash
npm run db:generate
npm run db:push
npm run db:seed
```

### 4. Start Development Server
```bash
npm run dev
```

The server will start on http://localhost:3001

### 5. Test the API
Visit http://localhost:3001/health to check if the server is running.

## Default Login Credentials (after seeding)
- **Admin**: admin@billing.com / admin123
- **User**: user@billing.com / user123

## API Documentation
The API endpoints are documented in the README.md file.

## Next Steps
1. Test the API endpoints using Postman or your frontend
2. Customize the business logic as needed
3. Deploy to your production environment
