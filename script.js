const BASE_URL = "https://localhost:7172/api";

document.addEventListener("DOMContentLoaded", () => {
  const url = `${BASE_URL}/Log/write`;

  fetch(url, { method: "GET" }).catch((err) => console.error("Log error:", err));
});

// (function () {
//   let idleTimer;
//   const idleLimit = 10 * 60 * 1000; // 10 دقیقه به میلی‌ثانیه

//   function resetTimer() {
//     clearTimeout(idleTimer);
//     idleTimer = setTimeout(() => {
//       location.reload();
//     }, idleLimit);
//   }

//   ["mousemove", "keydown", "scroll", "touchstart"].forEach((evt) => window.addEventListener(evt, resetTimer));

//   resetTimer();
// })();

let fixedLinks = [];

const todoInput = document.getElementById("todoInput");
const todoList = document.getElementById("todoList");
const toggleTodoVisibilityBtn = document.getElementById("toggleTodoVisibility");
const columnsContainer = document.getElementById("columnsContainer");

const LOCAL_STORAGE_KEY = "myTodoTasks";
const LOCAL_STORAGE_COLUMNS_KEY = "columnOrder";

let textHidden = false;
let isDraggingTask = false;
let isDraggingColumn = false;

function getTasks() {
  return JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || "[]");
}
function saveTasks(tasks) {
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(tasks));
}
function updateTask(updated) {
  const tasks = getTasks().map((t) => (t.text === updated.text ? updated : t));
  saveTasks(tasks);
}
function removeTask(text) {
  saveTasks(getTasks().filter((t) => t.text !== text));
}

async function checkNotificationsByIP() {
  try {
    const res = await fetch(`${BASE_URL}/notification/GetAllNotification`);
    if (!res.ok) throw new Error(`HTTP Error ${res.status}`);

    const notifications = await res.json();
    renderNotifications(notifications);
  } catch (err) {
    console.error("Error fetching notifications:", err);
    renderNotifications([]);
  }
}

function renderNotifications(notifications) {
  const container = document.getElementById("notificationContainer");
  container.innerHTML = "";

  if (!notifications || notifications.length === 0) {
    // container.innerHTML = `<div class="notification-item"><p>📭 پیامی موجود نیست</p></div>`;
    return;
  }

  notifications.forEach((n) => {
    const item = document.createElement("div");
    item.className = "notification-item";
    item.innerHTML = `
    <span class="close-btn" title="بستن">&times;</span>
    <div class="notif-header" style="display:flex; align-items:center; cursor:pointer;">
      <span class="arrow" style="margin-right:5px;color: #00437a; transition:transform 0.2s ease;">▶ </span>
      <h4 style="margin:0;">${n.title}</h4>
    </div>
    <p class="notif-message" style="display:none; margin-top:5px;">${n.message}</p>
  `;

    // دکمه بستن
    const closeBtn = item.querySelector(".close-btn");
    closeBtn.addEventListener("click", async () => {
      await markAsReadNotifications(n.notificationId);
      item.remove();
    });

    // باز/بسته کردن پیام همراه با چرخش فلش
    const headerEl = item.querySelector(".notif-header");
    const messageEl = item.querySelector(".notif-message");
    const arrowEl = item.querySelector(".arrow");

    headerEl.addEventListener("click", () => {
      const isVisible = messageEl.style.display === "block";
      messageEl.style.display = isVisible ? "none" : "block";
      arrowEl.style.transform = isVisible ? "rotate(0deg)" : "rotate(90deg)";
    });

    container.appendChild(item);
  });
}
async function markAsReadNotifications(notificationId) {
  try {
    const res = await fetch(`${BASE_URL}/notification/mark-as-read/${notificationId}`, {
      method: "POST",
    });

    if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
  } catch (err) {
    console.error("Error marking as read:", err);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  checkNotificationsByIP();
  setInterval(checkNotificationsByIP, 10 * 60 * 1000);
});

function staggeredFallAllForColumns({ containerSelector, excludeSelector = "", staggerMs = 150 }) {
  const container = document.querySelector(containerSelector);
  if (!container) return;

  const items = Array.from(container.querySelectorAll(`.todo-item:not(${excludeSelector})`));
  const viewportHeight = window.innerHeight;
  let pileOffset = 0;

  items.forEach((item, index) => {
    const rect = item.getBoundingClientRect();
    const finalY = viewportHeight - item.offsetHeight - 10 - pileOffset;

    item.style.position = "fixed";
    item.style.left = rect.left + "px";
    item.style.top = rect.top + "px";
    item.style.width = rect.width + "px";
    item.style.zIndex = 9999;

    setTimeout(() => {
      item.style.transition = "transform 0.6s ease-out";
      item.style.transform = `translateY(${finalY - rect.top}px)`;
      pileOffset += item.offsetHeight;
    }, index * staggerMs);
  });
}

function fallAllTodoItemsOneByOne(staggerMs = 200) {
  const items = Array.from(document.querySelectorAll(".todo-item"));
  const viewportHeight = window.innerHeight;
  let pileOffset = 0;

  items.forEach((item, i) => {
    const rect = item.getBoundingClientRect();
    const finalY = viewportHeight - item.offsetHeight - 10 - pileOffset;

    item.style.position = "fixed";
    item.style.left = rect.left + "px";
    item.style.top = rect.top + "px";
    item.style.width = rect.width + "px";
    item.style.zIndex = 9999;

    setTimeout(() => {
      item.style.transition = "transform 0.6s ease-out";
      item.style.transform = `translateY(${finalY - rect.top}px)`;
      pileOffset += item.offsetHeight;
    }, i * staggerMs);
  });
}

