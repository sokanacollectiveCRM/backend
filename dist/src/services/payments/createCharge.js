"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCharge = createCharge;
const tokenUtils_1 = require("../../utils/tokenUtils");
const buildChargePayload_1 = require("./buildChargePayload");
async function createCharge(amount, card) {
    const accessToken = await (0, tokenUtils_1.getValidAccessToken)();
    if (!accessToken) {
        throw new Error('Could not get QuickBooks access token');
    }
    const payload = (0, buildChargePayload_1.buildChargePayload)(amount, card);
    const response = await fetch('https://sandbox.api.intuit.com/quickbooks/v4/payments/charges', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!response.ok) {
        throw new Error(JSON.stringify(data));
    }
    return data;
}
