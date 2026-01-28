from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel


class IncomeCategoryBase(BaseModel):
    name: str
    description: Optional[str] = None


class IncomeCategoryCreate(IncomeCategoryBase):
    pass


class IncomeCategoryResponse(IncomeCategoryBase):
    id: int
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class ExpenseCategoryBase(BaseModel):
    name: str
    description: Optional[str] = None


class ExpenseCategoryCreate(ExpenseCategoryBase):
    pass


class ExpenseCategoryResponse(ExpenseCategoryBase):
    id: int
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class IncomeBase(BaseModel):
    amount: float
    description: Optional[str] = None
    reference: Optional[str] = None
    income_date: date


class IncomeCreate(IncomeBase):
    branch_id: int
    category_id: Optional[int] = None
    sale_id: Optional[int] = None


class IncomeResponse(IncomeBase):
    id: int
    branch_id: int
    category_id: Optional[int] = None
    sale_id: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ExpenseBase(BaseModel):
    amount: float
    description: Optional[str] = None
    vendor: Optional[str] = None
    reference: Optional[str] = None
    expense_date: date


class ExpenseCreate(ExpenseBase):
    branch_id: int
    category_id: Optional[int] = None


class ExpenseUpdate(BaseModel):
    amount: Optional[float] = None
    description: Optional[str] = None
    vendor: Optional[str] = None
    reference: Optional[str] = None
    expense_date: Optional[date] = None
    category_id: Optional[int] = None


class ExpenseResponse(ExpenseBase):
    id: int
    branch_id: int
    category_id: Optional[int] = None
    is_approved: bool
    approved_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class FinancialSummaryResponse(BaseModel):
    id: int
    branch_id: Optional[int] = None
    period_type: Optional[str] = None
    period_start: date
    period_end: date
    total_income: float
    total_expenses: float
    net_profit: float
    sales_count: int
    patients_count: int
    visits_count: int
    generated_at: datetime

    class Config:
        from_attributes = True


class FinancialReportRequest(BaseModel):
    branch_id: Optional[int] = None
    start_date: date
    end_date: date
