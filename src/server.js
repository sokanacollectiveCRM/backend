'use strict';
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
Object.defineProperty(exports, '__esModule', { value: true });
const cookie_parser_1 = __importDefault(require('cookie-parser'));
const cors_1 = __importDefault(require('cors'));
const dotenv_1 = __importDefault(require('dotenv'));
const express_1 = __importDefault(require('express'));
const authRoutes_1 = __importDefault(require('./routes/authRoutes'));
const clientRoutes_1 = __importDefault(require('./routes/clientRoutes'));
const contractRoutes_1 = __importDefault(require('./routes/contractRoutes'));
const customersRoutes_1 = __importDefault(require('./routes/customersRoutes'));
const EmailRoutes_1 = __importDefault(require('./routes/EmailRoutes'));
const paymentRoutes_1 = __importDefault(require('./routes/paymentRoutes'));
const quickbooksRoutes_1 = __importDefault(
  require('./routes/quickbooksRoutes')
);
const requestRoute_1 = __importDefault(require('./routes/requestRoute'));
const specificUserRoutes_1 = __importDefault(
  require('./routes/specificUserRoutes')
);
dotenv_1.default.config();
const app = (0, express_1.default)();
const corsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = [
      process.env.FRONTEND_URL || '',
      process.env.FRONTEND_URL_DEV || '',
    ];
    if (allowedOrigins.includes(origin || '') || !origin) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 86400,
};
app.use((0, cors_1.default)(corsOptions));
if (process.env.NODE_ENV !== 'production') {
  console.log('CORS Configuration:', {
    origin: process.env.FRONTEND_URL,
    credentials: true,
  });
}
app.use((0, cookie_parser_1.default)());
app.use(express_1.default.json());
app.use((req, res, next) => {
  req.url = req.url.replace(/\/+/g, '/');
  next();
});
app.use('/auth', authRoutes_1.default);
app.use('/email', EmailRoutes_1.default);
app.use('/requestService', requestRoute_1.default);
app.use('/clients', clientRoutes_1.default);
app.use('/quickbooks', quickbooksRoutes_1.default);
app.use('/quickbooks/customers', customersRoutes_1.default);
app.use('/users', specificUserRoutes_1.default);
app.use('/contracts', contractRoutes_1.default);
app.use('/api/payments', paymentRoutes_1.default);
app.get('/', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  // console.error('Error details:', {
  //   message: err.message,
  //   stack: err.stack,
  //   status: err.status || 500,
  // });
  res.status(err.status || 500).json({
    error:
      process.env.NODE_ENV === 'production'
        ? 'Internal Server Error'
        : err.message,
  });
});
const PORT = parseInt(process.env.PORT || '3001', 10);
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Frontend URL: ${process.env.FRONTEND_URL}`);
});
exports.default = app;
