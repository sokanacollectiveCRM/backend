# Portal Invite Status Requirement - Client Explanation

## Why Portal Invites Were Not Working

The portal invite feature has specific eligibility requirements that must be met before a client can be invited to the portal. These requirements ensure that only clients who have completed the necessary contract and payment steps can access their portal.

### Eligibility Requirements

For a client to be eligible for a portal invite, **both** of the following conditions must be met:

1. **Contract Status**: The client must have a contract with status = `'signed'`
   - This indicates that the contract has been signed and finalized
   - Contracts with statuses like `'draft'`, `'pending'`, or `'cancelled'` do not meet this requirement

2. **Payment Status**: The client must have a deposit payment with status = `'succeeded'`
   - This indicates that the initial deposit payment has been completed successfully
   - Payments with statuses like `'pending'`, `'failed'`, or `'canceled'` do not meet this requirement

### Why These Requirements Exist

These requirements ensure that:
- Only clients who have completed the contract signing process can access the portal
- Clients have made their initial financial commitment (deposit payment) before accessing portal features
- The system maintains data integrity by ensuring portal access aligns with business process completion

### What This Means

If a client's portal invite button was greyed out or disabled, it was because:
- The contract had not been signed yet, **OR**
- The deposit payment had not been completed yet, **OR**
- Both conditions were not met

### Resolution

To enable portal invites for a client:
1. Ensure the contract status is set to `'signed'`
2. Ensure a deposit payment exists with status `'succeeded'`
3. Once both conditions are met, the "Invite to Portal" button will be enabled

This is a security and business logic feature to ensure clients only receive portal access after completing the required contract and payment steps.
