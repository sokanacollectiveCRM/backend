"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateRequest = void 0;
const validateRequest = (schema) => {
    return async (req, res, next) => {
        try {
            await schema.parseAsync(req.body);
            next();
        }
        catch (error) {
            res.status(400).json({
                success: false,
                error: 'Invalid request data',
                details: error.errors
            });
        }
    };
};
exports.validateRequest = validateRequest;
