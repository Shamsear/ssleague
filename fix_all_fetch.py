import os
import re

def fix_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original = content
    # Fix: fetchWithTokenRefresh(/api/ -> fetchWithTokenRefresh('/api/
    content = re.sub(r"fetchWithTokenRefresh\(/api/", "fetchWithTokenRefresh('/api/", content)
    
    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        return True
    return False

fixed_count = 0
for root, dirs, files in os.walk('app'):
    for file in files:
        if file.endswith('.tsx'):
            filepath = os.path.join(root, file)
            if fix_file(filepath):
                print(f"Fixed: {filepath}")
                fixed_count += 1

print(f"\nTotal files fixed: {fixed_count}")
