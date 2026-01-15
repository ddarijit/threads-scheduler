import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://qizyzlwappfhdfuaotmi.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpenl6bHdhcHBmaGRmdWFvdG1pIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODE0ODUyNSwiZXhwIjoyMDgzNzI0NTI1fQ.5DJUJFu5_O6J-MfBjBA3Hi9WGVUajRTgxSy4RTRQc7o';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkCounts() {
    console.log('Fetching all thread statuses...');
    // We select * because sometimes RLS or other policies might behave differently on just 'status' if policies are row-based
    // But status should be fine. Using count for efficiency if needed, but here simple reduce is fine for small data.
    const { data: allData, error } = await supabase.from('threads').select('status');

    if (error) {
        console.error('Error fetching data:', error);
        return;
    }

    if (!allData || allData.length === 0) {
        console.log('No threads found in database.');
        return;
    }

    const counts = allData.reduce((acc, curr) => {
        acc[curr.status] = (acc[curr.status] || 0) + 1;
        return acc;
    }, {});
    console.log('--- Total Counts in Database ---');
    console.table(counts);
}

checkCounts();
