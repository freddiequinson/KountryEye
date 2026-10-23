import os
import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.api.v1.deps import get_current_active_user, require_permission
from app.core.uploads import save_upload
from app.models.user import User
from app.models.sales import Product

router = APIRouter()

# Create uploads directory if it doesn't exist
UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(os.path.join(UPLOAD_DIR, "products"), exist_ok=True)
os.makedirs(os.path.join(UPLOAD_DIR, "assets"), exist_ok=True)


@router.post("/avatar")
async def upload_avatar(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Upload the signed-in user's profile picture"""
    _, url = await save_upload(file, "avatars", kinds=("image",), max_mb=3)
    user = await db.get(User, current_user.id)
    user.avatar_url = url
    await db.commit()
    return {"message": "Profile picture updated", "avatar_url": url, "url": url}


@router.post("/product/{product_id}/image", dependencies=[Depends(require_permission("inventory.manage"))])
async def upload_product_image(
    product_id: int,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Upload an image for a product"""
    # Get product
    result = await db.execute(select(Product).where(Product.id == product_id))
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    _, new_url = await save_upload(file, "products", kinds=("image",))

    # Update product with image URL
    product.image_url = new_url
    await db.commit()
    
    return {
        "message": "Image uploaded successfully",
        "image_url": product.image_url
    }


@router.post("/asset/{asset_id}/image", dependencies=[Depends(require_permission("assets.manage"))])
async def upload_asset_image(
    asset_id: int,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Upload an image for an asset"""
    from app.models.asset import Asset
    
    # Get asset
    result = await db.execute(select(Asset).where(Asset.id == asset_id))
    asset = result.scalar_one_or_none()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    
    _, new_url = await save_upload(file, "assets", kinds=("image",))

    # Update asset with image URL
    asset.image_url = new_url
    await db.commit()
    
    return {
        "message": "Image uploaded successfully",
        "image_url": asset.image_url
    }
