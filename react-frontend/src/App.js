import "./App.css"
import { useState, useEffect, useCallback } from "react"

const API = "http://127.0.0.1:8000"

function App() {
  const [email, setEmail] = useState("")
  const [isRegister, setIsRegister] = useState(false)
  const [token, setToken] = useState(localStorage.getItem("token"))
  const [photos, setPhotos] = useState([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [isMasterAdmin, setIsMasterAdmin] = useState(false)
  const [adminView, setAdminView] = useState("dashboard")
  const [roleChecked, setRoleChecked] = useState(false)
  const [adminUsers, setAdminUsers] = useState([])
  const [adminPhotos, setAdminPhotos] = useState([])

  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)

  const [keyword, setKeyword] = useState("")
  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")
  const [showSearchModal, setShowSearchModal] = useState(false)

  const [editId, setEditId] = useState(null)
  const [editTitle, setEditTitle] = useState("")
  const [editDesc, setEditDesc] = useState("")
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedPhoto, setSelectedPhoto] = useState(null)
  const [sortBy, setSortBy] = useState("date") // "date" or "name"
  const [sortOrder, setSortOrder] = useState("desc") // "asc" or "desc"
  const [albums, setAlbums] = useState([])
  const [viewMode, setViewMode] = useState("all") // "all" | "favorites" | "album"
  const [selectedAlbumId, setSelectedAlbumId] = useState(null)

  const [uploadAlbumId, setUploadAlbumId] = useState("") // "" = không thuộc album nào
  const [editAlbumId, setEditAlbumId] = useState(null)

  const [albumModalOpen, setAlbumModalOpen] = useState(false)
  const [albumModalId, setAlbumModalId] = useState(null)
  const [albumName, setAlbumName] = useState("")
  const [albumDesc, setAlbumDesc] = useState("")

  const loadPhotosAll = useCallback(async (overrideToken = null) => {
    const currentToken = overrideToken || token
    if (!currentToken) {
      setPhotos([])
      return
    }

    const res = await fetch(API + "/photos?token=" + currentToken)

    if (!res.ok) {
      alert("Token hết hạn hoặc sai, vui lòng login lại")
      logout()
      return
    }

    const data = await res.json()

    // 👉 đảm bảo là array
    if (Array.isArray(data)) {
      setPhotos(data)
    } else {
      setPhotos([])
    }
  }, [token])

  const loadAlbums = useCallback(async (overrideToken = null) => {
    const currentToken = overrideToken || token
    if (!currentToken) {
      setAlbums([])
      return
    }

    const res = await fetch(API + "/albums?token=" + currentToken)
    if (!res.ok) {
      setAlbums([])
      return
    }
    const data = await res.json()
    setAlbums(Array.isArray(data) ? data : [])
  }, [token])

  const loadFavorites = useCallback(async (overrideToken = null) => {
    const currentToken = overrideToken || token
    if (!currentToken) {
      setPhotos([])
      return
    }

    const res = await fetch(API + "/photos/favorites?token=" + currentToken)
    if (!res.ok) {
      alert("Token hết hạn hoặc sai, vui lòng login lại")
      logout()
      return
    }

    const data = await res.json()
    setPhotos(Array.isArray(data) ? data : [])
  }, [token])

  const loadAlbumPhotos = useCallback(async (albumId, overrideToken = null) => {
    const currentToken = overrideToken || token
    if (!currentToken || !albumId) {
      setPhotos([])
      return
    }

    const res = await fetch(API + `/albums/${albumId}/photos?token=` + currentToken)
    if (!res.ok) {
      alert("Token hết hạn hoặc sai, vui lòng login lại")
      logout()
      return
    }

    const data = await res.json()
    setPhotos(Array.isArray(data) ? data : [])
  }, [token])

  const reloadCurrentView = useCallback(async (overrideToken = null, modeOverride = null, albumIdOverride = null) => {
    const currentToken = overrideToken || token
    if (!currentToken) {
      setPhotos([])
      return
    }

    const mode = modeOverride || viewMode
    const albumId = albumIdOverride ?? selectedAlbumId

    if (mode === "favorites") {
      return loadFavorites(currentToken)
    }
    if (mode === "album") {
      return loadAlbumPhotos(albumId, currentToken)
    }
    return loadPhotosAll(currentToken)
  }, [token, viewMode, selectedAlbumId, loadPhotosAll, loadFavorites, loadAlbumPhotos])

  const loadMe = useCallback(async (overrideToken = null) => {
    const currentToken = overrideToken || token
    if (!currentToken) return null

    const res = await fetch(API + "/me?token=" + currentToken)
    if (!res.ok) {
      throw new Error("Invalid token")
    }

    return await res.json()
  }, [token])

  const loadAdminUsers = useCallback(async (overrideToken = null) => {
    const currentToken = overrideToken || token
    if (!currentToken) {
      setAdminUsers([])
      return
    }

    const res = await fetch(API + "/admin/users?token=" + currentToken)
    if (!res.ok) {
      throw new Error("Không thể load admin users")
    }

    const data = await res.json()
    setAdminUsers(Array.isArray(data) ? data : [])
  }, [token])

  const loadAdminPhotos = useCallback(async (overrideToken = null) => {
    const currentToken = overrideToken || token
    if (!currentToken) {
      setAdminPhotos([])
      return
    }

    const res = await fetch(API + "/admin/photos?token=" + currentToken)
    if (!res.ok) {
      throw new Error("Không thể load admin photos")
    }

    const data = await res.json()
    setAdminPhotos(Array.isArray(data) ? data : [])
  }, [token])

  useEffect(() => {
    const init = async () => {
      if (!token) {
        setRoleChecked(false)
        return
      }

      setRoleChecked(false)
      try {
        const me = await loadMe(token)
        const adminFlag = !!me?.is_admin
        setIsAdmin(adminFlag)
        setIsMasterAdmin(!!me?.is_master_admin)
        setAdminView(adminFlag ? "dashboard" : "user")

        if (adminFlag) {
          await loadAdminUsers(token)
          await loadAdminPhotos(token)
        }
        await loadAlbums(token)
        await reloadCurrentView(token)
      } catch (e) {
        alert("Token hết hạn hoặc sai, vui lòng login lại")
        logout()
      } finally {
        setRoleChecked(true)
      }
    }

    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, loadMe, loadAdminUsers, loadAdminPhotos, loadAlbums, reloadCurrentView])

  // login
  const login = async () => {
    const res = await fetch(API + "/login", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({ username, password })
    })

    if (!res.ok) {
      alert("Sai tài khoản!")
      return
    }

    const data = await res.json()
    const newToken = data.token
    setToken(newToken)
    localStorage.setItem("token", newToken)
  }
