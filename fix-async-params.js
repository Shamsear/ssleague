const fs = require('fs');
const path = require('path');

// Find all route.ts files
function findRouteFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      findRouteFiles(filePath, fileList);
    } else if (file === 'route.ts') {
      fileList.push(filePath);
    }
  });
  
  return fileList;
}

// Fix params in a file
function fixParamsInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  const originalContent = content;
  
  // Pattern 1: { params }: { params: { id: string } }
  content = content.replace(
    /\{\s*params\s*\}:\s*\{\s*params:\s*\{\s*id:\s*string\s*\}\s*\}/g,
    '{ params }: { params: Promise<{ id: string }> }'
  );
  
  // Pattern 2: { params }: { params: { seasonId: string } }
  content = content.replace(
    /\{\s*params\s*\}:\s*\{\s*params:\s*\{\s*seasonId:\s*string\s*\}\s*\}/g,
    '{ params }: { params: Promise<{ seasonId: string }> }'
  );
  
  // Pattern 3: { params }: { params: { playerId: string } }
  content = content.replace(
    /\{\s*params\s*\}:\s*\{\s*params:\s*\{\s*playerId:\s*string\s*\}\s*\}/g,
    '{ params }: { params: Promise<{ playerId: string }> }'
  );
  
  // Now add await statements for params access
  // Pattern: const X = params.id; OR const X = params.seasonId; etc.
  // Replace with: const { id } = await params; etc.
  
  // For id params
  if (content.includes('Promise<{ id: string }>')) {
    // Find and replace params.id usage
    content = content.replace(
      /(const\s+)(\w+)(\s*=\s*params\.id\s*;)/g,
      'const { id: $2 } = await params;'
    );
    // Also handle direct params.id usage without assignment
    content = content.replace(
      /([^a-zA-Z_])params\.id([^a-zA-Z_])/g,
      '$1id$2'
    );
  }
  
  // For seasonId params
  if (content.includes('Promise<{ seasonId: string }>')) {
    content = content.replace(
      /(const\s+)(\w+)(\s*=\s*params\.seasonId\s*;)/g,
      'const { seasonId: $2 } = await params;'
    );
    content = content.replace(
      /([^a-zA-Z_])params\.seasonId([^a-zA-Z_])/g,
      '$1seasonId$2'
    );
  }
  
  // For playerId params
  if (content.includes('Promise<{ playerId: string }>')) {
    content = content.replace(
      /(const\s+)(\w+)(\s*=\s*params\.playerId\s*;)/g,
      'const { playerId: $2 } = await params;'
    );
    content = content.replace(
      /([^a-zA-Z_])params\.playerId([^a-zA-Z_])/g,
      '$1playerId$2'
    );
  }
  
  return { changed: content !== originalContent, content };
}

// Main execution
const apiDir = path.join(__dirname, 'app', 'api');
const routeFiles = findRouteFiles(apiDir);

let totalFiles = 0;
let changedFiles = 0;

routeFiles.forEach(filePath => {
  totalFiles++;
  const result = fixParamsInFile(filePath);
  
  if (result.changed) {
    fs.writeFileSync(filePath, result.content, 'utf8');
    changedFiles++;
    console.log(`Fixed: ${filePath}`);
  }
});

console.log(`\nProcessed ${totalFiles} files, changed ${changedFiles} files.`);
