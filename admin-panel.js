window.addEventListener("keydown", (e) => {
  if (e.ctrlKey && e.key.toLowerCase() === "x") {
    verifyTokenBeforeOpenPanel();
  }
});

async function verifyTokenBeforeOpenPanel() {
  const accessToken = localStorage.getItem("access_token");
  const refreshToken = localStorage.getItem("refresh_token");

  if (!accessToken && !refreshToken) {
    openAdminLoginModal();
    return;
  }

  try {
    const res = await fetch(`${BASE_URL}/users/CheckToken`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        accessToken: accessToken || "",
        refreshToken: refreshToken || "",
      }),
    });

    if (res.ok) {
      openAdminPanel();
      return;
    } else if (res.status === 401) {
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      openAdminLoginModal();
    } else {
      console.error("Unexpected status:", res.status);
    }
  } catch (err) {
    console.error("Error verifying token:", err);
  }
}

async function fetchWithAuth(url, options = {}) {
  let accessToken = localStorage.getItem("access_token");
  const refreshToken = localStorage.getItem("refresh_token");

  if (!accessToken || !refreshToken) return;

  options = options || {};
  options.headers = options.headers || {};

  if (!(options.body instanceof FormData)) {
    options.headers["Content-Type"] = "application/json";
  }

  options.headers["Authorization"] = `Bearer ${accessToken}`;

  let res = await fetch(url, options);

  if (res.status === 401) {
    const refreshed = await refreshAccessToken(accessToken, refreshToken);
    if (!refreshed) {
      return;
    }

    accessToken = localStorage.getItem("access_token");
    options.headers["Authorization"] = `Bearer ${accessToken}`;
    res = await fetch(url, options);
  }

  return res;
}

async function refreshAccessToken(refreshToken) {
  try {
    const res = await fetch(`${BASE_URL}/users/RefreshToken`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
      credentials: "include",
    });

    if (!res.ok) return false;

    const result = await res.json();
    if (result.success && result.data) {
      localStorage.setItem("access_token", result.data.token);
      localStorage.setItem("refresh_token", result.data.refreshToken);
      return true;
    }
  } catch (err) {
    console.error("refresh token error:", err);
  }
  return false;
}

function redirectToLogin() {
  alert("نشست شما منقضی شده، لطفاً دوباره وارد شوید.");
  location.reload();
}

