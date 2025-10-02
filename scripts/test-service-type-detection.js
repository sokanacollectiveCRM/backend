// Test service type detection logic
const serviceType = 'Labor Support Services';

const isLaborSupport = serviceType?.toLowerCase().includes('labor support') ||
                      serviceType?.toLowerCase().includes('labor') ||
                      serviceType === 'Labor Support Services';

const templateFileName = isLaborSupport
  ? 'Labor Support Agreement for Service.docx'
  : 'Agreement for Postpartum Doula Services.docx';

console.log('🔍 Service Type Detection Test');
console.log('================================');
console.log(`Service Type: "${serviceType}"`);
console.log(`isLaborSupport: ${isLaborSupport}`);
console.log(`Template Selected: ${templateFileName}`);
console.log(`Contract Type: ${isLaborSupport ? 'Labor Support' : 'Postpartum'}`);
