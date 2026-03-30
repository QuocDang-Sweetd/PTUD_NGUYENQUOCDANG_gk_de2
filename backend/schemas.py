from typing import Optional
from pydantic import BaseModel
from datetime import datetime

class UserCreate(BaseModel):
    username: str
    email: str
    password: str

class UserLogin(BaseModel):
    username: str
    password: str

class MeOut(BaseModel):
    username: str
    is_admin: bool

class AdminUserOut(BaseModel):
    id: int
    username: str
    email: str
    is_admin: bool

class PhotoCreate(BaseModel):
    title: str
    description: str
    # Nullable: không thuộc album nào
    album_id: Optional[int] = None


class PhotoAlbumUpdate(BaseModel):
    album_id: Optional[int] = None


class AlbumCreate(BaseModel):
    name: str
    description: Optional[str] = None


class AlbumUpdate(BaseModel):
    name: str
    description: Optional[str] = None


class AlbumOut(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    created_at: datetime
    user_id: int


class PhotoOut(BaseModel):
    id: int
    title: str
    description: str
    image_url: str
    uploaded_at: datetime
    album_id: Optional[int] = None
    is_favorite: bool = False
    user_id: int

    class Config:
        from_attributes = True