import 'dotenv/config';
import { v4 as uuidv4 } from 'uuid';

import {
  type SignNowContractData,
  processContractWithSignNow,
} from '../utils/signNowContractProcessor';

async function main() {
  const email =
    process.argv.find((a) => a.startsWith('--email='))?.split('=')[1] ||
    'jerrybony5@gmail.com';
  const name =
    process.argv.find((a) => a.startsWith('--name='))?.split('=')[1] ||
    'Jerry Bony';
  const total =
    process.argv.find((a) => a.startsWith('--total='))?.split('=')[1] ||
    '1200.00';
  const deposit =
    process.argv.find((a) => a.startsWith('--deposit='))?.split('=')[1] ||
    '600.00';

  const contractId = uuidv4();

  const data: SignNowContractData = {
    contractId,
    clientName: name,
    clientEmail: email,
    serviceType: 'Labor Support Services',
    totalInvestment: total,
    depositAmount: deposit,
    remainingBalance: (parseFloat(total) - parseFloat(deposit)).toFixed(2),
    contractDate: new Date().toLocaleDateString(),
  } as any;

  console.log('Sending Labor Support contract via SignNow with:', {
    contractId,
    name,
    email,
    total,
    deposit,
  });

  const result = await processContractWithSignNow(data);
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error('Failed to send contract:', err?.message || err);
  if ((err as any)?.response?.data) {
    console.error(
      'Response:',
      JSON.stringify((err as any).response.data, null, 2)
    );
  }
  process.exit(1);
});