function renderTask(task, toTop = false) {
  const li = document.createElement("li");
  li.className = "todo-item";
  li.draggable = true;
  li.dataset.text = task.text;
  if (task.done) li.classList.add("done");
  li.style.border = task.border || "";

  li.innerHTML = `
    <span class="drag-handle">☰</span>
    <span class="task-text">${task.text}</span>
    <button class="delete-btn" title="حذف">🗑️</button>
  `;

  let clickCount = 0;
  let lastClickTime = 0;
  let warningStage = 0;
  let stageLock = false;

  let funnyMsg = document.getElementById("funnyMsg");
  if (!funnyMsg) {
    funnyMsg = document.createElement("div");
    funnyMsg.id = "funnyMsg";
    funnyMsg.classList.add("hide");
    document.body.appendChild(funnyMsg);
  }

  let angryEmoji = document.getElementById("angryEmoji");
  if (!angryEmoji) {
    angryEmoji = document.createElement("div");
    angryEmoji.id = "angryEmoji";
    angryEmoji.classList.add("hide");
    angryEmoji.textContent = "😤";
    document.body.appendChild(angryEmoji);
  }

  li.querySelector(".task-text").addEventListener("click", () => {
    const now = Date.now();

    if (now - lastClickTime < 500) {
      clickCount++;
    } else {
      clickCount = 1;
    }
    lastClickTime = now;

    if (clickCount === 5 && !stageLock) {
      warningStage++;
      stageLock = true;

      if (warningStage === 1) {
        funnyMsg.textContent = "😏 بس کن دیگه!";
        funnyMsg.classList.add("show");
        funnyMsg.classList.remove("hide");
        setTimeout(() => funnyMsg.classList.add("shake"), 180);

        setTimeout(() => {
          funnyMsg.classList.remove("show", "shake");
          funnyMsg.classList.add("hide");
          stageLock = false;
        }, 2500);
      } else if (warningStage === 2) {
        angryEmoji.classList.add("show");
        angryEmoji.classList.remove("hide");

        setTimeout(() => {
          angryEmoji.classList.add("hide");
          angryEmoji.classList.remove("show");
          stageLock = false;
        }, 1200);
      } else if (warningStage === 3) {
        const count = staggeredFallAllForColumns({
          containerSelector: "#columnsContainer",
          excludeSelector: ".no-fall, .pinned",
          staggerMs: 80,
        });

        setTimeout(() => {
          warningStage = 0;
          stageLock = false;
        }, count * 80 + 1000);
      }

      clickCount = 0;
      return;
    }

    task.done = !task.done;
    li.classList.toggle("done", task.done);
    updateTask(task);
    if (task.done) starRain();
  });

  li.querySelector(".delete-btn").addEventListener("click", () => {
    if (confirm(`آیا از حذف "${task.text}" مطمئنی؟`)) {
      li.remove();
      removeTask(task.text);
      saveNewOrder();
    }
  });

  li.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    openContextMenu(e, task, li);
  });

  li.addEventListener("dragstart", (e) => {
    if (!e.target.classList.contains("todo-item")) return;
    isDraggingTask = true;
    isDraggingColumn = false;
    e.stopPropagation();
    li.classList.add("dragging");
  });

  li.addEventListener("dragend", () => {
    isDraggingTask = false;
    li.classList.remove("dragging");
    saveNewOrder();
  });

  const todoList = document.getElementById("todoList");
  if (toTop && todoList.firstChild) {
    todoList.insertBefore(li, todoList.firstChild);
  } else if (toTop) {
    todoList.prepend(li);
  } else {
    todoList.append(li);
  }
}

function addTodo() {
  const username = localStorage.getItem("username");
  if (username == null || username == "") {
    alert("لطفا نام خود را در بالای صفحه اضافه کنید.");
    return;
  }
  const text = todoInput.value.trim();
  if (!text) return;
  const newTask = { text, color: "rgb(41, 52, 80)", done: false };

  renderTask(newTask, true);
  saveTasks([newTask, ...getTasks()]);
  saveNewOrder();

  todoInput.value = "";
  todoInput.style.height = "40px";
}

function loadTasks() {
  todoList.innerHTML = "";
  getTasks().forEach((task) => renderTask(task));
}

todoList.addEventListener("dragover", (e) => {
  if (!isDraggingTask) return;
  e.preventDefault();
  e.stopPropagation();
  const draggingItem = document.querySelector(".todo-item.dragging");
  const afterElement = getDragAfterElement(todoList, e.clientY);
  if (!afterElement) {
    todoList.appendChild(draggingItem);
  } else {
    todoList.insertBefore(draggingItem, afterElement);
  }
});
function getDragAfterElement(container, y) {
  const draggableElements = [...container.querySelectorAll(".todo-item:not(.dragging)")];
  return draggableElements.reduce(
    (closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closest.offset) {
        return { offset, element: child };
      }
      return closest;
    },
    { offset: Number.NEGATIVE_INFINITY }
  ).element;
}
function saveNewOrder() {
  const newTasks = [...todoList.querySelectorAll(".todo-item")].map((li) => getTasks().find((t) => t.text === li.dataset.text));
  saveTasks(newTasks);
}

function enableColumnDragWithZones() {
  const columns = columnsContainer.querySelectorAll(".column");
  let dropZones = [];

  columns.forEach((col) => {
    col.draggable = true;

    col.addEventListener("dragstart", (e) => {
      if (!e.target.classList.contains("column")) return;
      isDraggingColumn = true;
      isDraggingTask = false;
      col.classList.add("dragging");

      dropZones = [];
      const allCols = [...columnsContainer.querySelectorAll(".column")];
      for (let i = 0; i <= allCols.length; i++) {
        const dz = document.createElement("div");
        dz.classList.add("drop-zone");
        dz.style.width = col.offsetWidth / 3 + "px";
        dz.style.height = col.offsetHeight + "px";
        dropZones.push(dz);

        if (i === allCols.length) {
          columnsContainer.appendChild(dz);
        } else {
          columnsContainer.insertBefore(dz, allCols[i]);
        }
      }
    });

    col.addEventListener("dragend", () => {
      isDraggingColumn = false;
      col.classList.remove("dragging");

      const activeZone = columnsContainer.querySelector(".drop-zone.active");
      if (activeZone) {
        columnsContainer.insertBefore(col, activeZone.nextSibling);
      }

      dropZones.forEach((z) => z.remove());
      dropZones = [];

      saveColumnOrder();
    });
  });

  columnsContainer.addEventListener("dragover", (e) => {
    if (!isDraggingColumn) return;
    e.preventDefault();

    let closestZone = null;
    let closestDistance = Infinity;

    dropZones.forEach((zone) => {
      const rect = zone.getBoundingClientRect();
      const dist = Math.abs(e.clientX - (rect.left + rect.width / 2));
      if (dist < closestDistance) {
        closestDistance = dist;
        closestZone = zone;
      }
    });

    dropZones.forEach((z) => z.classList.remove("active"));
    if (closestZone) closestZone.classList.add("active");
  });
}

function getColumnAfterElement(container, x) {
  const draggableCols = [...container.querySelectorAll(".column:not(.dragging), .column-placeholder")];
  return draggableCols.reduce(
    (closest, child) => {
      if (child.classList.contains("column-placeholder")) return closest;
      const box = child.getBoundingClientRect();
      const offset = x - box.left - box.width / 2;
      if (offset < 0 && offset > closest.offset) {
        return { offset, element: child };
      }
      return closest;
    },
    { offset: Number.NEGATIVE_INFINITY }
  ).element;
}
function saveColumnOrder() {
  const order = [...columnsContainer.querySelectorAll(".column")].map((col) => col.dataset.id);
  localStorage.setItem(LOCAL_STORAGE_COLUMNS_KEY, JSON.stringify(order));
}
function loadColumnOrder() {
  const order = JSON.parse(localStorage.getItem(LOCAL_STORAGE_COLUMNS_KEY) || "[]");
  if (order.length) {
    order.forEach((id) => {
      const col = document.querySelector(`.column[data-id="${id}"]`);
      if (col) columnsContainer.appendChild(col);
    });
  }
}

