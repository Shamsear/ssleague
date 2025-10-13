/**
 * Check for references to non-existent database tables
 */

const fs = require('fs');
const path = require('path');

// Tables that EXIST in your database
const EXISTING_TABLES = [
  'auction_settings',
  'bids',
  'footballplayers',
  'rounds',
  'starred_players',
  'team_players',
  'team_tiebreakers',
  'tiebreakers'
];

// Tables that might be referenced but DON'T exist
const NON_EXISTENT_TABLES = [
  'round',  // singular
  'auction_rounds',
  'round_players',
  'round_bids',
  'bulk_rounds',
  'bulk_tiebreakers',
  'bulk_tiebreaker_teams',
  'bulk_tiebreaker_bids'
];

// SQL keywords to search for
const SQL_PATTERNS = [
  'FROM ',
  'JOIN ',
  'INSERT INTO ',
  'UPDATE ',
  'DELETE FROM ',
  'CREATE TABLE ',
  'ALTER TABLE ',
  'DROP TABLE '
];

function findFilesRecursive(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      // Skip node_modules, .next, etc.
      if (!['node_modules', '.next', '.git', 'dist', 'build'].includes(file)) {
        findFilesRecursive(filePath, fileList);
      }
    } else if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js') || file.endsWith('.jsx')) {
      fileList.push(filePath);
    }
  });
  
  return fileList;
}

function checkFileForTableReferences(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const issues = [];
  
  // Check for each non-existent table
  NON_EXISTENT_TABLES.forEach(tableName => {
    // Check various SQL patterns
    SQL_PATTERNS.forEach(pattern => {
      const regex = new RegExp(`${pattern}\\s*${tableName}\\b`, 'gi');
      const matches = [...content.matchAll(regex)];
      
      matches.forEach(match => {
        const lineNumber = content.substring(0, match.index).split('\n').length;
        const line = content.split('\n')[lineNumber - 1].trim();
        
        issues.push({
          file: filePath,
          line: lineNumber,
          table: tableName,
          pattern: pattern.trim(),
          code: line
        });
      });
    });
    
    // Also check for template literals with table names
    const templateRegex = new RegExp('`[^`]*\\b' + tableName + '\\b[^`]*`', 'g');
    const templateMatches = [...content.matchAll(templateRegex)];
    
    templateMatches.forEach(match => {
      const lineNumber = content.substring(0, match.index).split('\n').length;
      const line = content.split('\n')[lineNumber - 1].trim();
      
      // Only report if it looks like SQL
      if (SQL_PATTERNS.some(p => match[0].includes(p))) {
        issues.push({
          file: filePath,
          line: lineNumber,
          table: tableName,
          pattern: 'SQL Template',
          code: line.substring(0, 100) + (line.length > 100 ? '...' : '')
        });
      }
    });
  });
  
  return issues;
}

function main() {
  console.log('🔍 Scanning codebase for references to non-existent tables...\n');
  console.log('='*80);
  
  const projectDir = process.cwd();
  const filesToCheck = findFilesRecursive(path.join(projectDir, 'app'));
  
  console.log(`\n📁 Scanning ${filesToCheck.length} files...\n`);
  
  const allIssues = [];
  
  filesToCheck.forEach(file => {
    const issues = checkFileForTableReferences(file);
    if (issues.length > 0) {
      allIssues.push(...issues);
    }
  });
  
  // Group issues by table
  const issuesByTable = {};
  allIssues.forEach(issue => {
    if (!issuesByTable[issue.table]) {
      issuesByTable[issue.table] = [];
    }
    issuesByTable[issue.table].push(issue);
  });
  
  console.log('='*80);
  console.log('\n📊 RESULTS:\n');
  
  if (allIssues.length === 0) {
    console.log('✅ No references to non-existent tables found!');
    console.log('✅ Your codebase is clean!\n');
    return;
  }
  
  console.log(`⚠️  Found ${allIssues.length} potential issues:\n`);
  
  Object.keys(issuesByTable).forEach(tableName => {
    const issues = issuesByTable[tableName];
    console.log(`\n❌ Table: "${tableName}" (DOES NOT EXIST)`);
    console.log(`   Found in ${issues.length} location(s):\n`);
    
    issues.forEach((issue, index) => {
      const relativePath = path.relative(projectDir, issue.file);
      console.log(`   ${index + 1}. ${relativePath}`);
      console.log(`      Line ${issue.line}: ${issue.pattern}`);
      console.log(`      Code: ${issue.code.substring(0, 80)}${issue.code.length > 80 ? '...' : ''}`);
      console.log('');
    });
  });
  
  console.log('='*80);
  console.log('\n⚠️  ACTION REQUIRED:\n');
  console.log('The above files reference tables that do not exist in your database.');
  console.log('You should either:');
  console.log('  1. Create these tables, OR');
  console.log('  2. Update the code to use existing tables, OR');
  console.log('  3. Remove the code if it\'s no longer needed\n');
  
  // Check for missing tables we might need
  console.log('='*80);
  console.log('\n🔍 TABLES THAT MAY BE NEEDED:\n');
  
  const potentiallyNeeded = ['round_players', 'round_bids', 'bulk_tiebreaker_teams', 'bulk_tiebreaker_bids'];
  const foundNeeded = potentiallyNeeded.filter(t => issuesByTable[t]);
  
  if (foundNeeded.length > 0) {
    console.log('These tables are referenced but don\'t exist:');
    foundNeeded.forEach(t => {
      console.log(`  ⚠️  ${t} - Referenced ${issuesByTable[t].length} times`);
    });
    console.log('\nYou may need to create these tables.');
  } else {
    console.log('✅ No missing required tables detected.');
  }
  
  console.log('\n' + '='*80 + '\n');
}

main();
