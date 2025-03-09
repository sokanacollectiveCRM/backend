import dotenv from 'dotenv';
import { RequestFormRepository } from './src/repositories/RequestFormRepository';
import { RequestApprovalService } from './src/services/RequestApprovalService';

dotenv.config();

async function testApprovalFlow() {
  try {
    const repository = new RequestFormRepository();
    
    // 1. Get all pending requests
    console.log('Fetching pending requests...');
    const pendingRequests = await repository.getAllPendingRequests();
    console.log(`Found ${pendingRequests.length} pending requests`);
    
    if (pendingRequests.length > 0) {
      const requestToApprove = pendingRequests[0];
      console.log(`Testing approval for request ID ${requestToApprove.id}`);
      
      // 2. Approve the first pending request
      const approvalService = new RequestApprovalService();
      await approvalService.approveRequest(
        requestToApprove.id,
        'http://localhost:3001/signup'
      );
      
      console.log('Approval process completed successfully');
    } else {
      console.log('No pending requests found to test');
    }
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testApprovalFlow();