function applyTextVisibilityState(isHidden) {
  document.querySelectorAll("#todoList .task-text").forEach((span) => span.classList.toggle("hidden-text", isHidden));
  const todoColumn = document.querySelector(".column.right .todo-container");
  if (todoColumn) {
    todoColumn.classList.toggle("blur-mode", isHidden);
  }
  toggleTodoVisibilityBtn.textContent = isHidden ? "کارهای روزانه" : "کارهای روزانه";
}
toggleTodoVisibilityBtn.addEventListener("click", () => {
  textHidden = !textHidden;
  localStorage.setItem("todoTextHidden", JSON.stringify(textHidden));
  applyTextVisibilityState(textHidden);
});

const contextMenu = document.createElement("div");
contextMenu.className = "context-menu";
contextMenu.style.position = "absolute";
contextMenu.style.display = "none";
contextMenu.innerHTML = `
  <ul>
    <li data-action="toggle">✅ انجام/بازگردانی</li>
    <li data-action="priority-urgent">🔴 فوری</li>
    <li data-action="priority-high">🟠 زیاد</li>
    <li data-action="priority-low">🟢 کم</li>
  </ul>
`;
document.body.appendChild(contextMenu);

function openContextMenu(e, task, li) {
  contextMenu.style.top = `${e.clientY}px`;
  contextMenu.style.left = `${e.clientX}px`;
  contextMenu.style.display = "block";

  contextMenu.onclick = (ev) => {
    const action = ev.target.dataset.action;
    if (!action) return;

    if (action === "toggle") {
      task.done = !task.done;
      li.classList.toggle("done", task.done);
      updateTask(task);
      if (task.done) starRain();
    }
    if (action.startsWith("priority-")) {
      let border;
      if (action === "priority-urgent") border = "1px solid rgb(177, 1, 1)";
      if (action === "priority-high") border = "1px solid rgb(210, 107, 11)";
      if (action === "priority-low") border = "1px solid rgb(2, 131, 2)";
      task.border = border;
      li.style.border = border;
      updateTask(task);
    }

    contextMenu.style.display = "none";
  };
}
document.addEventListener("click", () => {
  contextMenu.style.display = "none";
});
document.addEventListener("scroll", () => {
  contextMenu.style.display = "none";
});

function adjustHeight() {
  todoInput.style.height = "auto";
  todoInput.style.height = (todoInput.scrollHeight > 40 ? todoInput.scrollHeight : 40) + "px";
}
todoInput.addEventListener("input", adjustHeight);

document.getElementById("addTodoBtn").addEventListener("click", addTodo);
todoInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    addTodo();
  }
});

document.addEventListener("DOMContentLoaded", function () {
  const userNameElement = document.getElementById("userName");
  const userInfo = document.getElementById("userInfo");

  let savedNameEncoded = localStorage.getItem("username");
  let shakeInterval;

  function isValidName(name) {
    const clean = name.trim();
    const persianRegex = /^[\u0600-\u06FF\s]+$/;
    if (!persianRegex.test(clean)) return false;
    const parts = clean.split(/\s+/);
    return parts.length === 2 && parts[0] && parts[1];
  }

  function startShakeReminder() {
    shakeInterval = setInterval(() => {
      userInfo.classList.add("shake");
      setTimeout(() => userInfo.classList.remove("shake"), 600);
    }, 5000);
  }

  function updateNameDisplay(name) {
    userNameElement.textContent = `${name} عزیز خوش آمدید!`;
  }

  if (savedNameEncoded && savedNameEncoded.trim() !== "") {
    try {
      updateNameDisplay(savedNameEncoded);
    } catch (e) {
      console.error("خطا در decode نام:", e);
      userNameElement.textContent = "کاربر مهمان (کلیک کنید)";
      startShakeReminder();
    }
  } else {
    userNameElement.textContent = "کاربر مهمان (کلیک کنید)";
    startShakeReminder();
  }

  userInfo.addEventListener("click", function () {
    let newName = null;
    do {
      newName = prompt("نام و نام خانوادگی خود را وارد کنید (فقط حروف فارسی):", savedNameEncoded);
      if (newName === null) return;
      if (!isValidName(newName)) {
        alert("لطفاً دو بخش (نام و نام خانوادگی) فقط با حروف فارسی و بدون عدد وارد کنید.");
      }
    } while (!isValidName(newName));

    localStorage.setItem("username", newName.trim());

    updateNameDisplay(newName.trim());

    if (shakeInterval) {
      clearInterval(shakeInterval);
      starRain();
    }
    savedNameEncoded = encodedName;
  });

  function starRain() {
    const overlay = document.createElement("div");
    overlay.className = "overlay";
    document.body.appendChild(overlay);

    for (let i = 0; i < 50; i++) {
      const star = document.createElement("div");
      star.className = "star";
      star.style.left = Math.random() * 100 + "vw";
      star.style.animationDuration = 1 + Math.random() * 2 + "s";
      overlay.appendChild(star);
    }

    setTimeout(() => {
      overlay.remove();
    }, 3000);
  }
});

function starRain() {
  const overlay = document.createElement("div");
  overlay.className = "stars-overlay";
  document.body.appendChild(overlay);

  for (let i = 0; i < 60; i++) {
    const star = document.createElement("div");
    star.className = "star";
    star.style.left = Math.random() * 100 + "vw";
    star.style.animationDuration = 2 + Math.random() * 3 + "s";
    star.style.animationDelay = Math.random() * 2 + "s";
    overlay.appendChild(star);
  }

  setTimeout(() => overlay.remove(), 5000);
}

document.addEventListener("DOMContentLoaded", () => {
  loadColumnOrder();
  enableColumnDragWithZones();
  loadTasks();

  const savedState = localStorage.getItem("todoTextHidden");
  if (savedState !== null) {
    textHidden = JSON.parse(savedState);
    applyTextVisibilityState(textHidden);
  }
  adjustHeight();
});

let idleTimer;
let snowInterval;
const idleDelay = 5 * 60 * 1000;