// regsiter
const register = async () => {
  const res = await fetch(API + "/register", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({
      username,
      email,
      password
    })
  })

  if (!res.ok) {
    alert("Đăng ký thất bại")
    return
  }

  alert("Đăng ký thành công!")
  await login()
}

  // upload
  const upload = async (e) => {
    e.preventDefault()

    const form = new FormData(e.target)
    form.append("token", token)
    // Nếu dropdown album để trống => không gửi album_id (backend sẽ để NULL)
    const albumIdRaw = form.get("album_id")
    if (!albumIdRaw) {
      form.delete("album_id")
    }

    const res = await fetch(API + "/upload", {
      method: "POST",
      body: form
    })

    if (!res.ok) {
      alert("Upload thất bại")
      return
    }

    await reloadCurrentView()
  }

  // Update photo
  const updatePhoto = async () => {
    const res = await fetch(API + "/photos/" + editId + "?token=" + token, {
      method: "PUT",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({
        title: editTitle,
        description: editDesc,
        album_id: editAlbumId
      })
    })

    if (!res.ok) {
      alert("Update thất bại")
      return
    }

    setEditId(null)
    setShowEditModal(false)
    setSelectedPhoto(null)
    await reloadCurrentView()
  }

  // delete
  const del = async (id) => {
    const res = await fetch(API + "/photos/" + id + "?token=" + token, { method: "DELETE" })
    if (!res.ok) {
      alert("Xóa thất bại")
      return
    }
    setSelectedPhoto(null)
    await reloadCurrentView()
  }

  // admin: cấp quyền admin cho người khác
  const grantAdmin = async (userId) => {
    const res = await fetch(
      API + "/admin/users/" + userId + "/grant-admin?token=" + token,
      { method: "POST" }
    )
    if (!res.ok) {
      alert("Cấp quyền admin thất bại")
      return
    }
    await loadAdminUsers()
  }

  const revokeAdmin = async (userId) => {
    const res = await fetch(
      API + "/admin/users/" + userId + "/revoke-admin?token=" + token,
      { method: "POST" }
    )
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      alert(err.detail || "Tước quyền admin thất bại")
      return
    }
    await loadAdminUsers()
  }

  // admin: xóa user (kèm toàn bộ ảnh + like của họ ở backend)
  const deleteUser = async (userId) => {
    if (!window.confirm("Bạn chắc chắn muốn xóa user này? Toàn bộ ảnh và like của họ cũng sẽ bị xóa.")) {
      return
    }
    const res = await fetch(API + "/admin/users/" + userId + "?token=" + token, { method: "DELETE" })
    if (!res.ok) {
      alert("Xóa user thất bại")
      return
    }
    await loadAdminUsers()
    await loadAdminPhotos()
  }

  // toggle favorite
  const toggleFavorite = async (id) => {
    const res = await fetch(API + "/photos/" + id + "/favorite?token=" + token, { method: "PUT" })
    if (!res.ok) {
      alert("Favorite thất bại")
      return
    }
    await reloadCurrentView()
  }

  // album CRUD
  const openCreateAlbumModal = () => {
    setAlbumModalId(null)
    setAlbumName("")
    setAlbumDesc("")
    setAlbumModalOpen(true)
  }

  const openEditAlbumModal = (album) => {
    setAlbumModalId(album.id)
    setAlbumName(album.name || "")
    setAlbumDesc(album.description || "")
    setAlbumModalOpen(true)
  }

  const saveAlbumModal = async () => {
    const name = (albumName || "").trim()
    if (!name) {
      alert("Tên album không được rỗng")
      return
    }

    const body = { name, description: (albumDesc || "").trim() || null }

    let res
    if (albumModalId == null) {
      res = await fetch(API + "/albums?token=" + token, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(body),
      })
    } else {
      res = await fetch(API + "/albums/" + albumModalId + "?token=" + token, {
        method: "PUT",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(body),
      })
    }

    if (!res.ok) {
      alert("Lưu album thất bại")
      return
    }

    setAlbumModalOpen(false)
    await loadAlbums(token)
    await reloadCurrentView()
  }

  const deleteAlbumById = async (albumId) => {
    const album = albums.find((a) => a.id === albumId)
    if (!window.confirm(`Xóa album "${album?.name || ""}"? Ảnh bên trong sẽ được chuyển về không thuộc album nào.`)) {
      return
    }

    const res = await fetch(API + "/albums/" + albumId + "?token=" + token, { method: "DELETE" })
    if (!res.ok) {
      alert("Xóa album thất bại")
      return
    }

    // Nếu đang xem album vừa xóa => chuyển về "Tất cả ảnh"
    if (viewMode === "album" && selectedAlbumId === albumId) {
      setViewMode("all")
      setSelectedAlbumId(null)
    }

    await loadAlbums(token)
    await reloadCurrentView(null, viewMode === "album" && selectedAlbumId === albumId ? "all" : viewMode)
  }

  // load detail
  const loadPhotoDetail = async (id) => {
    const res = await fetch(API + "/photos/" + id + "?token=" + token)
    if (!res.ok) {
      alert("Không thể load ảnh chi tiết")
      return
    }
    const data = await res.json()
    setSelectedPhoto(data)
  }

  // search
  const searchPhotos = async () => {
    let url = API + "/search?token=" + token
    
    if (keyword) {
      url += "&q=" + encodeURIComponent(keyword)
    }
    
    if (fromDate) {
      url += "&from_date=" + encodeURIComponent(fromDate)
    }
    
    if (toDate) {
      url += "&to_date=" + encodeURIComponent(toDate)
    }

    if (viewMode === "album" && selectedAlbumId) {
      url += "&album_id=" + encodeURIComponent(selectedAlbumId)
    }

    const res = await fetch(url)
    if (!res.ok) {
      alert("Search lỗi. Vui lòng đăng nhập lại.")
      logout()
      return
    }

    const data = await res.json()
    let arr = Array.isArray(data) ? data : []
    if (viewMode === "favorites") {
      arr = arr.filter((p) => p.is_favorite)
    }
    setPhotos(arr)
  }

  // reset search
  const resetSearch = async () => {
    setKeyword("")
    setFromDate("")
    setToDate("")
    await reloadCurrentView()
  }

  // format uploaded_at để giờ của người dùng đúng (Xử lý timezone content từ backend)
  const formatUploadedAt = (uploadedAt) => {
    if (!uploadedAt) return ""

    // Nếu backend trả chuỗi ISO không offset (ví dụ 2024-03-28T12:00:00), mặc định coi là UTC
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(uploadedAt)) {
      uploadedAt = uploadedAt + "Z"
    }

    const d = new Date(uploadedAt)
    if (Number.isNaN(d.getTime())) {
      return uploadedAt
    }
    return d.toLocaleString("vi-VN")
  }

  // sort photos by date or name
  const getSortedPhotos = () => {
    let filtered = [...photos]
    filtered.sort((a, b) => {
      let compareA, compareB
      
      if (sortBy === "name") {
        compareA = (a.title || "").toLowerCase()
        compareB = (b.title || "").toLowerCase()
      } else {
        compareA = new Date(a.uploaded_at || 0).getTime()
        compareB = new Date(b.uploaded_at || 0).getTime()
      }
      
      if (compareA < compareB) return sortOrder === "asc" ? -1 : 1
      if (compareA > compareB) return sortOrder === "asc" ? 1 : -1
      return 0
    })
    
    return filtered
  }

  // logout
  const logout = () => {
    localStorage.removeItem("token")
    setToken(null)
    setPhotos([])
    setIsAdmin(false)
    setIsMasterAdmin(false)
    setAdminView("dashboard")
    setRoleChecked(false)
    setAdminUsers([])
    setAdminPhotos([])
    setKeyword("")
    setEditId(null)
    setUsername("")
    setPassword("")
  }

  // UI LOGIN
  if (!token) {

  // 👉 REGISTER UI
  if (isRegister) {
    return (
      <div className="login-box">
        <h2>Register</h2>
        <input placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} />
        <input placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
        <input 
          type={showPassword ? "text" : "password"} 
          placeholder="Password" 
          value={password} 
          onChange={e => setPassword(e.target.value)}
          style={{width: '100%', marginBottom: '15px', padding: '10px', borderRadius: '4px', border: '1px solid #ddd'}}
        />
        <label style={{display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px', cursor: 'pointer', fontSize: '16px'}}>
          <input 
            type="checkbox" 
            checked={showPassword} 
            onChange={() => setShowPassword(!showPassword)}
            style={{width: '18px', height: '18px', cursor: 'pointer'}}
          />
          <span>Show password</span>
        </label>
        
        <button onClick={register}>Register</button>

        <p>
          Đã có tài khoản?{" "}
          <span onClick={() => setIsRegister(false)} style={{color:"blue", cursor:"pointer"}}>
            Đăng nhập
          </span>
        </p>
      </div>
    )
  }

  // 👉 LOGIN UI
  return (
    <div className="login-box">
      <h2>Login</h2>
      <input placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} />
      <input 
        type={showPassword ? "text" : "password"} 
        placeholder="Password" 
        value={password} 
        onChange={e => setPassword(e.target.value)}
        style={{width: '100%', marginBottom: '15px', padding: '10px', borderRadius: '4px', border: '1px solid #ddd'}}
      />
      <label style={{display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px', cursor: 'pointer', fontSize: '16px'}}>
        <input 
          type="checkbox" 
          checked={showPassword} 
          onChange={() => setShowPassword(!showPassword)}
          style={{width: '18px', height: '18px', cursor: 'pointer'}}
        />
        <span>Show password</span>
      </label>
      
      <button onClick={login}>Login</button>

      <p>
        Chưa có tài khoản?{" "}
        <span onClick={() => setIsRegister(true)} style={{color:"blue", cursor:"pointer"}}>
          Tạo tài khoản
        </span>
      </p>
    </div>
  )
}

  // UI APP
  if (!roleChecked) {
    return <div style={{padding:"20px"}}>Loading...</div>
  }

  if (isAdmin && adminView === "dashboard") {
    return (
      <div style={{padding:"20px"}}>
        <h2>Admin Dashboard {isMasterAdmin ? "(Main Admin)" : ""}</h2>
        <div style={{display: 'flex', gap: '15px', marginBottom: '10px'}}>
          <button onClick={() => setAdminView("user")}>Đến giao diện User</button>
          <button onClick={logout}>Logout</button>
        </div>

        <h3 style={{marginTop: "20px"}}>Users</h3>
        <div style={{
          display:"grid",
          gridTemplateColumns:"repeat(3,1fr)",
          gap:"10px",
          marginTop:"10px"
        }}>
          {adminUsers.map(u => (
            <div key={u.id} style={{border:'1px solid #ccc', borderRadius:'8px', padding:'10px', backgroundColor:'white'}}>
              <p style={{margin:'4px 0', fontWeight:'bold'}}>{u.username}</p>
              <p style={{margin:'4px 0'}}>Email: {u.email || ""}</p>
              <p style={{margin:'4px 0'}}>
                Role: {u.is_master_admin ? "Main Admin" : (u.is_admin ? "Admin" : "User")}
              </p>
              <div style={{display:'flex', gap:'8px', marginTop:'10px'}}>
                {!u.is_admin && !u.is_master_admin && (
                  <button
                    onClick={() => grantAdmin(u.id)}
                    style={{flex:1, padding:'8px', border:'none', borderRadius:'4px', backgroundColor:'#007bff', color:'white', cursor:'pointer'}}
                  >
                    Cấp quyền admin
                  </button>
                )}
                {isMasterAdmin && u.is_admin && !u.is_master_admin && (
                  <button
                    onClick={() => revokeAdmin(u.id)}
                    style={{flex:1, padding:'8px', border:'none', borderRadius:'4px', backgroundColor:'#fd7e14', color:'white', cursor:'pointer'}}
                  >
                    Tước quyền admin
                  </button>
                )}
                {!u.is_admin && !u.is_master_admin && (
                  <button
                    onClick={() => deleteUser(u.id)}
                    style={{flex:1, padding:'8px', border:'none', borderRadius:'4px', backgroundColor:'#dc3545', color:'white', cursor:'pointer'}}
                  >
                    Xóa user
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        <h3 style={{marginTop: "25px"}}>Thống kê ảnh (chỉ số lượng, không hiển thị ảnh)</h3>
        <div style={{
          display:"grid",
          gridTemplateColumns:"repeat(2,1fr)",
          gap:"10px",
          marginTop:"10px"
        }}>
          {adminPhotos.map(p => (
            <div key={p.user_id} style={{border:'1px solid #ccc', borderRadius:'8px', padding:'10px', backgroundColor:'white'}}>
              <p style={{margin:'4px 0', fontWeight:'bold'}}>{p.owner_username}</p>
              <p style={{margin:'4px 0'}}>Số lượng ảnh đã upload: {p.photos_count}</p>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div style={{padding:"20px"}}>
    <h2>Gallery</h2>
    <div style={{display: 'flex', gap: '20px', alignItems: 'flex-start'}}>
      {/* Sidebar albums */}
      <div style={{width: '260px', border: '1px solid #ddd', borderRadius: '8px', padding: '12px', backgroundColor: 'white'}}>
        <h3 style={{marginTop: 0}}>Album</h3>

        <button
          onClick={() => { setViewMode("all"); setSelectedAlbumId(null); reloadCurrentView(null, "all"); }}
          style={{width: '100%', marginTop: 0, backgroundColor: viewMode === "all" ? "#007bff" : "#6c757d"}}
        >
          Tất cả ảnh
        </button>

        <button
          onClick={() => { setViewMode("favorites"); setSelectedAlbumId(null); reloadCurrentView(null, "favorites"); }}
          style={{width: '100%', marginTop: '10px', backgroundColor: viewMode === "favorites" ? "#dc3545" : "#6c757d"}}
        >
          Yêu thích
        </button>

        <div style={{marginTop: '14px'}}>
          <div style={{fontWeight: 'bold', marginBottom: '8px'}}>Danh sách album</div>
          {albums.length === 0 ? (
            <div style={{fontSize: '13px', color: '#666'}}>Chưa có album</div>
          ) : (
            albums.map((a) => (
              <div
                key={a.id}
                style={{
                  border: '1px solid #eee',
                  borderRadius: '8px',
                  padding: '8px',
                  marginBottom: '8px',
                  backgroundColor: viewMode === "album" && selectedAlbumId === a.id ? '#f0f6ff' : '#fff',
                }}
              >
                <div
                  style={{cursor: 'pointer', fontWeight: viewMode === "album" && selectedAlbumId === a.id ? 'bold' : 'normal'}}
                  onClick={() => { setViewMode("album"); setSelectedAlbumId(a.id); reloadCurrentView(null, "album", a.id); }}
                >
                  {a.name}
                </div>

                <div style={{display: 'flex', gap: '6px', marginTop: '8px'}}>
                  <button
                    onClick={(e) => { e.stopPropagation(); openEditAlbumModal(a); }}
                    style={{flex: 1, backgroundColor: '#007bff', marginTop: 0}}
                  >
                    Sửa
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteAlbumById(a.id); }}
                    style={{flex: 1, backgroundColor: '#dc3545', marginTop: 0}}
                  >
                    Xóa
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <button onClick={openCreateAlbumModal} style={{width: '100%', marginTop: '10px', backgroundColor: '#28a745'}}>
          + Tạo album
        </button>
      </div>

      <div style={{flex: 1}}>
      <div style={{display: 'flex', gap: '15px', marginBottom: '10px'}}>
        {isAdmin && (
          <button onClick={() => setAdminView("dashboard")}>
            Đến Dashboard
          </button>
        )}
        <button onClick={logout}>Logout</button>
        <button
          onClick={() => {
            setUploadAlbumId(viewMode === "album" && selectedAlbumId ? String(selectedAlbumId) : "");
            setShowUploadModal(true);
          }}
        >
          Upload
        </button>
        <button onClick={() => setShowSearchModal(true)}>TÌm kiếm</button>
      </div>

    {/* 🔍 SEARCH */}
    <div style={{marginTop:"10px"}}></div>

    {/* 📊 SORT OPTIONS */}
    <div style={{marginTop:"15px", padding: '10px', backgroundColor: '#f5f5f5', borderRadius: '6px'}}>
      <label style={{marginRight: '15px'}}>
        <strong>Sắp xếp theo:</strong>
      </label>
      <button 
        onClick={() => setSortBy("date")}
        style={{
          marginRight: '10px',
          padding: '8px 15px',
          backgroundColor: sortBy === "date" ? '#007bff' : '#e0e0e0',
          color: sortBy === "date" ? 'white' : 'black',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          fontWeight: sortBy === "date" ? 'bold' : 'normal'
        }}
      >
        📅 Ngày
      </button>
      <button 
        onClick={() => setSortBy("name")}
        style={{
          marginRight: '10px',
          padding: '8px 15px',
          backgroundColor: sortBy === "name" ? '#007bff' : '#e0e0e0',
          color: sortBy === "name" ? 'white' : 'black',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          fontWeight: sortBy === "name" ? 'bold' : 'normal'
        }}
      >
        🔤 Tên ảnh
      </button>
      <button 
        onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
        style={{
          padding: '8px 15px',
          backgroundColor: '#28a745',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          fontWeight: 'bold'
        }}
      >
        {sortOrder === "asc" ? "↑ Tăng dần" : "↓ Giảm dần"}
      </button>
    </div>

    {/* GALLERY */}
    <div style={{
      display:"grid",
      gridTemplateColumns:"repeat(4,1fr)",
      gap:"10px",
      marginTop:"20px"
    }}>
      {getSortedPhotos().map(p => (
        <div className="card" key={p.id} style={{height: '350px', display: 'flex', flexDirection: 'column', border: '1px solid #ccc', borderRadius: '8px', padding: '10px', backgroundColor: 'white'}}>
          <div style={{flex: '0 0 auto'}}>
            <img src={API + "/" + p.image_url} style={{width: '100%', height: '180px', objectFit: 'contain', borderRadius: '6px'}} alt={p.title || ""} />
            <button onClick={() => loadPhotoDetail(p.id)} style={{marginTop: '10px', width: '100%'}}>Xem chi tiết</button>
          </div>

          <div style={{flex: '1', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', marginTop: '8px'}}>
            <div>
              <p style={{margin: '4px 0', fontWeight: 'bold'}}>{p.title}</p>
              <p style={{margin: '4px 0'}}>{p.description || '(Không có mô tả)'}</p>
              {p.is_favorite && <p style={{margin: '4px 0'}}>❤️</p>}
            </div>

            <div style={{display: 'flex', gap: '8px'}}>
              <button onClick={() => toggleFavorite(p.id)} style={{flex: 1, backgroundColor: p.is_favorite ? 'red' : 'green', color: 'white'}}>
                {p.is_favorite ? '❤️' : '🤍'}
              </button>
              <button onClick={() => {
                setEditId(p.id)
                setEditTitle(p.title)
                setEditDesc(p.description)
                setEditAlbumId(p.album_id ?? null)
                setShowEditModal(true)
              }} style={{flex: 1}}>Edit</button>
              <button onClick={() => del(p.id)} style={{flex: 1}}>Delete</button>
            </div>
          </div>
        </div>
      ))}
    </div>

    {showEditModal && (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000
      }}>
        <div style={{
          backgroundColor: 'white',
          padding: '20px',
          borderRadius: '8px',
          maxWidth: '500px',
          width: '90%',
          maxHeight: '80vh',
          overflowY: 'auto'
        }}>
          <h3>Chỉnh sửa ảnh</h3>
          <div>
            <label>Tên</label>
            <input
              value={editTitle}
              onChange={e => setEditTitle(e.target.value)}
              style={{width: '100%', marginBottom: '10px'}}
            />
          </div>
          <div>
            <label>Mô tả</label>
            <textarea
              value={editDesc}
              onChange={e => setEditDesc(e.target.value)}
              style={{width: '100%', marginBottom: '10px'}}
            />
          </div>
          <div style={{display:'flex', gap:'10px', justifyContent:'flex-end'}}>
            <button onClick={() => setShowEditModal(false)}>Hủy</button>
            <button onClick={async () => {
              await updatePhoto()
              setShowEditModal(false)
            }}>Lưu</button>
          </div>
        </div>
      </div>
    )}

    {selectedPhoto && (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000
      }}>
        <div style={{
          backgroundColor: 'white',
          padding: '20px',
          borderRadius: '8px',
          maxWidth: '500px',
          width: '90%',
          maxHeight: '80vh',
          overflowY: 'auto'
        }}>
          <h3>Chi tiết ảnh</h3>
          <img src={API + "/" + selectedPhoto.image_url} width="100%" alt={selectedPhoto.title} style={{maxWidth: '100%'}} />
          <p><strong>Tiêu đề:</strong> {selectedPhoto.title}</p>
          <p><strong>Mô tả:</strong> {selectedPhoto.description || "(Không có mô tả)"}</p>
          <p><strong>Uploaded at:</strong> {formatUploadedAt(selectedPhoto.uploaded_at)}</p>
          <button onClick={() => setSelectedPhoto(null)}>Đóng</button>
        </div>
      </div>
    )}

    {showSearchModal && (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000
      }}>
        <div style={{
          backgroundColor: 'white',
          padding: '20px',
          borderRadius: '8px',
          maxWidth: '600px',
          width: '90%',
          maxHeight: '80vh',
          overflowY: 'auto'
        }}>
          <h3>🔍 Tìm Kiếm Nâng Cao</h3>
          <div style={{marginBottom: '15px'}}>
            <label style={{display: 'block', marginBottom: '5px'}}><strong>Tìm theo tên hoặc mô tả:</strong></label>
            <input 
              placeholder="Nhập từ khóa..."
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
              style={{width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ddd', marginBottom: '10px'}}
            />
          </div>
          <div style={{marginBottom: '15px'}}>
            <label style={{display: 'block', marginBottom: '5px'}}><strong>Kỳ hạn thời gian:</strong></label>
            <div style={{display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '10px'}}>
              <label>Từ ngày:</label>
              <input 
                type="date"
                value={fromDate}
                onChange={e => setFromDate(e.target.value)}
                style={{padding: '8px', borderRadius: '4px', border: '1px solid #ddd', flex: 1}}
              />
            </div>
            <div style={{display: 'flex', gap: '10px', alignItems: 'center'}}>
              <label>Đến ngày:</label>
              <input 
                type="date"
                value={toDate}
                onChange={e => setToDate(e.target.value)}
                style={{padding: '8px', borderRadius: '4px', border: '1px solid #ddd', flex: 1}}
              />
            </div>
          </div>
          <div style={{display: 'flex', gap: '10px'}}>
            <button onClick={() => { searchPhotos(); setShowSearchModal(false); }} style={{flex: 1, padding: '10px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold'}}>Tìm Kiếm</button>
            <button onClick={() => { resetSearch(); setShowSearchModal(false); }} style={{flex: 1, padding: '10px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold'}}>Reset</button>
            <button onClick={() => setShowSearchModal(false)} style={{flex: 1, padding: '10px', backgroundColor: '#e74c3c', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold'}}>Hủy</button>
          </div>
        </div>
      </div>
    )}

    {albumModalOpen && (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000
      }}>
        <div style={{
          backgroundColor: 'white',
          padding: '20px',
          borderRadius: '8px',
          maxWidth: '450px',
          width: '90%'
        }}>
          <h3>{albumModalId == null ? "Tạo album" : "Chỉnh sửa album"}</h3>
          <div style={{marginBottom: '10px'}}>
            <label style={{display: 'block', marginBottom: '5px', fontWeight: 'bold'}}>Tên album</label>
            <input
              value={albumName}
              onChange={(e) => setAlbumName(e.target.value)}
              style={{width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ddd'}}
            />
          </div>
          <div style={{marginBottom: '10px'}}>
            <label style={{display: 'block', marginBottom: '5px', fontWeight: 'bold'}}>Mô tả</label>
            <textarea
              value={albumDesc}
              onChange={(e) => setAlbumDesc(e.target.value)}
              rows={4}
              style={{width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ddd'}}
            />
          </div>
          <div style={{display: 'flex', gap: '10px', justifyContent: 'flex-end'}}>
            <button onClick={() => setAlbumModalOpen(false)}>Hủy</button>
            <button onClick={saveAlbumModal}>Lưu</button>
          </div>
        </div>
      </div>
    )}

    {showUploadModal && (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000
      }}>
        <div style={{
          backgroundColor: 'white',
          padding: '20px',
          borderRadius: '8px',
          maxWidth: '400px',
          width: '90%'
        }}>
          <h3>Upload ảnh</h3>
          <form onSubmit={async (e) => { await upload(e); setShowUploadModal(false); }}>
            <input name="title" placeholder="Title" style={{width: '100%', marginBottom: '10px'}} />
            <input name="description" placeholder="Description" style={{width: '100%', marginBottom: '10px'}} />
            <select
              name="album_id"
              value={uploadAlbumId}
              onChange={(e) => setUploadAlbumId(e.target.value)}
              style={{width: '100%', marginBottom: '10px', padding: '10px', borderRadius: '4px', border: '1px solid #ddd'}}
            >
              <option value="">Không thuộc album nào</option>
              {albums.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            <input type="file" name="file" style={{width: '100%', marginBottom: '10px'}} />
            <button type="submit">Upload</button>
            <button type="button" onClick={() => setShowUploadModal(false)} style={{marginLeft: '10px'}}>Đóng</button>
          </form>
        </div>
      </div>
    )}

    {showEditModal && (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000
      }}>
        <div style={{
          backgroundColor: 'white',
          padding: '20px',
          borderRadius: '8px',
          maxWidth: '400px',
          width: '90%'
        }}>
          <h3>Edit ảnh</h3>
          <div>
            <input 
              value={editTitle}
              placeholder="Tên"
              onChange={e => setEditTitle(e.target.value)}
              style={{width: '100%', marginBottom: '10px'}}
            />
            <input 
              value={editDesc}
              placeholder="Mô tả"
              onChange={e => setEditDesc(e.target.value)}
              style={{width: '100%', marginBottom: '10px'}}
            />
            <select
              value={editAlbumId ?? ""}
              onChange={(e) => setEditAlbumId(e.target.value ? Number(e.target.value) : null)}
              style={{width: '100%', marginBottom: '10px', padding: '10px', borderRadius: '4px', border: '1px solid #ddd'}}
            >
              <option value="">Không thuộc album nào</option>
              {albums.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            <button onClick={updatePhoto}>Save</button>
            <button onClick={() => setShowEditModal(false)} style={{marginLeft: '10px'}}>Đóng</button>
          </div>
        </div>
      </div>
    )}
      </div>
    </div>
  </div>
  )
}

export default App




