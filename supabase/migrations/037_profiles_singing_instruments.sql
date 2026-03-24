ALTER TABLE profiles ADD COLUMN singing_voice text;
ALTER TABLE profiles ADD COLUMN instrument_levels jsonb DEFAULT '{}';
