import os
import re

def fix_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original = content
    
    # Fix: await fetch( -> await fetchWithTokenRefresh(
    # But skip if it's already fetchWithTokenRefresh
    content = re.sub(r'await fetch\(', 'await fetchWithTokenRefresh(', content)
    
    # Also ensure the import is present
    if 'fetchWithTokenRefresh' in content and "from '@/lib/token-refresh'" not in content:
        # Add import after other imports
        # Find the last import statement
        import_pattern = r"(import\s+.*?from\s+['\"].*?['\"];?\s*\n)"
        matches = list(re.finditer(import_pattern, content))
        if matches:
            last_import_pos = matches[-1].end()
            import_statement = "import { fetchWithTokenRefresh } from '@/lib/token-refresh';\n"
            content = content[:last_import_pos] + import_statement + content[last_import_pos:]
    
    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        return True
    return False

fixed_count = 0
files_checked = 0

for root, dirs, files in os.walk('app/dashboard'):
    # Skip old files
    if 'page_old.tsx' in root or 'page.old.tsx' in root:
        continue
        
    for file in files:
        if file.endswith('.tsx') and not file.endswith('_old.tsx') and not file.endswith('.old.tsx'):
            filepath = os.path.join(root, file)
            files_checked += 1
            if fix_file(filepath):
                print(f"Fixed: {filepath}")
                fixed_count += 1

print(f"\nFiles checked: {files_checked}")
print(f"Files fixed: {fixed_count}")
