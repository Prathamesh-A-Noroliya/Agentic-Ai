import fs from "node:fs";
import path from "node:path";
import { validateTelemetry } from "./src/netcoop/telemetry";

const directory = "./datasets/scenarios";
const files = fs.readdirSync(directory).filter((file) => file.endsWith(".json"));
let passed = 0;
let failed = 0;

for (const file of files) {
  const input = JSON.parse(fs.readFileSync(path.join(directory, file), "utf8").replace(/^\uFEFF/, ""));
  const result = validateTelemetry(input);
  const shouldBeValid = !file.startsWith("06-");
  const success = result.valid === shouldBeValid;

  console.log(
    `${success ? "PASS" : "FAIL"}: ${file} — ${
      result.valid ? "accepted" : "rejected"
    }`
  );

  if (!success) {
    console.log(result);
    failed++;
  } else {
    passed++;
  }
}

console.log(`\nSCENARIOS: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

