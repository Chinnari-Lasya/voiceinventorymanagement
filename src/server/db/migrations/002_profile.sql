-- 002_profile: prototype profile/preferences + product category.
ALTER TABLE users ADD COLUMN display_name TEXT;
ALTER TABLE users ADD COLUMN preferences TEXT CHECK (preferences IS NULL OR json_valid(preferences));
ALTER TABLE products ADD COLUMN category TEXT;

-- Categories for the seeded demo products (no-ops on a database without them).
UPDATE products SET category = 'Grains'  WHERE id = 'p-rice';
UPDATE products SET category = 'Staples' WHERE id = 'p-sugar';
UPDATE products SET category = 'Cooking' WHERE id = 'p-oil';
UPDATE products SET category = 'Pulses'  WHERE id = 'p-dal';
