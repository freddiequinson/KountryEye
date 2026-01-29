from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
import csv
import io

from app.core.database import get_db
from app.api.v1.deps import get_current_active_user
from app.models.user import User
from app.models.sales import ProductCategory, Product, BranchStock, Sale, SaleItem, Payment, PriceHistory
from app.models.revenue import Revenue
from app.models.accounting import Income
from app.schemas.sales import (
    ProductCategoryCreate, ProductCategoryResponse,
    ProductCreate, ProductUpdate, ProductResponse,
    BranchStockResponse, SaleCreate, SaleResponse,
    PaymentCreate, PaymentResponse
)

router = APIRouter()


@router.get("/overview")
async def get_sales_overview(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get sales overview for dashboard"""
    from datetime import date
    
    today = date.today()
    
    # Get today's sales
    today_sales = await db.execute(
        select(func.count(Sale.id), func.sum(Sale.total_amount)).where(
            func.date(Sale.created_at) == today
        )
    )
    today_count, today_total = today_sales.first()
    
    # Get month sales
    month_sales = await db.execute(
        select(func.count(Sale.id), func.sum(Sale.total_amount)).where(
            func.date(Sale.created_at) >= today.replace(day=1)
        )
    )
    month_count, month_total = month_sales.first()
    
    return {
        "today": {
            "count": today_count or 0,
            "total": float(today_total or 0)
        },
        "month": {
            "count": month_count or 0,
            "total": float(month_total or 0)
        }
    }


def generate_sku(category_id: int, count: int) -> str:
    return f"PRD-{category_id or 0:02d}-{count:05d}"


def generate_receipt_number(branch_id: int) -> str:
    import uuid
    timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S%f")[:17]  # Include microseconds
    unique_suffix = uuid.uuid4().hex[:4].upper()
    return f"RCP-{branch_id:02d}-{timestamp}-{unique_suffix}"


@router.get("/categories", response_model=List[ProductCategoryResponse])
async def get_categories(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    result = await db.execute(select(ProductCategory).where(ProductCategory.is_active == True))
    return result.scalars().all()


@router.post("/categories", response_model=ProductCategoryResponse)
async def create_category(
    category_in: ProductCategoryCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    category = ProductCategory(**category_in.model_dump())
    db.add(category)
    await db.commit()
    await db.refresh(category)
    return category


@router.put("/categories/{category_id}", response_model=ProductCategoryResponse)
async def update_category(
    category_id: int,
    category_in: ProductCategoryCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    result = await db.execute(select(ProductCategory).where(ProductCategory.id == category_id))
    category = result.scalar_one_or_none()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    
    for field, value in category_in.model_dump(exclude_unset=True).items():
        setattr(category, field, value)
    
    await db.commit()
    await db.refresh(category)
    return category


@router.delete("/categories/{category_id}")
async def delete_category(
    category_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    result = await db.execute(select(ProductCategory).where(ProductCategory.id == category_id))
    category = result.scalar_one_or_none()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    
    # Check if category has products
    products_result = await db.execute(select(func.count(Product.id)).where(Product.category_id == category_id))
    product_count = products_result.scalar()
    
    if product_count > 0:
        # Soft delete - just mark as inactive
        category.is_active = False
        await db.commit()
        return {"message": f"Category deactivated (has {product_count} products)"}
    else:
        # Hard delete if no products
        await db.delete(category)
        await db.commit()
        return {"message": "Category deleted successfully"}


@router.get("/products")
async def get_products(
    category_id: Optional[int] = None,
    category_type: Optional[str] = None,  # medication, optical, general
    search: Optional[str] = None,
    active_only: bool = True,
    include_stock: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    query = select(Product).options(selectinload(Product.category))
    if active_only:
        query = query.where(Product.is_active == True)
    if category_id:
        query = query.where(Product.category_id == category_id)
    if category_type:
        # Filter by category type (medication, optical, general)
        query = query.join(ProductCategory).where(ProductCategory.category_type == category_type)
    if search:
        query = query.where(Product.name.ilike(f"%{search}%"))
    
    result = await db.execute(query.order_by(Product.name))
    products = result.scalars().all()
    
    if not include_stock:
        return products
    
    # Get stock for each product (sum across all branches)
    stock_result = await db.execute(select(BranchStock))
    all_stock = stock_result.scalars().all()
    stock_by_product = {}
    for s in all_stock:
        if s.product_id not in stock_by_product:
            stock_by_product[s.product_id] = 0
        stock_by_product[s.product_id] += s.quantity
    
    # Return products with stock info
    return [
        {
            "id": p.id,
            "sku": p.sku,
            "name": p.name,
            "description": p.description,
            "category_id": p.category_id,
            "category": {"id": p.category.id, "name": p.category.name} if p.category else None,
            "unit_price": float(p.unit_price) if p.unit_price else 0,
            "cost_price": float(p.cost_price) if p.cost_price else 0,
            "is_active": p.is_active,
            "requires_prescription": p.requires_prescription,
            "stock_quantity": stock_by_product.get(p.id, 0),
            "created_at": p.created_at.isoformat() if p.created_at else None,
        }
        for p in products
    ]


@router.get("/products/export")
async def export_products(
    format: str = "csv",
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Export all products as CSV or XLSX"""
    # Get all products with their categories and stock
    result = await db.execute(
        select(Product).options(selectinload(Product.category))
    )
    products = result.scalars().all()
    
    # Get stock for each product
    stock_result = await db.execute(select(BranchStock))
    all_stock = stock_result.scalars().all()
    stock_by_product = {}
    for s in all_stock:
        if s.product_id not in stock_by_product:
            stock_by_product[s.product_id] = 0
        stock_by_product[s.product_id] += s.quantity
    
    if format.lower() == "xlsx":
        try:
            from openpyxl import Workbook
            
            wb = Workbook()
            ws = wb.active
            ws.title = "Products"
            
            # Headers
            headers = ["ID", "SKU", "Name", "Category", "Cost Price", "Sale Price", "Stock", "Description", "Created At"]
            ws.append(headers)
            
            # Data
            for p in products:
                ws.append([
                    p.id,
                    p.sku,
                    p.name,
                    p.category.name if p.category else "",
                    float(p.cost_price) if p.cost_price else 0,
                    float(p.unit_price) if p.unit_price else 0,
                    stock_by_product.get(p.id, 0),
                    p.description or "",
                    p.created_at.strftime("%Y-%m-%d %H:%M") if p.created_at else ""
                ])
            
            output = io.BytesIO()
            wb.save(output)
            output.seek(0)
            
            return StreamingResponse(
                output,
                media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                headers={"Content-Disposition": "attachment; filename=products.xlsx"}
            )
        except ImportError:
            format = "csv"
    
    # CSV export
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Headers
    writer.writerow(["ID", "SKU", "Name", "Category", "Cost Price", "Sale Price", "Stock", "Description", "Created At"])
    
    # Data
    for p in products:
        writer.writerow([
            p.id,
            p.sku,
            p.name,
            p.category.name if p.category else "",
            float(p.cost_price) if p.cost_price else 0,
            float(p.unit_price) if p.unit_price else 0,
            stock_by_product.get(p.id, 0),
            p.description or "",
            p.created_at.strftime("%Y-%m-%d %H:%M") if p.created_at else ""
        ])
    
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=products.csv"}
    )


