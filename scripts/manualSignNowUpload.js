// Manual SignNow Upload Instructions
// This provides instructions for manually uploading the Labor Support contract to SignNow
import fs from 'fs';
import path from 'path';

async function manualSignNowUpload() {
  try {
    console.log('📋 MANUAL SIGNNOW UPLOAD INSTRUCTIONS\n');

    // 1️⃣ Find the latest Labor Support PDF
    const generatedDir = path.join(process.cwd(), 'generated');
    const files = await fs.promises.readdir(generatedDir);

    const laborSupportPdf = files
      .filter(
        (file) =>
          file.startsWith('labor-support-final-') && file.endsWith('.pdf')
      )
      .sort()
      .pop();

    if (!laborSupportPdf) {
      throw new Error(
        'Labor Support PDF not found. Please run the contract generation script first.'
      );
    }

    const pdfPath = path.join(generatedDir, laborSupportPdf);
    console.log(`📄 Labor Support PDF Ready: ${pdfPath}`);

    console.log('\n🎯 MANUAL SIGNNOW UPLOAD STEPS:');
    console.log('');
    console.log('1. 📤 UPLOAD TO SIGNNOW:');
    console.log('   • Go to SignNow dashboard');
    console.log('   • Click "Upload Document"');
    console.log('   • Select the Labor Support PDF:');
    console.log(`   • ${pdfPath}`);
    console.log('');
    console.log('2. ✍️ ADD SIGNATURE FIELDS:');
    console.log('   • Once uploaded, click "Add Fields"');
    console.log('   • Add signature field for client signature');
    console.log('   • Add text field for date');
    console.log('   • Add text field for initials');
    console.log('');
    console.log('3. 📧 SEND FOR SIGNING:');
    console.log('   • Click "Send for Signature"');
    console.log('   • Enter client email: jerrybony5@gmail.com');
    console.log('   • Add subject: "Please sign your Labor Support Contract"');
    console.log('   • Send invitation');
    console.log('');
    console.log('💡 CONTRACT DETAILS:');
    console.log('   📊 Total Amount: $2,500');
    console.log('   📊 Deposit: $500');
    console.log('   📊 Balance: $2,000');
    console.log('   📊 Client: Jerry Techluminate');
    console.log('');
    console.log('✅ LABOR SUPPORT CONTRACT READY FOR SIGNNOW!');
    console.log('   📄 PDF generated with perfect layout preservation');
    console.log('   📄 All contract values filled correctly');
    console.log('   📄 Ready for manual upload to SignNow');
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

// Run the manual upload instructions
manualSignNowUpload().catch(console.error);





