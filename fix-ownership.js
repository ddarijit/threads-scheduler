import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://qizyzlwappfhdfuaotmi.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpenl6bHdhcHBmaGRmdWFvdG1pIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODE0ODUyNSwiZXhwIjoyMDgzNzI0NTI1fQ.5DJUJFu5_O6J-MfBjBA3Hi9WGVUajRTgxSy4RTRQc7o';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const TARGET_USER_ID = '50812863-a4b9-4f7f-893b-94dbe886a98d'; // arijitdasfilm@gmail.com

async function fixOwnership() {
    console.log(`Reassigning all threads to user: ${TARGET_USER_ID}...`);

    const { data, error } = await supabase
        .from('threads')
        .update({ user_id: TARGET_USER_ID })
        .neq('user_id', TARGET_USER_ID)
        .select();

    if (error) {
        console.error('Error updating threads:', error);
    } else {
        console.log(`Success! Reassigned ${data.length} threads.`);
    }
}

fixOwnership();
