console.log("🔔 Background.js loaded - Service Worker running");

// Badge نمایش نسخه
function showBadge(version) {
  chrome.action.setBadgeText({ text: `v${version}` });
  chrome.action.setBadgeBackgroundColor({ color: "#007bff" });
}

// حذف Badge
function clearBadge() {
  chrome.action.setBadgeText({ text: "" });
}

// Notification آپدیت از نوع list
function showUpdateNotification(version, changesArray) {
  chrome.notifications.create("updateNotification", {
    type: "list",
    iconUrl: "icons/icon_128.png", // مسیر حتماً درست باشه
    title: `📢 آپدیت جدید افزونه - نسخه ${version}`,
    message: "لیست تغییرات:",
    items: changesArray.map((change) => ({ title: "•", message: change })),
    priority: 2,
  });
}

// Notification نصب اولیه
function showInstallNotification(version) {
  chrome.notifications.create("installNotification", {
    type: "basic",
    iconUrl: "icons/icon_128.png",
    title: `✨ نصب افزونه نسخه ${version}`,
    message: "به اکستنشن خوارزمی خوش آمدید!",
    priority: 2,
  });
}

// کلیک روی Notification
chrome.notifications.onClicked.addListener((notificationId) => {
  clearBadge();
  if (notificationId === "updateNotification") {
    const changelogInternalUrl = chrome.runtime.getURL("changelog.html");
    chrome.tabs.create({ url: changelogInternalUrl });
  }
});

// کلیک روی آیکون اکستنشن → حذف Badge
chrome.action.onClicked.addListener(() => {
  clearBadge();
});

// وقتی اکستنشن نصب یا آپدیت میشه
chrome.runtime.onInstalled.addListener((details) => {
  const currentVersion = chrome.runtime.getManifest().version;
  console.log("📦 نصب/آپدیت:", details.reason, currentVersion);

  const changelogItems = ["بهبود مدیریت توکن", "افزودن Pagination به پنل ادمین", "رفع باگ‌های جزئی"];

  if (details.reason === "install") {
    showBadge(currentVersion);
    showInstallNotification(currentVersion);
  } else if (details.reason === "update") {
    showBadge(currentVersion);
    showUpdateNotification(currentVersion, changelogItems);
  } else {
    // 🧪 حالت تست — حتی اگر update نبود
    console.log("🧪 اجرای Notification تستی");
    showBadge(currentVersion);
    showUpdateNotification(currentVersion, ["این یک تست نوتیفیکیشن است"]);
  }
});
