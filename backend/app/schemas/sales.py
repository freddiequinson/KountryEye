from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel


class ProductCategoryBase(BaseModel):
    name: str
    description: Optional[str] = None
    category_type: Optional[str] = "general"  # medication, optical, general


class ProductCategoryCreate(ProductCategoryBase):
    pass


class ProductCategoryResponse(ProductCategoryBase):
    id: int
    category_type: Optional[str] = "general"
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class ProductBase(BaseModel):
    name: str
    description: Optional[str] = None
    category_id: Optional[int] = None
    unit_price: float
    cost_price: Optional[float] = None
    requires_prescription: bool = False


class ProductCreate(ProductBase):
    sku: Optional[str] = None
    reorder_level: Optional[int] = 10
    initial_stock: Optional[int] = 0
    branch_id: Optional[int] = 1


class ProductUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    category_id: Optional[int] = None
    unit_price: Optional[float] = None
    cost_price: Optional[float] = None
    requires_prescription: Optional[bool] = None
    is_active: Optional[bool] = None


class ProductCategorySimple(BaseModel):
    id: int
    name: str
    
    class Config:
        from_attributes = True


class ProductResponse(ProductBase):
    id: int
    sku: str
    is_active: bool
    image_url: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    category: Optional[ProductCategorySimple] = None

    class Config:
        from_attributes = True


class BranchStockResponse(BaseModel):
    id: int
    branch_id: int
    product_id: int
    quantity: int
    min_quantity: int
    last_restocked: Optional[datetime] = None

    class Config:
        from_attributes = True


class SaleItemCreate(BaseModel):
    product_id: int
    quantity: int
    unit_price: Optional[float] = None
    discount: float = 0


class SaleCreate(BaseModel):
    branch_id: int
    patient_id: Optional[int] = None
    visit_id: Optional[int] = None
    prescription_id: Optional[int] = None
    items: List[SaleItemCreate]
    discount_amount: float = 0
    discount_percent: float = 0
    discount_reason: Optional[str] = None
    payment_method: Optional[str] = None
    notes: Optional[str] = None


class SaleItemResponse(BaseModel):
    id: int
    product_id: int
    quantity: int
    unit_price: float
    discount: float
    total: float

    class Config:
        from_attributes = True


class SaleResponse(BaseModel):
    id: int
    receipt_number: str
    branch_id: int
    patient_id: Optional[int] = None
    prescription_id: Optional[int] = None
    cashier_id: int
    subtotal: float
    discount_amount: float
    discount_percent: float
    tax_amount: float
    total_amount: float
    payment_method: Optional[str] = None
    payment_status: str
    paid_amount: float
    change_amount: float
    created_at: datetime
    completed_at: Optional[datetime] = None
    items: List[SaleItemResponse] = []

    class Config:
        from_attributes = True


class PaymentCreate(BaseModel):
    sale_id: int
    amount: float
    payment_method: str
    reference: Optional[str] = None


class PaymentResponse(BaseModel):
    id: int
    sale_id: int
    amount: float
    payment_method: str
    reference: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True
