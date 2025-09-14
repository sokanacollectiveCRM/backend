// Based on screenshot analysis - calculating precise coordinates

console.log('=== COORDINATE CALCULATION FROM SCREENSHOT ===');
console.log('');

console.log('Current test positions:');
console.log('- Test fields at SignNow coordinates: X=300, Y=392 and X=300, Y=442');
console.log('- Test fields at PDF coordinates: X=300, Y=400 and X=300, Y=350');
console.log('');

console.log('Visual analysis from screenshot:');
console.log('1. "600.00" text appears further RIGHT than current test position');
console.log('2. "1,200.00" text appears further RIGHT than current test position');
console.log('3. Both amounts are on the same page as test fields (good!)');
console.log('');

console.log('Estimated adjustments needed:');
console.log('- Move initials fields RIGHT by approximately 150-200 points');
console.log('- Fine-tune Y positions based on exact line positions');
console.log('');

console.log('Recommended new coordinates:');
console.log('');

// For "600.00" deposit amount
const depositNewX = 300 + 180; // Move right to after "600.00"
const depositNewY = 350 + 50;  // Adjust Y to match line position
console.log('Deposit amount "600.00":');
console.log(`- New PDF coordinates: X=${depositNewX}, Y=${depositNewY}`);
console.log(`- New SignNow coordinates: X=${depositNewX}, Y=${792 - depositNewY}`);
console.log('');

// For "1,200.00" total amount  
const totalNewX = 300 + 200; // Move right to after "1,200.00" (longer number)
const totalNewY = 350 + 100; // Adjust Y to match line position (appears below deposit)
console.log('Total amount "1,200.00":');
console.log(`- New PDF coordinates: X=${totalNewX}, Y=${totalNewY}`);
console.log(`- New SignNow coordinates: X=${totalNewX}, Y=${792 - totalNewY}`);
console.log('');

console.log('Next step: Update signNowService.ts with these coordinates');
