"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// authorizeRoles
//
// Takes in an array of authorized roles (in lowercase) of 'patient', 'doula', 'admin'.
//
const authorizeRoles = async (req, res, next, allowedRoles) => {
    try {
        if (!req.user || !req.user.email) {
            res.status(401).json({ error: 'Unauthorized: No user found' });
            return; // ← stop here!
        }
        if (!allowedRoles.includes(req.user.role)) {
            res.status(403).json({ error: 'Forbidden: Insufficient permissions' });
            return; // ← and stop here!
        }
        next();
    }
    catch {
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.default = authorizeRoles;
