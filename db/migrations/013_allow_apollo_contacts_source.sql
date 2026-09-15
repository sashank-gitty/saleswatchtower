-- No Lusha or ZoomInfo subscription on hand — Apollo.io is the real
-- contact-data provider being used going forward (see api/account-contacts.js).
-- The original CHECK only allowed the first two, so a plain ADD of a
-- constraint with the same name fails; drop and recreate it.
ALTER TABLE account_contacts DROP CONSTRAINT IF EXISTS account_contacts_source_check;
ALTER TABLE account_contacts ADD CONSTRAINT account_contacts_source_check CHECK (source IN ('lusha', 'zoominfo', 'apollo'));