document.addEventListener("DOMContentLoaded", () => {
  const captchaImage = document.getElementById("captchaImage");

  captchaImage.addEventListener("click", () => {
    captchaImage.src = `${BASE_URL}/Captcha/GetCaptcha?t=${Date.now()}`; // جلوگیری از کش
  });

  document.getElementById("adminLoginBtn").addEventListener("click", async () => {
    const btn = document.getElementById("adminLoginBtn");
    const user = document.getElementById("adminUsername").value.trim();
    const pass = document.getElementById("adminPassword").value.trim();
    const captcha = document.getElementById("captchaInput").value.trim();

    if (!user || !pass || !captcha) {
      return alert("⚠ لطفاً همه فیلدها را پر کنید.");
    }

    btn.disabled = true;
    btn.innerText = "⏳ در حال ورود...";

    try {
      const res = await fetch(`${BASE_URL}/Account/Login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mobile: user,
          password: pass,
          captchaCode: captcha,
        }),
        credentials: "include",
      });

      const result = await res.json();
      if (result.response.success) {
        const { token, refreshToken, permissionNames } = result.response.data;
        localStorage.setItem("access_token", token);
        localStorage.setItem("refresh_token", refreshToken);
        localStorage.setItem("username", result.fullName.trim());
        localStorage.setItem("permissions", JSON.stringify(permissionNames));

        closeModal("adminLoginModal");
        openAdminPanel();
      } else {
        alert("❌" + (result.message + "ورود ناموفق : "));
        captchaImage.src = `${BASE_URL}/Captcha/GetCaptcha?t=${Date.now()}`;
      }
    } catch (err) {
      captchaImage.src = `${BASE_URL}/Captcha/GetCaptcha?t=${Date.now()}`;
    } finally {
      btn.disabled = false;
      btn.innerText = "ورود";
    }
  });

  document.querySelectorAll(".modal-close").forEach((btn) => {
    btn.addEventListener("click", () => {
      btn.closest(".modal").style.display = "none";
    });
  });

  window.addEventListener("click", (e) => {
    document.querySelectorAll(".modal").forEach((modal) => {
      if (e.target === modal) modal.style.display = "none";
    });
  });

  document.querySelectorAll(".tabs .tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach((tc) => {
        tc.classList.remove("active");
        tc.style.display = "none";
      });

      btn.classList.add("active");
      const targetId = btn.dataset.tab;
      const targetContent = document.getElementById(targetId);
      if (targetContent) {
        targetContent.classList.add("active");
        targetContent.style.display = "block";
      }
    });
  });

  document.getElementById("addNewsForm").addEventListener("submit", handleAddNews);
  document.getElementById("editNewsForm").addEventListener("submit", handleEditNews);
  document.getElementById("addLinkForm").addEventListener("submit", handleAddLink);
  document.getElementById("editLinkForm").addEventListener("submit", handleEditLink);

  document.getElementById("cancelDeleteNews").addEventListener("click", () => closeModal("deleteNewsModal"));
  document.getElementById("cancelDeleteLink").addEventListener("click", () => closeModal("deleteLinkModal"));
});
document.addEventListener("click", (e) => {
  if (e.target.classList.contains("edit-news-btn")) {
    const btn = e.target;
    openEditNewsModal({
      id: btn.dataset.id,
      title: decodeURIComponent(btn.dataset.title),
      shortText: decodeURIComponent(btn.dataset.shorttext),
      text: decodeURIComponent(btn.dataset.text),
      imageName: decodeURIComponent(btn.dataset.imagename),
      isActive: btn.dataset.isactive === "true",
    });
  }
});

document.addEventListener("click", (e) => {
  if (e.target.classList.contains("gallery-news-btn")) {
    const newsId = e.target.dataset.id;
    openGalleryModal(newsId);
  }
});

let selectedFiles = [];

async function openGalleryModal(newsId) {
  selectedFiles = [];
  renderPreviews();

  document.getElementById("hiddenFileInput").dataset.newsid = newsId;

  const galleryContainer = document.getElementById("newsGalleryContainer");
  galleryContainer.innerHTML = "در حال بارگذاری...";

  const res = await fetch(`${BASE_URL}/NewsAdmin/Gallery/${newsId}`);

  let images = [];
  if (res.ok) {
    images = await res.json();
  }

  if (!images || images.length === 0) {
    galleryContainer.innerHTML = "<p>تصویری ثبت نشده است</p>";
  } else {
    galleryContainer.innerHTML = images
      .map(
        (img) => `
        <div class="gallery-item">
          <img src="${BASE_URL}/uploads/news-gallery/${img.imageName}" alt="${img.newsGalleryId}" />
          <button class="delete-image-btn" data-id="${img.newsGalleryId}" data-newsid="${newsId}">🗑️</button>
        </div>
      `
      )
      .join("");
  }

  document.getElementById("galleryModal").style.display = "block";
}

document.getElementById("closeGalleryModal").onclick = () => {
  document.getElementById("galleryModal").style.display = "none";
};

window.onclick = function (event) {
  const modal = document.getElementById("galleryModal");
  if (event.target === modal) {
    modal.style.display = "none";
  }
};

document.addEventListener("click", async (e) => {
  if (e.target.classList.contains("delete-image-btn")) {
    const id = e.target.dataset.id;
    const newsId = e.target.dataset.newsid;
    if (!confirm("حذف شود؟")) return;
    const res = await fetch(`${BASE_URL}/NewsAdmin/DeleteNewsGalleryId/${id}`, { method: "DELETE" });
    if (res.ok) {
      openGalleryModal(newsId);
    }
  }
});

document.getElementById("hiddenFileInput").onchange = (e) => {
  const files = Array.from(e.target.files);

  files.forEach((file) => {
    const reader = new FileReader();
    reader.onload = () => {
      selectedFiles.push(file);
      addPreview(reader.result, selectedFiles.length - 1);

      document.getElementById("uploadAllBtn").disabled = false;
    };
    reader.readAsDataURL(file);
  });
};

function renderPreviews() {
  const container = document.getElementById("previewContainer");
  container.innerHTML = "";

  selectedFiles.forEach((file, idx) => {
    const img = URL.createObjectURL(file);
    addPreview(img, idx);
  });

  if (selectedFiles.length === 0) {
    document.getElementById("uploadAllBtn").disabled = true;
  }
}

function addPreview(src, idx) {
  const container = document.getElementById("previewContainer");
  const div = document.createElement("div");
  div.classList.add("preview-item");
  div.innerHTML = `
    <img src="${src}" alt="">
    <button class="remove-preview-btn" data-idx="${idx}">❌</button>
  `;
  container.appendChild(div);
}

document.addEventListener("click", (e) => {
  if (e.target.classList.contains("remove-preview-btn")) {
    const idx = e.target.dataset.idx;
    selectedFiles.splice(idx, 1);
    renderPreviews();
  }
});

document.getElementById("uploadAllBtn").onclick = async () => {
  const btn = document.getElementById("uploadAllBtn");
  const newsId = document.getElementById("hiddenFileInput").dataset.newsid;

  btn.disabled = true;
  btn.textContent = "در حال آپلود...";

  const formData = new FormData();
  selectedFiles.forEach((file) => formData.append("images", file));

  const res = await fetch(`${BASE_URL}/NewsAdmin/Gallery/Upload/${newsId}`, {
    method: "POST",
    body: formData,
  });

  if (res.ok) {
    selectedFiles = [];
    renderPreviews();
    openGalleryModal(newsId);
  } else {
    alert("خطا در آپلود تصاویر");
  }

  btn.textContent = "ارسال به سرور";
};

document.getElementById("addImageBtn").onclick = () => {
  document.getElementById("hiddenFileInput").click();
};

document.getElementById("hiddenFileInput").onchange = (e) => {
  const files = Array.from(e.target.files);
  files.forEach((file) => {
    const reader = new FileReader();
    reader.onload = () => {
      selectedFiles.push(file);
      addPreview(reader.result, selectedFiles.length - 1);
      document.getElementById("uploadAllBtn").disabled = selectedFiles.length === 0;
    };
    reader.readAsDataURL(file);
  });
};

function addPreview(src, index) {
  const container = document.getElementById("previewContainer");
  const item = document.createElement("div");
  item.classList.add("preview-item");
  item.innerHTML = `
    <img src="${src}" />
    <button class="remove-btn" data-removePreviewId="${index}">x</button>
  `;
  container.appendChild(item);
}

document.addEventListener("click", function (e) {
  if (e.target.matches(".remove-btn")) {
    const index = e.target.dataset.removepreviewid;
    selectedFiles.splice(index, 1);
    renderPreviews();
  }
});

function renderPreviews() {
  const container = document.getElementById("previewContainer");
  container.innerHTML = "";
  selectedFiles.forEach((file, idx) => {
    const reader = new FileReader();
    reader.onload = () => addPreview(reader.result, idx);
    reader.readAsDataURL(file);
  });
  document.getElementById("uploadAllBtn").disabled = selectedFiles.length === 0;
}

document.getElementById("uploadAllBtn").onclick = async () => {
  const newsId = document.getElementById("hiddenFileInput").dataset.newsid;
  const formData = new FormData();
  formData.append("newsId", newsId);
  selectedFiles.forEach((file) => formData.append("images", file));

  document.querySelectorAll(".preview-item").forEach((item) => {
    const overlay = document.createElement("div");
    overlay.className = "loading-overlay";
    overlay.innerHTML = `<div class="spinner"></div>`;
    item.appendChild(overlay);
  });

  const res = await fetch(`${BASE_URL}/NewsAdmin/UploadGallery`, {
    method: "POST",
    body: formData,
  });

  if (res.ok) {
    selectedFiles = [];
    renderPreviews();
    openGalleryModal(newsId);
  } else {
    alert("خطا در آپلود تصاویر");
    document.querySelectorAll(".loading-overlay").forEach((o) => o.remove());
  }
};

function showLoading(containerId, cols) {
  document.getElementById(containerId).innerHTML = `
        <tr>
            <td colspan="${cols}" style="text-align:center; padding:15px;">
                <div class="spinner"></div> در حال بارگذاری...
            </td>
        </tr>`;
}
function openModal(id) {
  document.getElementById(id).style.display = "block";
}
function closeModal(id) {
  document.getElementById(id).style.display = "none";
}

function openAdminLoginModal() {
  openModal("adminLoginModal");
}
function openAdminPanel() {
  openModal("adminPanelModal");
  controlAdminUI();

  const addNewsBtn = document.getElementById("addNewsBtn");
  if (addNewsBtn) {
    addNewsBtn.onclick = () => {
      document.getElementById("newsTitle").value = "";
      document.getElementById("newsShortText").value = "";
      document.getElementById("newsDescription").value = "";
      document.getElementById("newsIsActive").value = "";
      openModal("addNewsModal");
    };
  }

  const addLinkBtn = document.getElementById("addLinkBtn");
  if (addLinkBtn) {
    addLinkBtn.onclick = () => {
      document.getElementById("linkTitle").value = "";
      openModal("addLinkModal");
    };
  }

  const adminPollList = document.getElementById("adminPollList");
  if (adminPollList) {
    adminPollList.onclick = () => {
      openModal("pollStatsModal");
    };
  }
}

let adminCurrentPage = 1;
const adminPageSize = 5;

function renderAdminPagination(totalPages) {
  const pagination = document.getElementById("adminPagination");
  pagination.innerHTML = "";

  if (totalPages <= 1) return;

  if (adminCurrentPage > 1) {
    const prev = document.createElement("button");
    prev.textContent = "« قبلی";
    prev.onclick = () => adminGotoPage(adminCurrentPage - 1);
    pagination.appendChild(prev);
  }

  for (let i = 1; i <= totalPages; i++) {
    const btn = document.createElement("button");
    btn.textContent = i;
    if (i === adminCurrentPage) btn.classList.add("active");
    btn.onclick = () => adminGotoPage(i);
    pagination.appendChild(btn);
  }

  if (adminCurrentPage < totalPages) {
    const next = document.createElement("button");
    next.textContent = "بعدی »";
    next.onclick = () => adminGotoPage(adminCurrentPage + 1);
    pagination.appendChild(next);
  }
}

function adminGotoPage(page) {
  loadNewsList(page).then(() => {
    const adminList = document.getElementById("adminNewsList");
    adminList.scrollIntoView({ behavior: "smooth", block: "start" });
    setTimeout(() => {
      window.scrollBy({ top: -100, left: 0, behavior: "smooth" });
    }, 400);
  });
}

async function loadNewsList(pageNumber = 1) {
  adminCurrentPage = pageNumber;
  showLoading("adminNewsList", 4);
  try {
    const res = await fetchWithAuth(`${BASE_URL}/NewsAdmin/GetAllNewsAdmin?pageNumber=${adminCurrentPage}&pageSize=${adminPageSize}`);
    if (!res) return;

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    if (!data.items || !data.items.length) {
      addNewsBtn.innerHTML = `<tr><td colspan='5'>${data.items.message}</td></tr>`;
      return;
    }

    renderNewsList(data);

    const totalCount = data.totalCount || 0;
    const totalPages = Math.ceil(totalCount / adminPageSize);
    renderAdminPagination(totalPages);
  } catch (err) {
    console.error("خطا در بارگذاری لیست اخبار:", err);
    document.getElementById("adminNewsList").innerHTML = `<tr><td colspan="5" style="color:red">⚠ عدم دریافت اخبار</td></tr>`;
    document.getElementById("adminPagination").innerHTML = "";
  }
}

function renderNewsList(data) {
  const tbody = document.getElementById("adminNewsList");
  if (!Array.isArray(data.items) || data.items.length === 0) {
    tbody.innerHTML = "<tr><td colspan='5'>خبری یافت نشد</td></tr>";
    return;
  }
  debugger;
  tbody.innerHTML = data.items
    .map(
      (n) => `
    <tr>
      <td>${n.id}</td>
      <td>${n.title}</td>
      <td>${n.createDateShamsi}</td>
      <td>${n.isActive ? "✅" : "❌"}</td>
      <td>
        <button 
          class="edit-news-btn" title="ویرایش"
          data-id="${n.id}"
          data-title="${encodeURIComponent(n.title)}"
          data-shorttext="${encodeURIComponent(n.shortText)}"
          data-type="${encodeURIComponent(n.createDateShamsi)}"
          data-text="${encodeURIComponent(n.text)}"
          data-imagename="${encodeURIComponent(n.imageName)}"
          data-isactive="${n.isActive}"
        >✏️</button>
        <button 
          class="gallery-news-btn" title="گالری"
          data-id="${n.id}"
        >🖼️</button>
        <button 
          class="delete-news-btn" title="حذف"
          data-id="${n.id}"
        >🗑️</button>
      </td>
    </tr>
  `
    )
    .join("");
  // دکمه افزودن خبر
  if (!hasPermission("SaveNews")) {
    document.getElementById("addNewsBtn").style.display = "none";
  }
  if (!hasPermission("UpdateNews")) {
    const buttons = document.querySelectorAll(".edit-news-btn");
    buttons.forEach((btn) => {
      btn.style.display = "none";
    });
  }
  if (!hasPermission("DeleteNew")) {
    const buttons = document.querySelectorAll(".delete-news-btn");
    buttons.forEach((btn) => {
      btn.style.display = "none";
    });
  }
  if (!hasPermission("UploadGallery")) {
    const buttons = document.querySelectorAll(".gallery-news-btn");
    buttons.forEach((btn) => {
      btn.style.display = "none";
    });
  }
}

function previewImage(inputId, previewId) {
  const inputEl = document.getElementById(inputId);
  const previewEl = document.getElementById(previewId);
  if (!inputEl || !previewEl) return;
  inputEl.addEventListener("change", function (e) {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        previewEl.src = reader.result;
        previewEl.style.display = "block";
      };
      reader.readAsDataURL(file);
    } else {
      previewEl.src = "";
      previewEl.style.display = "none";
    }
  });
}
previewImage("newsImage", "newsImagePreview");
previewImage("editNewsImage", "editNewsImagePreview");

async function handleAddNews(e) {
  e.preventDefault();

  const fd = new FormData();
  fd.append("title", document.getElementById("newsTitle").value.trim());
  fd.append("shortText", document.getElementById("newsShortText").value.trim());
  fd.append("text", document.getElementById("newsDescription").value.trim());
  fd.append("isActive", document.getElementById("newsIsActive").checked);

  const fileEl = document.getElementById("newsImage");
  if (fileEl?.files.length) {
    fd.append("image", fileEl.files[0]); // کلید باید دقیقاً "image" باشه
  }

  try {
    const res = await fetchWithAuth(`${BASE_URL}/NewsAdmin/Save`, {
      method: "POST",
      body: fd,
    });

    if (res && res.ok) {
      closeModal("addNewsModal");
      loadNewsList();
    } else {
      alert("❌ خطا در ذخیره خبر");
    }
  } catch (err) {
    alert("❌ مشکل در ارتباط با سرور");
  }
}

// ویرایش خبر
async function handleEditNews(e) {
  e.preventDefault();

  const fd = new FormData();
  fd.append("id", parseInt(document.getElementById("editNewsId").value));
  fd.append("title", document.getElementById("editNewsTitle").value.trim());
  fd.append("shortText", document.getElementById("editNewsShortText").value.trim());
  fd.append("text", document.getElementById("editNewsDescription").value.trim());
  fd.append("isActive", document.getElementById("editNewsIsActive").checked);

  const fileEl = document.getElementById("editNewsImage");
  if (fileEl?.files.length) {
    fd.append("image", fileEl.files[0]);
  }

  try {
    const res = await fetchWithAuth(`${BASE_URL}/NewsAdmin/Update`, {
      method: "PUT",
      body: fd,
    });

    if (res && res.ok) {
      closeModal("editNewsModal");
      loadNewsList();
    } else {
      alert("❌ خطا در ویرایش خبر");
    }
  } catch (err) {
    alert("❌ مشکل در ارتباط با سرور");
  }
}

document.getElementById("addNewsForm")?.addEventListener("submit", handleAddNews);
document.getElementById("editNewsForm")?.addEventListener("submit", handleEditNews);

function openEditNewsModal(news) {
  document.getElementById("editNewsId").value = news.id;
  document.getElementById("editNewsTitle").value = news.title;
  document.getElementById("editNewsShortText").value = news.shortText;
  document.getElementById("editNewsDescription").value = news.text;
  document.getElementById("editNewsIsActive").checked = news.isActive;

  const previewEl = document.getElementById("editNewsImagePreview");
  if (news.imageName) {
    previewEl.src = `${BASE_URL}/uploads/NewsAdmin/${news.imageName}`;
    previewEl.style.display = "block";
  } else {
    previewEl.src = "";
    previewEl.style.display = "none";
  }

  openModal("editNewsModal");
}

function openDeleteNewsModal(id) {
  document.getElementById("confirmDeleteNews").onclick = () => deleteNews(id);
  openModal("deleteNewsModal");
}
async function deleteNews(id) {
  const loadingEl = document.getElementById("deleteNewsLoading");
  if (loadingEl) loadingEl.style.display = "flex";

  try {
    const res = await fetchWithAuth(`${BASE_URL}/NewsAdmin/Delete/${id}`, {
      method: "DELETE",
    });

    if (res && res.ok) {
      closeModal("deleteNewsModal");
      loadNewsList();
    } else {
      alert("❌ خطا در حذف خبر");
    }
  } catch (err) {
    alert("❌ خطا در ارتباط با سرور");
  }

  if (loadingEl) loadingEl.style.display = "none";
}

async function loadLinksList() {
  showLoading("adminLinksList", 3);

  try {
    const res = await fetchWithAuth(`${BASE_URL}/LinkAdmin/GetAllAdminLink`);

    if (!res) return;

    if (res.ok) {
      const data = await res.json();

      if (!data || !data.length) {
        addLinkBtn.innerHTML = `<tr><td colspan='5'>${data.message}</td></tr>`;
        return;
      }

      renderLinksList(data);
    } else {
      console.error("❌ خطا در دریافت لیست لینک‌ها", res.status);
      alert("❌ خطا در بارگذاری لینک‌ها");
    }
  } catch (err) {
    console.error("خطا در بارگذاری لیست لینک‌ها:", err);
    alert("❌ مشکل در ارتباط با سرور");
  }
}

function renderLinksList(data) {
  const tbody = document.getElementById("adminLinksList");
  tbody.innerHTML = data
    .map(
      (l) => `
    <tr>
      <td>${l.id}</td>
      <td>${l.linkTitle}</td>
      <td>
        <button 
          class="delete-link-btn"
          data-id="${l.id}"
        >🗑️</button>
      </td>
    </tr>
  `
    )
    .join("");

  // لینک
  if (!hasPermission("SaveLink")) {
    document.getElementById("addLinkBtn").style.display = "none";
  }
  if (!hasPermission("DeleteLink")) {
    const buttons = document.querySelectorAll(".delete-link-btn");
    buttons.forEach((btn) => {
      btn.style.display = "none";
    });
  }
}

async function handleAddLink(e) {
  e.preventDefault();

  const linkTitle = document.getElementById("linkTitle").value.trim();
  const loadingEl = document.getElementById("linkFormLoading");
  loadingEl.style.display = "flex";

  try {
    const res = await fetchWithAuth(`${BASE_URL}/NewsAdmin/Save`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ linkTitle }),
    });

    if (!res) return;

    if (res.ok) {
      closeModal("addLinkModal");
      loadLinksList();
    } else {
      alert("❌ خطا در ثبت لینک");
      console.error("Link save failed:", res.status, await res.text());
    }
  } catch (err) {
    console.error("خطا در ثبت لینک:", err);
    alert("❌ خطا در ارتباط با سرور");
  } finally {
    loadingEl.style.display = "none";
  }
}

function openEditLinkModal(id, title) {
  document.getElementById("editLinkId").value = id;
  document.getElementById("editLinkTitle").value = title;
  openModal("editLinkModal");
}
async function handleEditLink(e) {
  e.preventDefault();

  const id = document.getElementById("editLinkId").value;
  const linkTitle = document.getElementById("editLinkTitle").value.trim();
  const loadingEl = document.getElementById("editLinkLoading");
  loadingEl.style.display = "flex";

  try {
    const res = await fetchWithAuth(`${BASE_URL}/NewsAdmin/Save`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, linkTitle }),
    });

    if (!res) return;

    if (res.ok) {
      closeModal("editLinkModal");
      loadLinksList();
    } else {
      alert("❌ خطا در بروزرسانی لینک");
      console.error("Link update failed:", res.status, await res.text());
    }
  } catch (err) {
    console.error("خطا در بروزرسانی لینک:", err);
    alert("❌ خطا در ارتباط با سرور");
  } finally {
    loadingEl.style.display = "none";
  }
}

function openDeleteLinkModal(id) {
  document.getElementById("confirmDeleteLink").onclick = () => deleteLink(id);
  openModal("deleteLinkModal");
}
async function deleteLink(id) {
  const loadingEl = document.getElementById("deleteLinkLoading");
  if (loadingEl) loadingEl.style.display = "flex";

  try {
    const res = await fetchWithAuth(`${BASE_URL}/NewsAdmin/Delete/${id}`, {
      method: "DELETE",
    });

    if (!res) return;
    if (res.ok) {
      closeModal("deleteLinkModal");
      loadLinksList();
    } else {
      alert("❌ خطا در حذف لینک");
      console.error("Delete link failed:", res.status, await res.text());
    }
  } catch (err) {
    console.error("خطا در حذف لینک:", err);
    alert("❌ خطا در ارتباط با سرور");
  } finally {
    if (loadingEl) loadingEl.style.display = "none";
  }
}

document.querySelector('[data-tab="userTab"]').addEventListener("click", loadUsers);
document.querySelector('[data-tab="roleTab"]').addEventListener("click", loadRoles);
document.querySelector('[data-tab="groupingUserTab"]').addEventListener("click", loadAllGroups);
document.querySelector('[data-tab="newsTab"]').addEventListener("click", () => {
  loadNewsList(1);
});
document.querySelector('[data-tab="linksTab"]').addEventListener("click", loadLinksList);
document.querySelector('[data-tab="starTab"]').addEventListener("click", loadPolls);

function hasPermission(permission) {
  const stored = localStorage.getItem("permissions");
  if (!stored) return false;

  const perms = JSON.parse(stored);
  return perms.includes(permission);
}
function controlAdminUI() {
  const tabsConfig = [
    { id: "userTab", perm: "GetAllUsers" },
    { id: "roleTab", perm: "GetAllRoles" },
    { id: "groupingUserTab", perm: "GetAllRoles" },
    { id: "newsTab", perm: "GetAllNewsAdmin" },
    { id: "linksTab", perm: "GetAllAdminLink" },
    { id: "starTab", perm: "GetAllPolls" },
  ];

  document.querySelectorAll(".tab-btn").forEach((btn) => btn.classList.remove("active"));
  document.querySelectorAll(".tab-content").forEach((tab) => {
    tab.classList.remove("active");
    tab.style.display = "none";
  });

  const allowedTabs = [];
  tabsConfig.forEach(({ id, perm }) => {
    const btn = document.querySelector(`.tab-btn[data-tab="${id}"]`);
    const content = document.getElementById(id);

    if (!hasPermission(perm)) {
      btn?.style.setProperty("display", "none");
      content?.style.setProperty("display", "none");
    } else {
      allowedTabs.push({ btn, content });
      btn?.style.removeProperty("display");
      content?.style.removeProperty("display");
    }
  });

  if (allowedTabs.length > 0) {
    const firstAllowed = allowedTabs[0];
    allowedTabs[0].btn.classList.add("active");
    allowedTabs[0].content.classList.add("active");
    allowedTabs[0].content.style.display = "block";

    firstAllowed.btn.click();
  }
}

async function loadPolls() {
  adminPollList.innerHTML = "<tr><td colspan='5'>در حال بارگذاری...</td></tr>";

  try {
    const res = await fetchWithAuth(`${BASE_URL}/PollAdmin/GetAllPolls`);
    if (!res) {
      adminPollList.innerHTML = "<tr><td colspan='5'>⚠️ نیاز به ورود مجدد</td></tr>";
      return;
    }

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const polls = await res.json();

    if (!polls || !polls.length) {
      adminPollList.innerHTML = `<tr><td colspan='5'>${polls.message}</td></tr>`;
      return;
    }

    adminPollList.innerHTML = polls
      .map(
        (poll) => `
          <tr>
            <td>${poll.pollId}</td>
            <td>${poll.question}</td>
            <td>${poll.isActive ? "✅" : "❌"}</td>
            <td>${poll.showResultsAfterVote ? "✅" : "❌"}</td>
            <td>
              <button class="edit-poll-btn" data-id="${poll.pollId}">✏️ ویرایش</button>
              <button class="stats-poll-btn" data-id="${poll.pollId}">📊 آمار</button>
              <button class="delete-poll-btn" data-id="${poll.pollId}">🗑 حذف</button>
            </td>
          </tr>
        `
      )
      .join("");

    document.querySelectorAll(".edit-poll-btn").forEach((btn) => {
      btn.addEventListener("click", () => openEditPoll(btn.dataset.id));
    });
    document.querySelectorAll(".delete-poll-btn").forEach((btn) => {
      btn.addEventListener("click", () => openDeletePoll(btn.dataset.id));
    });
    document.querySelectorAll(".stats-poll-btn").forEach((btn) => {
      btn.addEventListener("click", () => openStatsPoll(btn.dataset.id));
    });

    // دکمه افزودن نظرسنجی
    if (!hasPermission("CreatePoll")) {
      document.getElementById("addStarBtn").style.display = "none";
    }
    if (!hasPermission("UpdatePoll")) {
      const buttons = document.querySelectorAll(".edit-poll-btn");
      buttons.forEach((btn) => {
        btn.style.display = "none";
      });
    }
    if (!hasPermission("GetPollResultsAdmin")) {
      const buttons = document.querySelectorAll(".stats-poll-btn");
      buttons.forEach((btn) => {
        btn.style.display = "none";
      });
    }
    if (!hasPermission("DeletePoll")) {
      const buttons = document.querySelectorAll(".delete-poll-btn");
      buttons.forEach((btn) => {
        btn.style.display = "none";
      });
    }
  } catch (err) {
    console.error("خطا در بارگذاری لیست نظرسنجی‌ها:", err);
    adminPollList.innerHTML = "<tr><td colspan='5'>❌ خطا در بارگذاری لیست</td></tr>";
  }
}

document.getElementById("addStarBtn").addEventListener("click", () => {
  document.getElementById("pollModalTitle").innerText = "افزودن نظر سنجی";
  document.getElementById("pollForm").reset();
  document.getElementById("pollId").value = "";
  document.getElementById("addEditPollModal").style.display = "block";
});

document.getElementById("pollForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const id = document.getElementById("pollId").value.trim();
  const isActive = document.getElementById("pollIsActiveInput").checked;
  const showResultsAfterVote = document.getElementById("pollShowResultsAfterVoteInput").checked;
  const startDate = document.getElementById("pollStartDateInput").value.trim();
  const endDate = document.getElementById("pollEndDateInput").value.trim();
  const question = document.getElementById("pollQuestionInput").value.trim();

  const options = document
    .getElementById("pollOptionsInput")
    .value.split(`\n`)
    .map((o) => o.trim())
    .filter((o) => o);

  if (!question || options.length < 2) {
    alert("سوال و حداقل دو گزینه لازم است");
    return;
  }

  const method = id && Number(id) > 0 ? "PUT" : "POST";
  const url = Number(id) < 1 ? `${BASE_URL}/PollAdmin/CreatePoll` : `${BASE_URL}/PollAdmin/UpdatePoll`;

  const loadingEl = document.getElementById("pollFormLoading");
  loadingEl.style.display = "flex";

  try {
    const res = await fetchWithAuth(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pollId: Number(id) || 0,
        question,
        startDate,
        endDate,
        isActive,
        showResultsAfterVote,
        options,
      }),
    });

    if (!res) {
      return;
    }

    if (!res.ok) {
      const errText = await res.text();
      console.error("Poll save failed:", res.status, errText);
      throw new Error(`HTTP ${res.status}`);
    }

    document.getElementById("addEditPollModal").style.display = "none";
    loadPolls();
  } catch (err) {
    console.error("خطا در ذخیره نظرسنجی:", err);
    alert("❌ ذخیره نظرسنجی با خطا مواجه شد");
  } finally {
    loadingEl.style.display = "none";
  }
});

function formatDateForInput(dateString) {
  const date = new Date(dateString);
  if (isNaN(date)) return "";
  return date.toISOString().split("T")[0]; // فقط YYYY-MM-DD
}
async function openEditPoll(id) {
  try {
    const res = await fetchWithAuth(`${BASE_URL}/PollAdmin/GetPollById/${id}`);

    if (!res) {
      return;
    }

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`HTTP ${res.status}: ${errorText}`);
    }

    const poll = await res.json();

    document.getElementById("pollId").value = poll.pollId;
    document.getElementById("pollQuestionInput").value = poll.question;
    document.getElementById("pollOptionsInput").value = poll.options.map((o) => o.optionText).join("\n");

    document.getElementById("pollStartDateInput").value = formatDateForInput(poll.startDate);
    document.getElementById("pollEndDateInput").value = formatDateForInput(poll.endDate);

    document.getElementById("pollIsActiveInput").checked = poll.isActive;
    document.getElementById("pollShowResultsAfterVoteInput").checked = poll.showResultsAfterVote;

    document.getElementById("pollModalTitle").innerText = "ویرایش نظر سنجی";
    document.getElementById("addEditPollModal").style.display = "block";
  } catch (err) {
    console.error("خطا در بارگذاری نظرسنجی:", err);
    alert("❌ مشکل در دریافت اطلاعات نظرسنجی");
  }
}
document.getElementById("pollForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const pollId = document.getElementById("pollId").value.trim();
  const question = document.getElementById("pollQuestionInput").value.trim();
  const options = document
    .getElementById("pollOptionsInput")
    .value.split("\n")
    .map((o) => o.trim())
    .filter((o) => o !== "");
  const startDate = document.getElementById("pollStartDateInput").value.trim();
  const endDate = document.getElementById("pollEndDateInput").value.trim();

  const isActive = document.getElementById("pollIsActiveInput").checked;
  const showResultsAfterVote = document.getElementById("pollShowResultsAfterVoteInput").checked;

  const loadingEl = document.getElementById("pollFormLoading");
  loadingEl.style.display = "flex";

  try {
    const res = await fetchWithAuth(`${BASE_URL}/PollAdmin/${pollId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pollId: Number(pollId),
        startDate,
        endDate,
        question,
        isActive,
        showResultsAfterVote,
        options,
      }),
    });

    if (!res) {
      return;
    }

    if (!res.ok) {
      const errText = await res.text();
      console.error("Poll update failed:", res.status, errText);
      throw new Error(`HTTP ${res.status}`);
    }

    alert("✅ نظرسنجی با موفقیت ویرایش شد");
    document.getElementById("addEditPollModal").style.display = "none";
    loadPolls();
  } catch (err) {
    console.error("خطا در ذخیره نظرسنجی:", err);
    alert("❌ حین ذخیره نظرسنجی خطا رخ داد");
  } finally {
    loadingEl.style.display = "none";
  }
});

