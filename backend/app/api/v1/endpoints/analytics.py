from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_, case, extract
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Optional

from app.core.database import get_db
from app.models.user import User
from app.models.patient import Patient, Visit
from app.models.clinical import Consultation, ClinicalRecord, Prescription, PrescriptionItem, ConsultationType, OutOfStockRequest
from app.models.sales import Product, ProductCategory, Sale, SaleItem, BranchStock
from app.models.inventory import StockTransfer, Import
from app.models.accounting import Income, Expense, IncomeCategory, ExpenseCategory
from app.models.employee import Attendance
from app.models.branch import Branch
from app.models.revenue import Revenue
from app.api.v1.deps import get_current_active_user

router = APIRouter()


@router.get("/dashboard")
async def get_dashboard_analytics(
    period: str = Query("month", description="today, week, month, quarter, year"),
    branch_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get comprehensive dashboard analytics for admin"""
    
    # Calculate date range
    now = datetime.utcnow()
    if period == "today":
        start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
    elif period == "week":
        start_date = now - timedelta(days=7)
    elif period == "month":
        start_date = now - timedelta(days=30)
    elif period == "quarter":
        start_date = now - timedelta(days=90)
    elif period == "year":
        start_date = now - timedelta(days=365)
    else:
        start_date = now - timedelta(days=30)
    
    # Previous period for comparison
    period_length = (now - start_date).days
    prev_start = start_date - timedelta(days=period_length)
    prev_end = start_date
    
    # Build branch filter
    branch_filter = Visit.branch_id == branch_id if branch_id else True
    
    # ============ VISITS ANALYTICS ============
    # Current period visits
    visits_result = await db.execute(
        select(func.count(Visit.id))
        .where(and_(Visit.visit_date >= start_date, branch_filter))
    )
    total_visits = visits_result.scalar() or 0
    
    # Previous period visits
    prev_visits_result = await db.execute(
        select(func.count(Visit.id))
        .where(and_(
            Visit.visit_date >= prev_start,
            Visit.visit_date < prev_end,
            branch_filter if branch_id else True
        ))
    )
    prev_visits = prev_visits_result.scalar() or 0
    visits_change = ((total_visits - prev_visits) / prev_visits * 100) if prev_visits > 0 else 0
    
    # Visits by status
    visits_by_status_result = await db.execute(
        select(Visit.status, func.count(Visit.id))
        .where(and_(Visit.visit_date >= start_date, branch_filter))
        .group_by(Visit.status)
    )
    visits_by_status = {row[0]: row[1] for row in visits_by_status_result.all()}
    
    # Visits by payment type
    visits_by_payment_result = await db.execute(
        select(Visit.payment_type, func.count(Visit.id))
        .where(and_(Visit.visit_date >= start_date, branch_filter))
        .group_by(Visit.payment_type)
    )
    visits_by_payment = {row[0] or 'unknown': row[1] for row in visits_by_payment_result.all()}
    
    # ============ REVENUE ANALYTICS ============
    # Total revenue from Revenue table (all recorded revenue)
    branch_revenue_filter = Revenue.branch_id == branch_id if branch_id else True
    
    revenue_result = await db.execute(
        select(func.sum(Revenue.amount))
        .where(and_(Revenue.created_at >= start_date, branch_revenue_filter))
    )
    total_revenue = float(revenue_result.scalar() or 0)
    
    # Revenue by category (consultation, prescription, sale, etc.)
    revenue_by_category_result = await db.execute(
        select(Revenue.category, func.sum(Revenue.amount))
        .where(and_(Revenue.created_at >= start_date, branch_revenue_filter))
        .group_by(Revenue.category)
    )
    revenue_by_category = {row[0] or 'other': float(row[1] or 0) for row in revenue_by_category_result.all()}
    
    consultation_revenue = revenue_by_category.get('consultation', 0)
    sales_revenue = revenue_by_category.get('sale', 0) + revenue_by_category.get('prescription', 0)
    
    # Previous period revenue
    prev_revenue_result = await db.execute(
        select(func.sum(Revenue.amount))
        .where(and_(
            Revenue.created_at >= prev_start,
            Revenue.created_at < prev_end,
            branch_revenue_filter if branch_id else True
        ))
    )
    prev_revenue = float(prev_revenue_result.scalar() or 0)
    revenue_change = ((total_revenue - prev_revenue) / prev_revenue * 100) if prev_revenue > 0 else 0
    
    # Revenue by payment method
    revenue_by_payment_result = await db.execute(
        select(Revenue.payment_method, func.sum(Revenue.amount))
        .where(and_(Revenue.created_at >= start_date, branch_revenue_filter))
        .group_by(Revenue.payment_method)
    )
    revenue_by_payment = {row[0] or 'unknown': float(row[1] or 0) for row in revenue_by_payment_result.all()}
    
    # ============ PATIENTS ANALYTICS ============
    # New patients this period
    new_patients_result = await db.execute(
        select(func.count(Patient.id))
        .where(Patient.created_at >= start_date)
    )
    new_patients = new_patients_result.scalar() or 0
    
    # Total patients
    total_patients_result = await db.execute(select(func.count(Patient.id)))
    total_patients = total_patients_result.scalar() or 0
    
    # Patients by gender
    patients_by_gender_result = await db.execute(
        select(Patient.sex, func.count(Patient.id))
        .group_by(Patient.sex)
    )
    patients_by_gender = {row[0] or 'unknown': row[1] for row in patients_by_gender_result.all()}
    
    # ============ INSURANCE ANALYTICS ============
    # Insurance visits and coverage
    insurance_result = await db.execute(
        select(
            func.count(Visit.id),
            func.sum(Visit.insurance_limit),
            func.sum(Visit.insurance_used),
            func.sum(Visit.patient_topup)
        )
        .where(and_(
            Visit.visit_date >= start_date,
            Visit.payment_type == 'insurance',
            branch_filter
        ))
    )
    insurance_data = insurance_result.first()
    insurance_visits = insurance_data[0] or 0
    total_insurance_limit = float(insurance_data[1] or 0)
    total_insurance_used = float(insurance_data[2] or 0)
    total_patient_topup = float(insurance_data[3] or 0)
    
    # Insurance by provider
    insurance_by_provider_result = await db.execute(
        select(Visit.insurance_provider, func.count(Visit.id), func.sum(Visit.insurance_used))
        .where(and_(
            Visit.visit_date >= start_date,
            Visit.payment_type == 'insurance',
            branch_filter
        ))
        .group_by(Visit.insurance_provider)
    )
    insurance_by_provider = [
        {"provider": row[0] or 'Unknown', "visits": row[1], "amount_used": float(row[2] or 0)}
        for row in insurance_by_provider_result.all()
    ]
    
    # ============ OUTSTANDING PAYMENTS ============
    outstanding_result = await db.execute(
        select(
            func.count(Visit.id),
            func.sum(Visit.consultation_fee - Visit.amount_paid)
        )
        .where(and_(
            Visit.payment_status.in_(['unpaid', 'partial']),
            branch_filter
        ))
    )
    outstanding_data = outstanding_result.first()
    outstanding_count = outstanding_data[0] or 0
    outstanding_amount = float(outstanding_data[1] or 0)
    
    # ============ DAILY TRENDS ============
    # Get daily visit and revenue data for charts
    daily_data = []
    for i in range(min(30, period_length)):
        day = now - timedelta(days=i)
        day_start = day.replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day_start + timedelta(days=1)
        
        # Get visits count
        day_visits_result = await db.execute(
            select(func.count(Visit.id))
            .where(and_(
                Visit.visit_date >= day_start,
                Visit.visit_date < day_end,
                branch_filter
            ))
        )
        day_visits = day_visits_result.scalar() or 0
        
        # Get revenue from Revenue table
        day_revenue_result = await db.execute(
            select(func.sum(Revenue.amount))
            .where(and_(
                Revenue.created_at >= day_start,
                Revenue.created_at < day_end,
                branch_revenue_filter
            ))
        )
        day_revenue = float(day_revenue_result.scalar() or 0)
        
        daily_data.append({
            "date": day_start.strftime("%Y-%m-%d"),
            "visits": day_visits,
            "revenue": day_revenue
        })
    
    daily_data.reverse()  # Oldest to newest
    
    return {
        "period": period,
        "start_date": start_date.isoformat(),
        "end_date": now.isoformat(),
        "summary": {
            "total_visits": total_visits,
            "visits_change_percent": round(visits_change, 1),
            "total_revenue": total_revenue,
            "consultation_revenue": consultation_revenue,
            "sales_revenue": sales_revenue,
            "revenue_change_percent": round(revenue_change, 1),
            "new_patients": new_patients,
            "total_patients": total_patients,
            "outstanding_count": outstanding_count,
            "outstanding_amount": outstanding_amount,
        },
        "visits": {
            "by_status": visits_by_status,
            "by_payment_type": visits_by_payment,
        },
        "revenue": {
            "by_payment_type": revenue_by_payment,
            "by_category": revenue_by_category,
        },
        "patients": {
            "by_gender": patients_by_gender,
        },
        "insurance": {
            "total_visits": insurance_visits,
            "total_limit": total_insurance_limit,
            "total_used": total_insurance_used,
            "total_patient_topup": total_patient_topup,
            "by_provider": insurance_by_provider,
        },
        "trends": {
            "daily": daily_data,
        }
    }


@router.get("/out-of-stock")
async def get_out_of_stock_analytics(
    days: int = Query(30, description="Number of days to analyze"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get analytics for out-of-stock prescription requests"""
    cutoff_date = datetime.utcnow() - timedelta(days=days)
    
    # Get aggregated out-of-stock requests grouped by product
    result = await db.execute(
        select(
            OutOfStockRequest.product_id,
            OutOfStockRequest.product_name,
            func.count(OutOfStockRequest.id).label('request_count'),
            func.sum(OutOfStockRequest.quantity_requested).label('total_quantity'),
            func.max(OutOfStockRequest.created_at).label('last_requested')
        )
        .where(OutOfStockRequest.created_at >= cutoff_date)
        .group_by(OutOfStockRequest.product_id, OutOfStockRequest.product_name)
        .order_by(func.count(OutOfStockRequest.id).desc())
        .limit(50)
    )
    
    items = result.all()
    
    # Get total count
    total_result = await db.execute(
        select(func.count(OutOfStockRequest.id))
        .where(OutOfStockRequest.created_at >= cutoff_date)
    )
    total_requests = total_result.scalar() or 0
    
    return {
        "period_days": days,
        "total_requests": total_requests,
        "unique_products": len(items),
        "items": [
            {
                "product_id": row.product_id,
                "product_name": row.product_name,
                "request_count": row.request_count,
                "total_quantity_requested": row.total_quantity or 0,
                "last_requested": row.last_requested.isoformat() if row.last_requested else None,
            }
            for row in items
        ]
    }


@router.get("/inventory")
async def get_inventory_analytics(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get inventory analytics including low stock alerts"""
    
    # Total products
    total_products_result = await db.execute(
        select(func.count(Product.id)).where(Product.is_active == True)
    )
    total_products = total_products_result.scalar() or 0
    
    # Products by category
    products_by_category_result = await db.execute(
        select(ProductCategory.name, func.count(Product.id))
        .join(Product, Product.category_id == ProductCategory.id)
        .where(Product.is_active == True)
        .group_by(ProductCategory.name)
    )
    products_by_category = [
        {"category": row[0], "count": row[1]}
        for row in products_by_category_result.all()
    ]
    
    # Low stock items (stock <= min_quantity)
    low_stock_result = await db.execute(
        select(Product, BranchStock)
        .join(BranchStock, BranchStock.product_id == Product.id)
        .where(and_(
            Product.is_active == True,
            BranchStock.quantity <= BranchStock.min_quantity
        ))
        .order_by(BranchStock.quantity)
        .limit(20)
    )
    low_stock_items = [
        {
            "product_id": row.Product.id,
            "product_name": row.Product.name,
            "sku": row.Product.sku,
            "current_stock": row.BranchStock.quantity,
            "reorder_level": row.BranchStock.min_quantity,
            "branch_id": row.BranchStock.branch_id,
        }
        for row in low_stock_result.all()
    ]
    
    # Out of stock items
    out_of_stock_result = await db.execute(
        select(func.count(BranchStock.id))
        .where(BranchStock.quantity == 0)
    )
    out_of_stock_count = out_of_stock_result.scalar() or 0
    
    # Total inventory value
    inventory_value_result = await db.execute(
        select(func.sum(BranchStock.quantity * Product.cost_price))
        .join(Product, Product.id == BranchStock.product_id)
    )
    total_inventory_value = float(inventory_value_result.scalar() or 0)
    
    # Top selling products (last 30 days)
    thirty_days_ago = datetime.utcnow() - timedelta(days=30)
    top_selling_result = await db.execute(
        select(Product.id, Product.name, func.sum(SaleItem.quantity).label('total_sold'))
        .join(SaleItem, SaleItem.product_id == Product.id)
        .join(Sale, Sale.id == SaleItem.sale_id)
        .where(Sale.created_at >= thirty_days_ago)
        .group_by(Product.id, Product.name)
        .order_by(func.sum(SaleItem.quantity).desc())
        .limit(10)
    )
    top_selling = [
        {"product_id": row[0], "product_name": row[1], "total_sold": row[2]}
        for row in top_selling_result.all()
    ]
    
    return {
        "summary": {
            "total_products": total_products,
            "out_of_stock_count": out_of_stock_count,
            "low_stock_count": len(low_stock_items),
            "total_inventory_value": total_inventory_value,
        },
        "products_by_category": products_by_category,
        "low_stock_items": low_stock_items,
        "top_selling_products": top_selling,
    }


@router.get("/consultations")
async def get_consultation_analytics(
    period: str = Query("month", description="today, week, month, quarter, year"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get consultation type analytics"""
    
    # Calculate date range
    now = datetime.utcnow()
    if period == "today":
        start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
    elif period == "week":
        start_date = now - timedelta(days=7)
    elif period == "month":
        start_date = now - timedelta(days=30)
    elif period == "quarter":
        start_date = now - timedelta(days=90)
    elif period == "year":
        start_date = now - timedelta(days=365)
    else:
        start_date = now - timedelta(days=30)
    
    # Consultations by type
    consultations_by_type_result = await db.execute(
        select(ConsultationType.name, func.count(Visit.id), func.sum(Visit.consultation_fee))
        .join(Visit, Visit.consultation_type_id == ConsultationType.id)
        .where(Visit.visit_date >= start_date)
        .group_by(ConsultationType.name)
    )
    consultations_by_type = [
        {"type": row[0], "count": row[1], "revenue": float(row[2] or 0)}
        for row in consultations_by_type_result.all()
    ]
    
    # Average consultation fee
    avg_fee_result = await db.execute(
        select(func.avg(Visit.consultation_fee))
        .where(and_(Visit.visit_date >= start_date, Visit.consultation_fee > 0))
    )
    avg_consultation_fee = float(avg_fee_result.scalar() or 0)
    
    # Consultations completed vs pending
    status_result = await db.execute(
        select(Visit.status, func.count(Visit.id))
        .where(Visit.visit_date >= start_date)
        .group_by(Visit.status)
    )
    by_status = {row[0]: row[1] for row in status_result.all()}
    
    return {
        "period": period,
        "by_type": consultations_by_type,
        "average_fee": round(avg_consultation_fee, 2),
        "by_status": by_status,
    }


@router.get("/staff-performance")
async def get_staff_performance(
    period: str = Query("month", description="today, week, month, quarter, year"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get staff performance analytics"""
    
    # Calculate date range
    now = datetime.utcnow()
    if period == "today":
        start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
    elif period == "week":
        start_date = now - timedelta(days=7)
    elif period == "month":
        start_date = now - timedelta(days=30)
    elif period == "quarter":
        start_date = now - timedelta(days=90)
    elif period == "year":
        start_date = now - timedelta(days=365)
    else:
        start_date = now - timedelta(days=30)
    
    # Visits recorded by staff
    visits_by_staff_result = await db.execute(
        select((User.first_name + ' ' + User.last_name).label('full_name'), func.count(Visit.id))
        .join(User, User.id == Visit.recorded_by_id)
        .where(Visit.visit_date >= start_date)
        .group_by(User.first_name, User.last_name)
        .order_by(func.count(Visit.id).desc())
        .limit(10)
    )
    visits_by_staff = [
        {"staff_name": row[0], "visits_recorded": row[1]}
        for row in visits_by_staff_result.all()
    ]
    
    # Consultations by doctor
    consultations_by_doctor_result = await db.execute(
        select((User.first_name + ' ' + User.last_name).label('full_name'), func.count(Consultation.id))
        .join(User, User.id == Consultation.doctor_id)
        .where(Consultation.created_at >= start_date)
        .group_by(User.first_name, User.last_name)
        .order_by(func.count(Consultation.id).desc())
        .limit(10)
    )
    consultations_by_doctor = [
        {"doctor_name": row[0], "consultations": row[1]}
        for row in consultations_by_doctor_result.all()
    ]
    
    # Attendance summary
    attendance_result = await db.execute(
        select(
            func.count(Attendance.id),
            func.count(case((Attendance.status == 'present', 1))),
            func.count(case((Attendance.status == 'late', 1))),
            func.count(case((Attendance.status == 'absent', 1)))
        )
        .where(Attendance.date >= start_date.date())
    )
    attendance_data = attendance_result.first()
    
    return {
        "period": period,
        "visits_by_staff": visits_by_staff,
        "consultations_by_doctor": consultations_by_doctor,
        "attendance": {
            "total_records": attendance_data[0] or 0,
            "present": attendance_data[1] or 0,
            "late": attendance_data[2] or 0,
            "absent": attendance_data[3] or 0,
        }
    }


@router.get("/financial")
async def get_financial_analytics(
    period: str = Query("month", description="today, week, month, quarter, year"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get financial analytics including income and expenses"""
    
    # Calculate date range
    now = datetime.utcnow()
    if period == "today":
        start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
    elif period == "week":
        start_date = now - timedelta(days=7)
    elif period == "month":
        start_date = now - timedelta(days=30)
    elif period == "quarter":
        start_date = now - timedelta(days=90)
    elif period == "year":
        start_date = now - timedelta(days=365)
    else:
        start_date = now - timedelta(days=30)
    
    # Total income
    income_result = await db.execute(
        select(func.sum(Income.amount))
        .where(Income.income_date >= start_date.date())
    )
    total_income = float(income_result.scalar() or 0)
    
    # Total expenses
    expense_result = await db.execute(
        select(func.sum(Expense.amount))
        .where(Expense.expense_date >= start_date.date())
    )
    total_expenses = float(expense_result.scalar() or 0)
    
    # Net profit
    net_profit = total_income - total_expenses
    
    # Income by category
    income_by_category_result = await db.execute(
        select(IncomeCategory.name, func.sum(Income.amount))
        .join(IncomeCategory, IncomeCategory.id == Income.category_id, isouter=True)
        .where(Income.income_date >= start_date.date())
        .group_by(IncomeCategory.name)
    )
    income_by_category = [
        {"category": row[0] or 'Other', "amount": float(row[1] or 0)}
        for row in income_by_category_result.all()
    ]
    
    # Expenses by category
    expense_by_category_result = await db.execute(
        select(ExpenseCategory.name, func.sum(Expense.amount))
        .join(ExpenseCategory, ExpenseCategory.id == Expense.category_id, isouter=True)
        .where(Expense.expense_date >= start_date.date())
        .group_by(ExpenseCategory.name)
    )
    expense_by_category = [
        {"category": row[0] or 'Other', "amount": float(row[1] or 0)}
        for row in expense_by_category_result.all()
    ]
    
    return {
        "period": period,
        "summary": {
            "total_income": total_income,
            "total_expenses": total_expenses,
            "net_profit": net_profit,
            "profit_margin": round((net_profit / total_income * 100) if total_income > 0 else 0, 1),
        },
        "income_by_category": income_by_category,
        "expense_by_category": expense_by_category,
    }