function startIdleTimer() {
  resetIdleTimer();
  ["mousemove", "keydown", "scroll", "click", "touchstart"].forEach((evt) => {
    document.addEventListener(evt, resetIdleTimer, { passive: true });
  });

  document.addEventListener("visibilitychange", handleVisibilityChange);
}

function resetIdleTimer() {
  clearTimeout(idleTimer);
  stopSnowfall();
  idleTimer = setTimeout(startSnowfall, idleDelay);
}

function startSnowfall() {
  if (snowInterval) clearInterval(snowInterval);
  snowInterval = setInterval(() => {
    createSnowflake();
  }, 200);
}

function stopSnowfall() {
  clearInterval(snowInterval);
}

function createSnowflake() {
  const snowflake = document.createElement("div");
  snowflake.className = "snowflake";
  snowflake.textContent = "❄";
  snowflake.style.left = Math.random() * 100 + "vw";
  snowflake.style.fontSize = 12 + Math.random() * 16 + "px";
  document.body.appendChild(snowflake);
}

function handleVisibilityChange() {
  if (document.hidden) {
    clearTimeout(idleTimer);
    stopSnowfall();
  } else {
    resetIdleTimer();
  }
}

startIdleTimer();

const linksBox = document.querySelector(".icons-box");
const ICONS_STORAGE_KEY = "myQuickLinks";

function getLinks() {
  return JSON.parse(localStorage.getItem(ICONS_STORAGE_KEY) || "[]");
}
function saveLinks(links) {
  localStorage.setItem(ICONS_STORAGE_KEY, JSON.stringify(links));
}
function extractDomainName(url) {
  try {
    let host = new URL(url).hostname;
    if (host.startsWith("www.")) host = host.slice(4);
    return host.split(".")[0];
  } catch {
    return url;
  }
}
function createLinkElement(url, title) {
  const wrapper = document.createElement("div");
  wrapper.style.position = "relative";
  wrapper.style.display = "inline-block";

  const a = document.createElement("a");
  a.href = url;
  a.target = "_blank";
  a.className = "icon-item";

  const img = document.createElement("img");
  img.src = `https://www.google.com/s2/favicons?sz=64&domain_url=${url}`;
  img.alt = title;

  const span = document.createElement("span");
  span.textContent = title;

  a.appendChild(img);
  a.appendChild(span);
  wrapper.appendChild(a);

  const delBtn = document.createElement("button");
  delBtn.textContent = "×";
  delBtn.style.cssText = `
    background:#4b596f;color:white;border:none;
    border-radius:50%;width:20px;height:20px;
    cursor:pointer;position:absolute;top:-8px;right:-8px;
    font-weight:bold;line-height:18px;
  `;
  delBtn.addEventListener("click", (e) => {
    e.preventDefault();
    removeLink(url);
  });

  wrapper.appendChild(delBtn);
  return wrapper;
}
function renderLinks() {
  linksBox.innerHTML = "";
  if (fixedLinks.length > 0) {
    fixedLinks.forEach((link) => {
      linksBox.appendChild(createFixedLinkElement(link.url, link.title));
    });
    const divider = document.createElement("hr");
    divider.style.width = "100%";
    divider.style.margin = "10px 0";
    linksBox.appendChild(divider);
  }
  let links = getLinks();
  if (links.length === 0) {
    links = [{ url: "https://www.google.com/", title: "گوگل" }];
    saveLinks(links);
  }
  links.forEach((link) => {
    linksBox.appendChild(createLinkElement(link.url, link.title));
  });
  const addBtnWrapper = document.createElement("div");
  const addBtn = document.createElement("a");
  addBtn.href = "#";
  addBtn.className = "icon-item";
  addBtn.innerHTML = `<img src="https://cdn-icons-png.flaticon.com/512/2312/2312340.png"><span>افزودن</span>`;
  addBtn.addEventListener("click", (e) => {
    e.preventDefault();
    addNewLink();
  });
  addBtnWrapper.appendChild(addBtn);
  linksBox.appendChild(addBtnWrapper);
}
function removeLink(url) {
  saveLinks(getLinks().filter((link) => link.url !== url));
  renderLinks();
}
function addNewLink() {
  let url = prompt("آدرس سایت را وارد کنید (مثال: https://example.com)");
  if (!url) return;
  const loaderBox = document.createElement("div");
  loaderBox.className = "link-loading";
  loaderBox.innerHTML = `<div class="spinner"></div>`;
  linksBox.appendChild(loaderBox);
  setTimeout(() => {
    const title = extractDomainName(url);
    const links = getLinks();
    links.push({ url, title });
    saveLinks(links);
    renderLinks();
  }, 500);
}

const newsContainer = document.getElementById("newsContainer");
const modal = document.getElementById("newsModal");
const modalTitle = document.getElementById("modalTitle");
const modalDate = document.getElementById("modalDate");
const modalDesc = document.getElementById("modalDesc");
const modalImage = document.getElementById("modalImage");
const modalClose = document.querySelector(".modal-close");

function getTypeClass(type) {
  switch (type) {
    case "هشدار":
      return "tag-warning";
    case "رویداد":
      return "tag-success";
    case "خطر":
      return "tag-danger";
    default:
      return "tag-warning";
  }
}

let currentPage = 1;
const pageSize = 3;

function getReadNews() {
  return JSON.parse(localStorage.getItem("readNews") || "[]");
}

function markAsRead(newsId) {
  const readNews = getReadNews();
  if (!readNews.includes(newsId)) {
    readNews.push(newsId);
    localStorage.setItem("readNews", JSON.stringify(readNews));
  }
}

function renderPagination(totalPages) {
  const pagination = document.getElementById("pagination");
  pagination.innerHTML = "";

  if (totalPages <= 1) return;

  if (currentPage > 1) {
    const prev = document.createElement("button");
    prev.textContent = "« قبلی";
    prev.onclick = () => gotoPage(currentPage - 1);
    pagination.appendChild(prev);
  }

  for (let i = 1; i <= totalPages; i++) {
    const btn = document.createElement("button");
    btn.textContent = i;
    if (i === currentPage) btn.classList.add("active");
    btn.onclick = () => gotoPage(i);
    pagination.appendChild(btn);
  }

  if (currentPage < totalPages) {
    const next = document.createElement("button");
    next.textContent = "بعدی »";
    next.onclick = () => gotoPage(currentPage + 1);
    pagination.appendChild(next);
  }
}

function gotoPage(page) {
  loadNews(page).then(() => {
    const newsContainer = document.getElementById("newsContainer");
    newsContainer.scrollIntoView({ behavior: "smooth", block: "start" });
    setTimeout(() => {
      window.scrollBy({ top: -100, left: 0, behavior: "smooth" });
    }, 400);
  });
}

