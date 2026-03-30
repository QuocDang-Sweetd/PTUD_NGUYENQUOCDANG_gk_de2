from fastapi import FastAPI, Depends, UploadFile, File, Form, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text, func
import shutil, os, unicodedata
from datetime import datetime, timezone
from typing import Optional
from fastapi.middleware.cors import CORSMiddleware
from database import Base, engine, SessionLocal
import models, schemas, utils, auth
from fastapi.staticfiles import StaticFiles

app = FastAPI()
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")


def normalize_text(text):
    if not text:
        return ""
    
    nfd = unicodedata.normalize('NFD', text)
    
    return ''.join(char for char in nfd if unicodedata.category(char) != 'Mn').lower()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

Base.metadata.create_all(bind=engine)
MAIN_ADMIN_USERNAME = "admin"
MAIN_ADMIN_PASSWORD = "admin1"


def ensure_admin_column():
    try:
        with engine.begin() as conn:
            cols = conn.execute(text("PRAGMA table_info(users)")).fetchall()
            col_names = [c[1] for c in cols]  
            if "is_admin" not in col_names:
                conn.execute(text("ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0"))
    except Exception:
        
        pass

ensure_admin_column()

def ensure_photo_columns():
    """
    Với SQLite đang có sẵn: ALTER TABLE chỉ thêm được cột, không thể thêm constraint FK.
    Mục tiêu ở đây là đảm bảo app chạy được với DB hiện tại.
    """
    try:
        with engine.begin() as conn:
            cols = conn.execute(text("PRAGMA table_info(photos)")).fetchall()
            col_names = [c[1] for c in cols]  # c[1] là tên cột

            if "album_id" not in col_names:
                conn.execute(text("ALTER TABLE photos ADD COLUMN album_id INTEGER"))

            if "is_favorite" not in col_names:
                conn.execute(text("ALTER TABLE photos ADD COLUMN is_favorite INTEGER DEFAULT 0"))

            
            conn.execute(text("UPDATE photos SET is_favorite = 0 WHERE is_favorite IS NULL"))
    except Exception:
       
        pass

ensure_photo_columns()


def ensure_main_admin_account():
    db = SessionLocal()
    try:
        main_admin = (
            db.query(models.User)
            .filter(models.User.username == MAIN_ADMIN_USERNAME)
            .first()
        )
        hashed = utils.hash_password(MAIN_ADMIN_PASSWORD)
        if main_admin:
            main_admin.password = hashed
            main_admin.is_admin = 1
        else:
            main_admin = models.User(
                username=MAIN_ADMIN_USERNAME,
                email="admin@local",
                password=hashed,
                is_admin=1,
            )
            db.add(main_admin)
        db.commit()
    finally:
        db.close()


ensure_main_admin_account()

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ---------------- AUTH ----------------

@app.post("/register")
def register(user: schemas.UserCreate, db: Session = Depends(get_db)):
    if (user.username or "").strip().lower() == MAIN_ADMIN_USERNAME:
        raise HTTPException(status_code=400, detail="Username reserved")

    existing = db.query(models.User).filter(models.User.username == user.username).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")

    hashed = utils.hash_password(user.password)

    new_user = models.User(
        username=user.username,
        email=user.email,
        password=hashed
    )

    db.add(new_user)
    db.commit()

    return {"msg": "Registered"}

@app.post("/login")
def login(user: schemas.UserLogin, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.username == user.username).first()
    if not db_user or not utils.verify_password(user.password, db_user.password):
        raise HTTPException(status_code=400, detail="Invalid")

    token = auth.create_token(user.username)
    return {"token": token}

# ---------------- AUTH (ROLE) ----------------
@app.get("/me")
def me(token: str, db: Session = Depends(get_db)):
    user = get_current_user(token, db)
    return {
        "username": user.username,
        "is_admin": user_is_admin(user),
        "is_master_admin": is_master_admin(user),
    }

# ---------------- PHOTO ----------------

