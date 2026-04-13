/**
 * If .env is missing but .env.example exists, copy it so local dev has a template.
 * Set DATABASE_URL to your Postgres connection string.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const envPath = path.join(root, ".env");
const examplePath = path.join(root, ".env.example");

if (!fs.existsSync(envPath) && fs.existsSync(examplePath)) {
  fs.copyFileSync(examplePath, envPath);
  console.log("Created .env from .env.example — set DATABASE_URL to your Postgres database.");
} else if (fs.existsSync(envPath)) {
  console.log(".env already exists.");
} else {
  console.warn("No .env.example found; create .env with DATABASE_URL manually.");
}
