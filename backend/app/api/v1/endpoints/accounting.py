from typing import List, Optional
from datetime import date, datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_

from app.core.database import get_db
from app.api.v1.deps import get_current_active_user
from app.models.user import User
from app.models.accounting import IncomeCategory, ExpenseCategory, Income, Expense, FinancialSummary
from app.models.sales import Sale
from app.models.patient import Patient, Visit
from app.schemas.accounting import (
    IncomeCategoryCreate, IncomeCategoryResponse,
    ExpenseCategoryCreate, ExpenseCategoryResponse,
    IncomeCreate, IncomeResponse,
    ExpenseCreate, ExpenseUpdate, ExpenseResponse,
    FinancialSummaryResponse, FinancialReportRequest
)

router = APIRouter()


@router.get("/income-categories", response_model=List[IncomeCategoryResponse])
async def get_income_categories(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    result = await db.execute(select(IncomeCategory).where(IncomeCategory.is_active == True))
    return result.scalars().all()


@router.post("/income-categories", response_model=IncomeCategoryResponse)
async def create_income_category(
    category_in: IncomeCategoryCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    category = IncomeCategory(**category_in.model_dump())
    db.add(category)
    await db.commit()
    await db.refresh(category)
    return category


@router.get("/expense-categories", response_model=List[ExpenseCategoryResponse])
async def get_expense_categories(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    result = await db.execute(select(ExpenseCategory).where(ExpenseCategory.is_active == True))
    return result.scalars().all()


@router.post("/expense-categories", response_model=ExpenseCategoryResponse)
async def create_expense_category(
    category_in: ExpenseCategoryCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    category = ExpenseCategory(**category_in.model_dump())
    db.add(category)
    await db.commit()
    await db.refresh(category)
    return category


@router.get("/incomes", response_model=List[IncomeResponse])
async def get_incomes(
    branch_id: Optional[int] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    query = select(Income)
    if branch_id:
        query = query.where(Income.branch_id == branch_id)
    if start_date:
        query = query.where(Income.income_date >= start_date)
    if end_date:
        query = query.where(Income.income_date <= end_date)
    
    query = query.order_by(Income.income_date.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


@router.post("/incomes", response_model=IncomeResponse)
async def create_income(
    income_in: IncomeCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    income = Income(**income_in.model_dump(), recorded_by_id=current_user.id)
    db.add(income)
    await db.commit()
    await db.refresh(income)
    return income


@router.get("/expenses", response_model=List[ExpenseResponse])
async def get_expenses(
    branch_id: Optional[int] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    approved_only: bool = False,
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    query = select(Expense)
    if branch_id:
        query = query.where(Expense.branch_id == branch_id)
    if start_date:
        query = query.where(Expense.expense_date >= start_date)
    if end_date:
        query = query.where(Expense.expense_date <= end_date)
    if approved_only:
        query = query.where(Expense.is_approved == True)
    
    query = query.order_by(Expense.expense_date.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


@router.post("/expenses", response_model=ExpenseResponse)
async def create_expense(
    expense_in: ExpenseCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    expense = Expense(**expense_in.model_dump(), recorded_by_id=current_user.id)
    db.add(expense)
    await db.commit()
    await db.refresh(expense)
    return expense


@router.put("/expenses/{expense_id}", response_model=ExpenseResponse)
async def update_expense(
    expense_id: int,
    expense_in: ExpenseUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    result = await db.execute(select(Expense).where(Expense.id == expense_id))
    expense = result.scalar_one_or_none()
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    
    for field, value in expense_in.model_dump(exclude_unset=True).items():
        setattr(expense, field, value)
    
    await db.commit()
    await db.refresh(expense)
    return expense


@router.put("/expenses/{expense_id}/approve")
async def approve_expense(
    expense_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    result = await db.execute(select(Expense).where(Expense.id == expense_id))
    expense = result.scalar_one_or_none()
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    
    expense.is_approved = True
    expense.approved_by_id = current_user.id
    expense.approved_at = datetime.utcnow()
    
    await db.commit()
    return {"message": "Expense approved"}


@router.post("/reports/generate")
async def generate_financial_report(
    report_in: FinancialReportRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    income_query = select(func.coalesce(func.sum(Income.amount), 0))
    expense_query = select(func.coalesce(func.sum(Expense.amount), 0))
    sales_query = select(func.count(Sale.id))
    patients_query = select(func.count(Patient.id))
    visits_query = select(func.count(Visit.id))
    
    if report_in.branch_id:
        income_query = income_query.where(Income.branch_id == report_in.branch_id)
        expense_query = expense_query.where(Expense.branch_id == report_in.branch_id)
        sales_query = sales_query.where(Sale.branch_id == report_in.branch_id)
        patients_query = patients_query.where(Patient.branch_id == report_in.branch_id)
        visits_query = visits_query.where(Visit.branch_id == report_in.branch_id)
    
    income_query = income_query.where(
        and_(Income.income_date >= report_in.start_date, Income.income_date <= report_in.end_date)
    )
    expense_query = expense_query.where(
        and_(Expense.expense_date >= report_in.start_date, Expense.expense_date <= report_in.end_date)
    )
    sales_query = sales_query.where(
        and_(func.date(Sale.created_at) >= report_in.start_date, func.date(Sale.created_at) <= report_in.end_date)
    )
    patients_query = patients_query.where(
        and_(func.date(Patient.created_at) >= report_in.start_date, func.date(Patient.created_at) <= report_in.end_date)
    )
    visits_query = visits_query.where(
        and_(func.date(Visit.visit_date) >= report_in.start_date, func.date(Visit.visit_date) <= report_in.end_date)
    )
    
    total_income = (await db.execute(income_query)).scalar() or 0
    total_expenses = (await db.execute(expense_query)).scalar() or 0
    sales_count = (await db.execute(sales_query)).scalar() or 0
    patients_count = (await db.execute(patients_query)).scalar() or 0
    visits_count = (await db.execute(visits_query)).scalar() or 0
    
    summary = FinancialSummary(
        branch_id=report_in.branch_id,
        period_type="custom",
        period_start=report_in.start_date,
        period_end=report_in.end_date,
        total_income=total_income,
        total_expenses=total_expenses,
        net_profit=float(total_income) - float(total_expenses),
        sales_count=sales_count,
        patients_count=patients_count,
        visits_count=visits_count
    )
    db.add(summary)
    await db.commit()
    await db.refresh(summary)
    
    return {
        "id": summary.id,
        "period_start": report_in.start_date,
        "period_end": report_in.end_date,
        "total_income": float(total_income),
        "total_expenses": float(total_expenses),
        "net_profit": float(total_income) - float(total_expenses),
        "sales_count": sales_count,
        "patients_count": patients_count,
        "visits_count": visits_count
    }


@router.get("/dashboard")
async def get_accounting_dashboard(
    branch_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    today = date.today()
    month_start = today.replace(day=1)
    year_start = today.replace(month=1, day=1)
    
    async def get_totals(start: date, end: date):
        income_q = select(func.coalesce(func.sum(Income.amount), 0)).where(
            and_(Income.income_date >= start, Income.income_date <= end)
        )
        expense_q = select(func.coalesce(func.sum(Expense.amount), 0)).where(
            and_(Expense.expense_date >= start, Expense.expense_date <= end)
        )
        
        if branch_id:
            income_q = income_q.where(Income.branch_id == branch_id)
            expense_q = expense_q.where(Expense.branch_id == branch_id)
        
        income = (await db.execute(income_q)).scalar() or 0
        expense = (await db.execute(expense_q)).scalar() or 0
        return float(income), float(expense)
    
    today_income, today_expense = await get_totals(today, today)
    month_income, month_expense = await get_totals(month_start, today)
    year_income, year_expense = await get_totals(year_start, today)
    
    return {
        "today": {
            "income": today_income,
            "expenses": today_expense,
            "profit": today_income - today_expense
        },
        "month": {
            "income": month_income,
            "expenses": month_expense,
            "profit": month_income - month_expense
        },
        "year": {
            "income": year_income,
            "expenses": year_expense,
            "profit": year_income - year_expense
        }
    }
