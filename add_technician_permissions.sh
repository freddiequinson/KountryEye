#!/bin/bash

DB="/var/www/kountryeye/backend/kountry_eyecare.db"

# Get technician role ID
ROLE_ID=$(sqlite3 $DB "SELECT id FROM roles WHERE name='technician';")
echo "Technician role ID: $ROLE_ID"

# Add technician permissions if they don't exist
sqlite3 $DB "INSERT OR IGNORE INTO permissions (name, code, module) VALUES ('View Technician Dashboard', 'technician.view', 'technician');"
sqlite3 $DB "INSERT OR IGNORE INTO permissions (name, code, module) VALUES ('Manage Scans', 'technician.scans', 'technician');"
sqlite3 $DB "INSERT OR IGNORE INTO permissions (name, code, module) VALUES ('Manage Referrals', 'technician.referrals', 'technician');"
sqlite3 $DB "INSERT OR IGNORE INTO permissions (name, code, module) VALUES ('View Dashboard', 'dashboard.view', 'dashboard');"
sqlite3 $DB "INSERT OR IGNORE INTO permissions (name, code, module) VALUES ('View Messages', 'messages.view', 'messages');"

# Get permission IDs
PERM1=$(sqlite3 $DB "SELECT id FROM permissions WHERE code='technician.view';")
PERM2=$(sqlite3 $DB "SELECT id FROM permissions WHERE code='technician.scans';")
PERM3=$(sqlite3 $DB "SELECT id FROM permissions WHERE code='technician.referrals';")
PERM4=$(sqlite3 $DB "SELECT id FROM permissions WHERE code='dashboard.view';")
PERM5=$(sqlite3 $DB "SELECT id FROM permissions WHERE code='messages.view';")

echo "Permission IDs: $PERM1, $PERM2, $PERM3, $PERM4, $PERM5"

# Link permissions to technician role (role_permissions table)
sqlite3 $DB "INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES ($ROLE_ID, $PERM1);"
sqlite3 $DB "INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES ($ROLE_ID, $PERM2);"
sqlite3 $DB "INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES ($ROLE_ID, $PERM3);"
sqlite3 $DB "INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES ($ROLE_ID, $PERM4);"
sqlite3 $DB "INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES ($ROLE_ID, $PERM5);"

echo "Technician permissions added and linked successfully"

# Verify
sqlite3 $DB "SELECT p.code FROM permissions p JOIN role_permissions rp ON p.id = rp.permission_id WHERE rp.role_id = $ROLE_ID;"
