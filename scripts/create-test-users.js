const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Put your real logged-in owner/admin email here.
const OWNER_EMAIL = "soudkhan82@gmail.com";

const testUsers = [
  {
    email: "test.owner@workspora.local",
    password: "Test@123456",
    full_name: "Test Owner",
    role: "owner",
  },
  {
    email: "test.admin@workspora.local",
    password: "Test@123456",
    full_name: "Test Admin",
    role: "admin",
  },
  {
    email: "test.member1@workspora.local",
    password: "Test@123456",
    full_name: "Test Member One",
    role: "member",
  },
  {
    email: "test.member2@workspora.local",
    password: "Test@123456",
    full_name: "Test Member Two",
    role: "member",
  },
];

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function getOwnerUserId() {
  const { data, error } = await supabase.auth.admin.listUsers();

  if (error) throw error;

  const owner = data.users.find((u) => u.email === OWNER_EMAIL);

  if (!owner) {
    throw new Error(`Owner user not found in Supabase Auth: ${OWNER_EMAIL}`);
  }

  return owner.id;
}

async function getWorkspaceId(ownerUserId) {
  const { data, error } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", ownerUserId)
    .in("role", ["owner", "admin"])
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  if (!data?.workspace_id) {
    throw new Error("No active workspace found for owner/admin user.");
  }

  return data.workspace_id;
}

async function upsertProfile(userId, fullName, email) {
  const { error } = await supabase.from("profiles").upsert(
    {
      id: userId,
      full_name: fullName,
      email,
    },
    {
      onConflict: "id",
    },
  );

  if (error) {
    console.warn(`Profile upsert skipped/failed for ${email}:`, error.message);
  }
}

async function upsertWorkspaceMember(userId, workspaceId, role) {
  const { error } = await supabase.from("workspace_members").upsert(
    {
      user_id: userId,
      workspace_id: workspaceId,
      role,
      status: "active",
    },
    {
      onConflict: "workspace_id,user_id",
    },
  );

  if (error) throw error;
}

async function createOrUpdateAuthUser(user) {
  const { data: existingUsers, error: listError } =
    await supabase.auth.admin.listUsers();

  if (listError) throw listError;

  const existing = existingUsers.users.find((u) => u.email === user.email);

  if (existing) {
    const { data, error } = await supabase.auth.admin.updateUserById(
      existing.id,
      {
        password: user.password,
        email_confirm: true,
        user_metadata: {
          full_name: user.full_name,
        },
      },
    );

    if (error) throw error;

    return data.user;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email: user.email,
    password: user.password,
    email_confirm: true,
    user_metadata: {
      full_name: user.full_name,
    },
  });

  if (error) throw error;

  return data.user;
}

async function main() {
  console.log("Finding owner user...");
  const ownerUserId = await getOwnerUserId();

  console.log("Finding workspace...");
  const workspaceId = await getWorkspaceId(ownerUserId);

  console.log("Workspace ID:", workspaceId);

  for (const testUser of testUsers) {
    console.log(`Creating/updating ${testUser.email}...`);

    const authUser = await createOrUpdateAuthUser(testUser);

    await upsertProfile(authUser.id, testUser.full_name, testUser.email);

    await upsertWorkspaceMember(authUser.id, workspaceId, testUser.role);

    console.log(`Done: ${testUser.email} / ${testUser.password}`);
  }

  console.log("\nTest users ready:");
  for (const user of testUsers) {
    console.log(`${user.email} | ${user.password} | ${user.role}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
