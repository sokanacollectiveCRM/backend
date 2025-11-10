require('dotenv').config();
const fs = require('fs');

function createTemplateWithTags() {
  try {
    console.log('🔍 Creating template with Text Tags...');

    const templateContent = `Labor Support Agreement for Service
As a Labor Support Client you will receive:
	•	Unlimited prenatal support via email, phone, text, video call
	•	In-person/live prenatal visits scheduled between you and your doula (up to 3)
	•	On-call availability starting at 37 weeks of pregnancy through birth/42wks
	•	Continuous in-person support during labor, birth, and the immediate postpartum period*
	•	A partner doula to work with your assigned doula should backup support be needed
	•	A postpartum visit within the first week of delivery
	•	Up to 2 visits with a certified lactation counselor for breast/chest/infant feeding support**
*If COVID restrictions make it so the doula cannot be in person we are happy to provide virtual support and or move your payment to postpartum doula services.
**If more than 2 visits of support are needed then an extra fee will occur
Understanding the role of your labor support doula
	•	A Sokana Collective doula is here to provide non-medical support. They provide education, comfort measures, emotional support and help the client find their voice to advocate for themselves.
	•	They are not doing any clinical/medical tasks such as diagnosing, are not checking fetal tones, blood pressures, vaginal exams etc.
	•	My doula will help me and my partner obtain the information necessary to make informed decisions and will not make decisions for me.
	•	My doula will listen to me and my partners concerns me and suggest options
CANCELLATION OF SERVICES
I understand that if I cancel services more than 4 weeks before my due date, Sokana Collective will retain 30% of my contract rate. I may use the remainder of the balance for any additional services listed above or Sokana Collective can refund the balance. I understand that canceling services less than 4 weeks before my due date will result in no refunds but may still be transferred to an additional service.
REFUND POLICY
I understand that if I have contacted my doula team to request support and no one was able to provide support during labor or birth because they were unavailable, the fees paid for labor support services will be refunded. I understand that no refund will be made if my plans regarding labor support change because:
	•	I failed to call/connect with my doula (primary or backup and admin if necessary) when I was in labor, or did not request their support.
	•	I delayed contacting them and they were not able to support me in time.
	•	I changed my birth plan and I decided to cancel services within 4 weeks of my due date.
	•	I have an unplanned cesarean called during labor.
YOUR RESPONSIBILITY TO NOTIFY SOKANA COLLECTIVE
Due to the occasional failure of communications technologies, it is your responsibility to make a thorough effort to contact your doula/backup doula/s. Texting alone is not always sufficient. The earliest possible notice will give them the best chance to accommodate your request for support.
If you cannot reach your doula(s) then promptly contact Sokana Collective directly 847-701-5527
FINANCIAL AGREEMENT
After considering the conditions set forth in this agreement, I/we agree to pay the following amount:
Doula services: {{t:t;r:y;o:"Signer 1";l:"Total Amount";}}
Today I agree to pay {{t:t;r:y;o:"Signer 1";l:"Deposit Amount";}} as a deposit (invoice sent separately) and the balance of {{t:t;r:y;o:"Signer 1";l:"Balance Amount";}} to be paid in full by the 36th week of your pregnancy.
I/We have read and agree to what is outlined in this contract and agree that Sokana Collective and the doula are not liable in any way for the outcome of the birth, nor for the health and wellbeing of the pregnant person or the baby. We agree that the presence of a labor support doula is not a substitute for a trained birth attendant, such as a doctor, midwife, or nurse.
I/We understand that it is our responsibility to contact the doula/s when we suspect that labor is beginning, and to communicate regarding our needs as labor is established. I/We understand that our doula will do their best to arrive as quickly as possible, but that it may take up to 2 hours for our doula to arrive from the point at which we request their presence.
I/We agree to the above conditions regarding fees and refunds and agree to pay for any additional services that are requested beyond the labor support package.
Client name: {{t:t;r:y;o:"Signer 1";l:"Client Name";}}
Client Signature: {{t:s;r:y;o:"Signer 1";}}
Date: {{t:d;r:y;o:"Signer 1";}}
INFORMATION DISCLOSURE
I give my permission for my doula to take notes about me, including personal information I choose to disclose to them, and information regarding the labor, birth, and the postpartum period pertaining to myself and my child(ren). I understand that this information will be securely stored as part of my client record at Sokana Collective and that the doula may use this information to provide me with a summary for my own personal use.
Initials: {{t:t;r:y;o:"Signer 1";l:"Initials";}}`;

    // Save as a text file first
    const textFilePath = './Labor Support Agreement with Tags.txt';
    fs.writeFileSync(textFilePath, templateContent);
    console.log(`✅ Template saved as text file: ${textFilePath}`);

    // Also save as a simple HTML file that can be converted to DOCX
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Labor Support Agreement for Service</title>
</head>
<body>
    <pre>${templateContent.replace(/\n/g, '<br>')}</pre>
</body>
</html>`;

    const htmlFilePath = './Labor Support Agreement with Tags.html';
    fs.writeFileSync(htmlFilePath, htmlContent);
    console.log(`✅ Template saved as HTML file: ${htmlFilePath}`);

    console.log('📋 Text Tags included:');
    console.log('- {{t:t;r:y;o:"Signer 1";l:"Total Amount";}}');
    console.log('- {{t:t;r:y;o:"Signer 1";l:"Deposit Amount";}}');
    console.log('- {{t:t;r:y;o:"Signer 1";l:"Balance Amount";}}');
    console.log('- {{t:t;r:y;o:"Signer 1";l:"Client Name";}}');
    console.log('- {{t:s;r:y;o:"Signer 1";}}');
    console.log('- {{t:d;r:y;o:"Signer 1";}}');
    console.log('- {{t:t;r:y;o:"Signer 1";l:"Initials";}}');

    console.log('\n📝 Next steps:');
    console.log('1. Open the HTML file in a browser');
    console.log('2. Copy the content and paste it into a Word document');
    console.log('3. Save as DOCX');
    console.log('4. Upload to SignNow');
  } catch (error) {
    console.error('❌ Error creating template:', error.message);
  }
}

createTemplateWithTags();





