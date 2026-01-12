import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://qizyzlwappfhdfuaotmi.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpenl6bHdhcHBmaGRmdWFvdG1pIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODE0ODUyNSwiZXhwIjoyMDgzNzI0NTI1fQ.5DJUJFu5_O6J-MfBjBA3Hi9WGVUajRTgxSy4RTRQc7o';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function inspectStuck() {
    const { data } = await supabase
        .from('threads')
        .select('*')
        .eq('id', '06736704-efd0-4998-851c-02766194c1d3')
        .single();

    console.log(JSON.stringify(data, null, 2));
}

inspectStuck();
