import { glob } from 'fs/promises';
import { readFileSync, existsSync, statSync } from 'fs';
import { parse, resolve, dirname, join } from 'path';

async function run() {
  let hasErrors = false;
  let fileCount = 0;
  
  for await (const file of glob('src/**/*.{ts,tsx,js,jsx}')) {
    fileCount++;
    const content = readFileSync(file, 'utf8');
    const dir = dirname(file);
    
    // Regex to match import / export from '...'
    const importRegex = /(?:import|export)\s+(?:[^'"]+\s+from\s+)?['"]([^'"]+)['"]/g;
    // Regex to match import('...')
    const dynamicImportRegex = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    
    const checkTarget = (targetPath: string) => {
      // Skip node builtins, npm packages, and 'src/' generic aliases if any
      if (!targetPath.startsWith('.') && !targetPath.startsWith('/')) {
        if (!targetPath.startsWith('src/')) return; 
      }
      
      let resolved = '';
      if (targetPath.startsWith('src/')) {
        resolved = resolve(process.cwd(), targetPath);
      } else {
        resolved = resolve(dir, targetPath);
      }
      
      // If it ends with .js, bun will try to resolve .ts, .tsx, .js, .jsx
      let possiblePaths = [resolved];
      if (resolved.endsWith('.js')) {
        const base = resolved.substring(0, resolved.length - 3);
        possiblePaths = [
          resolved,
          base + '.ts',
          base + '.tsx',
          base + '/index.ts',
          base + '/index.js'
        ];
      } else if (resolved.endsWith('.jsx')) {
         possiblePaths.push(resolved.replace('.jsx', '.tsx'));
      } else {
         possiblePaths.push(resolved + '.ts', resolved + '.tsx', resolved + '.js', resolved + '/index.ts', resolved + '/index.js');
      }

      const exists = possiblePaths.some(p => {
        try {
          return existsSync(p) && statSync(p).isFile()
        } catch { return false; }
      });
      
      if (!exists) {
        console.error(`❌ Broken import in ${file}:`);
        console.error(`   Target: '${targetPath}'`);
        console.error(`   Tried paths:\n     - ${possiblePaths.join('\n     - ')}`);
        hasErrors = true;
      }
    };
    
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      checkTarget(match[1]);
    }
    
    while ((match = dynamicImportRegex.exec(content)) !== null) {
      checkTarget(match[1]);
    }
  }
  
  console.log(`\nChecked ${fileCount} files.`);
  if (!hasErrors) {
    console.log("✅ All import paths resolve successfully!");
  }
}

run().catch(console.error);