async function loadNews(pageNumber = 1) {
  try {
    currentPage = pageNumber;

    const res = await fetch(`${BASE_URL}/News/GetAllNewsHomePage?pageNumber=${pageNumber}&pageSize=${pageSize}`);
    if (!res.ok) throw new Error(`خطای HTTP ${res.status}`);

    const data = await res.json();
    const newsList = Array.isArray(data.items) ? data.items : [];
    window._latestNews = newsList;

    const totalCount = data.totalCount || 0;
    const totalPages = Math.ceil(totalCount / pageSize);

    const newsContainer = document.getElementById("newsContainer");
    newsContainer.innerHTML = "";

    const readList = getReadNews();

    newsList.forEach((news) => {
      const imageUrl = news.imageName ? `${BASE_URL}/uploads/news/${news.imageName}` : `${BASE_URL}/uploads/news/no_image.png`;

      const newsItem = document.createElement("div");
      newsItem.className = "news-item";
      newsItem.dataset.id = news.id;

      if (readList.includes(news.id)) {
        newsItem.classList.add("read");
      }

      newsItem.innerHTML = `
        <div class="news-image">
          <img src="${imageUrl}" alt="${news.title}">
        </div>
        <div class="news-content">
          <div class="news-meta">
            <span class="news-date"></span>
            <span class="news-tag tag-success">${news.createDateShamsi}</span>
          </div>
          <h3 class="news-title cursor-pointer">${news.title}</h3>
          <p class="news-desc">${news.shortText || ""}</p>
        </div>
      `;

      newsContainer.appendChild(newsItem);
    });

    renderPagination(totalPages);
  } catch (error) {
    console.error("❌ خطا در لود اخبار:", error);
    document.getElementById("newsContainer").innerHTML = `<p style="color:red">⚠ عدم دریافت اخبار</p>`;
  }
}

document.getElementById("newsContainer").addEventListener("click", (e) => {
  const newsItem = e.target.closest(".news-item");
  if (!newsItem) return;

  const id = Number(newsItem.dataset.id);
  const newsData = window._latestNews?.find((n) => n.id === id);

  if (newsData) {
    markAsRead(id);
    newsItem.classList.add("read");

    openNewsModal(newsData);
  }
});

document.addEventListener("DOMContentLoaded", () => {
  loadNews(1);
});

newsContainer.addEventListener("click", (e) => {
  const newsItem = e.target.closest(".news-item");
  if (!newsItem) return;
  const id = newsItem.dataset.id;
  const newsData = findNewsById(id);
  if (newsData) openNewsModal(newsData);
});
function findNewsById(id) {
  return window._latestNews?.find((n) => String(n.id) === String(id)) || null;
}

let currentGallery = [];
let currentGalleryIndex = 0;

function openNewsModal(news) {
  modalTitle.textContent = news.title;
  modalType.textContent = news.createDateShamsi;
  modalType.className = `news-tag tag-success`;
  modalDesc.textContent = news.text || news.shortText || "";
  modalImage.src = news.imageName ? `${BASE_URL}/uploads/news/${news.imageName}` : `${BASE_URL}/uploads/news/no_image.png`;
  modalImage.alt = news.title || "بدون تصویر";

  const modalGallery = document.getElementById("modalGallery");
  modalGallery.innerHTML = "";
  if (Array.isArray(news.gallery) && news.gallery.length > 0) {
    const thumbs = news.gallery
      .map(
        (g, idx) =>
          `<img src="${BASE_URL}/uploads/news-gallery/${g.imageName}"
              class="gallery-thumb"
              data-gallery-index="${idx}"
              data-news-id="${news.id}" />`
      )
      .join("");
    modalGallery.innerHTML = thumbs;
  }

  modal.classList.remove("closing");
  modal.classList.add("show");
  modal.style.display = "block";
}

document.addEventListener("click", function (e) {
  const thumb = e.target.closest(".gallery-thumb");
  if (thumb) {
    const newsId = parseInt(thumb.dataset.newsId, 10);
    const startIndex = parseInt(thumb.dataset.galleryIndex, 10);

    const newsItem = window._latestNews?.find((n) => n.id === newsId);
    if (newsItem && Array.isArray(newsItem.gallery)) {
      currentGallery = newsItem.gallery.map((g) => `${BASE_URL}/uploads/news-gallery/${g.imageName}`);
      currentGalleryIndex = startIndex;
      openLightbox();
    }
  }

  if (e.target.classList.contains("lightbox-close") || e.target.id === "lightbox") {
    closeLightbox();
  }
  if (e.target.classList.contains("lightbox-prev")) {
    showPrevImage();
  }
  if (e.target.classList.contains("lightbox-next")) {
    showNextImage();
  }
});

document.addEventListener("keydown", function (e) {
  const lightbox = document.getElementById("lightbox");
  if (lightbox.style.display !== "flex") return;
  if (e.key === "ArrowLeft") showPrevImage();
  if (e.key === "ArrowRight") showNextImage();
  if (e.key === "Escape") closeLightbox();
});

function openLightbox() {
  document.querySelector(".lightbox-image").src = currentGallery[currentGalleryIndex];
  document.getElementById("lightbox").style.display = "flex";
}

function closeLightbox() {
  document.getElementById("lightbox").style.display = "none";
}

function showPrevImage() {
  currentGalleryIndex = (currentGalleryIndex - 1 + currentGallery.length) % currentGallery.length;
  document.querySelector(".lightbox-image").src = currentGallery[currentGalleryIndex];
}

function showNextImage() {
  currentGalleryIndex = (currentGalleryIndex + 1) % currentGallery.length;
  document.querySelector(".lightbox-image").src = currentGallery[currentGalleryIndex];
}

function closeNewsModal() {
  modal.classList.remove("show");
  modal.style.display = "none";
}
modalClose.addEventListener("click", closeNewsModal);
window.addEventListener("click", (e) => {
  if (e.target === modal) closeNewsModal();
});
const lightbox = document.getElementById("imageLightbox");
const lightboxImg = document.getElementById("lightboxImg");
const lightboxClose = document.querySelector(".lightbox-close");

modalImage.addEventListener("click", () => {
  lightboxImg.src = modalImage.src;
  lightbox.style.display = "flex";
});

lightboxClose.addEventListener("click", () => {
  lightbox.style.display = "none";
});
lightbox.addEventListener("click", (e) => {
  if (e.target === lightbox) {
    lightbox.style.display = "none";
  }
});