let deletingPollId = null;
function openDeletePoll(id) {
  deletingPollId = id;
  document.getElementById("deletePollModal").style.display = "block";
}
document.getElementById("confirmDeletePoll").addEventListener("click", async () => {
  if (!deletingPollId) return;

  const loadingEl = document.getElementById("deletePollLoading");
  loadingEl.style.display = "flex";

  try {
    const res = await fetchWithAuth(`${BASE_URL}/PollAdmin/${deletingPollId}`, {
      method: "DELETE",
    });

    if (!res) {
      return;
    }

    if (!res.ok) {
      const errText = await res.text();
      console.error("Poll deletion failed:", res.status, errText);
      throw new Error(`HTTP ${res.status}`);
    }

    document.getElementById("deletePollModal").style.display = "none";
    loadPolls();
  } catch (err) {
    console.error("خطا در حذف نظرسنجی:", err);
    alert("❌ حذف نظرسنجی با خطا مواجه شد");
  } finally {
    loadingEl.style.display = "none";
  }
});

async function handleLogout() {
  const refreshToken = localStorage.getItem("refresh_token");

  if (!refreshToken) {
    localStorage.removeItem("access_token");
    location.reload();
    return;
  }

  try {
    const res = await fetchWithAuth(`${BASE_URL}/users/Logout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: refreshToken }),
    });

    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");

    if (res && res.ok) {
      location.reload();
      return;
    } else {
      console.error("Logout API failed:", res ? res.status : "No response");
      redirectToLogin();
    }
  } catch (err) {
    console.error("Error during logout:", err);
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");

    redirectToLogin();
  }
}

document.getElementById("logoutBtn")?.addEventListener("click", handleLogout);

document.querySelectorAll(".modal-close").forEach((btn) => {
  btn.addEventListener("click", () => (btn.closest(".modal").style.display = "none"));
});
document.getElementById("cancelDeletePoll").addEventListener("click", () => {
  document.getElementById("deletePollModal").style.display = "none";
});

async function openStatsPoll(id) {
  try {
    const res = await fetchWithAuth(`${BASE_URL}/PollAdmin/${id}/results`);

    if (!res) {
      return;
    }

    if (!res.ok) {
      const errorText = await res.text();
      console.error("Stats fetch failed:", res.status, errorText);
      throw new Error(`HTTP ${res.status}`);
    }

    const data = await res.json();

    let statsHtml = `
      <table class="admin-table">
        <tr><th>گزینه</th><th>تعداد رای</th><th>درصد</th></tr>
        ${data
          .map(
            (s) => `
            <tr>
              <td>${s.optionText}</td>
              <td>${s.voteCount}</td>
              <td>${s.percentage}%</td>
            </tr>
          `
          )
          .join("")}
      </table>
    `;

    document.getElementById("pollStatsContent").innerHTML = statsHtml;
    document.getElementById("pollStatsModal").style.display = "block";
  } catch (err) {
    console.error("خطا در دریافت آمار نظرسنجی:", err);
    alert("❌ خطا در دریافت آمار نظرسنجی");
  }
}
async function loadUsers() {
  try {
    const res = await fetchWithAuth(`${BASE_URL}/users/GetAllUsers`);
    if (!res.ok) throw new Error("خطا در دریافت کاربران");

    const users = await res.json();
    const tbody = document.getElementById("adminUserList");
    tbody.innerHTML = "";
    users.forEach((u) => {
      const roles = u.roles?.map((r) => r.roleTitle).join("، ") || "-";
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${u.userId}</td>
        <td>${u.fullName}</td>
        <td>${u.email}</td>
        <td>${u.mobile || "-"}</td>
        <td>${new Date(u.registerDate).toLocaleDateString("fa-IR")}</td>
        <td>${u.isActive ? "✅ فعال" : "❌ غیرفعال"}</td>
        <td>${roles}</td>
        <td>
          <button 
            class="edit-user-btn" title="ویرایش"
            data-id="${u.userId}"
            data-fullname="${encodeURIComponent(u.fullName)}"
            data-email="${encodeURIComponent(u.email)}"
            data-mobile="${encodeURIComponent(u.mobile || "")}"
            data-isactive="${u.isActive}"
            data-roles='${JSON.stringify(u.roles || [])}'
          >✏️</button>
          <button 
            class="delete-user-btn" title="حذف"
            data-id="${u.userId}"
          >🗑️</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    // کاربران
    if (!hasPermission("SaveNews")) {
      document.getElementById("addUserBtn").style.display = "none";
    }
    if (!hasPermission("UpdateUser")) {
      const buttons = document.querySelectorAll(".edit-user-btn");
      buttons.forEach((btn) => {
        btn.style.display = "none";
      });
    }
    if (!hasPermission("DeleteUser")) {
      const buttons = document.querySelectorAll(".delete-user-btn");
      buttons.forEach((btn) => {
        btn.style.display = "none";
      });
    }
  } catch (err) {
    console.error(err);
    alert("خطا در بارگذاری کاربران");
  }
}

async function loadRolesToSelect(selectId, selectedIds = []) {
  try {
    const res = await fetchWithAuth(`${BASE_URL}/role/GetAllRoles`);
    if (!res.ok) throw new Error("خطا در دریافت نقش‌ها");

    const roles = await res.json();
    const select = document.getElementById(selectId);
    select.innerHTML = "";
    select.multiple = true;

    roles.forEach((role) => {
      const opt = document.createElement("option");
      opt.value = role.roleId;
      opt.textContent = role.title;
      if (selectedIds.includes(role.roleId)) {
        opt.selected = true;
      }
      select.appendChild(opt);
    });
  } catch (err) {
    console.error(err);
    alert("خطا در بارگذاری نقش‌ها");
  }
}

function getSelectedRoleIds(selectId) {
  return Array.from(document.getElementById(selectId).selectedOptions).map((opt) => parseInt(opt.value, 10));
}

document.addEventListener("DOMContentLoaded", () => {
  const addUserBtn = document.getElementById("addUserBtn");
  if (addUserBtn) {
    addUserBtn.addEventListener("click", () => {
      document.getElementById("addUserForm").reset();
      loadRolesToSelect("addUserRole");
      document.getElementById("addUserModal").style.display = "block";
    });
  }

  document.getElementById("addUserForm").addEventListener("submit", async (e) => {
    e.preventDefault();

    const payload = {
      fullName: document.getElementById("addUserFullName").value.trim(),
      email: document.getElementById("addUserEmail").value.trim(),
      mobile: document.getElementById("addUserMobile").value.trim(),
      password: document.getElementById("addUserPassword").value.trim(),
      isActive: document.getElementById("addUserIsActive").checked,
      roleIds: getSelectedRoleIds("addUserRole"),
    };

    if (!payload.fullName || !payload.email || !payload.password) {
      alert("⚠ لطفاً همه فیلدهای اجباری را پر کنید");
      return;
    }

    document.getElementById("addUserLoading").style.display = "flex";
    try {
      const res = await fetchWithAuth(`${BASE_URL}/users/CreateUser`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      document.getElementById("addUserLoading").style.display = "none";

      if (res.ok) {
        alert("✅ کاربر جدید با موفقیت افزوده شد");
        closeModal("addUserModal");
        loadUsers();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(`❌ خطا: ${data.Message || ""}`);
      }
    } catch (err) {
      console.error(err);
      alert("مشکل در اتصال به سرور");
    }
  });

  document.getElementById("adminUserList").addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;

    if (btn.classList.contains("edit-user-btn")) {
      document.getElementById("editUserId").value = btn.dataset.id;
      document.getElementById("editUserFullName").value = decodeURIComponent(btn.dataset.fullname);
      document.getElementById("editUserEmail").value = decodeURIComponent(btn.dataset.email);
      document.getElementById("editUserMobile").value = decodeURIComponent(btn.dataset.mobile);
      document.getElementById("editUserIsActive").checked = btn.dataset.isactive === "true";
      document.getElementById("editUserPassword").value = "";

      const selectedRoles = JSON.parse(btn.dataset.roles || "[]").map((r) => r.roleId);
      loadRolesToSelect("editUserRole", selectedRoles);
      document.getElementById("editUserModal").style.display = "block";
    }

    if (btn.classList.contains("delete-user-btn")) {
      document.getElementById("confirmDeleteUser").dataset.id = btn.dataset.id;
      document.getElementById("deleteUserModal").style.display = "block";
    }
  });
});

function getSelectedRoleIds(selectId) {
  const select = document.getElementById(selectId);
  return Array.from(select.selectedOptions).map((opt) => parseInt(opt.value, 10));
}

document.addEventListener("DOMContentLoaded", () => {
  const editUserForm = document.getElementById("editUserForm");
  const loadingEl = document.getElementById("editUserLoading");

  editUserForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const id = document.getElementById("editUserId").value;

    const payload = {
      FullName: document.getElementById("editUserFullName").value.trim(),
      Email: document.getElementById("editUserEmail").value.trim(),
      Mobile: document.getElementById("editUserMobile").value.trim(),
      Password: document.getElementById("editUserPassword").value.trim(),
      IsActive: document.getElementById("editUserIsActive").checked,
      RoleIds: getSelectedRoleIds("editUserRole"),
    };

    if (!payload.FullName || !payload.Email) {
      alert(".لطفاً نام کامل و ایمیل را وارد کنید");
      return;
    }

    try {
      loadingEl.style.display = "flex";

      const updateRes = await fetchWithAuth(`${BASE_URL}/users/UpdateUser/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      loadingEl.style.display = "none";

      if (updateRes.ok) {
        alert("✅ اطلاعات کاربر با موفقیت بروزرسانی شد");
        closeModal("editUserModal");
        loadUsers();
      } else {
        const data = await updateRes.json().catch(() => ({}));
        console.error("❌ خطای API:", data);
        alert(`❌ خطا: ${data.Message || JSON.stringify(data)}`);
      }
    } catch (err) {
      console.error("❌ خطای شبکه:", err);
      loadingEl.style.display = "none";
      alert("مشکل در اتصال به سرور");
    }
  });
});

