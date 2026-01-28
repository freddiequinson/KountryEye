"""
Migration script to add default_checklist and default_maintenance_interval to asset_categories.
Run this script to apply the migration.
"""
import asyncio
import aiosqlite
import json

DATABASE_PATH = "./kountry_eyecare.db"

# Predefined checklists for eye clinic equipment
EYE_CLINIC_CATEGORIES = [
    {
        "name": "Autorefractor/Keratometer",
        "description": "Auto refraction and keratometry equipment",
        "default_checklist": [
            "Clean chin rest and forehead rest",
            "Clean measurement window/lens",
            "Check calibration accuracy",
            "Verify printout quality",
            "Check power cord and connections",
            "Update software if needed",
            "Test auto-alignment function"
        ],
        "default_maintenance_interval": 90
    },
    {
        "name": "Slit Lamp",
        "description": "Biomicroscope for eye examination",
        "default_checklist": [
            "Clean eyepieces and objective lenses",
            "Clean chin rest and forehead rest",
            "Check illumination bulb",
            "Verify slit width calibration",
            "Lubricate moving parts",
            "Check power supply",
            "Test all magnification settings",
            "Clean filters"
        ],
        "default_maintenance_interval": 30
    },
    {
        "name": "Tonometer",
        "description": "Intraocular pressure measurement device",
        "default_checklist": [
            "Calibrate pressure readings",
            "Clean and disinfect probe tip",
            "Check probe alignment",
            "Verify battery/power",
            "Test measurement accuracy",
            "Replace disposable tips if needed"
        ],
        "default_maintenance_interval": 30
    },
    {
        "name": "Phoropter",
        "description": "Refraction testing instrument",
        "default_checklist": [
            "Clean all lenses",
            "Check lens rotation mechanism",
            "Verify PD scale accuracy",
            "Lubricate moving parts",
            "Check cross-cylinder function",
            "Test prism settings",
            "Clean forehead rest"
        ],
        "default_maintenance_interval": 90
    },
    {
        "name": "Lensometer/Focimeter",
        "description": "Lens power measurement device",
        "default_checklist": [
            "Clean eyepiece and stage",
            "Calibrate with test lens",
            "Check marking device",
            "Verify axis alignment",
            "Test auto-read function if applicable",
            "Check light source"
        ],
        "default_maintenance_interval": 90
    },
    {
        "name": "Retinal Camera/Fundus Camera",
        "description": "Retinal imaging equipment",
        "default_checklist": [
            "Clean objective lens",
            "Clean chin rest and forehead rest",
            "Check flash intensity",
            "Verify image quality",
            "Backup stored images",
            "Update software",
            "Check alignment system",
            "Clean filters"
        ],
        "default_maintenance_interval": 30
    },
    {
        "name": "OCT Machine",
        "description": "Optical Coherence Tomography scanner",
        "default_checklist": [
            "Clean chin rest and forehead rest",
            "Run calibration test",
            "Check scan quality",
            "Backup patient data",
            "Update software",
            "Verify network connectivity",
            "Clean optical components",
            "Check alignment laser"
        ],
        "default_maintenance_interval": 30
    },
    {
        "name": "Visual Field Analyzer",
        "description": "Perimetry testing equipment",
        "default_checklist": [
            "Clean chin rest and forehead rest",
            "Check stimulus brightness",
            "Verify calibration",
            "Test response button",
            "Backup test results",
            "Update normative database",
            "Clean dome interior"
        ],
        "default_maintenance_interval": 90
    },
    {
        "name": "Trial Lens Set",
        "description": "Manual refraction lens kit",
        "default_checklist": [
            "Clean all lenses",
            "Check lens organization in case",
            "Verify lens markings are readable",
            "Replace damaged lenses",
            "Clean trial frame",
            "Check trial frame adjustments"
        ],
        "default_maintenance_interval": 180
    },
    {
        "name": "Projector Chart",
        "description": "Visual acuity chart projector",
        "default_checklist": [
            "Clean projection lens",
            "Check bulb brightness",
            "Verify chart clarity",
            "Test remote control",
            "Check all chart options",
            "Clean screen/mirror"
        ],
        "default_maintenance_interval": 180
    },
    {
        "name": "Edger/Lens Cutting Machine",
        "description": "Optical lab lens edging equipment",
        "default_checklist": [
            "Clean cutting wheels",
            "Check water/coolant level",
            "Calibrate frame tracer",
            "Verify bevel accuracy",
            "Clean suction cups",
            "Check drill bits",
            "Update frame database",
            "Clean and drain water tank"
        ],
        "default_maintenance_interval": 7
    },
    {
        "name": "Frame Heater",
        "description": "Frame adjustment heating device",
        "default_checklist": [
            "Check temperature settings",
            "Clean heating surface",
            "Verify temperature accuracy",
            "Check power cord",
            "Clean salt/bead pan if applicable"
        ],
        "default_maintenance_interval": 90
    },
    {
        "name": "Ultrasonic Cleaner",
        "description": "Eyewear cleaning equipment",
        "default_checklist": [
            "Drain and clean tank",
            "Replace cleaning solution",
            "Check ultrasonic function",
            "Clean exterior",
            "Verify timer function"
        ],
        "default_maintenance_interval": 7
    },
    {
        "name": "Computer/Workstation",
        "description": "Office computers and workstations",
        "default_checklist": [
            "Run antivirus scan",
            "Clear temporary files",
            "Check for software updates",
            "Backup important data",
            "Clean keyboard and mouse",
            "Check monitor calibration",
            "Verify network connectivity"
        ],
        "default_maintenance_interval": 30
    },
    {
        "name": "Air Conditioning Unit",
        "description": "HVAC and climate control",
        "default_checklist": [
            "Clean or replace air filters",
            "Check refrigerant levels",
            "Clean condenser coils",
            "Check thermostat function",
            "Inspect electrical connections",
            "Clean drain line",
            "Check fan operation"
        ],
        "default_maintenance_interval": 90
    },
    {
        "name": "Generator",
        "description": "Backup power generator",
        "default_checklist": [
            "Check fuel level",
            "Test start mechanism",
            "Check oil level",
            "Inspect battery",
            "Run load test",
            "Check transfer switch",
            "Inspect exhaust system"
        ],
        "default_maintenance_interval": 30
    },
    {
        "name": "Furniture",
        "description": "Office and clinic furniture",
        "default_checklist": [
            "Check structural integrity",
            "Tighten loose screws/bolts",
            "Clean upholstery",
            "Check wheels/casters",
            "Lubricate moving parts",
            "Check hydraulics if applicable"
        ],
        "default_maintenance_interval": 180
    },
    {
        "name": "Examination Chair",
        "description": "Patient examination chair",
        "default_checklist": [
            "Check hydraulic lift function",
            "Clean upholstery",
            "Verify recline mechanism",
            "Check footrest operation",
            "Lubricate moving parts",
            "Inspect electrical controls",
            "Check headrest adjustment"
        ],
        "default_maintenance_interval": 90
    }
]


