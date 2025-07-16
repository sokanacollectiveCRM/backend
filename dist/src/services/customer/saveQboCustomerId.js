"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = saveQboCustomerId;
const supabase_1 = __importDefault(require("../../supabase"));
async function saveQboCustomerId(internalCustomerId, qboCustomerId) {
    const { error } = await supabase_1.default
        .from('customers')
        .update({ qbo_customer_id: qboCustomerId })
        .eq('id', internalCustomerId);
    if (error) {
        throw new Error(`Supabase error saving qbo_customer_id: ${error.message}`);
    }
}
