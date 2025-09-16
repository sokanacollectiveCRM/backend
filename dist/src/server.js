"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const express_1 = __importDefault(require("express"));
const authRoutes_1 = __importDefault(require("./routes/authRoutes"));
const clientRoutes_1 = __importDefault(require("./routes/clientRoutes"));
const contractPaymentRoutes_1 = __importDefault(require("./routes/contractPaymentRoutes"));
const contractRoutes_1 = __importDefault(require("./routes/contractRoutes"));
const contractSigningRoutes_1 = __importDefault(require("./routes/contractSigningRoutes"));
const customersRoutes_1 = __importDefault(require("./routes/customersRoutes"));
const docusignRoutes_1 = __importDefault(require("./routes/docusignRoutes"));
const EmailRoutes_1 = __importDefault(require("./routes/EmailRoutes"));
const paymentRoutes_1 = __importDefault(require("./routes/paymentRoutes"));
const quickbooksRoutes_1 = __importDefault(require("./routes/quickbooksRoutes"));
const requestRoute_1 = __importDefault(require("./routes/requestRoute"));
const signNowRoutes_1 = __importDefault(require("./routes/signNowRoutes"));
const specificUserRoutes_1 = __importDefault(require("./routes/specificUserRoutes"));
const stripePaymentRoutes_1 = __importDefault(require("./routes/stripePaymentRoutes"));
dotenv_1.default.config();
const app = (0, express_1.default)();
// ---- Helper to normalize ESM/CJS route modules ----
const asMiddleware = (m) => typeof m === 'function' ? m : (m?.default ?? m);
const corsOptions = {
    origin: (origin, callback) => {
        const allowedOrigins = [
            process.env.FRONTEND_URL || 'http://localhost:3001',
            process.env.FRONTEND_URL_DEV || 'http://localhost:3000',
            'http://localhost:5050',
            'http://localhost:3001',
            'http://localhost:3000'
        ];
        if (allowedOrigins.includes(origin || '') || !origin) {
            callback(null, true);
        }
        else {
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
// ---- Mount webhook routes BEFORE JSON parsing ----
// Stripe webhook needs raw body data
app.use('/api/stripe', asMiddleware(stripePaymentRoutes_1.default));
app.use(express_1.default.json());
// normalize duplicate slashes
app.use((req, _res, next) => {
    req.url = req.url.replace(/\/+/g, '/');
    next();
});
// ---- Mount other routes (wrapped for ESM/CJS compatibility) ----
app.use('/auth', asMiddleware(authRoutes_1.default));
app.use('/email', asMiddleware(EmailRoutes_1.default));
app.use('/requestService', asMiddleware(requestRoute_1.default));
app.use('/clients', asMiddleware(clientRoutes_1.default));
app.use('/client', asMiddleware(clientRoutes_1.default)); // alias
app.use('/quickbooks', asMiddleware(quickbooksRoutes_1.default));
app.use('/quickbooks/customers', asMiddleware(customersRoutes_1.default));
app.use('/users', asMiddleware(specificUserRoutes_1.default));
app.use('/api/contract', asMiddleware(contractRoutes_1.default));
app.use('/api/contract-signing', asMiddleware(contractSigningRoutes_1.default));
app.use('/api/payments', asMiddleware(paymentRoutes_1.default));
app.use('/api/signnow', asMiddleware(signNowRoutes_1.default));
app.use('/api/contract-payment', asMiddleware(contractPaymentRoutes_1.default));
app.use('/api/docusign', asMiddleware(docusignRoutes_1.default));
app.get('/', (_req, res) => {
    res.status(200).json({ status: 'ok' });
});
// global error handler
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
    res.status(err.status || 500).json({
        error: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message,
    });
});
const PORT = process.env.PORT || 5050;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:3001'}`);
});
exports.default = app;