async def migrate():
    async with aiosqlite.connect(DATABASE_PATH) as db:
        print("Starting migration...")
        
        # Check existing columns in asset_categories table
        cursor = await db.execute("PRAGMA table_info(asset_categories)")
        columns = await cursor.fetchall()
        column_names = [col[1] for col in columns]
        
        if 'default_checklist' not in column_names:
            print("Adding default_checklist column to asset_categories...")
            await db.execute("ALTER TABLE asset_categories ADD COLUMN default_checklist JSON")
        else:
            print("default_checklist column already exists")
        
        if 'default_maintenance_interval' not in column_names:
            print("Adding default_maintenance_interval column to asset_categories...")
            await db.execute("ALTER TABLE asset_categories ADD COLUMN default_maintenance_interval INTEGER DEFAULT 90")
        else:
            print("default_maintenance_interval column already exists")
        
        await db.commit()
        
        # Insert predefined categories if they don't exist
        print("Adding predefined eye clinic asset categories...")
        for category in EYE_CLINIC_CATEGORIES:
            # Check if category exists
            cursor = await db.execute(
                "SELECT id FROM asset_categories WHERE name = ?",
                (category["name"],)
            )
            existing = await cursor.fetchone()
            
            if existing:
                # Update existing category with checklist
                print(f"  Updating: {category['name']}")
                await db.execute(
                    """UPDATE asset_categories 
                       SET default_checklist = ?, default_maintenance_interval = ?, description = ?
                       WHERE name = ?""",
                    (json.dumps(category["default_checklist"]), 
                     category["default_maintenance_interval"],
                     category["description"],
                     category["name"])
                )
            else:
                # Insert new category
                print(f"  Adding: {category['name']}")
                await db.execute(
                    """INSERT INTO asset_categories (name, description, default_checklist, default_maintenance_interval)
                       VALUES (?, ?, ?, ?)""",
                    (category["name"], 
                     category["description"],
                     json.dumps(category["default_checklist"]),
                     category["default_maintenance_interval"])
                )
        
        await db.commit()
        print("Migration completed successfully!")


if __name__ == "__main__":
    asyncio.run(migrate())
