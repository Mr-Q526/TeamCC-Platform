import { loadTeamCCConfig, fetchIdentityFromTeamCC } from './src/bootstrap/teamccAuth.js';
import { getCwd } from './src/utils/cwd.js';
import { envelopeToProfile } from './src/utils/identity.js';

async function run() {
  const cwd = getCwd();
  const config = await loadTeamCCConfig(cwd);
  if (!config) throw new Error("No config");
  const envelope = await fetchIdentityFromTeamCC(config);
  const profile = envelopeToProfile(envelope);
  console.log("Profile:", JSON.stringify(profile));
}

run().catch(console.error);