function createFixedLinkElement(url, title) {
  const a = document.createElement("a");
  a.href = url;
  a.target = "_blank";
  a.className = "icon-item";
  const img = document.createElement("img");
  img.src = `https://www.google.com/s2/favicons?sz=64&domain_url=${url}`;
  img.alt = title;
  const span = document.createElement("span");
  span.textContent = title;
  a.appendChild(img);
  a.appendChild(span);
  return a;
}
async function loadFixedLinks() {
  linksBox.innerHTML = `
    <div style="width:100%;text-align:center;padding:20px;">
      <div class="spinner" style="
        border:4px solid #f3f3f3;
        border-top:4px solid #3498db;
        border-radius:50%;
        width:30px;
        height:30px;
        animation: spin 1s linear infinite;
        margin: auto;
      "></div>
    </div>
  `;
  try {
    const res = await fetch(`${BASE_URL}/Link/GetAllLink`);
    const data = await res.json();
    fixedLinks = data.map((item) => ({
      url: item.linkTitle,
      title: extractDomainName(item.linkTitle),
    }));
  } catch (err) {
    console.error("❌ خطا در دریافت لینک‌های ثابت", err);
    fixedLinks = [
      { url: "https://www.google.com", title: "گوگل" },
      { url: "https://www.time.ir", title: "تایم" },
    ];
  }
  renderLinks();
}

loadFixedLinks();

const centerColumn = document.querySelector(".column.center");
const CENTER_STORAGE_KEY = "centerOrder";
let isDraggingCenter = false;

function ensureCenterElementsReady(timeout = 3000) {
  return new Promise((resolve) => {
    const start = Date.now();
    (function waitForElems() {
      const google = centerColumn?.querySelector(".google-search");
      const icons = centerColumn?.querySelector(".icons-box");
      const fixed = centerColumn?.querySelector("#fixedLinksBox");
      const news = centerColumn?.querySelector(".news-section");
      if (google || icons || fixed || news) return resolve({ google, icons, fixed, news });
      if (Date.now() - start > timeout) return resolve({ google, icons, fixed, news });
      setTimeout(waitForElems, 50);
    })();
  });
}

function ensureLinksWrapper() {
  let existing = centerColumn.querySelector(".links-wrapper.center-section");
  if (existing) return existing;

  const hdr = centerColumn.querySelector("h2");
  const fixed = centerColumn.querySelector("#fixedLinksBox");
  const icons = centerColumn.querySelector(".icons-box");
  if (!hdr && !fixed && !icons) return null;

  const wrapper = document.createElement("div");
  wrapper.className = "links-wrapper center-section";
  wrapper.dataset.centerType = "links";

  if (hdr && hdr.parentElement !== wrapper) wrapper.appendChild(hdr);
  if (fixed && fixed.parentElement !== wrapper) wrapper.appendChild(fixed);
  if (icons && icons.parentElement !== wrapper) wrapper.appendChild(icons);

  centerColumn.appendChild(wrapper);
  return wrapper;
}

async function enableCenterSectionsDrag() {
  if (!centerColumn) return;
  const { google, news } = await ensureCenterElementsReady();

  const googleSection = google
    ? (function () {
        const el = google.closest(".center-section") || google;
        el.classList.add("center-section");
        el.dataset.centerType = "google";
        return el;
      })()
    : null;

  const linksSection = ensureLinksWrapper();

  const newsSection = news
    ? (function () {
        const el = news.closest(".center-section") || news;
        el.classList.add("center-section");
        el.dataset.centerType = "news";
        return el;
      })()
    : null;

  const targets = [];
  if (googleSection) targets.push(googleSection);
  if (linksSection) targets.push(linksSection);
  if (newsSection) targets.push(newsSection);
  if (targets.length === 0) return;

  targets.forEach((t) => {
    if (!t.dataset.centerType) {
      if (t.querySelector(".google-search")) t.dataset.centerType = "google";
      else if (t.querySelector(".news-section")) t.dataset.centerType = "news";
      else t.dataset.centerType = "links";
    }
    t.setAttribute("draggable", "true");

    if (!t.__centerDragBound) {
      t.addEventListener("dragstart", () => {
        isDraggingCenter = true;
        t.classList.add("dragging");
      });
      t.addEventListener("dragend", () => {
        isDraggingCenter = false;
        t.classList.remove("dragging");
        saveCenterOrder();
      });
      t.__centerDragBound = true;
    }
  });

  if (!centerColumn.__centerDragOverBound) {
    centerColumn.addEventListener("dragover", (e) => {
      if (!isDraggingCenter) return;
      e.preventDefault();
      const dragging = centerColumn.querySelector(".center-section.dragging");
      if (!dragging) return;
      const afterElement = getCenterAfterElement(centerColumn, e.clientY);
      if (!afterElement) centerColumn.appendChild(dragging);
      else centerColumn.insertBefore(dragging, afterElement);
    });
    centerColumn.__centerDragOverBound = true;
  }
}

function getCenterAfterElement(container, y) {
  const elements = [...container.querySelectorAll(".center-section:not(.dragging)")];
  let closest = { offset: Number.NEGATIVE_INFINITY, element: null };
  elements.forEach((child) => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if (offset < 0 && offset > closest.offset) {
      closest = { offset, element: child };
    }
  });
  return closest.element;
}

function saveCenterOrder() {
  if (!centerColumn) return;
  const sections = [...centerColumn.querySelectorAll(".center-section")];
  const order = sections.map((sec) => {
    return sec.dataset.centerType || (sec.querySelector(".google-search") ? "google" : sec.querySelector(".news-section") ? "news" : "links");
  });

  console.log("saveCenterOrder ->", order);
  try {
    localStorage.setItem(CENTER_STORAGE_KEY, JSON.stringify(order));
  } catch (e) {
    console.error("Failed to save centerOrder", e);
  }
}

function loadCenterOrder() {
  if (!centerColumn) return;
  let order;
  try {
    order = JSON.parse(localStorage.getItem(CENTER_STORAGE_KEY) || "[]");
  } catch {
    order = [];
  }
  if (!order.length) return;

  const applyOrder = () => {
    const map = {
      google: centerColumn.querySelector('[data-center-type="google"]') || centerColumn.querySelector(".google-search"),
      news: centerColumn.querySelector('[data-center-type="news"]') || centerColumn.querySelector(".news-section"),
      links: centerColumn.querySelector('[data-center-type="links"]') || centerColumn.querySelector(".links-wrapper"),
    };
    if (!map.links) map.links = ensureLinksWrapper();

    order.forEach((key) => {
      const el = map[key];
      if (el) centerColumn.appendChild(el);
      else console.warn("loadCenterOrder: element missing ->", key);
    });
  };

  const needGoogle = order.includes("google") && !centerColumn.querySelector('[data-center-type="google"], .google-search');
  const needNews = order.includes("news") && !centerColumn.querySelector('[data-center-type="news"], .news-section');
  const needLinks = order.includes("links") && !centerColumn.querySelector('[data-center-type="links"], .links-wrapper');

  if (!needGoogle && !needNews && !needLinks) {
    applyOrder();
    return;
  }

  const mo = new MutationObserver(() => {
    const g = centerColumn.querySelector('[data-center-type="google"], .google-search');
    const n = centerColumn.querySelector('[data-center-type="news"], .news-section');
    const l = centerColumn.querySelector('[data-center-type="links"], .links-wrapper');
    if ((!needGoogle || g) && (!needNews || n) && (!needLinks || l)) {
      mo.disconnect();
      setTimeout(applyOrder, 10);
    }
  });
  mo.observe(centerColumn, { childList: true, subtree: true });

  setTimeout(() => {
    try {
      mo.disconnect();
    } catch {}
    applyOrder();
  }, 2500);
}

