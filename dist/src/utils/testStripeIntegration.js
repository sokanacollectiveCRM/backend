"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.testStripeIntegration = testStripeIntegration;
const contractClientService_1 = require("../services/contractClientService");
const stripePaymentService_1 = require("../services/stripePaymentService");
/**
 * Test script to verify Stripe integration with contract system
 */
async function testStripeIntegration() {
    console.log('🧪 Testing Stripe Integration with Contract System...\n');
    try {
        const stripeService = new stripePaymentService_1.StripePaymentService();
        const contractService = new contractClientService_1.ContractClientService();
        // Test 1: Check if we can get payment summary
        console.log('📊 Test 1: Getting payment dashboard...');
        const dashboard = await contractService.getPaymentDashboard();
        console.log('✅ Payment dashboard:', dashboard);
        // Test 2: Check if we can get overdue payments
        console.log('\n📅 Test 2: Getting overdue payments...');
        const overduePayments = await contractService.getOverduePayments();
        console.log('✅ Overdue payments found:', overduePayments.length);
        // Test 3: Check if we can get contracts needing cleanup
        console.log('\n🧹 Test 3: Getting contracts needing cleanup...');
        const contractsNeedingCleanup = await contractService.getContractsNeedingCleanup();
        console.log('✅ Contracts needing cleanup:', contractsNeedingCleanup.length);
        console.log('\n🎉 All tests completed successfully!');
        console.log('\n📋 Next steps:');
        console.log('1. Create a test contract with payment schedule');
        console.log('2. Test payment intent creation');
        console.log('3. Test webhook processing');
        console.log('4. Verify Stripe customer creation');
    }
    catch (error) {
        console.error('❌ Test failed:', error);
        throw error;
    }
}
// Run the test if this file is executed directly
if (require.main === module) {
    testStripeIntegration()
        .then(() => {
        console.log('\n✅ Stripe integration test completed');
        process.exit(0);
    })
        .catch((error) => {
        console.error('\n❌ Stripe integration test failed:', error);
        process.exit(1);
    });
}
