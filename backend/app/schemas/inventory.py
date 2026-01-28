from datetime import date, datetime
from typing import Optional, List
from pydantic import BaseModel


class WarehouseBase(BaseModel):
    name: str
    location: Optional[str] = None
    contact_person: Optional[str] = None
    contact_phone: Optional[str] = None


class WarehouseCreate(WarehouseBase):
    pass


class WarehouseResponse(WarehouseBase):
    id: int
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class WarehouseStockResponse(BaseModel):
    id: int
    warehouse_id: int
    product_id: int
    quantity: int
    min_quantity: int
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ImportItemCreate(BaseModel):
    product_id: int
    expected_quantity: int
    unit_cost: Optional[float] = None


class ImportCreate(BaseModel):
    warehouse_id: int
    vendor_id: Optional[int] = None
    supplier_name: Optional[str] = None
    reference_number: Optional[str] = None
    expected_date: Optional[date] = None
    total_cost: Optional[float] = None
    notes: Optional[str] = None
    items: List[ImportItemCreate] = []


class ImportItemResponse(BaseModel):
    id: int
    product_id: int
    expected_quantity: int
    received_quantity: int
    unit_cost: Optional[float] = None

    class Config:
        from_attributes = True


class ImportResponse(BaseModel):
    id: int
    warehouse_id: int
    supplier_name: Optional[str] = None
    reference_number: Optional[str] = None
    expected_date: Optional[date] = None
    arrival_date: Optional[date] = None
    status: str
    notes: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class StockTransferItemCreate(BaseModel):
    product_id: int
    requested_quantity: int


class StockTransferCreate(BaseModel):
    from_warehouse_id: int
    to_branch_id: int
    notes: Optional[str] = None
    items: List[StockTransferItemCreate] = []


class StockTransferItemResponse(BaseModel):
    id: int
    product_id: int
    requested_quantity: int
    approved_quantity: Optional[int] = None
    received_quantity: Optional[int] = None

    class Config:
        from_attributes = True


class StockTransferResponse(BaseModel):
    id: int
    from_warehouse_id: Optional[int] = None
    to_branch_id: int
    status: str
    request_date: datetime
    approved_date: Optional[datetime] = None
    completed_date: Optional[datetime] = None
    notes: Optional[str] = None

    class Config:
        from_attributes = True


class StockAlertResponse(BaseModel):
    id: int
    branch_id: Optional[int] = None
    warehouse_id: Optional[int] = None
    product_id: int
    alert_type: Optional[str] = None
    current_quantity: Optional[int] = None
    min_quantity: Optional[int] = None
    is_resolved: bool
    created_at: datetime

    class Config:
        from_attributes = True