@app.post("/upload")
def upload_photo(
    title: str = Form(...),
    description: str = Form(...),
    file: UploadFile = File(...),
    token: str = Form(...),
    album_id: Optional[int] = Form(None),
    db: Session = Depends(get_db)
):
    username = auth.get_user(token)
    if not username:
        raise HTTPException(401, "Invalid token")

    user = db.query(models.User).filter(models.User.username == username).first()

    file_path = f"{UPLOAD_DIR}/{file.filename}"
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

   
    if album_id is not None:
        album = db.query(models.Album).filter(models.Album.id == album_id, models.Album.user_id == user.id).first()
        if not album:
            raise HTTPException(status_code=404, detail="Album not found")

    photo = models.Photo(
        title=title,
        description=description,
        image_url=file_path,
        uploaded_at=datetime.now(timezone.utc),
        user_id=user.id,
        album_id=album_id,
    )
    db.add(photo)
    db.commit()

    return {"msg": "Uploaded"}

@app.get("/photos")
def get_photos(token: str, db: Session = Depends(get_db)):
    username = auth.get_user(token)

    if not username:
        raise HTTPException(status_code=401, detail="Invalid token")  # 👈 thêm dòng này

    user = db.query(models.User).filter(models.User.username == username).first()

    photos = db.query(models.Photo).filter(models.Photo.user_id == user.id).all()
    result = []
    for photo in photos:
        likes_count = db.query(models.Like).filter(models.Like.photo_id == photo.id).count()
        user_liked = db.query(models.Like).filter(models.Like.user_id == user.id, models.Like.photo_id == photo.id).first() is not None
        result.append({
            "id": photo.id,
            "title": photo.title,
            "description": photo.description,
            "image_url": photo.image_url,
            "uploaded_at": photo.uploaded_at,
            "album_id": photo.album_id,
            "is_favorite": bool(photo.is_favorite),
            "likes": likes_count,
            "liked": user_liked
        })
    return result

def get_current_user(token: str, db: Session):
    username = auth.get_user(token)
    if not username:
        raise HTTPException(status_code=401, detail="Invalid token")

    user = db.query(models.User).filter(models.User.username == username).first()
    if not user:
        raise HTTPException(status_code=401, detail="Invalid user")

    return user


def require_admin_user(token: str, db: Session):
    user = get_current_user(token, db)
    if not user_is_admin(user):
        raise HTTPException(status_code=403, detail="Admin only")
    return user


def is_master_admin(user: models.User):
    return (user.username or "").strip().lower() == MAIN_ADMIN_USERNAME


def user_is_admin(user: models.User):
    return bool(user.is_admin) or is_master_admin(user)


# ---------------- ADMIN ----------------
@app.get("/admin/users")
def admin_users(token: str, db: Session = Depends(get_db)):
    require_admin_user(token, db)
    users = db.query(models.User).all()
    result = []
    for u in users:
        result.append({
            "id": u.id,
            "username": u.username,
            "email": u.email,
            "is_admin": user_is_admin(u),
            "is_master_admin": is_master_admin(u),
        })
    return result


@app.post("/admin/users/{user_id}/grant-admin")
def admin_grant_admin(user_id: int, token: str, db: Session = Depends(get_db)):
    require_admin_user(token, db)
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.is_admin = 1
    db.commit()
    return {"msg": "Granted admin"}


@app.post("/admin/users/{user_id}/revoke-admin")
def admin_revoke_admin(user_id: int, token: str, db: Session = Depends(get_db)):
    current_admin = require_admin_user(token, db)
    if not is_master_admin(current_admin):
        raise HTTPException(status_code=403, detail="Only main admin can revoke admin")
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if is_master_admin(user):
        raise HTTPException(status_code=400, detail="Cannot revoke main admin")

    user.is_admin = 0
    db.commit()
    return {"msg": "Revoked admin"}


@app.get("/admin/photos")
def admin_photos(token: str, db: Session = Depends(get_db)):
    require_admin_user(token, db)

    
    rows = (
        db.query(
            models.User.id.label("user_id"),
            models.User.username.label("owner_username"),
            func.count(models.Photo.id).label("photos_count"),
        )
        .outerjoin(models.Photo, models.Photo.user_id == models.User.id)
        .group_by(models.User.id, models.User.username)
        .all()
    )

    return [
        {
            "user_id": r.user_id,
            "owner_username": r.owner_username,
            "photos_count": r.photos_count,
        }
        for r in rows
    ]


