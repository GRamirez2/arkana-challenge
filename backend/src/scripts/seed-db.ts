import { seedDatabaseFromCsv, seedDatabaseIfEmpty } from '../diabetes-store.js';

async function main() {
  const shouldReset = process.argv.includes('--reset');

  if (shouldReset) {
    const result = await seedDatabaseFromCsv({ reset: true });
    console.log(`Reset and seeded ${result.rowCount} rows into PostgreSQL.`);
    return;
  }

  const result = await seedDatabaseIfEmpty();
  if (result.seeded) {
    console.log(`Seeded ${result.rowCount} rows into PostgreSQL.`);
  } else {
    console.log(
      `Skipped seeding because database already has ${result.rowCount} rows.`
    );
  }
}

try {
  await main();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
