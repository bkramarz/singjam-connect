-- Migration 009: seed genres, themes, cultures, and religious traditions

insert into public.genres (name) values
  ('Acoustic'),('Afrobeats'),('Afropop'),('Alternative'),('Ambient'),
  ('Americana'),('Art Rock'),('Bluegrass'),('Blues'),('Bossa Nova'),
  ('Cabaret'),('Cajun'),('Celtic'),('Chanson'),('Children''s'),
  ('Christian'),('Classical'),('Contemporary Christian'),('Country'),
  ('Country Rock'),('Dance'),('Disco'),('Doo-Wop'),('Dream Pop'),
  ('Drum and Bass'),('Electronic'),('Emo'),('Experimental'),('Flamenco'),
  ('Folk'),('Folk Rock'),('Funk'),('Gospel'),('Glam Rock'),('Grunge'),
  ('Hard Rock'),('Heavy Metal'),('Hip-Hop'),('Holiday'),('House'),
  ('Hymns'),('Indie'),('Jazz'),('Klezmer'),('Latin'),('Metal'),
  ('Motown'),('Musical Theatre'),('New Age'),('New Wave'),('Opera'),
  ('Outlaw Country'),('Pop'),('Post-Punk'),('Post-Rock'),('Progressive Rock'),
  ('Protest Songs'),('Psychedelic'),('Punk'),('R&B'),('Rap'),('Reggae'),
  ('Rockabilly'),('Rock'),('Salsa'),('Shanties'),('Shoegaze'),('Singer-Songwriter'),
  ('Ska'),('Soul'),('Spiritual'),('Surf Rock'),('Synthpop'),('Tango'),
  ('Techno'),('Traditional'),('Trance'),('Trap'),('Western Swing'),
  ('Work Songs'),('World'),('Worship'),('Zydeco')
on conflict (name) do nothing;


insert into public.themes (name) values
  ('Addiction'),('Adventure'),('Aging'),('Betrayal'),('Celebration'),
  ('Childhood'),('City Life'),('Coming of Age'),('Community'),('Courage'),
  ('Dancing'),('Death'),('Drinking'),('Dreams'),('Exile'),
  ('Faith'),('Family'),('Fantasy'),('Fatherhood'),('Fear'),
  ('Forgiveness'),('Freedom'),('Friendship'),('Grief'),('History'),
  ('Home'),('Hope'),('Humor'),('Identity'),('Immigration'),
  ('Isolation'),('Joy'),('Justice'),('Labor'),('Longing'),
  ('Loss'),('Love'),('Memory'),('Motherhood'),('Music'),
  ('Mythology'),('Nature'),('Nostalgia'),('Peace'),('Politics'),
  ('Poverty'),('Pride'),('Race'),('Rebellion'),('Redemption'),
  ('Religion'),('Resistance'),('Romance'),('Rural Life'),('Satire'),
  ('Sea'),('Seasons'),('Shame'),('Spirituality'),('Storytelling'),
  ('Struggle'),('Time'),('Travel'),('Unity'),('War'),
  ('Wealth'),('Work'),('Youth')
on conflict (name) do nothing;


insert into public.cultures (name) values
  ('Aboriginal Australian'),('African American'),('Appalachian'),('Arab'),
  ('Argentine'),('Australian'),('Bangladeshi'),('Belgian'),('Brazilian'),
  ('British'),('Cajun'),('Cambodian'),('Chilean'),('Chinese'),
  ('Colombian'),('Creole'),('Cuban'),('Czech'),('Danish'),
  ('Dutch'),('East African'),('Egyptian'),('Ethiopian'),('Filipino'),
  ('Finnish'),('First Nations'),('French'),('German'),('Ghanaian'),
  ('Greek'),('Haitian'),('Hawaiian'),('Hungarian'),('Indian'),
  ('Indonesian'),('Irish'),('Israeli'),('Italian'),('Jamaican'),
  ('Japanese'),('Jewish'),('Kenyan'),('Korean'),('Latin American'),
  ('Māori'),('Mexican'),('Native American'),('Nepali'),('Nigerian'),
  ('Norwegian'),('Pakistani'),('Peruvian'),('Polish'),('Portuguese'),
  ('Puerto Rican'),('Romanian'),('Romani'),('Russian'),('Scandinavian'),
  ('Scottish'),('South African'),('Spanish'),('Sri Lankan'),
  ('Swedish'),('Swiss'),('Tex-Mex'),('Thai'),('Trinidadian'),
  ('Turkish'),('Ukrainian'),('Venezuelan'),('Vietnamese'),
  ('Welsh'),('West African'),('Yoruba'),('Zulu')
on conflict (name) do nothing;


insert into public.traditions (name) values
  ('African Traditional'),('Amish'),('Anglican'),('Baptist'),
  ('Buddhist'),('Catholic'),('Celtic Pagan'),('Christian'),
  ('Coptic'),('Eastern Orthodox'),('Ethiopian Orthodox'),
  ('Evangelical'),('Gospel'),('Gregorian'),('Hindu'),
  ('Indigenous'),('Islamic'),('Jewish'),('Liturgical'),
  ('Lutheran'),('Methodist'),('Mormon'),('Pentecostal'),
  ('Presbyterian'),('Protestant'),('Quaker'),('Rastafarian'),
  ('Secular'),('Seventh-day Adventist'),('Shaker'),('Sikh'),
  ('Spiritual'),('Sufi'),('Unitarian Universalist')
on conflict (name) do nothing;
