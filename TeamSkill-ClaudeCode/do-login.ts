import { loginToTeamCC, saveTeamCCConfig } from './src/bootstrap/teamccAuth.js';
import { getCwd } from './src/utils/cwd.js';

async function run() {
  console.log("Logging in...");
  const cwd = getCwd();
  const apiBase = "http://127.0.0.1:3000";
  try {
    const { config } = await loginToTeamCC("admin", "password123", apiBase);
    await saveTeamCCConfig(cwd, config);
    console.log("Logged in successfully! Token saved.");
    process.exit(0);
  } catch (err: any) {
    console.error("Login failed:", err.message);
    process.exit(1);
  }
}

run();
