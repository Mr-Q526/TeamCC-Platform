import { ensureBootstrapMacro } from './src/bootstrapMacro.js'
ensureBootstrapMacro();
import { main } from './src/main.js'

async function run() {
  setTimeout(() => {
    console.log("TRACE: 15s timeout hit - process hanging");
    process.exit(1);
  }, 15000);
  console.log("TRACE: starting main");
  try {
    await main();
    console.log("TRACE: main returned");
  } catch (e) {
    console.error("TRACE ERROR:", e);
  }
}
run();
