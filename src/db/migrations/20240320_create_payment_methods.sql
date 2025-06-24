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

-- Index for faster lookups
create index payment_methods_customer_id_idx on payment_methods(customer_id);

-- Trigger to update updated_at timestamp
create or replace function update_updated_at_column()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language 'plpgsql';

create trigger update_payment_methods_updated_at
    before update on payment_methods
    for each row
    execute procedure update_updated_at_column(); 