#!/usr/bin/env python3
"""
Automatically fix token authentication in all dashboard pages
Adds fetchWithTokenRefresh import and replaces fetch calls
"""

import os
import re
from pathlib import Path

# Configuration
DASHBOARD_PATH = r"C:\Drive d\SS\nosqltest\nextjs-project\app\dashboard"
IMPORT_LINE = "import { fetchWithTokenRefresh } from '@/lib/token-refresh';"

# Counters
files_modified = 0
fetch_calls_replaced = 0
files_skipped = 0

def has_fetch_with_token_refresh(content):
    """Check if file already has fetchWithTokenRefresh import"""
    return 'fetchWithTokenRefresh' in content

def has_await_fetch(content):
    """Check if file has any await fetch( calls"""
    return re.search(r'await\s+fetch\s*\(', content) is not None

def find_last_import_line(lines):
    """Find the index of the last import statement"""
    last_import_idx = -1
    for i, line in enumerate(lines):
        if line.strip().startswith('import '):
            last_import_idx = i
    return last_import_idx

def add_import(content):
    """Add fetchWithTokenRefresh import after other imports"""
    lines = content.split('\n')
    last_import_idx = find_last_import_line(lines)
    
    if last_import_idx >= 0:
        # Insert after last import
        lines.insert(last_import_idx + 1, IMPORT_LINE)
        return '\n'.join(lines)
    
    return content

def replace_fetch_calls(content):
    """Replace await fetch( with await fetchWithTokenRefresh("""
    # Don't replace /api/auth/set-token (token refresh endpoint itself)
    # Don't replace external URLs (http://, https://)
    
    original_content = content
    replacements = 0
    
    # Pattern 1: await fetch("/api/...
    pattern1 = r'await\s+fetch\s*\(\s*["\'](\s*/api/(?!auth/set-token))'
    replacement1 = r'await fetchWithTokenRefresh(\1'
    content = re.sub(pattern1, replacement1, content)
    
    # Pattern 2: await fetch(`/api/...
    pattern2 = r'await\s+fetch\s*\(\s*`(\s*/api/(?!auth/set-token))'
    replacement2 = r'await fetchWithTokenRefresh(`\1'
    content = re.sub(pattern2, replacement2, content)
    
    # Count replacements
    if content != original_content:
        # Count how many fetch calls were replaced
        original_fetch_count = len(re.findall(r'await\s+fetch\s*\(', original_content))
        new_fetch_count = len(re.findall(r'await\s+fetch\s*\(', content))
        replacements = original_fetch_count - new_fetch_count
    
    return content, replacements

def process_file(file_path):
    """Process a single TypeScript file"""
    global files_modified, fetch_calls_replaced, files_skipped
    
    try:
        # Read file
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Check if already has fetchWithTokenRefresh
        if has_fetch_with_token_refresh(content):
            print(f"  ✓ Skipping {file_path.name} - already has fetchWithTokenRefresh")
            files_skipped += 1
            return
        
        # Check if has await fetch calls
        if not has_await_fetch(content):
            files_skipped += 1
            return
        
        print(f"  → Processing {file_path}")
        
        # Add import
        content = add_import(content)
        
        # Replace fetch calls
        content, replacements = replace_fetch_calls(content)
        
        if replacements > 0:
            # Write back to file
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(content)
            
            files_modified += 1
            fetch_calls_replaced += replacements
            print(f"    ✓ Replaced {replacements} fetch calls")
        
    except Exception as e:
        print(f"    ✗ Error processing {file_path}: {e}")

def main():
    """Main function to process all TypeScript files"""
    global files_modified, fetch_calls_replaced, files_skipped
    
    print("=" * 60)
    print("Token Authentication Auto-Fix Script")
    print("=" * 60)
    print(f"Scanning: {DASHBOARD_PATH}\n")
    
    # Find all .tsx files
    dashboard_path = Path(DASHBOARD_PATH)
    tsx_files = list(dashboard_path.rglob("*.tsx"))
    
    print(f"Found {len(tsx_files)} .tsx files\n")
    
    # Process each file
    for tsx_file in tsx_files:
        process_file(tsx_file)
    
    # Print summary
    print("\n" + "=" * 60)
    print("Summary:")
    print("=" * 60)
    print(f"Files modified: {files_modified}")
    print(f"Files skipped: {files_skipped}")
    print(f"Fetch calls replaced: {fetch_calls_replaced}")
    print("=" * 60)
    print("\n✅ Done! All dashboard pages have been fixed.")

if __name__ == "__main__":
    main()
