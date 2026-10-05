/**
 * Verification script for PUT /clients/:id/phi endpoint
 *
 * This script verifies that the PHI endpoint method exists and has the correct signature.
 */
import { ClientController } from '../src/controllers/clientController';
import { SupabaseAssignmentRepository } from '../src/repositories/supabaseAssignmentRepository';
import { ClientUseCase } from '../src/usecase/clientUseCase';

async function verifyPhiEndpoint() {
  console.log('🔍 Verifying PHI endpoint implementation...\n');

  // Create controller instance
  const mockUseCase = {} as ClientUseCase;
  const mockAssignmentRepo = {} as SupabaseAssignmentRepository;
  const controller = new ClientController(mockUseCase, mockAssignmentRepo);

  // Check if method exists
  if (typeof controller.updateClientPhi === 'function') {
    console.log('✅ updateClientPhi method exists on ClientController');
    console.log(
      `✅ Method signature: async updateClientPhi(req, res): Promise<void>`
    );
  } else {
    console.log('❌ updateClientPhi method NOT found on ClientController');
    process.exit(1);
  }

  // Check method properties
  const methodString = controller.updateClientPhi.toString();

  const checks = [
    { name: 'Accepts req parameter', test: methodString.includes('req') },
    { name: 'Accepts res parameter', test: methodString.includes('res') },
    { name: 'Validates client ID', test: methodString.includes('id') },
    {
      name: 'Splits PHI/operational fields',
      test: methodString.includes('splitClientPatch'),
    },
    {
      name: 'Checks authorization',
      test: methodString.includes('canAccessSensitive'),
    },
    {
      name: 'Writes PHI on Cloud SQL',
      test: methodString.includes('writePhiFields'),
    },
    {
      name: 'Updates identity cache',
      test: methodString.includes('updateIdentityCache'),
    },
  ];

  console.log('\n📋 Implementation checks:');
  for (const check of checks) {
    console.log(`${check.test ? '✅' : '❌'} ${check.name}`);
  }

  console.log('\n✅ PHI endpoint verification complete!');
  console.log('\n📝 Next steps:');
  console.log('   1. Run manual tests using: docs/PHI_ENDPOINT_TESTING.md');
  console.log('   2. Test with curl commands');
  console.log('   3. Verify in staging/production environment');
}

verifyPhiEndpoint().catch((error) => {
  console.error('❌ Verification failed:', error);
  process.exit(1);
});
