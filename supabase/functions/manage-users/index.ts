import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { action, ...data } = await req.json();

    if (action === "seed-admin") {
      // Check if admin already exists
      const { data: existing } = await supabase
        .from("profiles")
        .select("id")
        .eq("username", "admin@vaazhai")
        .single();

      if (existing) {
        return new Response(JSON.stringify({ message: "Admin already exists" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: user, error } = await supabase.auth.admin.createUser({
        email: "admin@vaazhai.com",
        password: "vaazhai123",
        email_confirm: true,
        user_metadata: {
          full_name: "Admin",
          username: "admin@vaazhai",
          role: "admin",
          department: "Management",
        },
      });

      if (error) throw error;

      return new Response(JSON.stringify({ message: "Admin created", user }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "create-employee") {
      // Verify caller is admin
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) throw new Error("Not authenticated");

      const token = authHeader.replace("Bearer ", "");
      const { data: { user: caller } } = await supabase.auth.getUser(token);
      if (!caller) throw new Error("Not authenticated");

      const { data: callerRole } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", caller.id)
        .eq("role", "admin")
        .single();

      if (!callerRole) throw new Error("Not authorized");

      const { full_name, username, password, department, joining_date, company, phone_number } = data;

      // Create auth user
      const { data: newUser, error } = await supabase.auth.admin.createUser({
        email: `${username.replace(/[^a-zA-Z0-9]/g, '')}@vaazhai.emp`,
        password,
        email_confirm: true,
        user_metadata: {
          full_name,
          username,
          role: "employee",
          department,
          joining_date,
          company,
          phone_number,
        },
      });

      if (error) throw error;

      // Explicitly update profile to ensure new fields are set
      if (newUser.user) {
        const { error: profileError } = await supabase
          .from("profiles")
          .update({ company, phone_number })
          .eq("id", newUser.user.id);

        if (profileError) {
          console.error("Error updating profile with extra fields:", profileError);
          // We don't throw here to avoid failing the whole creation if just metadata sync fails, 
          // but ideally we should ensuring consistency.
        }
      }

      return new Response(JSON.stringify({ message: "Employee created", user: newUser }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "update-employee") {
      // Verify caller is admin
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) throw new Error("Not authenticated");

      const token = authHeader.replace("Bearer ", "");
      const { data: { user: caller } } = await supabase.auth.getUser(token);
      if (!caller) throw new Error("Not authenticated");

      const { data: callerRole } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", caller.id)
        .eq("role", "admin")
        .single();

      if (!callerRole) throw new Error("Not authorized");

      const { id, full_name, department, joining_date, company, phone_number } = data;

      // Update auth user metadata
      const { data: user, error } = await supabase.auth.admin.updateUserById(id, {
        user_metadata: {
          full_name,
          department,
          joining_date,
          company,
          phone_number,
        },
      });

      if (error) throw error;

      // Update profile table
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ full_name, department, joining_date, company, phone_number })
        .eq("id", id);

      if (profileError) throw profileError;

      return new Response(JSON.stringify({ message: "Employee updated", user }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete-employee") {
      // Verify caller is admin
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) throw new Error("Not authenticated");

      const token = authHeader.replace("Bearer ", "");
      const { data: { user: caller } } = await supabase.auth.getUser(token);
      if (!caller) throw new Error("Not authenticated");

      const { data: callerRole } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", caller.id)
        .eq("role", "admin")
        .single();

      if (!callerRole) throw new Error("Not authorized");

      const { id } = data;

      // Delete auth user
      const { error } = await supabase.auth.admin.deleteUser(id);

      if (error) throw error;

      return new Response(JSON.stringify({ message: "Employee deleted" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
