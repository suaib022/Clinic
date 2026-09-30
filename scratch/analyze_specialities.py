import json
import re

with open('labaid_complete_data.json', 'r') as f:
    data = json.load(f)

specialities_set = set()
doctor_specialities = [] # (doctor_name, speciality)

for dept in data:
    for doc in dept.get('doctors', []):
        spec_str = doc.get('speciality', '')
        if spec_str:
            # Split by | and , 
            parts = re.split(r'\||,', spec_str)
            for p in parts:
                p = p.strip()
                if p:
                    # Clean up some obvious non-specialities or keep them as is?
                    # The user said "add all possible distinguished specialities"
                    # We might want to filter out degrees like MBBS, FCPS, MD, MS, PhD, etc.
                    # Or maybe just include everything and let the user filter later?
                    # Let's do some basic filtering for common degrees to keep it clean, 
                    # but if they want all of them, let's just uppercase and add.
                    # Actually, degrees like "MBBS (DMC)" shouldn't be specialities.
                    # But if we blindly add them, it might be messy. Let's just add them as requested,
                    # but normalize whitespace.
                    
                    # Normalize whitespace
                    p = ' '.join(p.split())
                    if len(p) > 2: # Ignore tiny strings
                        specialities_set.add(p)
                        doctor_specialities.append((doc['name'], p))

print(f"Found {len(specialities_set)} unique specialities.")

# Write a basic SQL migration
with open('scratch/generate_booking_migration.py', 'w') as f:
    f.write("import json\n")