@app.delete("/admin/photos/{photo_id}")
def admin_delete_photo(photo_id: int, token: str, db: Session = Depends(get_db)):
    require_admin_user(token, db)

    photo = db.query(models.Photo).filter(models.Photo.id == photo_id).first()
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")

    
    db.query(models.Like).filter(models.Like.photo_id == photo_id).delete(synchronize_session=False)
    db.delete(photo)
    db.commit()
    return {"msg": "Deleted"}


@app.delete("/admin/users/{user_id}")
def admin_delete_user(user_id: int, token: str, db: Session = Depends(get_db)):
    admin = require_admin_user(token, db)

    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if is_master_admin(user):
        raise HTTPException(status_code=400, detail="Cannot delete main admin")

    
    if user.id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")

   
    photos = db.query(models.Photo).filter(models.Photo.user_id == user.id).all()
    photo_ids = [p.id for p in photos]

    if photo_ids:
        
        db.query(models.Like).filter(models.Like.photo_id.in_(photo_ids)).delete(synchronize_session=False)
        
        db.query(models.Photo).filter(models.Photo.id.in_(photo_ids)).delete(synchronize_session=False)

   
    db.query(models.Like).filter(models.Like.user_id == user.id).delete(synchronize_session=False)

    db.delete(user)
    db.commit()
    return {"msg": "User deleted"}



@app.get("/photos/favorites")
def get_favorite_photos_early(token: str, db: Session = Depends(get_db)):
    user = get_current_user(token, db)
    photos = db.query(models.Photo).filter(models.Photo.user_id == user.id, models.Photo.is_favorite == 1).all()
    result = []
    for photo in photos:
        likes_count = db.query(models.Like).filter(models.Like.photo_id == photo.id).count()
        user_liked = db.query(models.Like).filter(models.Like.user_id == user.id, models.Like.photo_id == photo.id).first() is not None
        result.append({
            "id": photo.id,
            "title": photo.title,
            "description": photo.description,
            "image_url": photo.image_url,
            "uploaded_at": photo.uploaded_at,
            "album_id": photo.album_id,
            "is_favorite": True,
            "likes": likes_count,
            "liked": user_liked,
        })
    return result


@app.get("/photos/{photo_id}")
def get_photo(photo_id: int, token: str, db: Session = Depends(get_db)):
    user = get_current_user(token, db)
    photo = db.query(models.Photo).filter(models.Photo.id == photo_id, models.Photo.user_id == user.id).first()
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")
    likes_count = db.query(models.Like).filter(models.Like.photo_id == photo_id).count()
    user_liked = db.query(models.Like).filter(models.Like.user_id == user.id, models.Like.photo_id == photo_id).first() is not None
    return {
        "id": photo.id,
        "title": photo.title,
        "description": photo.description,
        "image_url": photo.image_url,
        "uploaded_at": photo.uploaded_at,
        "album_id": photo.album_id,
        "is_favorite": bool(photo.is_favorite),
        "likes": likes_count,
        "liked": user_liked
    }


@app.delete("/photos/{photo_id}")
def delete_photo(photo_id: int, token: str, db: Session = Depends(get_db)):
    user = get_current_user(token, db)
    photo = db.query(models.Photo).filter(models.Photo.id == photo_id, models.Photo.user_id == user.id).first()
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")

    db.delete(photo)
    db.commit()
    return {"msg": "Deleted"}


@app.put("/photos/{photo_id}")
def update_photo(photo_id: int, data: schemas.PhotoCreate, token: str, db: Session = Depends(get_db)):
    user = get_current_user(token, db)
    photo = db.query(models.Photo).filter(models.Photo.id == photo_id, models.Photo.user_id == user.id).first()
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")

    photo.title = data.title
    photo.description = data.description
    # Tương thích API cũ: nếu client không gửi `album_id` thì không đụng đến album hiện tại.
    if hasattr(data, "model_fields_set") and "album_id" in data.model_fields_set:
        if data.album_id is not None:
            album = db.query(models.Album).filter(models.Album.id == data.album_id, models.Album.user_id == user.id).first()
            if not album:
                raise HTTPException(status_code=404, detail="Album not found")
            photo.album_id = data.album_id
        else:
            # frontend gửi null => không thuộc album nào
            photo.album_id = None
    db.commit()
    return {"msg": "Updated"}

