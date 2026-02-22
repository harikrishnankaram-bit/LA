// @ts-ignore: Deno import
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore: Deno import
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

declare const Deno: any;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // @ts-ignore: Deno global
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || Deno.env.get("BACKEND_SUPABASE_URL")!;
    // @ts-ignore: Deno global
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.startsWith("sb_secret")
      ? Deno.env.get("BACKEND_SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      : Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    // @ts-ignore: Deno global
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Admin client to perform actions (using Service Role Key for elevated permissions)
    const supabase = createClient(supabaseUrl, serviceRoleKey);


    const { action, ...data } = await req.json();

    if (action === "debug") {
      // @ts-ignore: Deno global
      const bKey = Deno.env.get("BACKEND_SUPABASE_URL") || "";
      // @ts-ignore: Deno global
      const srKey1 = Deno.env.get("BACKEND_SUPABASE_SERVICE_ROLE_KEY") || "";
      // @ts-ignore: Deno global
      const srKey2 = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
      return new Response(JSON.stringify({
        url: bKey,
        srKey1Start: srKey1.substring(0, 10),
        srKey2Start: srKey2.substring(0, 10),
        hasServiceRole: !!srKey1,
        hasDefaultServiceRole: !!srKey2
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
      if (!authHeader) throw new Error("Auth header missing");

      // Extract the JWT (remove "Bearer " exactly)
      const token = authHeader.replace(/^Bearer\s+/i, "").trim();
      const tokenParts = token.split('.');
      if (tokenParts.length !== 3) {
        throw new Error(`Invalid JWT structure. Received: ${token.substring(0, 10)}... (parts: ${tokenParts.length})`);
      }

      let callerId;
      try {
        // Base64Url decode logic
        const base64Url = tokenParts[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function (c) {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        const payload = JSON.parse(jsonPayload);
        callerId = payload.sub;
      } catch (err: any) {
        throw new Error("Could not parse caller ID from token payload. " + err.message);
      }

      if (!callerId) throw new Error("Caller ID missing from token");

      const { data: callerRole, error: roleError } = await supabase
        .from("profiles")
        .select("role")
        .eq("user_id", callerId)
        .eq("role", "admin")
        .single();

      if (roleError || !callerRole) {
        // Fallback: check user_roles table if profiles check fails
        const { data: altCallerRole } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", callerId)
          .eq("role", "admin")
          .single();

        if (!altCallerRole) throw new Error(`Not authorized: ${roleError?.message || 'Admin role not confirmed'}`);
      }

      const { full_name, username, password, department, joining_date, company, phone_number, role = "employee" } = data;


      // Create auth user with password
      const { data: newUser, error } = await supabase.auth.admin.createUser({
        email: username,
        password: password,
        email_confirm: true,
        user_metadata: {
          full_name,
          username,
          role,
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
          .update({ company, phone_number, role })
          .eq("id", newUser.user.id);


        if (profileError) {
          console.error("Error updating profile with extra fields:", profileError);
        }
      }

      return new Response(JSON.stringify({ message: "Employee invited successfully", user: newUser }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "update-employee") {
      // Verify caller is admin
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) throw new Error("Auth header missing");

      const token = authHeader.replace(/^Bearer\s+/i, "").trim();
      const tokenParts = token.split('.');
      if (tokenParts.length !== 3) {
        throw new Error(`Invalid JWT structure. Received: ${token.substring(0, 10)}... (parts: ${tokenParts.length})`);
      }

      let callerId;
      try {
        // Base64Url decode logic
        const base64Url = tokenParts[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function (c) {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        const payload = JSON.parse(jsonPayload);
        callerId = payload.sub;
      } catch (err: any) {
        throw new Error("Could not parse caller ID from token payload. " + err.message);
      }

      if (!callerId) throw new Error("Caller ID missing from token");

      const { data: callerRole } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", callerId)
        .eq("role", "admin")
        .single();

      if (!callerRole) throw new Error("Not authorized");

      const { id, full_name, department, joining_date, company, phone_number, role } = data;

      // Update auth user metadata
      const { data: user, error } = await supabase.auth.admin.updateUserById(id, {
        user_metadata: {
          full_name,
          department,
          joining_date,
          company,
          phone_number,
          role,
        },
      });


      if (error) throw error;

      // Update profile table
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ full_name, department, joining_date, company, phone_number, role })
        .eq("id", id);


      if (profileError) throw profileError;

      return new Response(JSON.stringify({ message: "Employee updated", user }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete-employee") {
      // Verify caller is admin
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) throw new Error("Auth header missing");

      const token = authHeader.replace(/^Bearer\s+/i, "").trim();
      const tokenParts = token.split('.');
      if (tokenParts.length !== 3) {
        throw new Error(`Invalid JWT structure. Received: ${token.substring(0, 10)}... (parts: ${tokenParts.length})`);
      }

      let callerId;
      try {
        // Base64Url decode logic
        const base64Url = tokenParts[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function (c) {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        const payload = JSON.parse(jsonPayload);
        callerId = payload.sub;
      } catch (err: any) {
        throw new Error("Could not parse caller ID from token payload. " + err.message);
      }

      if (!callerId) throw new Error("Caller ID missing from token");

      const { data: callerRole } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", callerId)
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

    if (action === "reset-password") {
      // Verify caller is admin
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) throw new Error("Auth header missing");

      const token = authHeader.replace(/^Bearer\s+/i, "").trim();
      const tokenParts = token.split('.');
      if (tokenParts.length !== 3) {
        throw new Error(`Invalid JWT structure. Received: ${token.substring(0, 10)}... (parts: ${tokenParts.length})`);
      }

      let callerId;
      try {
        // Base64Url decode logic
        const base64Url = tokenParts[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function (c) {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        const payload = JSON.parse(jsonPayload);
        callerId = payload.sub;
      } catch (err: any) {
        throw new Error("Could not parse caller ID from token payload. " + err.message);
      }

      if (!callerId) throw new Error("Caller ID missing from token");
      const { data: callerRole } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", callerId)
        .eq("role", "admin")
        .single();

      if (!callerRole) throw new Error("Not authorized");

      const { id, password } = data;

      // Update auth user password
      const { error } = await supabase.auth.admin.updateUserById(id, {
        password: password
      });

      if (error) throw error;

      return new Response(JSON.stringify({ message: "Password updated successfully" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
