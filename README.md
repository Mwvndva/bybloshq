# BYBLOS

A modern e-commerce platform for discovering and selling unique fashion items with an emphasis on aesthetic categories. Built with a modern tech stack for optimal performance and developer experience.

## 🌟 Features

### For Customers
- 🛍️ Browse products by aesthetic categories
- 🔍 Advanced product filtering and search functionality
- 🛒 Shopping cart and secure checkout process
- 📱 Mobile-first responsive design
- 🔐 Secure user authentication
- 📋 Order tracking and history

### For Sellers
- 🏪 Seller dashboard for product management
- 💎 Product listing with image uploads
- 📊 Sales analytics and reporting
- 📤 Real-time inventory management
- 🏷️ Category and collection management

### General
- 🌐 Responsive design with modern UI components
- ⚡ Optimized performance with Vite
- 🔒 Secure JWT-based authentication
- 📱 Mobile-friendly interface

## 🚀 Tech Stack

### Frontend
| Technology | Description |
|------------|-------------|
| React 18 | Frontend library for building user interfaces |
| TypeScript | Static type checking |
| Vite | Next Generation Frontend Tooling |
| Tailwind CSS | Utility-first CSS framework |
| shadcn/ui | Beautifully designed components |
| React Query | Server state management |
| React Hook Form | Form handling with Zod validation |
| React Router v6 | Client-side routing |
| Lucide React | Beautiful & consistent icons |
| Playwright | End-to-end testing |

### Backend
| Technology | Description |
|------------|-------------|
| Node.js 18+ | JavaScript runtime |
| Express | Web application framework |
| PostgreSQL | Relational database |
| Knex.js | SQL query builder |
| JWT | Authentication with refresh tokens |
| Express Validator | Request validation |
| Winston | Logging |
| RESTful API | Resource-based API design |

## 🛠️ Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** 18+ (LTS version recommended)
- **npm** 9+ or **yarn** 1.22+
- **PostgreSQL** 13+ (with pgAdmin for database management)
- **Git** for version control
- **Modern web browser** (Chrome, Firefox, Safari, or Edge)
- **Code editor** (VS Code, WebStorm, etc.)

## 🚀 Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/yourusername/byblos.git
cd byblos
```

### 2. Install dependencies

```bash
# Install frontend dependencies
npm install

# Install server dependencies
cd server && npm install && cd ..
```

### 3. Set up environment variables

Create the following files with the required environment variables:

#### Frontend (root `.env`)
```env
VITE_API_URL=http://localhost:3002/api
NODE_ENV=development
# VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX  # Uncomment for Google Analytics
```

#### Backend (`server/.env`)
```env
# Server
PORT=3002
NODE_ENV=development

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=byblos
DB_USER=your_db_user
DB_PASSWORD=your_secure_password

# JWT
JWT_SECRET=generate_a_strong_secret_here
JWT_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=7d

# Email (optional)
# SMTP_HOST=smtp.example.com
# SMTP_PORT=587
# SMTP_USER=your_email@example.com
# SMTP_PASS=your_email_password
# EMAIL_FROM=noreply@bybloshq.space
```

### 4. Set up the database

1. **Create a new PostgreSQL database**
   ```bash
   # Connect to PostgreSQL
   psql -U postgres
   
   # Create database and user
   CREATE DATABASE byblos;
   CREATE USER your_db_user WITH PASSWORD 'your_secure_password';
   GRANT ALL PRIVILEGES ON DATABASE byblos TO your_db_user;
   ```

2. **Run database migrations**
   ```bash
   # From the server directory
   cd server
   
   # Install Knex CLI locally
   npm install -D knex
   
   # Run migrations and seeds
   npx knex migrate:latest
   npx knex seed:run  # Optional: for sample data
   ```

### 5. Start the development servers

#### Terminal 1: Frontend
```bash
# From project root
npm run dev
```

#### Terminal 2: Backend
```bash
# From server directory
cd server && npm run dev
```

### 6. Access the application

- **Frontend**: `http://localhost:5173`
- **API**: `http://localhost:3002/api`
- **API Docs**: `http://localhost:3002/api-docs` (if Swagger is configured)
- **PgAdmin**: `http://localhost:5050` (if using Docker)

### 6. Access the application

- **Customer View**: `http://localhost:5173`
- **Seller Dashboard**: `http://localhost:5173/seller/dashboard`
- **Admin Dashboard**: `http://localhost:5173/admin/dashboard`

## 🧪 Testing

```bash
# Run all tests
npm test

# Run frontend tests
npm run test:frontend

# Run backend tests
cd server && npm test

# Run E2E tests
npm run test:e2e
```

## 🏗️ Production Build

```bash
# Build the frontend for production
npm run build

# Start production server (from server directory)
cd server && NODE_ENV=production npm start

# Or using PM2 (recommended for production)
npm install -g pm2
pm2 start server/dist/index.js --name "byblos-api"
```

## 🐳 Docker Support

Run the entire stack with Docker Compose:

```bash
docker-compose up -d
```

This will start:
- Frontend (port 80)
- Backend API (port 3002)
- PostgreSQL (port 5432)
- PgAdmin (port 5050)

## 📂 Project Structure

```
.
├── public/                  # Static files
├── server/                  # Backend server code
│   ├── src/
│   │   ├── config/         # Configuration files
│   │   ├── controllers/    # Request handlers
│   │   ├── middleware/     # Express middleware
│   │   ├── models/         # Database models
│   │   ├── routes/         # API routes
│   │   ├── services/       # Business logic
│   │   ├── utils/          # Utility functions
│   │   └── app.ts          # Express app setup
│   ├── knexfile.ts         # Knex configuration
│   └── migrations/         # Database migrations
│
├── src/                    # Frontend source
│   ├── api/                # API service functions
│   ├── assets/             # Static assets
│   ├── components/         # Reusable components
│   ├── hooks/              # Custom React hooks
│   ├── pages/              # Page components
│   ├── store/              # State management
│   ├── styles/             # Global styles
│   ├── types/              # TypeScript type definitions
│   ├── utils/              # Utility functions
│   └── App.tsx             # Main application component
│
├── .env                    # Frontend environment variables
├── .env.example            # Example environment variables
├── package.json            # Frontend dependencies
├── tsconfig.json           # TypeScript configuration
└── vite.config.ts          # Vite configuration
│   ├── assets/          # Static assets
│   ├── components/      # Reusable UI components
│   ├── contexts/        # React contexts
│   ├── hooks/           # Custom React hooks
│   ├── pages/           # Page components
│   ├── routes/          # Application routes
│   ├── styles/          # Global styles
│   └── types/           # TypeScript type definitions
├── .gitignore
├── package.json
├── README.md
└── tsconfig.json
```

## 🤝 Contributing

Contributions are what make the open-source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

1. Fork the project
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

## 👏 Acknowledgments

- [shadcn/ui](https://ui.shadcn.com/) - Beautifully designed components
- [Vite](https://vitejs.dev/) - Next generation frontend tooling
- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS framework
- [React Query](https://tanstack.com/query) - Server state management
- [Knex.js](https://knexjs.org/) - SQL query builder
- [Express](https://expressjs.com/) - Fast, unopinionated web framework

## 📚 Documentation

- [API Documentation](http://localhost:3002/api-docs) (available when server is running)
- [Frontend Architecture](./docs/frontend-architecture.md)
- [API Reference](./docs/api-reference.md)
- [Database Schema](./docs/database-schema.md)

## 🔧 Support

For support, please open an issue or reach out to our team at support@bybloshq.space