@app.post("/albums")
def create_album(data: schemas.AlbumCreate, token: str, db: Session = Depends(get_db)):
    user = get_current_user(token, db)
    album = models.Album(
        name=data.name,
        description=data.description,
        user_id=user.id,
    )
    db.add(album)
    db.commit()
    db.refresh(album)
    return {
        "id": album.id,
        "name": album.name,
        "description": album.description,
        "created_at": album.created_at,
        "user_id": album.user_id,
    }


@app.get("/albums")
def list_albums(token: str, db: Session = Depends(get_db)):
    user = get_current_user(token, db)
    albums = db.query(models.Album).filter(models.Album.user_id == user.id).order_by(models.Album.id.desc()).all()
    return [
        {
            "id": a.id,
            "name": a.name,
            "description": a.description,
            "created_at": a.created_at,
            "user_id": a.user_id,
        }
        for a in albums
    ]


@app.put("/albums/{album_id}")
def update_album(album_id: int, data: schemas.AlbumUpdate, token: str, db: Session = Depends(get_db)):
    user = get_current_user(token, db)
    album = db.query(models.Album).filter(models.Album.id == album_id, models.Album.user_id == user.id).first()
    if not album:
        raise HTTPException(status_code=404, detail="Album not found")

    album.name = data.name
    album.description = data.description
    db.commit()
    return {"msg": "Album updated"}


@app.delete("/albums/{album_id}")
def delete_album(album_id: int, token: str, db: Session = Depends(get_db)):
    user = get_current_user(token, db)
    album = db.query(models.Album).filter(models.Album.id == album_id, models.Album.user_id == user.id).first()
    if not album:
        raise HTTPException(status_code=404, detail="Album not found")

    # Không xóa ảnh: chỉ chuyển album_id về NULL
    db.query(models.Photo).filter(
        models.Photo.album_id == album_id,
        models.Photo.user_id == user.id,
    ).update({models.Photo.album_id: None}, synchronize_session=False)

    db.delete(album)
    db.commit()
    return {"msg": "Album deleted"}


@app.put("/photos/{photo_id}/album")
def set_photo_album(photo_id: int, data: schemas.PhotoAlbumUpdate, token: str, db: Session = Depends(get_db)):
    user = get_current_user(token, db)
    photo = db.query(models.Photo).filter(models.Photo.id == photo_id, models.Photo.user_id == user.id).first()
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")

    if data.album_id is not None:
        album = db.query(models.Album).filter(models.Album.id == data.album_id, models.Album.user_id == user.id).first()
        if not album:
            raise HTTPException(status_code=404, detail="Album not found")
        photo.album_id = data.album_id
    else:
        photo.album_id = None

    db.commit()
    return {"msg": "Photo album updated", "album_id": photo.album_id}


@app.put("/photos/{photo_id}/favorite")
def toggle_favorite(photo_id: int, token: str, db: Session = Depends(get_db)):
    user = get_current_user(token, db)
    photo = db.query(models.Photo).filter(models.Photo.id == photo_id, models.Photo.user_id == user.id).first()
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")

    photo.is_favorite = 0 if int(photo.is_favorite) == 1 else 1
    db.commit()
    return {"msg": "Favorite updated", "is_favorite": bool(photo.is_favorite)}


@app.get("/photos/favorites_legacy")
def get_favorite_photos(token: str, db: Session = Depends(get_db)):
    user = get_current_user(token, db)
    photos = db.query(models.Photo).filter(models.Photo.user_id == user.id, models.Photo.is_favorite == 1).all()
    result = []
    for photo in photos:
        likes_count = db.query(models.Like).filter(models.Like.photo_id == photo.id).count()
        user_liked = db.query(models.Like).filter(models.Like.user_id == user.id, models.Like.photo_id == photo.id).first() is not None
        result.append({
            "id": photo.id,
            "title": photo.title,
            "description": photo.description,
            "image_url": photo.image_url,
            "uploaded_at": photo.uploaded_at,
            "album_id": photo.album_id,
            "is_favorite": True,
            "likes": likes_count,
            "liked": user_liked,
        })
    return result


