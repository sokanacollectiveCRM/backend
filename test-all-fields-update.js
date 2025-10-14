require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function testAllFieldsUpdate() {
  console.log('🧪 TESTING ALL 65+ FIELDS UPDATE\n');
  console.log('=' .repeat(80));

  // First, let's get a client to update
  const { data: clients, error: fetchError } = await supabase
    .from('client_info')
    .select('*')
    .limit(1);

  if (fetchError || !clients || clients.length === 0) {
    console.error('❌ No clients found to test:', fetchError);
    return;
  }

  const testClient = clients[0];
  console.log(`\n📋 Testing with client: ${testClient.firstname} ${testClient.lastname} (${testClient.id})\n`);

  // Prepare update data with ALL fields from all 10 sections
  const updateData = {
    // ===== SECTION 1: CLIENT DETAILS =====
    firstname: 'Updated First',
    lastname: 'Updated Last',
    email: 'updated@test.com',
    phone_number: '555-9999',
    preferred_contact_method: 'Email', // NEW
    preferred_name: 'Preferred Name', // NEW
    pronouns: 'They/Them',
    pronouns_other: 'Custom Pronouns',
    children_expected: '2',

    // ===== SECTION 2: HOME DETAILS =====
    address: '999 Test Street',
    city: 'Test City',
    state: 'CA',
    zip_code: '90210',
    home_phone: '555-1111',
    home_type: 'House',
    home_access: 'Front door - ring bell',
    pets: 'Two cats and a dog',

    // ===== SECTION 3: FAMILY MEMBERS =====
    relationship_status: 'Married',
    first_name: 'Partner First',
    last_name: 'Partner Last',
    middle_name: 'Partner Middle',
    mobile_phone: '555-2222',
    work_phone: '555-3333',

    // ===== SECTION 4: REFERRAL =====
    referral_source: 'Friend',
    referral_name: 'Jane Doe',
    referral_email: 'jane@example.com',

    // ===== SECTION 5: HEALTH HISTORY =====
    health_history: 'Updated health history',
    allergies: 'Peanuts, shellfish',
    health_notes: 'Important health notes here',

    // ===== SECTION 6: PAYMENT INFO =====
    payment_method: 'Credit Card', // NEW
    annual_income: '$45,000-$64,999',
    service_needed: 'Labor Support',
    service_specifics: 'Overnight support needed',

    // ===== SECTION 7: PREGNANCY/BABY =====
    due_date: '2025-12-15',
    birth_location: 'Hospital',
    birth_hospital: 'Test Memorial Hospital',
    number_of_babies: 2,
    baby_name: 'Twin A and Twin B',
    baby_sex: 'Unknown',
    provider_type: 'OB',
    pregnancy_number: 3,
    hospital: 'Test Hospital',

    // ===== SECTION 8: PAST PREGNANCIES =====
    had_previous_pregnancies: true,
    previous_pregnancies_count: 2,
    living_children_count: 1,
    past_pregnancy_experience: 'Had one C-section, one natural birth',

    // ===== SECTION 9: SERVICES INTERESTED =====
    services_interested: ['Labor Support', 'Postpartum Support', 'Lactation Support'],
    service_support_details: 'Need help with breastfeeding and night care',

    // ===== SECTION 10: CLIENT DEMOGRAPHICS =====
    race_ethnicity: 'Asian/Pacific Islander',
    primary_language: 'Spanish',
    client_age_range: '26-30',
    insurance: 'Private Insurance',
    demographics_multi: ['LGBTQ+', 'First-time parent'],

    // ===== ADDITIONAL FIELDS =====
    status: 'client'
  };

  console.log('📝 Updating client with ALL fields...\n');

  // Perform the update
  const { data: updatedClient, error: updateError } = await supabase
    .from('client_info')
    .update(updateData)
    .eq('id', testClient.id)
    .select()
    .single();

  if (updateError) {
    console.error('❌ Update failed:', updateError);
    return;
  }

  console.log('✅ Update successful!\n');
  console.log('=' .repeat(80));
  console.log('\n📊 VERIFICATION - Checking all updated fields:\n');

  // Verify each section
  const sections = [
    {
      name: 'SECTION 1: CLIENT DETAILS',
      fields: [
        'firstname', 'lastname', 'email', 'phone_number',
        'preferred_contact_method', 'preferred_name', 'pronouns',
        'pronouns_other', 'children_expected'
      ]
    },
    {
      name: 'SECTION 2: HOME DETAILS',
      fields: [
        'address', 'city', 'state', 'zip_code',
        'home_phone', 'home_type', 'home_access', 'pets'
      ]
    },
    {
      name: 'SECTION 3: FAMILY MEMBERS',
      fields: [
        'relationship_status', 'first_name', 'last_name',
        'middle_name', 'mobile_phone', 'work_phone'
      ]
    },
    {
      name: 'SECTION 4: REFERRAL',
      fields: ['referral_source', 'referral_name', 'referral_email']
    },
    {
      name: 'SECTION 5: HEALTH HISTORY',
      fields: ['health_history', 'allergies', 'health_notes']
    },
    {
      name: 'SECTION 6: PAYMENT INFO',
      fields: [
        'payment_method', 'annual_income',
        'service_needed', 'service_specifics'
      ]
    },
    {
      name: 'SECTION 7: PREGNANCY/BABY',
      fields: [
        'due_date', 'birth_location', 'birth_hospital',
        'number_of_babies', 'baby_name', 'baby_sex',
        'provider_type', 'pregnancy_number', 'hospital'
      ]
    },
    {
      name: 'SECTION 8: PAST PREGNANCIES',
      fields: [
        'had_previous_pregnancies', 'previous_pregnancies_count',
        'living_children_count', 'past_pregnancy_experience'
      ]
    },
    {
      name: 'SECTION 9: SERVICES INTERESTED',
      fields: ['services_interested', 'service_support_details']
    },
    {
      name: 'SECTION 10: CLIENT DEMOGRAPHICS',
      fields: [
        'race_ethnicity', 'primary_language', 'client_age_range',
        'insurance', 'demographics_multi'
      ]
    },
    {
      name: 'ADDITIONAL FIELDS',
      fields: ['status']
    }
  ];

  let totalFields = 0;
  let successfulUpdates = 0;
  let failedUpdates = 0;

  sections.forEach(section => {
    console.log(`\n${section.name}:`);
    console.log('-'.repeat(60));

    section.fields.forEach(field => {
      totalFields++;
      const expectedValue = updateData[field];
      const actualValue = updatedClient[field];

      // Compare values (handle arrays specially)
      const matches = Array.isArray(expectedValue)
        ? JSON.stringify(expectedValue) === JSON.stringify(actualValue)
        : expectedValue === actualValue;

      if (matches) {
        console.log(`  ✅ ${field}: ${JSON.stringify(actualValue)}`);
        successfulUpdates++;
      } else {
        console.log(`  ❌ ${field}: Expected ${JSON.stringify(expectedValue)}, got ${JSON.stringify(actualValue)}`);
        failedUpdates++;
      }
    });
  });

  console.log('\n' + '='.repeat(80));
  console.log('\n📈 FINAL RESULTS:');
  console.log(`  Total fields tested: ${totalFields}`);
  console.log(`  ✅ Successful updates: ${successfulUpdates}`);
  console.log(`  ❌ Failed updates: ${failedUpdates}`);
  console.log(`  📊 Success rate: ${((successfulUpdates/totalFields) * 100).toFixed(1)}%`);
  console.log('\n' + '='.repeat(80));

  if (failedUpdates === 0) {
    console.log('\n🎉 SUCCESS! All fields can be updated!\n');
  } else {
    console.log('\n⚠️  Some fields failed to update. Check the logs above.\n');
  }
}

// Run the test
testAllFieldsUpdate().catch(console.error);