@router.get("/products/{product_id}", response_model=ProductResponse)
async def get_product(
    product_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    result = await db.execute(
        select(Product)
        .options(selectinload(Product.category))
        .where(Product.id == product_id)
    )
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product


@router.post("/products", response_model=ProductResponse)
async def create_product(
    product_in: ProductCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    count_result = await db.execute(select(func.count(Product.id)))
    count = count_result.scalar() + 1
    
    sku = product_in.sku or generate_sku(product_in.category_id, count)
    
    # Extract initial_stock, branch_id, and reorder_level if provided
    product_data = product_in.model_dump(exclude={"sku", "initial_stock", "branch_id", "reorder_level"})
    initial_stock = getattr(product_in, 'initial_stock', None) or 0
    branch_id = getattr(product_in, 'branch_id', None) or 1
    reorder_level = getattr(product_in, 'reorder_level', None) or 10
    
    product = Product(**product_data, sku=sku)
    db.add(product)
    await db.flush()
    
    # Create initial stock if provided
    if initial_stock > 0:
        stock = BranchStock(
            branch_id=branch_id,
            product_id=product.id,
            quantity=initial_stock,
            min_quantity=reorder_level
        )
        db.add(stock)
    
    await db.commit()
    await db.refresh(product)
    return product


@router.put("/products/{product_id}", response_model=ProductResponse)
async def update_product(
    product_id: int,
    product_in: ProductUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    result = await db.execute(select(Product).where(Product.id == product_id))
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    if product_in.unit_price and product_in.unit_price != float(product.unit_price):
        price_history = PriceHistory(
            product_id=product_id,
            old_price=product.unit_price,
            new_price=product_in.unit_price,
            changed_by_id=current_user.id
        )
        db.add(price_history)
    
    for field, value in product_in.model_dump(exclude_unset=True).items():
        setattr(product, field, value)
    
    await db.commit()
    await db.refresh(product)
    return product


@router.delete("/products/{product_id}")
async def delete_product(
    product_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    result = await db.execute(select(Product).where(Product.id == product_id))
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    await db.delete(product)
    await db.commit()
    return {"message": "Product deleted successfully"}


@router.post("/products/{product_id}/image")
async def upload_product_image(
    product_id: int,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Upload an image for a product"""
    import os
    import uuid
    
    print(f"Upload request: filename={file.filename}, content_type={file.content_type}, size={file.size}")
    
    result = await db.execute(select(Product).where(Product.id == product_id))
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Validate file - just check that we have a file with content
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")
    
    # Get extension from filename
    file_ext = file.filename.split('.')[-1].lower() if '.' in file.filename else 'jpg'
    allowed_extensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'avif', 'svg']
    
    if file_ext not in allowed_extensions:
        raise HTTPException(status_code=400, detail=f"Invalid file extension '.{file_ext}'. Allowed: {', '.join(allowed_extensions)}")
    
    # Create uploads directory if it doesn't exist
    upload_dir = "uploads/products"
    os.makedirs(upload_dir, exist_ok=True)
    
    # Generate unique filename
    ext = file.filename.split('.')[-1] if '.' in file.filename else 'jpg'
    filename = f"{product_id}_{uuid.uuid4().hex[:8]}.{ext}"
    filepath = os.path.join(upload_dir, filename)
    
    # Save file
    content = await file.read()
    with open(filepath, 'wb') as f:
        f.write(content)
    
    # Update product with image URL
    product.image_url = f"/uploads/products/{filename}"
    await db.commit()
    
    return {"image_url": product.image_url, "message": "Image uploaded successfully"}


@router.get("/stock/{branch_id}", response_model=List[BranchStockResponse])
async def get_branch_stock(
    branch_id: int,
    low_stock_only: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    query = select(BranchStock).where(BranchStock.branch_id == branch_id)
    if low_stock_only:
        query = query.where(BranchStock.quantity <= BranchStock.min_quantity)
    
    result = await db.execute(query)
    return result.scalars().all()


@router.post("/products/import-csv")
async def import_products_csv(
    file: UploadFile = File(...),
    column_mapping: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Import products from CSV file.
    column_mapping should be JSON string like: {"name": "Product Name", "sku": "SKU", "unit_price": "Price"}
    """
    import json
    
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="File must be a CSV")
    
    content = await file.read()
    decoded = content.decode('utf-8')
    
    # Parse CSV and strip whitespace from headers
    lines = decoded.strip().split('\n')
    if not lines:
        raise HTTPException(status_code=400, detail="Empty CSV file")
    
    # Clean headers - strip whitespace
    headers = [h.strip().strip('"').strip("'") for h in lines[0].split(',')]
    
    # Rebuild CSV with clean headers
    clean_csv = ','.join(headers) + '\n' + '\n'.join(lines[1:])
    reader = csv.DictReader(io.StringIO(clean_csv))
    
    # Parse column mapping if provided
    mapping = {}
    if column_mapping:
        try:
            mapping = json.loads(column_mapping)
        except json.JSONDecodeError:
            raise HTTPException(status_code=400, detail="Invalid column mapping JSON")
    
    created = 0
    updated = 0
    errors = []
    
    for row_num, row in enumerate(reader, start=2):
        try:
            # Helper to get value using mapping or fallback names
            def get_mapped_value(field_key: str, *fallbacks):
                # First try the mapped column name (check for non-empty string)
                mapped_col = mapping.get(field_key, '')
                if mapped_col and mapped_col.strip():
                    val = row.get(mapped_col)
                    if val is not None and str(val).strip():
                        return str(val).strip()
                # Then try fallbacks
                for fb in fallbacks:
                    val = row.get(fb)
                    if val is not None and str(val).strip():
                        return str(val).strip()
                return None
            
            name = get_mapped_value('name', 'name', 'Name', ' Name', 'product_name', 'Product Name', 'ProductName', 'PRODUCT', 'product')
            sku = get_mapped_value('sku', 'sku', 'SKU', 'Sku', ' SKU', 'product_sku', 'PRODUCT SKU', 'Product SKU')
            unit_price = get_mapped_value('unit_price', 'unit_price', 'price', 'Price', ' Price', 'PRICE', 'sale_price', 'Sale Price', 'SalePrice', 'SALE PRICE', 'selling_price', 'Selling Price', 'SP', ' SP', 'sp')
            cost_price = get_mapped_value('cost_price', 'cost_price', 'cost', 'Cost', ' Cost', 'COST', 'CostPrice', 'COST PRICE', 'buying_price', 'Buying Price', 'CP', ' CP', 'cp')
            description = get_mapped_value('description', 'description', 'Description', ' Description', 'DESCRIPTION', 'desc', 'Desc', 'DESC')
            category_name = get_mapped_value('category', 'category', 'Category', ' Category', 'CATEGORY', 'category_name', 'CategoryName', 'CATEGORY NAME')
            stock_qty = get_mapped_value('stock_quantity', 'stock_quantity', 'stock', 'Stock', ' Stock', 'STOCK', 'quantity', 'Quantity', ' quantity', 'QUANTITY', 'qty', 'Qty', ' qty', 'QTY', 'branch_quantity', 'Branch Quantity')
            branch_id_str = get_mapped_value('branch_id', 'branch_id', 'branch', 'Branch', ' Branch', 'BRANCH', 'Branch ID', 'BRANCH ID', 'qb', ' qb', 'QB')
            
            if not name:
                errors.append(f"Row {row_num}: Missing product name")
                continue
            
            if not unit_price:
                errors.append(f"Row {row_num}: Missing unit price for {name}")
                continue
            
            # Find or create category
            category_id = None
            if category_name:
                cat_result = await db.execute(
                    select(ProductCategory).where(ProductCategory.name == category_name)
                )
                category = cat_result.scalar_one_or_none()
                if not category:
                    category = ProductCategory(name=category_name)
                    db.add(category)
                    await db.flush()
                category_id = category.id
            
            # Check if product exists by SKU
            existing = None
            if sku:
                existing_result = await db.execute(select(Product).where(Product.sku == sku))
                existing = existing_result.scalar_one_or_none()
            
            if existing:
                # Update existing product
                existing.name = name
                existing.unit_price = float(unit_price)
                if cost_price:
                    existing.cost_price = float(cost_price)
                if description:
                    existing.description = description
                if category_id:
                    existing.category_id = category_id
                updated += 1
                product_id = existing.id
            else:
                # Create new product
                count_result = await db.execute(select(func.count(Product.id)))
                count = count_result.scalar() + 1
                
                product = Product(
                    name=name,
                    sku=sku or generate_sku(category_id, count),
                    unit_price=float(unit_price),
                    cost_price=float(cost_price) if cost_price else None,
                    description=description,
                    category_id=category_id,
                )
                db.add(product)
                await db.flush()
                product_id = product.id
                created += 1
            
            # Handle stock if provided
            if stock_qty:
                try:
                    qty = int(float(stock_qty))
                    branch_id = int(branch_id_str) if branch_id_str else 1
                    
                    stock_result = await db.execute(
                        select(BranchStock).where(
                            BranchStock.branch_id == branch_id,
                            BranchStock.product_id == product_id
                        )
                    )
                    stock = stock_result.scalar_one_or_none()
                    
                    if stock:
                        stock.quantity = qty
                    else:
                        stock = BranchStock(
                            branch_id=branch_id,
                            product_id=product_id,
                            quantity=qty,
                            min_quantity=10
                        )
                        db.add(stock)
                except (ValueError, TypeError):
                    pass  # Ignore invalid stock values
                
        except Exception as e:
            errors.append(f"Row {row_num}: {str(e)}")
    
    await db.commit()
    
    # Get stock counts for verification
    stock_count_result = await db.execute(select(func.count(BranchStock.id)))
    total_stock_records = stock_count_result.scalar()
    
    return {
        "created": created,
        "updated": updated,
        "errors": errors[:10],  # Return first 10 errors
        "total_errors": len(errors),
        "stock_records": total_stock_records,
        "headers_found": headers if 'headers' in dir() else [],
    }


@router.post("/create", response_model=SaleResponse)
async def create_sale(
    sale_in: SaleCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    subtotal = 0
    sale_items = []
    
    for item_in in sale_in.items:
        product_result = await db.execute(select(Product).where(Product.id == item_in.product_id))
        product = product_result.scalar_one_or_none()
        if not product:
            raise HTTPException(status_code=404, detail=f"Product {item_in.product_id} not found")
        
        # Check stock availability
        stock_result = await db.execute(
            select(BranchStock).where(
                BranchStock.branch_id == sale_in.branch_id,
                BranchStock.product_id == item_in.product_id
            )
        )
        stock = stock_result.scalar_one_or_none()
        available_qty = stock.quantity if stock else 0
        if item_in.quantity > available_qty:
            raise HTTPException(
                status_code=400, 
                detail=f"Insufficient stock for {product.name}. Available: {available_qty}, Requested: {item_in.quantity}"
            )
        
        unit_price = item_in.unit_price or float(product.unit_price)
        item_total = (unit_price * item_in.quantity) - item_in.discount
        subtotal += item_total
        
        sale_items.append({
            "product_id": item_in.product_id,
            "quantity": item_in.quantity,
            "unit_price": unit_price,
            "discount": item_in.discount,
            "total": item_total
        })
    
    discount_from_percent = subtotal * (sale_in.discount_percent / 100)
    total_discount = sale_in.discount_amount + discount_from_percent
    total_amount = subtotal - total_discount
    
    sale = Sale(
        receipt_number=generate_receipt_number(sale_in.branch_id),
        branch_id=sale_in.branch_id,
        patient_id=sale_in.patient_id,
        prescription_id=sale_in.prescription_id,
        cashier_id=current_user.id,
        subtotal=subtotal,
        discount_amount=sale_in.discount_amount,
        discount_percent=sale_in.discount_percent,
        discount_reason=sale_in.discount_reason,
        total_amount=total_amount,
        payment_method=sale_in.payment_method,
        notes=sale_in.notes
    )
    db.add(sale)
    await db.flush()
    
    for item_data in sale_items:
        sale_item = SaleItem(sale_id=sale.id, **item_data)
        db.add(sale_item)
        
        stock_result = await db.execute(
            select(BranchStock).where(
                BranchStock.branch_id == sale_in.branch_id,
                BranchStock.product_id == item_data["product_id"]
            )
        )
        stock = stock_result.scalar_one_or_none()
        if stock:
            stock.quantity -= item_data["quantity"]
    
    # Record revenue for this sale
    revenue = Revenue(
        category="product_sale",
        description=f"Sale {sale.receipt_number}",
        amount=total_amount,
        payment_method=sale_in.payment_method or "cash",
        reference_type="sale",
        reference_id=sale.id,
        patient_id=sale_in.patient_id,
        branch_id=sale_in.branch_id,
        recorded_by_id=current_user.id
    )
    db.add(revenue)
    
    # Also record as income for accounting
    from datetime import date as date_type
    income = Income(
        amount=total_amount,
        description=f"Product Sale - {sale.receipt_number}",
        reference=sale.receipt_number,
        income_date=date_type.today(),
        branch_id=sale_in.branch_id,
        recorded_by_id=current_user.id,
        sale_id=sale.id
    )
    db.add(income)
    
    await db.commit()
    
    # Eagerly load the sale with items to avoid MissingGreenlet error
    result = await db.execute(
        select(Sale).options(selectinload(Sale.items)).where(Sale.id == sale.id)
    )
    sale = result.scalar_one()
    return sale


@router.get("", response_model=List[SaleResponse])
async def get_sales(
    branch_id: Optional[int] = None,
    patient_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    query = select(Sale).options(selectinload(Sale.items))
    if branch_id:
        query = query.where(Sale.branch_id == branch_id)
    if patient_id:
        query = query.where(Sale.patient_id == patient_id)
    
    query = query.order_by(Sale.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/{sale_id}", response_model=SaleResponse)
async def get_sale(
    sale_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    result = await db.execute(select(Sale).where(Sale.id == sale_id))
    sale = result.scalar_one_or_none()
    if not sale:
        raise HTTPException(status_code=404, detail="Sale not found")
    return sale


@router.get("/products/{product_id}/rank")
async def get_product_rank(
    product_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get the sales rank of a product compared to all other products"""
    # Get total quantity sold for each product
    from sqlalchemy import desc
    
    ranking_query = select(
        SaleItem.product_id,
        func.sum(SaleItem.quantity).label('total_sold')
    ).group_by(SaleItem.product_id).order_by(desc('total_sold'))
    
    result = await db.execute(ranking_query)
    rankings = result.all()
    
    # Find the rank of the requested product
    rank = 0
    total_products = len(rankings)
    product_sold = 0
    
    for idx, (pid, sold) in enumerate(rankings, 1):
        if pid == product_id:
            rank = idx
            product_sold = sold or 0
            break
    
    # If product has no sales, it's last
    if rank == 0:
        # Check if product exists
        product_result = await db.execute(select(Product).where(Product.id == product_id))
        product = product_result.scalar_one_or_none()
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")
        
        # Count total products
        total_result = await db.execute(select(func.count(Product.id)))
        total_products = total_result.scalar() or 0
        rank = total_products  # Last place
    
    # Get top 3 products for comparison
    top_3 = []
    for pid, sold in rankings[:3]:
        prod_result = await db.execute(select(Product).where(Product.id == pid))
        prod = prod_result.scalar_one_or_none()
        if prod:
            top_3.append({
                "id": prod.id,
                "name": prod.name,
                "total_sold": sold or 0
            })
    
    return {
        "product_id": product_id,
        "rank": rank,
        "total_products": total_products,
        "total_sold": product_sold,
        "percentile": round((1 - (rank / total_products)) * 100, 1) if total_products > 0 else 0,
        "top_3": top_3
    }


@router.post("/payments", response_model=PaymentResponse)
async def create_payment(
    payment_in: PaymentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    sale_result = await db.execute(select(Sale).where(Sale.id == payment_in.sale_id))
    sale = sale_result.scalar_one_or_none()
    if not sale:
        raise HTTPException(status_code=404, detail="Sale not found")
    
    payment = Payment(**payment_in.model_dump())
    db.add(payment)
    
    sale.paid_amount = float(sale.paid_amount) + payment_in.amount
    if sale.paid_amount >= float(sale.total_amount):
        sale.payment_status = "paid"
        sale.completed_at = datetime.utcnow()
        sale.change_amount = sale.paid_amount - float(sale.total_amount)
    else:
        sale.payment_status = "partial"
    
    await db.commit()
    await db.refresh(payment)
    return payment
