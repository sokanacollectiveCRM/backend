"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = upsertInternalCustomer;
const supabase_1 = __importDefault(require("../../supabase"));
async function upsertInternalCustomer(internalCustomerId, fullName, email) {
    const { data, error } = await supabase_1.default
        .from('customers')
        .upsert({ id: internalCustomerId, name: fullName, email }, { onConflict: 'id' })
        .single();
    if (error) {
        throw new Error(`Supabase error upserting internal customer: ${error.message}`);
    }
    return data;
}