@app.get("/albums/{album_id}/photos")
def get_album_photos(album_id: int, token: str, db: Session = Depends(get_db)):
    user = get_current_user(token, db)
    album = db.query(models.Album).filter(models.Album.id == album_id, models.Album.user_id == user.id).first()
    if not album:
        raise HTTPException(status_code=404, detail="Album not found")

    photos = db.query(models.Photo).filter(models.Photo.user_id == user.id, models.Photo.album_id == album_id).all()
    result = []
    for photo in photos:
        likes_count = db.query(models.Like).filter(models.Like.photo_id == photo.id).count()
        user_liked = db.query(models.Like).filter(models.Like.user_id == user.id, models.Like.photo_id == photo.id).first() is not None
        result.append({
            "id": photo.id,
            "title": photo.title,
            "description": photo.description,
            "image_url": photo.image_url,
            "uploaded_at": photo.uploaded_at,
            "album_id": photo.album_id,
            "is_favorite": bool(photo.is_favorite),
            "likes": likes_count,
            "liked": user_liked,
        })
    return result

@app.post("/photos/{photo_id}/like")
def like_photo(photo_id: int, token: str, db: Session = Depends(get_db)):
    user = get_current_user(token, db)
    photo = db.query(models.Photo).filter(models.Photo.id == photo_id).first()
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")

    existing_like = db.query(models.Like).filter(models.Like.user_id == user.id, models.Like.photo_id == photo_id).first()
    if existing_like:
        raise HTTPException(status_code=400, detail="Already liked")

    like = models.Like(user_id=user.id, photo_id=photo_id)
    db.add(like)
    db.commit()
    return {"msg": "Liked"}

@app.delete("/photos/{photo_id}/like")
def unlike_photo(photo_id: int, token: str, db: Session = Depends(get_db)):
    user = get_current_user(token, db)
    like = db.query(models.Like).filter(models.Like.user_id == user.id, models.Like.photo_id == photo_id).first()
    if not like:
        raise HTTPException(status_code=400, detail="Not liked")

    db.delete(like)
    db.commit()
    return {"msg": "Unliked"}

@app.get("/photos/{photo_id}/likes")
def get_likes(photo_id: int, token: str, db: Session = Depends(get_db)):
    user = get_current_user(token, db)
    photo = db.query(models.Photo).filter(models.Photo.id == photo_id).first()
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")

    likes_count = db.query(models.Like).filter(models.Like.photo_id == photo_id).count()
    user_liked = db.query(models.Like).filter(models.Like.user_id == user.id, models.Like.photo_id == photo_id).first() is not None
    return {"likes": likes_count, "liked": user_liked}


@app.get("/search")
def search(
    q: str = None,
    token: str = None,
    from_date: str = None,
    to_date: str = None,
    album_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    username = auth.get_user(token)
    if not username:
        raise HTTPException(status_code=401, detail="Invalid token")

    user = db.query(models.User).filter(models.User.username == username).first()
    if not user:
        raise HTTPException(status_code=401, detail="Invalid user")

    # Start with all user's photos
    photos = db.query(models.Photo).filter(models.Photo.user_id == user.id).all()

    # Filter theo album (nếu có)
    if album_id is not None:
        photos = [p for p in photos if p.album_id == album_id]
    
    # Filter by search text (title + description) - normalize & case-insensitive
    if q and q.strip():
        normalized_q = normalize_text(q)
        photos = [p for p in photos if normalized_q in normalize_text(p.title) or normalized_q in normalize_text(p.description)]
    
    # Filter by date range
    if from_date:
        from_datetime = datetime.fromisoformat(from_date)
        photos = [p for p in photos if p.uploaded_at >= from_datetime]
    
    if to_date:
        to_datetime = datetime.fromisoformat(to_date)
        photos = [p for p in photos if p.uploaded_at <= to_datetime]
    
    result = []
    for photo in photos:
        likes_count = db.query(models.Like).filter(models.Like.photo_id == photo.id).count()
        user_liked = db.query(models.Like).filter(models.Like.user_id == user.id, models.Like.photo_id == photo.id).first() is not None
        result.append({
            "id": photo.id,
            "title": photo.title,
            "description": photo.description,
            "image_url": photo.image_url,
            "uploaded_at": photo.uploaded_at,
            "album_id": photo.album_id,
            "is_favorite": bool(photo.is_favorite),
            "likes": likes_count,
            "liked": user_liked
        })
    return result

app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")
