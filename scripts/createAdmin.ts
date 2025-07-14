import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false
  }
});

async function createAdminUser(email: string, firstname: string, lastname: string) {
  const password = 'YourSecurePassword123!'; // Change this!
  
  try {
    // 1. Create user in auth.users with admin privileges
    console.log(`Creating auth user for ${email}...`);
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Skip email verification
      user_metadata: { role: 'admin' }
    });

    if (authError) throw authError;
    console.log('Auth user created:', authUser.user.id);

    // 2. Create user in your custom users table
    console.log('Creating user record...');
    const { data: customUser, error: customError } = await supabase
      .from('users')
      .insert({
        id: authUser.user.id, // Use the same UUID
        email,
        role: 'admin',
        account_status: 'active',
        firstname,
        lastname
      })
      .select()
      .single();

    if (customError) throw customError;
    console.log('User record created:', customUser);

    console.log('\nAdmin user created successfully! ✅');
    console.log('Email:', email);
    console.log('Password:', password);
    
  } catch (error) {
    console.error('Error creating admin user:', error);
  }
}

async function createAllAdmins() {
  const admins = [
    {
      email: 'nancy@sokanacollective.com',
      firstname: 'Nancy',
      lastname: 'Collective'
    },
    {
      email: 'sonia@sokanacollective.com',
      firstname: 'Sonia',
      lastname: 'Collective'
    }
  ];

  for (const admin of admins) {
    console.log(`\nProcessing ${admin.email}...`);
    await createAdminUser(admin.email, admin.firstname, admin.lastname);
  }

  process.exit(0);
}

createAllAdmins(); 