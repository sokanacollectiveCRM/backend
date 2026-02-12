# System Architecture Documentation

## Overview

The Sokana Collective Backend is a comprehensive Node.js/Express.js application designed to support doula services management. The system handles client requests, user authentication, payment processing, QuickBooks integration, and email communications.

## System Architecture

### High-Level Architecture

**Data split:** Supabase = **auth only**. All application data = **Google Cloud SQL**. See [ARCHITECTURE_AUTH_AND_DATA.md](./ARCHITECTURE_AUTH_AND_DATA.md).

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend       │    │   External      │
│   (React/Next)  │◄──►│   (Express.js)  │◄──►│   Services      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │                       │
                    ┌───────────┴───────────┐           ▼
                    ▼                       ▼   ┌─────────────────┐
           ┌─────────────────┐     ┌─────────────────┐ │   Email/Payment │
           │   Supabase      │     │   Google        │ │   (Stripe/QBO)   │
           │   (Auth only)   │     │   Cloud SQL     │ └─────────────────┘
           └─────────────────┘     │   (All data)    │
                                   └─────────────────┘
```

## Technology Stack

### Core Technologies
- **Runtime:** Node.js 18+
- **Framework:** Express.js 4.21.2
- **Language:** TypeScript 5.7.3
- **Authentication:** Supabase Auth only (sessions, login, OAuth)
- **Application data:** Google Cloud SQL (PostgreSQL) when `CLOUD_SQL_HOST` is set; see [ARCHITECTURE_AUTH_AND_DATA.md](./ARCHITECTURE_AUTH_AND_DATA.md)

### Key Dependencies
- **Email:** Nodemailer 6.10.0
- **Payments:** Stripe 14.20.0
- **Accounting:** QuickBooks Online API
- **File Processing:** PDFKit, DocxTemplater
- **Validation:** Zod 3.25.67
- **Testing:** Jest 29.7.0

## Directory Structure

```
src/
├── api/                    # API-specific modules
│   ├── qbo/               # QuickBooks Online integration
│   └── quickbooks/        # QuickBooks services
├── config/                 # Configuration files
│   ├── index.ts           # Main config
│   ├── quickbooks.ts      # QBO config
│   └── stripe.ts          # Stripe config
├── controllers/            # Request handlers (MVC)
│   ├── authController.ts   # Authentication logic
│   ├── clientController.ts # Client management
│   ├── contractController.ts # Contract handling
│   ├── emailController.ts  # Email operations
│   ├── paymentController.ts # Payment processing
│   ├── quickbooksController.ts # QBO operations
│   ├── requestFormController.ts # Lead form handling
│   └── userController.ts   # User management
├── db/                     # Database operations
│   ├── migrations/         # Database migrations
│   └── setupStripeDb.ts   # Stripe DB setup
├── domains/                # Domain-specific logic
│   └── errors/             # Custom error classes
├── entities/               # Data models
│   ├── Activity.ts         # Activity tracking
│   ├── Client.ts           # Client entity
│   ├── Contract.ts         # Contract entity
│   ├── Hours.ts            # Hours tracking
│   ├── Note.ts             # Notes entity
│   ├── RequestForm.ts      # Request form entity
│   ├── Template.ts         # Template entity
│   └── User.ts             # User entity
├── features/               # Feature-specific modules
│   ├── invoices/           # Invoice functionality
│   └── quickbooks/         # QBO features
├── middleware/             # Express middleware
│   ├── auth.ts             # Authentication middleware
│   ├── authorizeRoles.ts   # Role-based authorization
│   └── validateRequest.ts  # Request validation
├── repositories/           # Data access layer
│   ├── interface/          # Repository interfaces
│   ├── requestFormRepository.ts # Request form data access
│   ├── supabaseActivityRepository.ts # Activity data access
│   ├── supabaseClientRepository.ts # Client data access
│   └── supabaseUserRepository.ts # User data access
├── routes/                 # API route definitions
│   ├── authRoutes.ts       # Authentication routes
│   ├── clientRoutes.ts     # Client routes
│   ├── contractRoutes.ts   # Contract routes
│   ├── customersRoutes.ts  # Customer routes
│   ├── emailRoutes.ts      # Email routes
│   ├── paymentRoutes.ts    # Payment routes
│   ├── quickbooksRoutes.ts # QBO routes
│   ├── requestRoute.ts     # Request form routes
│   └── specificUserRoutes.ts # User routes
├── services/               # Business logic layer
│   ├── auth/               # Authentication services
│   ├── customer/           # Customer services
│   ├── invoice/            # Invoice services
│   ├── payments/           # Payment services
│   ├── interface/          # Service interfaces
│   ├── emailService.ts     # Email service
│   ├── RequestFormService.ts # Request form service
│   ├── supabaseAuthService.ts # Supabase auth service
│   └── supabaseContractService.ts # Contract service
├── types/                  # TypeScript type definitions
│   └── express/            # Express-specific types
├── usecase/                # Use case implementations
│   ├── authUseCase.ts      # Authentication use cases
│   ├── clientUseCase.ts    # Client use cases
│   ├── contractUseCase.ts  # Contract use cases
│   └── userUseCase.ts      # User use cases
├── utils/                  # Utility functions
│   ├── convertToPdf.ts     # PDF conversion
│   ├── generateInvoicePdf.ts # Invoice PDF generation
│   ├── qboClient.ts        # QBO client utility
│   └── tokenUtils.ts       # Token utilities
├── index.ts                # Application entry point
├── server.ts               # Server configuration
├── supabase.ts             # Supabase client
└── types.ts                # Global type definitions
```

## Design Patterns

### 1. Layered Architecture
The system follows a clean layered architecture:

```
┌─────────────────────────────────────────────────────────┐
│                    Presentation Layer                   │
│                   (Controllers/Routes)                 │
├─────────────────────────────────────────────────────────┤
│                    Business Logic Layer                │
│                   (Services/Use Cases)                │
├─────────────────────────────────────────────────────────┤
│                    Data Access Layer                   │
│                   (Repositories)                      │
├─────────────────────────────────────────────────────────┤
│                    Infrastructure Layer                │
│                   (Database/External APIs)            │
└─────────────────────────────────────────────────────────┘
```

### 2. Repository Pattern
- **Interface-based:** All repositories implement interfaces
- **Database agnostic:** Easy to switch between data sources
- **Testable:** Mock implementations for testing

### 3. Service Layer Pattern
- **Business logic encapsulation:** All business rules in services
- **Reusable:** Services can be used across different controllers
- **Testable:** Isolated business logic for unit testing

### 4. Controller-Service Pattern
- **Separation of concerns:** Controllers handle HTTP, services handle business logic
- **Thin controllers:** Controllers only handle request/response
- **Fat services:** Business logic resides in services

## Core Modules

### 1. Authentication Module
**Purpose:** Handle user authentication and authorization
**Components:**
- `authController.ts` - Authentication endpoints
- `supabaseAuthService.ts` - Supabase auth integration
- `authMiddleware.ts` - JWT token validation
- `authorizeRoles.ts` - Role-based access control

**Flow:**
```
Client Request → Auth Middleware → Role Check → Controller → Service → Database
```

### 2. Lead Management Module
**Purpose:** Handle client lead submissions and processing
**Components:**
- `requestFormController.ts` - Lead form handling
- `RequestFormService.ts` - Lead processing logic
- `requestFormRepository.ts` - Lead data persistence
- Email notifications to admins and clients

**Flow:**
```
Form Submission → Validation → Database Save → Email Notifications → Response
```

### 3. Payment Processing Module
**Purpose:** Handle Stripe payment processing
**Components:**
- `paymentController.ts` - Payment endpoints
- `stripePaymentService.ts` - Stripe integration
- `buildChargePayload.ts` - Payment data preparation
- `createCharge.ts` - Charge creation logic

**Flow:**
```
Payment Request → Validation → Stripe API → Database Update → Response
```

### 4. QuickBooks Integration Module
**Purpose:** Sync data with QuickBooks Online
**Components:**
- `quickbooksController.ts` - QBO endpoints
- `qboClient.ts` - QBO API client
- Customer and invoice synchronization
- OAuth token management

**Flow:**
```
QBO Request → Token Validation → QBO API → Data Sync → Response
```

### 5. Email Service Module
**Purpose:** Handle all email communications
**Components:**
- `emailService.ts` - Email service implementation
- `NodemailerService` - SMTP email sending
- Template-based email generation
- HTML and text email support

## Database Design

### Core Tables
1. **users** - User accounts and profiles
2. **clients** - Client information
3. **requests** - Lead form submissions
4. **contracts** - Service contracts
5. **activities** - Activity tracking
6. **payments** - Payment records
7. **quickbooks_tokens** - QBO OAuth tokens

### Relationships
```
users (1) ── (many) clients
clients (1) ── (many) contracts
clients (1) ── (many) requests
contracts (1) ── (many) activities
contracts (1) ── (many) payments
```

## API Design

### RESTful Endpoints
- **Authentication:** `/auth/*`
- **Clients:** `/clients/*`
- **Contracts:** `/contracts/*`
- **Payments:** `/api/payments/*`
- **QuickBooks:** `/quickbooks/*`
- **Requests:** `/requestService/*`
- **Users:** `/users/*`

### Response Format
```typescript
// Success Response
{
  message: string;
  data?: any;
}

// Error Response
{
  error: string;
  details?: any;
}
```

## Security Architecture

### 1. Authentication
- **JWT tokens:** Stateless authentication
- **Role-based access:** Admin, Doula, Client roles
- **Token refresh:** Automatic token renewal
- **Session management:** Secure session handling

### 2. Authorization
- **Middleware-based:** Route-level authorization
- **Role validation:** Controller-level role checks
- **Resource ownership:** User-specific data access
- **API key protection:** External service authentication

### 3. Data Protection
- **Input validation:** Zod schema validation
- **SQL injection prevention:** Parameterized queries
- **XSS protection:** Input sanitization
- **CORS configuration:** Cross-origin request control

## Error Handling

### Error Hierarchy
```typescript
DomainError (base)
├── AuthenticationError
├── AuthorizationError
├── ValidationError
├── ConflictError
└── NotFoundError
```

### Error Response Strategy
- **Development:** Detailed error messages with stack traces
- **Production:** Generic error messages for security
- **Logging:** Comprehensive error logging
- **Monitoring:** Error tracking and alerting

## Testing Strategy

### Test Types
1. **Unit Tests:** Individual function testing
2. **Integration Tests:** API endpoint testing
3. **Service Tests:** Business logic testing
4. **Repository Tests:** Data access testing

### Test Coverage
- **Controllers:** 100% endpoint coverage
- **Services:** Core business logic coverage
- **Repositories:** Data access layer coverage
- **Middleware:** Authentication and validation coverage

## Deployment Architecture

### Environment Configuration
- **Development:** Local development setup
- **Staging:** Pre-production testing
- **Production:** Live application deployment

### Environment Variables
```bash
# Database
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# External Services
STRIPE_SECRET_KEY=
QUICKBOOKS_CLIENT_ID=
QUICKBOOKS_CLIENT_SECRET=

# Email
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=

# Application
NODE_ENV=
PORT=
FRONTEND_URL=
```

## Performance Considerations

### 1. Database Optimization
- **Indexing:** Strategic database indexing
- **Query optimization:** Efficient SQL queries
- **Connection pooling:** Database connection management
- **Caching:** Redis caching for frequently accessed data

### 2. API Performance
- **Response compression:** Gzip compression
- **Rate limiting:** API rate limiting
- **Caching headers:** HTTP caching
- **Async operations:** Non-blocking I/O

### 3. Scalability
- **Horizontal scaling:** Load balancer support
- **Microservices ready:** Modular architecture
- **Stateless design:** Session-independent
- **Containerization:** Docker support

## Monitoring and Logging

### Logging Strategy
- **Structured logging:** JSON log format
- **Log levels:** Error, Warn, Info, Debug
- **Request tracking:** Request ID correlation
- **Performance metrics:** Response time tracking

### Health Checks
- **Database connectivity:** Supabase connection check
- **External services:** Stripe, QBO availability
- **Email service:** SMTP connectivity
- **Application status:** Overall system health

## Integration Points

### 1. Frontend Integration
- **CORS configuration:** Cross-origin request handling
- **API versioning:** Backward compatibility
- **Error handling:** Consistent error responses
- **Authentication:** JWT token management

### 2. External Services
- **Stripe:** Payment processing
- **QuickBooks Online:** Accounting integration
- **Email providers:** SMTP email services
- **Supabase:** Database and authentication

### 3. Third-party APIs
- **PDF generation:** Document creation
- **File processing:** Document conversion
- **OAuth providers:** Authentication services

## Configuration Management

### Environment-based Configuration
- **Development:** Local development settings
- **Staging:** Pre-production configuration
- **Production:** Live environment settings

### Feature Flags
- **Email notifications:** Toggle email sending
- **Payment processing:** Enable/disable payments
- **QBO integration:** Toggle QuickBooks sync
- **Debug mode:** Enhanced logging

## Backup and Recovery

### Database Backup
- **Automated backups:** Daily database backups
- **Point-in-time recovery:** Transaction log backups
- **Cross-region replication:** Geographic redundancy

### Application Recovery
- **Health checks:** Automated health monitoring
- **Graceful degradation:** Service failure handling
- **Rollback procedures:** Version rollback capability
- **Disaster recovery:** Complete system recovery

## Compliance and Security

### Data Protection
- **GDPR compliance:** Data privacy regulations
- **HIPAA considerations:** Health information protection
- **PCI DSS:** Payment card data security
- **Data encryption:** At-rest and in-transit encryption

### Security Measures
- **HTTPS enforcement:** Secure communication
- **Input sanitization:** XSS prevention
- **SQL injection protection:** Parameterized queries
- **Rate limiting:** DDoS protection 