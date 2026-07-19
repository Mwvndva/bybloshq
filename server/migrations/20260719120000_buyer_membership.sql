-- Byblos membership card.
-- Buyers can opt in to become a "Byblos member" and receive a scarce, monotonic
-- membership number that is minted at opt-in time (NOT at signup) so that
-- "No. 000417" genuinely means the 417th person to become a member.
CREATE SEQUENCE IF NOT EXISTS byblos_member_seq START WITH 1 INCREMENT BY 1;

ALTER TABLE buyers
  ADD COLUMN IF NOT EXISTS is_member BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS member_number INTEGER,
  ADD COLUMN IF NOT EXISTS membership_joined_at TIMESTAMP WITH TIME ZONE;

-- One number per member; NULL for the many buyers who never opt in
-- (partial unique index keeps non-members from colliding on NULL).
CREATE UNIQUE INDEX IF NOT EXISTS buyers_member_number_key
  ON buyers (member_number) WHERE member_number IS NOT NULL;