(async function initCenter() {
  await enableCenterSectionsDrag();
  loadCenterOrder();
})();

const messages = [
  "اگر می خواهید زندگی شادی داشته باشید، زندگی خود را به یک هدف گره بزنید نه آدم ها و چیزها - آلبرت انیشتین.",
  "بزرگترین لذت زندگی انجام کاری است که دیگران می‌گویند: تو نمی‌توانی. - رومن پلانسکی.",
  "کینه‌توزی مانند این می‌ماند که سم بنوشی و منتظر آن باشی که فرد مقابل بمیرد. - نلسون ماندلا.",
  "هرگز از چیزی که باعث خندیدن تو میشود پشیمان نشو. مارک تواین",
  "هر چیزی که شما می توانید تصور کنید واقعی است. پابلو پیکاسو",
  "سادگی غایت پیچیدگی است. لئوناردو داوینچی",
  "هر کاری که انجام می دهید، آن را به خوبی انجام دهید. والت دیزنی",
  "روزگار سخت پایدار نیست ولی انسانهای سخت چرا. رابرت اچ، شولر",
  "مشکلات تابلوی توقف نیستند، راهنما هستند. رابرت اچ، شولر",
  "یک روز افرادی که حتی شما را باور ندارند به همه خواهند گفت که چگونه شما را ملاقات کرده اند. جانی دپ",
  "اگر حقیقت را بگویید لازم نیست چیزی را به خاطر بسپارید. مارک تواین",
  "شهامت کافی برای شروع و قلب کافی برای تمام کردن داشته باشید. جسیکا",
  "من می توانم با شما موافق باشم اما در آن صورت هر دو اشتباه می کنیم. هاروی اسپکتر",
  "اولویت های خود را مشخص کنید و روی آنها تمرکز کنید. آیلین مک درگ",
  "آنقدر خوب باش که نتوانند تو را نادیده بگیرند. استیو مارتین",
  "شما هرگز نمی دانید چقدر قوی هستید تا زمانی که قوی بودن تنها انتخابی باشد که در زندگی دارید.",
  "در نهایت ما فقط از فرصت هایی که استفاده نکردیم پشیمان هستیم.",
  "امروز از زندگی لذت ببرید، دیروز رفته و فردا ممکن است هرگز به وجود نیاید.",
  "بخشودن کسی که به تو بدی کرده تغییر گذشته نیست ، تغییر آینده است. گاندی",
  "اگر پرسند کیستی باید هنرهای خویش را بشماری. بزرگمهر",
  "در زندگی همیشه غمگین بودن از شاد بودن آسان تر است، ولی من اصلا از آدم هایی خوشم نمی آید که آسان ترین راه را انتخاب میکنند",
  "تراژدی این نیست که تنها باشی بلکه این است که نتوانی تنها باشی . . .آلبر کامو",
  "اجازه دهید همیشه با لبخند با هم روبرو شویم، زیرا لبخند سرآغاز عشق است. مادر ترزا",
  "هنگامی که در شادی به روی انسان بسته می‌شود بلافاصله در دیگری باز می‌شود، اما ما آنقدر به در بسته خیره می‌شویم که در باز شده را نمی‌بینیم. هلن کلر",
  "نترسید روزی خورشید متلاشی شود و همگی ما از سرما بمیریم ، بترسید روزی برسد که زنان بخواهند محبتشان را از مردان دریغ کنند…آن وقت همگی از سرما خواهیم مُرد.. چارلی چاپلین",
  "شادترین انسان‌ها کسانی هستند که قدرت جذب خرد از یک شاخه گل را داشته باشند.",
  "هیچ‌گاه دیر نیست که آنچه می‌توانستی باشی، بشوی. - جرج الیوت",
  "وقتی همه چیز علیه توست، به یاد بیاور که هواپیما برخلاف باد بلند می‌شود. - هنری فورد",
  "موفقیت اتفاقی نیست، نتیجه تلاش، یادگیری و عشق است. - پله",
  "برای شروع عالی بودن، لازم نیست عالی باشی، اما برای عالی شدن باید شروع کنی. - زیگ زیگلر",
  "کسی که می‌خواهد در زندگی پیشرفت کند، هیچ وقت منتظر شرایط ایده‌آل نمی‌ماند.",
  "زندگی کوتاه است، اما لبخند تو می‌تواند لحظه‌ها را طولانی‌تر کند.",
  "در مسیرت به سمت هدف، گاهی آرام برو اما هرگز متوقف نشو.",
  "اگر مسیر را پیدا نمی‌کنی، خودت مسیر بساز.",
  "آرامش از درون تو آغاز می‌شود، به بیرون نگاه نکن. - بودا",
  "برنده کسی است که یک بار دیگر بیشتر از شکست‌هایش تلاش کند.",
  "ترس، دروغی است که آینده در گوش تو زمزمه می‌کند.",
  "موفقیت همان جایی آغاز می‌شود که منطقه امن تو به پایان می‌رسد.",
  "گاهی پایان یک راه، آغاز سفری تازه است.",
];

const typingSpeed = 80;
const deletingSpeed = 50;
const pauseAfterSentence = 2000;

let charIndex = 0;
let isDeleting = false;
let lastIndex = -1;
let currentIndex = 0;
let typingActive = false;
let typingTimeout;
const userMessageElement = document.getElementById("userMessage");

function getRandomIndex() {
  let index;
  do {
    index = Math.floor(Math.random() * messages.length);
  } while (index === lastIndex && messages.length > 1);
  lastIndex = index;
  return index;
}

