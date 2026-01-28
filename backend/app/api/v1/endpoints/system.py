from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy import text
from app.core.database import async_session_maker, engine, Base
from app.core.security import get_password_hash
from app.models import User, Role, Branch, ConsultationType, ProductCategory, IncomeCategory, ExpenseCategory, AssetCategory

router = APIRouter()

RESET_PASSWORD = "21Savage"

class ResetRequest(BaseModel):
    password: str
    reseed: bool = True


@router.post("/hard-reset")
async def hard_reset_database(request: ResetRequest):
    """
    Hard reset the entire database. This will delete ALL data.
    Requires the system reset password.
    """
    if request.password != RESET_PASSWORD:
        raise HTTPException(status_code=403, detail="Invalid reset password")
    
    try:
        # Drop all tables and recreate them
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)
            await conn.run_sync(Base.metadata.create_all)
        
        if request.reseed:
            # Reseed with initial data
            async with async_session_maker() as session:
                # Create admin role
                role = Role(name="admin", description="Administrator with full access")
                session.add(role)
                await session.flush()

                # Create admin user
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

                # Create other roles
                frontdesk_role = Role(name="frontdesk", description="Front desk staff")
                doctor_role = Role(name="doctor", description="Medical doctors")
                marketing_role = Role(name="marketing", description="Marketing team")
                session.add_all([frontdesk_role, doctor_role, marketing_role])

                # Create main branch
                main_branch = Branch(
                    name="Kountry Eyecare Main",
                    address="123 Main Street, Lagos",
                    phone="+234 800 000 0001",
                    email="main@kountryeyecare.com",
                    is_active=True
                )
                session.add(main_branch)

                # Create consultation types
                consultation_types = [
                    ConsultationType(name="General Eye Exam", description="Comprehensive eye examination", base_fee=5000),
                    ConsultationType(name="Pediatric Eye Exam", description="Eye examination for children", base_fee=4000),
                    ConsultationType(name="Contact Lens Fitting", description="Contact lens consultation and fitting", base_fee=7500),
                    ConsultationType(name="Glaucoma Screening", description="Glaucoma detection and monitoring", base_fee=8000),
                    ConsultationType(name="Diabetic Eye Exam", description="Eye examination for diabetic patients", base_fee=6000),
                ]
                session.add_all(consultation_types)

                # Create product categories
                product_categories = [
                    ProductCategory(name="Frames", description="Eyeglass frames"),
                    ProductCategory(name="Lenses", description="Prescription and non-prescription lenses"),
                    ProductCategory(name="Contact Lenses", description="Contact lenses"),
                    ProductCategory(name="Sunglasses", description="Sunglasses and tinted lenses"),
                    ProductCategory(name="Eye Drops", description="Eye drops and medications"),
                    ProductCategory(name="Accessories", description="Cases, cleaning solutions, etc."),
                ]
                session.add_all(product_categories)

                # Create income categories
                income_categories = [
                    IncomeCategory(name="Consultation Fees", description="Income from consultations"),
                    IncomeCategory(name="Product Sales", description="Income from product sales"),
                    IncomeCategory(name="Services", description="Income from services"),
                    IncomeCategory(name="Other", description="Other income sources"),
                ]
                session.add_all(income_categories)

                # Create expense categories
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

                # Create asset categories
                asset_categories = [
                    AssetCategory(name="Medical Equipment", description="Diagnostic and treatment equipment"),
                    AssetCategory(name="Furniture", description="Office furniture"),
                    AssetCategory(name="IT Equipment", description="Computers, printers, etc."),
                    AssetCategory(name="Vehicles", description="Company vehicles"),
                ]
                session.add_all(asset_categories)

                await session.commit()
        
        return {
            "success": True,
            "message": "Database has been reset successfully",
            "reseeded": request.reseed,
            "admin_credentials": {
                "email": "admin@kountryeyecare.com",
                "password": "admin123"
            } if request.reseed else None
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Reset failed: {str(e)}")
