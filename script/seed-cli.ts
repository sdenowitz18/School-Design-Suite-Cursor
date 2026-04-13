/**
 * Seed default components when the DB is empty (same as POST /api/seed).
 * Usage: npm run seed  (requires DATABASE_URL in .env and schema applied: npm run db:push)
 */
import { seedDefaultComponentsIfEmpty } from "../server/seed-defaults";

async function main() {
  const result = await seedDefaultComponentsIfEmpty();
  console.log(result.message);
  if (result.components?.length) {
    console.log(`Components (${result.components.length}): ${result.components.map((c) => c.nodeId).join(", ")}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
