import crypto from "node:crypto";
const secret = "super-secret-jwt-token-with-at-least-32-characters-long";
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const sign = (role) => {
  const h = b64({ alg: "HS256", typ: "JWT" });
  const p = b64({ iss: "supabase-demo", role, iat: 1700000000, exp: 2000000000 });
  const s = crypto.createHmac("sha256", secret).update(`${h}.${p}`).digest("base64url");
  return `${h}.${p}.${s}`;
};
console.log(`ANON=${sign("anon")}\nSERVICE=${sign("service_role")}`);
