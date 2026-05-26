import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables (Make sure to run this script from the project root)
dotenv.config();

const supabaseUrl = (process.env.VITE_SUPABASE_URL || 'https://pzjfqrvmwlwfrtgojejl.supabase.co')
  .replace(/\/$/, '')
  .replace(/\/rest\/v1$/, '')
  .replace(/\/auth\/v1$/, '');
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB6amZxcnZtd2x3ZnJ0Z29qZWpsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzQ4MDM0OSwiZXhwIjoyMDkzMDU2MzQ5fQ.a1ZhMrPLvhNRyJwsMGTupveV9rU0Gz_5qywuXipOuFI';

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Adjust PORT if your backend is running on a different port
const BACKEND_URL = process.env.APP_URL || 'http://localhost:3000';

function getCurrentWeekStartDate(): string {
  const now = new Date();
  // Set to Monday of the current week (assuming weekStartsOn: 1)
  const day = now.getDay() || 7; 
  if (day !== 1) {
    now.setHours(-24 * (day - 1));
  }
  return now.toISOString().split('T')[0];
}

async function syncAllClients() {
  console.log(`[${new Date().toISOString()}] Starting Background Sync...`);
  const weekStart = getCurrentWeekStartDate();
  console.log(`[${new Date().toISOString()}] Target Week Start: ${weekStart}`);

  try {
    // 1. Fetch all clients
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('*');

    if (clientsError) throw clientsError;
    if (!clients || clients.length === 0) {
      console.log('No clients found. Exiting.');
      return;
    }

    // 2. Loop through each client and sync
    for (const client of clients) {
      console.log(`\nSyncing Client: ${client.name} (${client.id})`);
      try {
        // We'll calculate the 7-day range for live metrics matching what getLiveMetrics does in frontend.
        // Or we can use the sync-weekly-data endpoint which takes weekStart.
        const endpoint = `${BACKEND_URL}/api/clients/${client.id}/sync-weekly-data?weekStart=${weekStart}`;
        
        const response = await fetch(endpoint, { method: 'POST' });
        const data = await response.json() as any;

        if (!response.ok) {
          throw new Error(data.error || 'Unknown API Error');
        }

        console.log(`  -> Fetched Metrics: Clicks=${data.gsc_clicks}, Traffic=${data.ga4_traffic}`);

        // 3. Upsert into weekly_data table
        const { error: upsertError } = await supabase
          .from('weekly_data')
          .upsert(
            {
              client_id: client.id,
              week_start_date: weekStart,
              gsc_clicks: data.gsc_clicks,
              gsc_impressions: data.gsc_impressions,
              gsc_ctr: data.gsc_ctr,
              gsc_position: data.gsc_position,
              ga4_traffic: data.ga4_traffic,
              ga4_new_users: data.ga4_new_users,
              ga4_returning_users: data.ga4_returning_users
            },
            { onConflict: 'client_id, week_start_date' }
          );

        if (upsertError) {
          console.error(`  -> Failed to UPSERT weekly_data:`, upsertError.message);
        } else {
          console.log(`  -> Successfully updated DB for ${client.name}`);
        }

      } catch (err: any) {
        console.error(`  -> Failed to sync ${client.name}:`, err.message);
      }
    }

    // 4. Trigger the new Monthly Cache Sync
    console.log(`\n[${new Date().toISOString()}] Triggering Monthly Cache Sync...`);
    try {
      const monthlyRes = await fetch(`${BACKEND_URL}/api/cron/sync-monthly-cache`);
      if (monthlyRes.ok) {
        console.log(`  -> Monthly Cache Sync completed successfully!`);
      } else {
        console.error(`  -> Monthly Cache Sync returned status ${monthlyRes.status}`);
      }
    } catch (monthlyErr: any) {
      console.error(`  -> Failed to trigger Monthly Cache Sync:`, monthlyErr.message);
    }

    console.log(`\n[${new Date().toISOString()}] Background Sync Complete!`);
  } catch (error: any) {
    console.error('Fatal Error during background sync:', error);
  }
}

// Execute the sync
syncAllClients();
