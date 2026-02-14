#!/bin/bash

DB="/var/www/kountryeye/backend/kountry_eyecare.db"

# Check how many records have ENQUIRY
echo "Records with ENQUIRY visit_type:"
sqlite3 $DB "SELECT COUNT(*) FROM visits WHERE visit_type = 'ENQUIRY';"

# Update ENQUIRY to INITIAL (or another valid type)
sqlite3 $DB "UPDATE visits SET visit_type = 'INITIAL' WHERE visit_type = 'ENQUIRY';"

echo "Updated ENQUIRY records to INITIAL"

# Verify
echo "Remaining ENQUIRY records:"
sqlite3 $DB "SELECT COUNT(*) FROM visits WHERE visit_type = 'ENQUIRY';"

echo "Done!"
