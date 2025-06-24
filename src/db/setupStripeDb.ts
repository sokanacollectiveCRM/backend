import supabase from '../supabase';

async function setupStripeDb() {
  const sql = `
    -- First, create the update_updated_at_column function if it doesn't exist
    create or replace function update_updated_at_column()
    returns trigger as $$
    begin
        new.updated_at = now();
        return new;
    end;
    $$ language 'plpgsql';

    -- Drop existing objects if they exist
    drop trigger if exists update_payment_methods_updated_at on payment_methods;
    drop trigger if exists update_charges_updated_at on charges;
    drop table if exists charges;
    drop table if exists payment_methods;

    -- Create payment_methods table
    create table payment_methods (
      id uuid default uuid_generate_v4() primary key,
      customer_id uuid references customers(id) not null,
      stripe_payment_method_id text not null,
      card_last4 text not null,
      card_brand text not null,
      card_exp_month integer not null,
      card_exp_year integer not null,
      is_default boolean default false,
      created_at timestamp with time zone default now(),
      updated_at timestamp with time zone default now()
    );

    -- Create charges table
    create table charges (
      id uuid default uuid_generate_v4() primary key,
      customer_id uuid references customers(id) not null,
      payment_method_id uuid references payment_methods(id) not null,
      stripe_payment_intent_id text not null,
      amount integer not null,  -- Amount in cents
      status text not null,    -- 'succeeded', 'failed', etc.
      description text,
      created_at timestamp with time zone default now(),
      updated_at timestamp with time zone default now()
    );

    -- Create indexes
    create index if not exists payment_methods_customer_id_idx on payment_methods(customer_id);
    create index if not exists charges_customer_id_idx on charges(customer_id);
    create index if not exists charges_payment_method_id_idx on charges(payment_method_id);

    -- Create triggers
    create trigger update_payment_methods_updated_at
        before update on payment_methods
        for each row
        execute procedure update_updated_at_column();

    create trigger update_charges_updated_at
        before update on charges
        for each row
        execute procedure update_updated_at_column();
  `;

  try {
    const { error } = await supabase.rpc('exec_sql', { sql });
    if (error) throw error;
    console.log('Successfully set up Stripe database tables');
  } catch (error) {
    console.error('Error setting up Stripe database:', error);
    throw error;
  }
}

// Run the setup
setupStripeDb().catch(console.error); 