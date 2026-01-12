import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://qizyzlwappfhdfuaotmi.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpenl6bHdhcHBmaGRmdWFvdG1pIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODE0ODUyNSwiZXhwIjoyMDgzNzI0NTI1fQ.5DJUJFu5_O6J-MfBjBA3Hi9WGVUajRTgxSy4RTRQc7o';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function monitorLatest() {
    console.log('--- Checking for latest thread ---');
    const { data, error } = await supabase
        .from('threads')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1);

    if (error) {
        console.error('Error fetching thread:', error);
        return;
    }

    if (!data || data.length === 0) {
        console.log('No threads found.');
        return;
    }

    const thread = data[0];
    console.log(`ID: ${thread.id}`);
    console.log(`Created At: ${thread.created_at}`);
    console.log(`Scheduled Time: ${thread.scheduled_time}`);
    console.log(`Status: ${thread.status}`);
    console.log(`Error Message: ${thread.error_message || 'N/A'}`);

    // Check if it looks like the one the user just made (e.g. created in last 5 mins)
    const createdTime = new Date(thread.created_at).getTime();
    const now = Date.now();
    const minutesAgo = (now - createdTime) / 1000 / 60;

    if (minutesAgo < 10) {
        console.log('>> This appears to be a recently created thread.');
    } else {
        console.log('>> This thread is older than 10 minutes. Waiting for new post...');
    }
}

monitorLatest();