// حذف
document.getElementById("confirmDeleteUser").addEventListener("click", async (e) => {
  const id = e.target.dataset.id;
  document.getElementById("deleteUserLoading").style.display = "flex";

  try {
    const res = await fetchWithAuth(`${BASE_URL}/users/DeleteUser/${id}`, { method: "DELETE" });
    document.getElementById("deleteUserLoading").style.display = "none";

    if (res.ok) {
      alert("✅ کاربر حذف شد");
      closeModal("deleteUserModal");
      loadUsers();
    } else {
      alert("❌ خطا در حذف کاربر");
    }
  } catch (err) {
    console.error(err);
    alert("مشکل در اتصال به سرور");
  }
});

document.getElementById("cancelDeleteUser").addEventListener("click", () => {
  closeModal("deleteUserModal");
});

function closeModal(id) {
  document.getElementById(id).style.display = "none";
}

async function loadPermissions(containerId, selectedIds = []) {
  try {
    const res = await fetchWithAuth(`${BASE_URL}/permission/GetAllPermissions`);
    if (!res.ok) throw new Error("خطا در لود پرمیژن‌ها");

    const permissions = await res.json();
    const container = document.getElementById(containerId);
    container.innerHTML = "";

    let count = 1;
    permissions.forEach((p) => {
      const div = document.createElement("div");
      div.innerHTML = `
      <table class="admin-table">
        <tr>
          <td style="width: 5%;">${count}</td>
          <td style="width: 80%;text-align: right;">${p.title}</td>
          <td><input type="checkbox" value="${p.permissionId}" style="margin-top: -40px;"
            ${selectedIds.includes(p.permissionId) ? "checked" : ""}></td>
        </tr>
      </table>
      `;
      container.appendChild(div);
      count = count + 1;
    });
  } catch (err) {
    console.error("خطا در لود پرمیژن‌ها", err);
    alert("مشکل در لود پرمیژن‌ها");
  }
}