function typeWriter() {
  if (!typingActive) return;

  const currentText = messages[currentIndex];
  userMessageElement.textContent = currentText.substring(0, charIndex);

  let delay = typingSpeed;

  if (!isDeleting) {
    charIndex++;
    if (charIndex === currentText.length) {
      isDeleting = true;
      delay = pauseAfterSentence;
    }
  } else {
    charIndex--;
    delay = deletingSpeed;
    if (charIndex === 0) {
      isDeleting = false;
      currentIndex = getRandomIndex();
    }
  }

  typingTimeout = setTimeout(typeWriter, delay);
}

function startTyping() {
  typingActive = true;
  localStorage.setItem("typingActive", "true");
  currentIndex = getRandomIndex();
  typeWriter();
}

function stopTyping() {
  typingActive = false;
  localStorage.setItem("typingActive", "false");
  clearTimeout(typingTimeout);
  userMessageElement.textContent = "";
}

if (localStorage.getItem("typingActive") === "true") {
  startTyping();
}

window.addEventListener("keydown", (e) => {
  if (e.altKey && e.key.toLowerCase() === "q") {
    if (typingActive) {
      stopTyping();
      alert("نمایش جملات غیرفعال شد.");
    } else {
      startTyping();
      alert("نمایش جملات فعال شد.");
    }
  }
});

document.addEventListener("DOMContentLoaded", () => {
  const themeBtn = document.getElementById("themeToggleButton");
  const themePanel = document.getElementById("themePanel");
  const themeOptions = document.querySelectorAll(".theme-option");

  themeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    themePanel.classList.toggle("show");
  });
  document.body.addEventListener("click", (e) => {
    if (!themePanel.contains(e.target) && e.target !== themeBtn) {
      themePanel.classList.remove("show");
    }
  });

  themeOptions.forEach((option) => {
    option.addEventListener("click", () => {
      const theme = option.getAttribute("data-theme");
      applyTheme(theme);
      localStorage.setItem("selectedTheme", theme);
    });
  });

  const savedTheme = localStorage.getItem("selectedTheme") || "default";
  applyTheme(savedTheme);

  function applyTheme(theme) {
    const overlay = document.getElementById("backgroundOverlay");
    const bgLayer = document.getElementById("backgroundLayer");

    switch (theme) {
      case "b1":
        bgLayer.style.backgroundImage = "url('background/b1.jpg')";
        overlay.style.background = "linear-gradient(160deg, rgba(18,18,18,0.85), rgba(30,30,30,0.85), rgba(44,44,44,0.85))";
        document.body.style.color = "#c4c2c5ff";
        break;

      case "b2":
        bgLayer.style.backgroundImage = "url('background/b2.jpg')";
        overlay.style.background = "linear-gradient(145deg, rgba(107, 63, 154, 0.6), rgba(44, 29, 104, 0.6), rgba(81, 57, 151, 0.6))";
        document.body.style.color = "#fff";
        break;

      case "b3":
        bgLayer.style.backgroundImage = "url('background/b3.jpg')";
        overlay.style.background = "linear-gradient(145deg, rgba(17, 56, 50, 0.6), rgba(64, 10, 49, 0.6))";
        document.body.style.color = "#fff";
        break;

      case "b4":
        bgLayer.style.backgroundImage = "url('background/b4.jpg')";
        overlay.style.background = "linear-gradient(160deg, rgba(15,17,20,0.85), rgba(27,31,36,0.85), rgba(15,17,20,0.85))";
        document.body.style.color = "#fff";
        break;

      case "b6":
        bgLayer.style.backgroundImage = "url('background/b6.jpg')";
        overlay.style.background = "linear-gradient(140deg, rgba(14,14,14,0.85), rgba(18,23,42,0.85), rgba(14,14,14,0.85))";
        document.body.style.color = "#fff";
        break;

      case "b7":
        bgLayer.style.backgroundImage = "url('background/b7.jpg')";
        overlay.style.background = "linear-gradient(160deg, rgba(18,18,18,0.85), rgba(30,30,30,0.85), rgba(44,44,44,0.85))";
        document.body.style.color = "#fff";
        break;

      case "b8":
        bgLayer.style.backgroundImage = "url('background/b8.jpg')";
        overlay.style.background = "linear-gradient(160deg, rgba(45, 6, 74, 0.85), rgba(36, 34, 34, 0.85), rgba(32, 27, 27, 0.85))";
        document.body.style.color = "#fff";
        break;

      default:
        bgLayer.style.backgroundImage = "url('background/b8.jpg')";
        overlay.style.background = "linear-gradient(160deg, rgba(45, 6, 74, 0.85), rgba(36, 34, 34, 0.85), rgba(32, 27, 27, 0.85))";
        document.body.style.color = "#fff";
    }
    localStorage.setItem("selectedTheme", theme);
  }

  window.addEventListener("DOMContentLoaded", () => {
    const savedTheme = localStorage.getItem("selectedTheme") || "darkSteel";
    applyTheme(savedTheme);
  });
});

document.addEventListener("DOMContentLoaded", () => {
  const fileInput = document.getElementById("bgUploader");
  const bgLayer = document.getElementById("backgroundLayer");
  const overlay = document.getElementById("backgroundOverlay");

  const savedImage = localStorage.getItem("customBackground");
  if (savedImage) {
    bgLayer.style.backgroundImage = `url('${savedImage}')`;
  }

  document.addEventListener("keydown", (e) => {
    if (e.altKey && e.key.toLowerCase() === "f") {
      e.preventDefault();
      fileInput.click();
    }
  });

  fileInput.addEventListener("change", () => {
    const file = fileInput.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const imgData = event.target.result;
      bgLayer.style.opacity = 0;
      setTimeout(() => {
        bgLayer.style.backgroundImage = `url('${imgData}')`;
        bgLayer.style.opacity = 1;
      }, 400);

      localStorage.setItem("customBackground", imgData);
    };
    reader.readAsDataURL(file);
  });

  window.applyTheme = function (theme) {
    switch (theme) {
      case "darkSteel":
        overlay.style.background = "linear-gradient(160deg, rgba(15,17,20,0.85), rgba(27,31,36,0.85), rgba(15,17,20,0.85))";
        break;
      case "roseDream":
        overlay.style.background = "linear-gradient(160deg, rgba(255,225,236,0.6), rgba(255,193,214,0.6), rgba(255,158,196,0.6))";
        break;
      case "royalMidnight":
        overlay.style.background = "linear-gradient(140deg, rgba(14,14,14,0.85), rgba(18,23,42,0.85), rgba(14,14,14,0.85))";
        break;
      default:
        overlay.style.background = "linear-gradient(160deg, rgba(13,13,13,0.8), rgba(24,24,24,0.8), rgba(31,31,31,0.8))";
    }
  };
});
