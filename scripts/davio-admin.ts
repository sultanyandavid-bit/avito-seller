import { db } from "../lib/davio/server/db";
const [email, action] = process.argv.slice(2);
if (!email || !["grant", "revoke"].includes(action)) {
  console.error(
    "Использование: npm run admin -- user@example.com grant|revoke",
  );
  process.exit(1);
}
const result = db()
  .prepare("UPDATE users SET role=? WHERE email=?")
  .run(action === "grant" ? "admin" : "user", email.toLowerCase());
if (!result.changes) {
  console.error(
    "Пользователь не найден. Сначала зарегистрируйте локальный аккаунт.",
  );
  process.exit(1);
}
console.log("Роль локального пользователя обновлена.");
