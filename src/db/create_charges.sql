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
create index if not exists charges_customer_id_idx on charges(customer_id);
create index if not exists charges_payment_method_id_idx on charges(payment_method_id);

-- Create trigger
create trigger update_charges_updated_at
    before update on charges
    for each row
    execute procedure update_updated_at_column(); 