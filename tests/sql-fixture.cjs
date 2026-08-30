const fs = require("node:fs");
const { PGlite } = require("@electric-sql/pglite");
const alice = "11111111-1111-4111-8111-111111111111",
  bob = "22222222-2222-4222-8222-222222222222",
  cara = "33333333-3333-4333-8333-333333333333";
async function database() {
  const db = new PGlite();
  await db.exec(`CREATE ROLE authenticated; CREATE ROLE anon; CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY);
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$SELECT NULLIF(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 GRANT USAGE ON SCHEMA public,auth TO authenticated,anon;
 INSERT INTO auth.users VALUES('${alice}'),('${bob}'),('${cara}');`);
  for (const file of fs
    .readdirSync("supabase/migrations")
    .filter((f) => /^\d.*\.sql$/.test(f))
    .sort())
    await db.exec(
      fs
        .readFileSync("supabase/migrations/" + file, "utf8")
        .replace(/^ALTER PUBLICATION.*$/gm, ""),
    );
  await db.exec(
    `GRANT SELECT,INSERT,UPDATE,DELETE ON trips,trip_members,transactions,transaction_adjustments TO authenticated;`,
  );
  return db;
}
const as = async (db, id) => {
  await db.exec("RESET ROLE");
  await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [
    id || "",
  ]);
  await db.exec("SET ROLE authenticated");
};

module.exports = { database, as };
