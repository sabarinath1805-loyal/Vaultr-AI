import { app } from "./app";
import { manifestPublicKey } from "./lib/manifestSigning";
import { assertProductionConfig, validateRuntimeConfig } from "./lib/configValidation";

const PORT = process.env.PORT ?? 3001;

// Surface a malformed MANIFEST_SIGNING_KEY at boot rather than when someone's
// first export fails. Unset is a valid choice and means manifests go out
// unsigned; malformed is a misconfiguration, so stop rather than serve a
// deployment whose exports will fail later.
try {
  const configReport = validateRuntimeConfig();
  for (const warning of configReport.warnings) {
    console.warn(`[config] ${warning.name}: ${warning.reason}`);
  }
  assertProductionConfig();
  const signingKey = manifestPublicKey();
  if (signingKey) {
    console.log(`Export manifests signed with key ${signingKey.key_id}`);
  }
} catch (err) {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
}

app.listen(PORT, () => {
  console.log(`Mike backend running on port ${PORT}`);
});
