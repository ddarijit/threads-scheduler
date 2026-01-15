import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
    console.error('Missing SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkThreads() {
    console.log('Checking threads table...');
    const { data, error } = await supabase
        .from('threads')
        .select('id, status, scheduled_time, content');

    if (error) {
        console.error('Error:', error);
        return;
    }

    const counts = data.reduce((acc, curr) => {
        acc[curr.status] = (acc[curr.status] || 0) + 1;
        return acc;
    }, {});

    console.log('Thread Counts by Status:', counts);

    const publishedOrFailed = data.filter(t => t.status === 'published' || t.status === 'failed');
    if (publishedOrFailed.length > 0) {
        console.log('\nWARNING: Found threads that should have been deleted (unless they are from before the fix):');
        publishedOrFailed.forEach(t => {
            console.log(`- ID: ${t.id}, Status: ${t.status}, Time: ${t.scheduled_time}`);
        });
    } else {
        console.log('\nSUCCESS: No "published" or "failed" threads found in the database.');
    }
}

checkThreads();
