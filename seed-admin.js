import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vusgubstapwuhzrdxysz.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ1c2d1YnN0YXB3dWh6cmR4eXN6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjEzNzkxOCwiZXhwIjoyMDg3NzEzOTE4fQ.ey5wtCxJt8s4liSVjx4P61ErKhMJBRbJThBA5kSSZxE';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function seedAdmin() {
    console.log('Seeding admin user...');
    const { data, error } = await supabase.auth.admin.createUser({
        email: 'admin@vaazhai.com',
        password: 'adminpassword',
        email_confirm: true,
        user_metadata: { role: 'admin', full_name: 'Admin' }
    });

    if (error) {
        if (error.message.includes('already exists') || error.message.includes('User already registered')) {
            console.log('Admin user already exists. Checking metadata...');
            const { data: users, error: listError } = await supabase.auth.admin.listUsers();
            if (listError) console.error(listError);
            else {
                const adminUser = users.users.find(u => u.email === 'admin@vaazhai.com');
                if (adminUser) {
                    const { data: updateData, error: updateError } = await supabase.auth.admin.updateUserById(adminUser.id, {
                        user_metadata: { role: 'admin', full_name: 'Admin' },
                        password: 'adminpassword',
                        email_confirm: true
                    });
                    if (updateError) console.error('Error updating admin:', updateError);
                    else console.log('Admin user updated successfully.');
                }
            }
        } else {
            console.error('Error creating admin user:', error.message);
        }
    } else {
        console.log('Admin user created successfully:', data.user.email);
    }
}

seedAdmin();
