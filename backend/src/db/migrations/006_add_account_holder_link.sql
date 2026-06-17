-- Link family members to an account holder.
-- NULL = account holder; set = family member of that holder.
ALTER TABLE users
  ADD COLUMN account_holder_id UUID REFERENCES users(id) ON DELETE CASCADE;

CREATE INDEX idx_users_account_holder_id ON users (account_holder_id)
  WHERE account_holder_id IS NOT NULL;
