import asyncio
from datetime import datetime, date
from app.core.database import async_session_maker
from app.core.security import get_password_hash
from app.models import (
    User, Role, Branch, ConsultationType, ProductCategory, Product,
    IncomeCategory, ExpenseCategory, AssetCategory
)

async def seed_data():
    async with async_session_maker() as session:
        role = Role(name="admin", description="Administrator with full access")
        session.add(role)
        await session.flush()

        admin_user = User(
            email="admin@kountryeyecare.com",
            hashed_password=get_password_hash("admin123"),
            first_name="System",
            last_name="Administrator",
            role_id=role.id,
            is_active=True,
            is_superuser=True
        )
        session.add(admin_user)

        frontdesk_role = Role(name="frontdesk", description="Front desk staff")
        doctor_role = Role(name="doctor", description="Medical doctors")
        marketing_role = Role(name="marketing", description="Marketing team")
        session.add_all([frontdesk_role, doctor_role, marketing_role])

        main_branch = Branch(
            name="Kountry Eyecare Main",
            address="123 Main Street, Lagos",
            phone="+234 800 000 0001",
            email="main@kountryeyecare.com",
            is_active=True
        )
        session.add(main_branch)

        consultation_types = [
            ConsultationType(name="General Eye Exam", description="Comprehensive eye examination", base_fee=5000),
            ConsultationType(name="Pediatric Eye Exam", description="Eye examination for children", base_fee=4000),
            ConsultationType(name="Contact Lens Fitting", description="Contact lens consultation and fitting", base_fee=7500),
            ConsultationType(name="Glaucoma Screening", description="Glaucoma detection and monitoring", base_fee=8000),
            ConsultationType(name="Diabetic Eye Exam", description="Eye examination for diabetic patients", base_fee=6000),
        ]
        session.add_all(consultation_types)

        product_categories = [
            ProductCategory(name="Frames", description="Eyeglass frames"),
            ProductCategory(name="Lenses", description="Prescription and non-prescription lenses"),
            ProductCategory(name="Contact Lenses", description="Contact lenses"),
            ProductCategory(name="Sunglasses", description="Sunglasses and tinted lenses"),
            ProductCategory(name="Eye Drops", description="Eye drops and medications"),
            ProductCategory(name="Accessories", description="Cases, cleaning solutions, etc."),
        ]
        session.add_all(product_categories)
        await session.flush()

        products = [
            Product(sku="FRM-001", name="Classic Metal Frame", category_id=product_categories[0].id, unit_price=15000, cost_price=8000),
            Product(sku="FRM-002", name="Designer Plastic Frame", category_id=product_categories[0].id, unit_price=25000, cost_price=12000),
            Product(sku="LNS-001", name="Single Vision Lens", category_id=product_categories[1].id, unit_price=8000, cost_price=3500),
            Product(sku="LNS-002", name="Progressive Lens", category_id=product_categories[1].id, unit_price=35000, cost_price=15000),
            Product(sku="CL-001", name="Daily Disposable Contacts (30pk)", category_id=product_categories[2].id, unit_price=12000, cost_price=6000),
            Product(sku="SUN-001", name="Polarized Sunglasses", category_id=product_categories[3].id, unit_price=18000, cost_price=9000),
            Product(sku="DRP-001", name="Lubricating Eye Drops", category_id=product_categories[4].id, unit_price=2500, cost_price=1000, requires_prescription=False),
            Product(sku="ACC-001", name="Lens Cleaning Kit", category_id=product_categories[5].id, unit_price=3000, cost_price=1200),
        ]
        session.add_all(products)

        income_categories = [
            IncomeCategory(name="Consultation Fees", description="Income from consultations"),
            IncomeCategory(name="Product Sales", description="Income from product sales"),
            IncomeCategory(name="Services", description="Income from services"),
            IncomeCategory(name="Other", description="Other income sources"),
        ]
        session.add_all(income_categories)

        expense_categories = [
            ExpenseCategory(name="Salaries", description="Staff salaries and wages"),
            ExpenseCategory(name="Rent", description="Office rent"),
            ExpenseCategory(name="Utilities", description="Electricity, water, internet"),
            ExpenseCategory(name="Inventory", description="Stock purchases"),
            ExpenseCategory(name="Equipment", description="Equipment and maintenance"),
            ExpenseCategory(name="Marketing", description="Marketing and advertising"),
            ExpenseCategory(name="Other", description="Miscellaneous expenses"),
        ]
        session.add_all(expense_categories)

        asset_categories = [
            AssetCategory(name="Medical Equipment", description="Diagnostic and treatment equipment"),
            AssetCategory(name="Furniture", description="Office furniture"),
            AssetCategory(name="IT Equipment", description="Computers, printers, etc."),
            AssetCategory(name="Vehicles", description="Company vehicles"),
        ]
        session.add_all(asset_categories)

        await session.commit()
        print("Seed data created successfully!")
        print("Admin login: admin@kountryeyecare.com / admin123")

if __name__ == "__main__":
    asyncio.run(seed_data())
