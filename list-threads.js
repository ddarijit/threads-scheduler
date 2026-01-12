import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://qizyzlwappfhdfuaotmi.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpenl6bHdhcHBmaGRmdWFvdG1pIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODE0ODUyNSwiZXhwIjoyMDgzNzI0NTI1fQ.5DJUJFu5_O6J-MfBjBA3Hi9WGVUajRTgxSy4RTRQc7o';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function listRecent() {
    console.log('--- Recent Threads ---');
    const { data, error } = await supabase
        .from('threads')
        .select('id, status, scheduled_time, error_message, created_at')
        .order('created_at', { ascending: false })
        .limit(5);

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.table(data);
}

listRecent();
