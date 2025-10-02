// Debug service type detection
const serviceType = 'Labor Support Services';

console.log('🔍 Debug Service Type Detection');
console.log('================================');
console.log(`Original serviceType: "${serviceType}"`);
console.log(`serviceType?.toLowerCase(): "${serviceType?.toLowerCase()}"`);
console.log(`includes('labor support'): ${serviceType?.toLowerCase().includes('labor support')}`);
console.log(`includes('labor'): ${serviceType?.toLowerCase().includes('labor')}`);
console.log(`=== 'Labor Support Services': ${serviceType === 'Labor Support Services'}`);

const isLaborSupport = serviceType?.toLowerCase().includes('labor support') ||
                      serviceType?.toLowerCase().includes('labor') ||
                      serviceType === 'Labor Support Services';

console.log(`isLaborSupport: ${isLaborSupport}`);

const templateFileName = isLaborSupport
  ? 'Labor Support Agreement for Service.docx'
  : 'Agreement for Postpartum Doula Services.docx';

console.log(`Template selected: ${templateFileName}`);
console.log(`Contract type: ${isLaborSupport ? 'Labor Support' : 'Postpartum'}`);
