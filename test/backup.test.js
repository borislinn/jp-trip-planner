import { test } from "node:test";
import assert from "node:assert/strict";
import { InMemoryRepository } from "../src/data/repository.js";
import {
  buildBackup, restoreBackup, isValidBackup,
  backupFileName, BACKUP_FORMAT
} from "../src/domain/backup.js";

async function seed(repo) {
  await repo.put("flights", { id: "f1", flightNumber: "NH7", from: "SFO", to: "KIX" });
  await repo.put("budgetEntries", { id: "b1", amount: 1500, category: "food" });
  await repo.put("settings", { id: "budget", totalBudget: 200000, currencyCode: "JPY" });
  await repo.put("meals", { id: "m1", name: "Ichiran", amount: 1500 });
}

test("buildBackup captures every store with format + version", async () => {
  const repo = new InMemoryRepository();
  await seed(repo);
  const backup = await buildBackup(repo);

  assert.equal(backup.format, BACKUP_FORMAT);
  assert.equal(backup.version, 1);
  assert.equal(typeof backup.exportedAt, "string");
  assert.equal(backup.stores.flights.length, 1);
  assert.equal(backup.stores.settings[0].totalBudget, 200000);
  assert.deepEqual(backup.stores.restaurants, []);
});

test("restoreBackup round-trips into a fresh repository", async () => {
  const source = new InMemoryRepository();
  await seed(source);
  const backup = await buildBackup(source);

  const target = new InMemoryRepository();
  const counts = await restoreBackup(target, backup);

  assert.equal(counts.flights, 1);
  assert.equal(counts.meals, 1);
  assert.deepEqual(await target.getAll("flights"), await source.getAll("flights"));
  assert.deepEqual(await target.getAll("settings"), await source.getAll("settings"));
});

test("restore upserts by id and keeps unrelated existing rows", async () => {
  const source = new InMemoryRepository();
  await source.put("flights", { id: "f1", flightNumber: "NH7" });
  const backup = await buildBackup(source);

  const target = new InMemoryRepository();
  await target.put("flights", { id: "f1", flightNumber: "OLD" });
  await target.put("flights", { id: "f2", flightNumber: "KEEP" });
  await restoreBackup(target, backup);

  const flights = (await target.getAll("flights")).sort((a, b) =>
    a.id.localeCompare(b.id));
  assert.equal(flights.length, 2);
  assert.equal(flights[0].flightNumber, "NH7");   // f1 overwritten
  assert.equal(flights[1].flightNumber, "KEEP");  // f2 untouched
});

test("invalid files are rejected, valid ones accepted", async () => {
  assert.equal(isValidBackup(null), false);
  assert.equal(isValidBackup({ format: "nope", version: 1, stores: {} }), false);
  assert.equal(isValidBackup({ format: BACKUP_FORMAT, version: 1, stores: {} }), true);

  const repo = new InMemoryRepository();
  await assert.rejects(() => restoreBackup(repo, { format: "x" }),
    /not a Go Go Osaka backup/);
});

test("backup file name is a dated .json", () => {
  const name = backupFileName(new Date(2026, 4, 23, 9, 5));
  assert.equal(name, "go-go-osaka-backup-20260523-0905.json");
});
