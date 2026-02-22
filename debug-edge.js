async function run() {
    const { VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY } = process.env;
    const authRes = await fetch(VITE_SUPABASE_URL + '/auth/v1/token?grant_type=password', {
        method: 'POST',
        headers: { apikey: VITE_SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@vaazhai.com', password: 'vaazhai123' })
    });
    const authJson = await authRes.json();
    const token = authJson.access_token;

    const res = await fetch(VITE_SUPABASE_URL + '/functions/v1/manage-users', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create-employee', username: 'test-admin-curl@tensemi.com', password: 'password123', full_name: 'Test', department: 'Test', company: 'Tensemi', phone_number: '1234567890' })
    });
    const text = await res.text();
    console.log("RESPONSE:", res.status);
    console.log("BODY:", text);
}
run().catch(console.error);
