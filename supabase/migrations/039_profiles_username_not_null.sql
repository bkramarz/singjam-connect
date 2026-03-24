-- Fill any existing null usernames with a unique fallback derived from the user id
UPDATE profiles SET username = 'user_' || substr(replace(id::text, '-', ''), 1, 12) WHERE username IS NULL;

ALTER TABLE profiles ALTER COLUMN username SET NOT NULL;
