import os
import glob

# Search for actual API routes using bulk_tiebreaker tables
project_root = r"C:\Drive d\SS\nosqltest\nextjs-project"
app_dir = os.path.join(project_root, "app", "api")

print("🔍 Checking which routes exist and use bulk_tiebreaker tables:\n")
print("=" * 80)

# Check if bulk-tiebreakers routes exist
bulk_tiebreaker_routes = [
    "admin/bulk-tiebreakers",
    "team/bulk-tiebreakers"
]

for route in bulk_tiebreaker_routes:
    route_path = os.path.join(app_dir, route)
    if os.path.exists(route_path):
        print(f"\n✅ Route exists: /api/{route}")
        
        # List all files in this route
        for root, dirs, files in os.walk(route_path):
            for file in files:
                if file.endswith('.ts'):
                    file_path = os.path.join(root, file)
                    rel_path = os.path.relpath(file_path, app_dir)
                    print(f"   📄 {rel_path}")
    else:
        print(f"\n❌ Route does NOT exist: /api/{route}")

print("\n" + "=" * 80)
print("\n🔍 Now checking regular tiebreaker routes:\n")

regular_tiebreaker_routes = [
    "admin/tiebreakers",
    "team/tiebreakers",
    "tiebreakers"
]

for route in regular_tiebreaker_routes:
    route_path = os.path.join(app_dir, route)
    if os.path.exists(route_path):
        print(f"\n✅ Route exists: /api/{route}")
        
        for root, dirs, files in os.walk(route_path):
            for file in files:
                if file.endswith('.ts'):
                    file_path = os.path.join(root, file)
                    rel_path = os.path.relpath(file_path, app_dir)
                    print(f"   📄 {rel_path}")
    else:
        print(f"\n❌ Route does NOT exist: /api/{route}")
