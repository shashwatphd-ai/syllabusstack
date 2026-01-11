-- Add price_known column to recommendations table
ALTER TABLE recommendations 
ADD COLUMN IF NOT EXISTS price_known BOOLEAN DEFAULT false;

-- Backfill: URLs from known platforms should have price_known = true
UPDATE recommendations
SET price_known = true
WHERE url IS NOT NULL 
  AND (url ILIKE '%coursera.org%' 
    OR url ILIKE '%udemy.com%' 
    OR url ILIKE '%edx.org%'
    OR url ILIKE '%khanacademy.org%'
    OR url ILIKE '%freecodecamp.org%'
    OR url ILIKE '%youtube.com%'
    OR url ILIKE '%ocw.mit.edu%'
    OR url ILIKE '%linkedin.com/learning%'
    OR url ILIKE '%pluralsight.com%'
    OR url ILIKE '%skillshare.com%'
    OR url ILIKE '%udacity.com%'
    OR url ILIKE '%codecademy.com%'
    OR url ILIKE '%futurelearn.com%');

-- Also mark confirmed free courses (cost_usd = 0) as price_known
UPDATE recommendations
SET price_known = true
WHERE cost_usd = 0;