async function loadRoles() {
  try {
    const res = await fetchWithAuth(`${BASE_URL}/role/GetAllRoles`);
    if (!res.ok) throw new Error("خطا در دریافت نقش‌ها");

    const roles = await res.json();
    const tbody = document.getElementById("adminRoleList");
    tbody.innerHTML = "";

    roles.forEach((r) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${r.roleId}</td>
        <td>${r.title}</td>
        <td>${r.roleTitle}</td>
        <td>${r.isDefault ? "✅" : "❌"}</td>
        <td>${r.isDelete ? "❌" : "✅"}</td>
        <td>
          <button class="edit-role-btn" 
            data-id="${r.roleId}"
            data-title="${encodeURIComponent(r.title)}"
            data-roletitle="${encodeURIComponent(r.roleTitle)}"
            data-isdefault="${r.isDefault}"
          >✏️</button>
          <button class="delete-role-btn" data-id="${r.roleId}">🗑️</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    // نقش های کاربران
    if (!hasPermission("CreateRole")) {
      document.getElementById("addRoleBtn").style.display = "none";
    }
    if (!hasPermission("UpdateRole")) {
      const buttons = document.querySelectorAll(".edit-role-btn");
      buttons.forEach((btn) => {
        btn.style.display = "none";
      });
    }
    if (!hasPermission("DeleteRole")) {
      const buttons = document.querySelectorAll(".delete-role-btn");
      buttons.forEach((btn) => {
        btn.style.display = "none";
      });
    }
  } catch (err) {
    console.error(err);
    alert("خطا در بارگذاری نقش‌ها");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const addRoleBtn = document.getElementById("addRoleBtn");
  addRoleBtn.addEventListener("click", () => {
    document.getElementById("addRoleForm").reset();
    loadPermissions("addRolePermissions"); // نمایش همه دسترسی‌ها
    document.getElementById("addRoleModal").style.display = "block";
  });

  document.getElementById("addRoleForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const selectedPermissions = Array.from(document.querySelectorAll("#addRolePermissions input:checked")).map((chk) => parseInt(chk.value));

    const payload = {
      Title: document.getElementById("addRoleTitle").value.trim(),
      RoleTitle: document.getElementById("addRoleRoleTitle").value.trim(),
      IsDefault: document.getElementById("addRoleIsDefault").checked,
      PermissionIds: selectedPermissions,
    };

    if (!payload.Title || !payload.RoleTitle) {
      alert("⚠ لطفاً همه فیلدهای اجباری را پر کنید");
      return;
    }

    document.getElementById("addRoleLoading").style.display = "flex";
    try {
      const res = await fetchWithAuth(`${BASE_URL}/role/CreateRole`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      document.getElementById("addRoleLoading").style.display = "none";

      if (res.ok) {
        alert("✅ نقش جدید افزوده شد");
        closeModal("addRoleModal");
        loadRoles();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(`❌ خطا: ${data.Message || ""}`);
      }
    } catch (err) {
      console.error(err);
      alert("مشکل در اتصال به سرور");
    }
  });

  document.getElementById("adminRoleList").addEventListener("click", async (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;

    if (btn.classList.contains("edit-role-btn")) {
      const roleId = btn.dataset.id;

      const roleRes = await fetchWithAuth(`${BASE_URL}/role/GetRoleById/${roleId}`);
      if (!roleRes.ok) {
        alert("خطا در دریافت اطلاعات نقش");
        return;
      }
      const roleData = await roleRes.json();
      document.getElementById("editRoleId").value = roleData.roleId;
      document.getElementById("editRoleTitle").value = roleData.title;
      document.getElementById("editRoleRoleTitle").value = roleData.roleTitle;
      document.getElementById("editRoleIsDefault").checked = roleData.isDefault;

      const selectedPermissions = roleData.permissionIds || [];
      await loadPermissions("editRolePermissions", selectedPermissions);

      document.getElementById("editRoleModal").style.display = "block";
    }

    if (btn.classList.contains("delete-role-btn")) {
      document.getElementById("confirmDeleteRole").dataset.id = btn.dataset.id;
      document.getElementById("deleteRoleModal").style.display = "block";
    }
  });

  document.getElementById("editRoleForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = document.getElementById("editRoleId").value;

    const selectedPermissions = Array.from(document.querySelectorAll("#editRolePermissions input:checked")).map((chk) => parseInt(chk.value));

    const payload = {
      Title: document.getElementById("editRoleTitle").value.trim(),
      RoleTitle: document.getElementById("editRoleRoleTitle").value.trim(),
      IsDefault: document.getElementById("editRoleIsDefault").checked,
      PermissionIds: selectedPermissions,
    };

    if (!payload.Title || !payload.RoleTitle) {
      alert("لطفاً همه فیلدهای اجباری را پر کنید");
      return;
    }

    document.getElementById("editRoleLoading").style.display = "flex";
    try {
      const updateRes = await fetchWithAuth(`${BASE_URL}/role/UpdateRole/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      document.getElementById("editRoleLoading").style.display = "none";

      if (updateRes.ok) {
        alert("✅ نقش ویرایش شد");
        closeModal("editRoleModal");
        loadRoles();
      } else {
        const data = await updateRes.json().catch(() => ({}));
        alert(`❌ خطا: ${data.Message || ""}`);
      }
    } catch (err) {
      console.error(err);
      alert("مشکل در اتصال به سرور");
    }
  });

  document.getElementById("confirmDeleteRole").addEventListener("click", async (e) => {
    const id = e.target.dataset.id;
    document.getElementById("deleteRoleLoading").style.display = "flex";

    try {
      const res = await fetchWithAuth(`${BASE_URL}/role/DeleteRole/${id}`, { method: "DELETE" });
      document.getElementById("deleteRoleLoading").style.display = "none";

      if (res.ok) {
        alert("✅ نقش حذف شد");
        closeModal("deleteRoleModal");
        loadRoles();
      } else {
        alert("❌ خطا در حذف نقش");
      }
    } catch (err) {
      console.error(err);
      alert("مشکل در اتصال به سرور");
    }
  });

  document.getElementById("cancelDeleteRole").addEventListener("click", () => {
    closeModal("deleteRoleModal");
  });
});

function closeModal(id) {
  document.getElementById(id).style.display = "none";
}

//===================================================
const groupModal = document.getElementById("groupModal");
let selectedEmployees = new Set();
let allEmployeesData = [];
let currentGroupId = null;

// 📌 باز کردن مودال و ریست
document.getElementById("addGroupBtn").addEventListener("click", () => {
  openGroupModal();
});

document.getElementById("closeGroupModal").addEventListener("click", () => {
  groupModal.style.display = "none";
});

function openGroupModal(id = null) {
  currentGroupId = id;
  document.getElementById("groupName").value = "";
  document.getElementById("groupEmployees").innerHTML = "";
  document.getElementById("groupUsers").innerHTML = "";
  document.getElementById("employeeSearch").value = "";
  selectedEmployees.clear();

  if (id) {
    loadGroupData(id);
  } else {
    loadAllEmployees();
  }

  groupModal.style.display = "block";
}

// 📌 لود لیست گروه‌ها
async function loadAllGroups() {
  try {
    const res = await fetch(`${BASE_URL}/GroupingUsers`);
    if (!res.ok) throw new Error("خطا در دریافت گروه‌ها");

    const groups = await res.json();
    const tbody = document.getElementById("groupList");
    tbody.innerHTML = "";

    groups.forEach((g) => {
      const tr = document.createElement("tr");

      const tdId = document.createElement("td");
      tdId.textContent = g.id;

      const tdName = document.createElement("td");
      tdName.textContent = g.groupName;

      const tdCount = document.createElement("td");
      tdCount.textContent = g.employeeCount;

      const tdActions = document.createElement("td");

      const editBtn = document.createElement("button");
      editBtn.title = "ویرایش";
      editBtn.textContent = "✏️";
      editBtn.addEventListener("click", () => editGroup(g.id));

      const msgBtn = document.createElement("button");
      msgBtn.title = "ارسال پیام";
      msgBtn.textContent = "💬";
      msgBtn.addEventListener("click", () => openMessageModal(g.id));

      const delBtn = document.createElement("button");
      delBtn.title = "حذف";
      delBtn.textContent = "🗑️";
      delBtn.addEventListener("click", () => deleteGroup(g.id));

      tdActions.append(editBtn, msgBtn, delBtn);
      tr.append(tdId, tdName, tdCount, tdActions);
      tbody.appendChild(tr);
    });
  } catch (error) {
    console.error(error);
    alert("دریافت گروه‌ها با خطا مواجه شد.");
  }
}

// 📌 باز کردن مودال ارسال پیام
function openMessageModal(groupId) {
  const modal = document.getElementById("messageModal");
  modal.style.display = "block";
  document.getElementById("sendMsgBtn").dataset.groupId = groupId;
}

// 📌 بستن مودال
function closeMessageModal() {
  document.getElementById("messageModal").style.display = "none";
  document.getElementById("msgTitle").value = "";
  document.getElementById("msgBody").value = "";
}

// 📌 لود کارمندان
async function loadAllEmployees(excludeIds = []) {
  const res = await fetch(`${BASE_URL}/employee`);
  allEmployeesData = await res.json();

  const filteredEmployees = allEmployeesData.filter((emp) => !excludeIds.includes(emp.id));

  renderEmployees(filteredEmployees);

  // سرچ زنده
  const searchInput = document.getElementById("employeeSearch");
  searchInput.oninput = () => {
    const term = searchInput.value.trim().toLowerCase();
    const filtered = filteredEmployees.filter((emp) => emp.name.toLowerCase().includes(term) || (emp.email && emp.email.toLowerCase().includes(term)));
    renderEmployees(filtered);
  };
}

// 📌 لیست کارمندان سمت چپ
function renderEmployees(employees) {
  const container = document.getElementById("groupEmployees");
  container.innerHTML = "";
  employees.forEach((emp) => {
    const li = document.createElement("li");
    li.textContent = `${emp.name} (${emp.email || ""})`;
    li.draggable = true;
    li.dataset.id = emp.id;

    li.addEventListener("click", (e) => {
      e.preventDefault();
      toggleSelection(li);
    });

    container.appendChild(li);
  });
  initDragAndDrop();
}

// 📌 تغییر انتخاب
function toggleSelection(li) {
  const id = li.dataset.id;
  if (selectedEmployees.has(id)) {
    selectedEmployees.delete(id);
    li.classList.remove("selected");
  } else {
    selectedEmployees.add(id);
    li.classList.add("selected");
  }
}

// 📌 Drag & Drop
function initDragAndDrop() {
  const lists = document.querySelectorAll(".user-list");

  lists.forEach((list) => {
    list.addEventListener("dragstart", (e) => {
      e.dataTransfer.effectAllowed = "move";
      e.target.classList.add("dragging");

      const ids = selectedEmployees.size > 0 ? Array.from(selectedEmployees) : [e.target.dataset.id];

      e.dataTransfer.setData("application/json", JSON.stringify(ids));
    });

    list.addEventListener("dragend", () => {
      document.querySelectorAll(".dragging").forEach((li) => li.classList.remove("dragging"));
    });

    list.addEventListener("dragover", (e) => e.preventDefault());

    list.addEventListener("drop", (e) => {
      e.preventDefault();
      const ids = JSON.parse(e.dataTransfer.getData("application/json"));
      const targetList = e.target.closest(".user-list");

      ids.forEach((id) => {
        const draggedLi = document.querySelector(`.user-list li[data-id="${id}"]`);
        if (draggedLi) {
          draggedLi.classList.remove("selected");
          selectedEmployees.delete(id);
          targetList.appendChild(draggedLi);
        }
      });
    });
  });
}

// 📌 ذخیره گروه
document.getElementById("saveGroupBtn").addEventListener("click", async () => {
  const groupName = document.getElementById("groupName").value.trim();
  const employeeIds = Array.from(document.querySelectorAll("#groupUsers li")).map((li) => parseInt(li.dataset.id));

  if (!groupName) {
    alert("لطفاً نام گروه را وارد کنید");
    return;
  }

  const payload = { groupName, employeeIds };
  if (currentGroupId) {
    await fetch(`${BASE_URL}/GroupingUsers/${currentGroupId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    alert("گروه ویرایش شد");
  } else {
    await fetch(`${BASE_URL}/GroupingUsers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    alert("گروه اضافه شد");
  }

  groupModal.style.display = "none";
  loadAllGroups();
});

// 📌 پر کردن مودال ویرایش
async function loadGroupData(id) {
  // اول همه کارمندان رو بگیر
  await loadAllEmployees();

  const res = await fetch(`${BASE_URL}/GroupingUsers/${id}`);
  const data = await res.json();

  document.getElementById("groupName").value = data.groupName;

  const rightContainer = document.getElementById("groupUsers");
  rightContainer.innerHTML = "";
  data.employeeIds.forEach((empId) => {
    const emp = allEmployeesData.find((e) => e.id === empId);
    if (emp) {
      const li = document.createElement("li");
      li.textContent = `${emp.name} (${emp.email || ""})`;
      li.draggable = true;
      li.dataset.id = emp.id;
      li.addEventListener("click", (e) => {
        e.preventDefault();
        toggleSelection(li);
      });
      rightContainer.appendChild(li);
    }
  });

  // به‌روز کردن سمت چپ بدون اعضای گروه
  const memberIds = data.employeeIds;
  const leftList = allEmployeesData.filter((emp) => !memberIds.includes(emp.id));
  renderEmployees(leftList);
}

function editGroup(id) {
  openGroupModal(id);
}

async function deleteGroup(id) {
  if (!confirm("آیا از حذف این گروه مطمئن هستید؟")) return;
  await fetch(`${BASE_URL}/GroupingUsers/${id}`, { method: "DELETE" });
  loadAllGroups();
}

//================= Message For Users ===========
// let currentGroupId = null;

// 📌 باز کردن مودال ارسال پیام
function openMessageModal(groupId) {
  const modal = document.getElementById("messageModal");
  modal.style.display = "block";
  document.getElementById("sendMsgBtn").dataset.groupId = groupId;
}

// 📌 بستن مودال
function closeMessageModal() {
  document.getElementById("messageModal").style.display = "none";
  document.getElementById("msgTitle").value = "";
  document.getElementById("msgBody").value = "";
}

// 📌 ارسال پیام به گروه
async function sendGroupMessage() {
  const groupId = document.getElementById("sendMsgBtn").dataset.groupId;
  const title = document.getElementById("msgTitle").value.trim();
  const message = document.getElementById("msgBody").value.trim();

  if (!title || !message) {
    alert("عنوان و متن پیام را وارد کنید.");
    return;
  }

  try {
    const res = await fetch(`${BASE_URL}/Notification/SendGroupNotification/${groupId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, message }),
    });

    if (!res.ok) throw new Error("ارسال پیام با خطا مواجه شد.");

    const data = await res.json();
    alert(data.message || "پیام ارسال شد.");
    closeMessageModal();
  } catch (error) {
    console.error(error);
    alert("ارسال پیام با خطا مواجه شد.");
  }
}

// 📌 رویدادها
document.getElementById("closeMsgBtn").addEventListener("click", closeMessageModal);
document.getElementById("sendMsgBtn").addEventListener("click", sendGroupMessage);

document.querySelectorAll(".inner-tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    // حذف active از همه
    document.querySelectorAll(".inner-tab-btn").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".inner-tab-content").forEach((c) => c.classList.remove("active"));

    // فعال کردن تب انتخاب‌شده
    btn.classList.add("active");
    document.getElementById(btn.dataset.innerTab).classList.add("active");
  });
});
