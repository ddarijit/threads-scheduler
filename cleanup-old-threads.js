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

async function cleanupOldThreads() {
    console.log('Starting cleanup of old "published" and "failed" threads...');

    // 1. Get IDs to delete (for logging)
    const { data: threadsToDelete, error: fetchError } = await supabase
        .from('threads')
        .select('id, status')
        .in('status', ['published', 'failed']);

    if (fetchError) {
        console.error('Error fetching threads:', fetchError);
        return;
    }

    const count = threadsToDelete?.length || 0;
    if (count === 0) {
        console.log('No threads to clean up.');
        return;
    }

    console.log(`Found ${count} threads to delete.`);

    // 2. Delete them
    const { error: deleteError } = await supabase
        .from('threads')
        .delete()
        .in('status', ['published', 'failed']);

    if (deleteError) {
        console.error('Error deleting threads:', deleteError);
    } else {
        console.log(`Successfully deleted ${count} threads.`);
    }
}

cleanupOldThreads();
