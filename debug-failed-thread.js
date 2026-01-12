import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://qizyzlwappfhdfuaotmi.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpenl6bHdhcHBmaGRmdWFvdG1pIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODE0ODUyNSwiZXhwIjoyMDgzNzI0NTI1fQ.5DJUJFu5_O6J-MfBjBA3Hi9WGVUajRTgxSy4RTRQc7o';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkStuckThreads() {
    const { data, error } = await supabase
        .from('threads')
        .select('*')
        .in('status', ['publishing', 'scheduled', 'failed'])
        .order('scheduled_time', { ascending: false });

    if (error) {
        console.error('Error fetching threads:', error);
        return;
    }

    console.log('Found threads:', data?.length);
    data?.forEach(t => {
        console.log(`- ID: ${t.id}, Status: ${t.status}, Time: ${t.scheduled_time}`);
        // Check if error_message exists in the returned object (even if select * returned it, or if it's missing)
        console.log(`  Error Message: ${t.error_message}`);
    });
}

checkStuckThreads();
