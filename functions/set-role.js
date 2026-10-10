import { applicationDefault, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

initializeApp({ credential: applicationDefault(), projectId: "lmsupana" });

const [uid, role] = process.argv.slice(2);
if (!uid || !["supervisor", "admin", "none"].includes(role)) {
  console.error("Uso: npm run set-role -- <UID> supervisor|admin|none");
  process.exit(1);
}

const auth = getAuth();
const user = await auth.getUser(uid);
const claims = { ...(user.customClaims ?? {}) };
if (role === "none") delete claims.role;
else claims.role = role;
await auth.setCustomUserClaims(uid, claims);
await auth.revokeRefreshTokens(uid);
console.log(`Rol ${role} aplicado a ${uid}. La persona deberá volver a iniciar sesión.`);
