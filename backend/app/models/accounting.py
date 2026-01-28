from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Numeric, Boolean, Date
from sqlalchemy.orm import relationship

from app.core.database import Base


class IncomeCategory(Base):
    __tablename__ = "income_categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    incomes = relationship("Income", back_populates="category")


class ExpenseCategory(Base):
    __tablename__ = "expense_categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    expenses = relationship("Expense", back_populates="category")


class Income(Base):
    __tablename__ = "incomes"

    id = Column(Integer, primary_key=True, index=True)
    branch_id = Column(Integer, ForeignKey("branches.id"), nullable=False)
    category_id = Column(Integer, ForeignKey("income_categories.id"))
    sale_id = Column(Integer, ForeignKey("sales.id"))
    
    amount = Column(Numeric(10, 2), nullable=False)
    description = Column(Text)
    reference = Column(String(100))
    income_date = Column(Date, nullable=False)
    
    recorded_by_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)

    branch = relationship("Branch")
    category = relationship("IncomeCategory", back_populates="incomes")
    sale = relationship("Sale")
    recorded_by = relationship("User")


class Expense(Base):
    __tablename__ = "expenses"

    id = Column(Integer, primary_key=True, index=True)
    branch_id = Column(Integer, ForeignKey("branches.id"), nullable=False)
    category_id = Column(Integer, ForeignKey("expense_categories.id"))
    
    amount = Column(Numeric(10, 2), nullable=False)
    description = Column(Text)
    vendor = Column(String(200))
    reference = Column(String(100))
    expense_date = Column(Date, nullable=False)
    
    receipt_path = Column(String(500))
    is_approved = Column(Boolean, default=False)
    approved_by_id = Column(Integer, ForeignKey("users.id"))
    approved_at = Column(DateTime)
    
    recorded_by_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)

    branch = relationship("Branch")
    category = relationship("ExpenseCategory", back_populates="expenses")
    recorded_by = relationship("User", foreign_keys=[recorded_by_id])
    approved_by = relationship("User", foreign_keys=[approved_by_id])


class FinancialSummary(Base):
    __tablename__ = "financial_summaries"

    id = Column(Integer, primary_key=True, index=True)
    branch_id = Column(Integer, ForeignKey("branches.id"))
    period_type = Column(String(20))
    period_start = Column(Date, nullable=False)
    period_end = Column(Date, nullable=False)
    
    total_income = Column(Numeric(12, 2), default=0)
    total_expenses = Column(Numeric(12, 2), default=0)
    net_profit = Column(Numeric(12, 2), default=0)
    
    sales_count = Column(Integer, default=0)
    patients_count = Column(Integer, default=0)
    visits_count = Column(Integer, default=0)
    
    generated_at = Column(DateTime, default=datetime.utcnow)

    branch = relationship("Branch")
