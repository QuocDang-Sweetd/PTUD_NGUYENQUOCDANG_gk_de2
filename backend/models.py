from sqlalchemy import Column, Integer, String, ForeignKey, DateTime
from database import Base
from datetime import datetime, timezone

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String)
    email = Column(String)
    password = Column(String)
    # Admin quyền quản trị (0/1). Một số bài có thể chưa tạo cột này trên DB cũ,
    # sẽ được xử lý trong main.py khi khởi động.
    is_admin = Column(Integer, default=0)

class Photo(Base):
    __tablename__ = "photos"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String)
    description = Column(String)
    image_url = Column(String)
    uploaded_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    # Album mà ảnh thuộc về (nullable = không thuộc album nào)
    album_id = Column(Integer, ForeignKey("albums.id"), nullable=True)
    # 0/1: 0 = không yêu thích, 1 = yêu thích
    is_favorite = Column(Integer, default=0, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"))

class Album(Base):
    __tablename__ = "albums"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(String)
    user_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

class Like(Base):
    __tablename__ = "likes"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    photo_id = Column(Integer, ForeignKey("photos.id"))