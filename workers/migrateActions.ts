import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

async function migrateActions() {
  console.log('Fetching old actions from weekly_data...');
  
  // Fetch all rows where next_seo_action is not null and not empty
  const { data, error } = await supabase
    .from('weekly_data')
    .select('client_id, next_seo_action, week_start_date')
    .not('next_seo_action', 'is', null)
    .neq('next_seo_action', '');

  if (error) {
    console.error('Error fetching weekly_data:', error);
    return;
  }

  if (!data || data.length === 0) {
    console.log('No old actions found to migrate.');
    return;
  }

  console.log(`Found ${data.length} actions to migrate.`);

  // Insert into client_actions
  const insertPayload = data.map((row) => ({
    client_id: row.client_id,
    action_text: row.next_seo_action,
    // Setting deadline to null for old migrated data, or maybe end of that week
    status: 'pending',
    created_at: new Date(row.week_start_date).toISOString()
  }));

  const { error: insertError } = await supabase
    .from('client_actions')
    .insert(insertPayload);

  if (insertError) {
    console.error('Error migrating data into client_actions:', insertError);
  } else {
    console.log('Migration successful! Actions have been moved to Action Center.');
  }
}

migrateActions();
