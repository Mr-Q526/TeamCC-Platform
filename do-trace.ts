import { main } from './src/main.js'
console.log('Running main...');
main().then(() => console.log('Main finished')).catch(e => console.error(e));
