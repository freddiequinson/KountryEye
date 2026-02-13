#!/bin/bash
sqlite3 /var/www/kountryeye/backend/kountry_eyecare.db "INSERT INTO roles (name, description) VALUES ('technician', 'Clinical technician for scans and referrals');"
echo "Technician role added successfully"
