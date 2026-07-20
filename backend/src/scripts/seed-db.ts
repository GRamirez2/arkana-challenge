import { seedDatabaseFromCsv } from '../diabetes-store.js';

async function main() {
  const result = await seedDatabaseFromCsv({ reset: true });

  console.log(`Seeded ${result.rowCount} rows into PostgreSQL.`);
}

try {
  await main();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
