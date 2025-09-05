document.addEventListener("DOMContentLoaded", () => {
  const pollLoading = document.getElementById("pollLoading");
  const pollList = document.getElementById("pollList");
  const BASE_URL = "https://localhost:7172/api/userpoll"; // مسیر API

  // -------- بارگذاری لیست نظرسنجی‌ها --------
  async function loadPolls() {
    pollLoading.style.display = "block";
    pollList.innerHTML = "";

    try {
      const res = await fetch(`${BASE_URL}/active`);
      if (!res.ok) throw new Error(`خطا در دریافت نظرسنجی‌ها: ${res.status}`);

      const polls = await res.json();

      pollLoading.style.display = "none";

      if (!Array.isArray(polls) || polls.length === 0) {
        pollList.innerHTML = `<p>❌ نظرسنجی فعالی موجود نیست</p>`;
        return;
      }

      polls.forEach(renderPollBlock);
    } catch (err) {
      console.error(err);
      pollLoading.style.display = "none";
      pollList.innerHTML = `<p>❌ خطا در لود نظرسنجی‌ها</p>`;
    }
  }

  // -------- ساخت بلوک هر نظرسنجی --------
  function renderPollBlock(poll) {
    const pollId = poll.pollId ?? poll.PollId;
    const question = poll.question ?? poll.Question ?? "عنوان نظرسنجی";
    const showResultsAfterVote = poll.showResultsAfterVote ?? poll.ShowResultsAfterVote ?? false;
    const options = poll.options ?? poll.Options ?? [];
    const results = poll.results ?? poll.Results ?? [];

    if (!pollId) {
      console.warn("⚠️ Poll بدون شناسه:", poll);
      return;
    }

    const block = document.createElement("div");
    block.className = "poll-block";

    let contentHtml = "";

    if (!showResultsAfterVote && poll.hasVoted) {
      // ساخت بلوک HTML
      block.innerHTML = `
    <h3>${question}</h3>
    <span>نتایج این نظر سنجی بعد از تایید مدیر منتشر میشود.</span>
  `;
      pollList.appendChild(block);
      return;
    }

    if (Array.isArray(results) && results.length > 0) {
      // --- نمایش نتایج ---
      const resultsHtml = results
        .map((r) => {
          const text = r.optionText ?? r.OptionText ?? "بدون متن";
          const count = r.voteCount ?? r.VoteCount ?? 0;
          const perc = r.percentage ?? r.Percentage ?? 0;
          return `<li>${text} - (${count} رأی) (${perc}%)</li>`;
        })
        .join("");

      contentHtml = `<ul class="poll-results">${resultsHtml}</ul>`;
    } else if (Array.isArray(options) && options.length > 0) {
      // --- نمایش گزینه‌ها ---
      const optionsHtml = options
        .map((opt) => {
          const oid = Number(opt.optionId ?? opt.OptionId);
          const otext = opt.optionText ?? opt.OptionText ?? "بدون متن";
          return `
        <label class="poll-option">
          <input type="radio" name="poll-${pollId}" value="${oid}">
          ${otext}
        </label>
      `;
        })
        .join("");

      contentHtml = `
      <div class="poll-options" id="pollOptions-${pollId}">
        ${optionsHtml}
      </div>
      <button class="poll-submit-btn"
              data-poll-id="${pollId}"
              data-show-results="${showResultsAfterVote}">
        ثبت رأی
      </button>
    `;
    } else {
      // --- هیچ گزینه‌ای نیست و نتایج هم نیست ---
      contentHtml = `<p class="no-options">هیچ داده‌ای برای این نظرسنجی وجود ندارد.</p>`;
    }

    // ساخت بلوک HTML
    block.innerHTML = `
    <h3>${question}</h3>
    ${contentHtml}
    <div class="poll-result" id="pollResult-${pollId}"></div>
  `;

    pollList.appendChild(block);

    // اتصال رخداد ثبت رأی اگر گزینه‌ها وجود دارد
    if (!results.length && options.length) {
      block.querySelector(".poll-submit-btn").addEventListener("click", submitVote);
    }
  }

  // -------- ثبت رأی --------
  async function submitVote(e) {
    const username = localStorage.getItem("username");
    if (username == null || username == "") {
      alert("لطفا نام خود را در بالای صفحه اضافه کنید.");
      return;
    }
    const btn = e.currentTarget;
    const pollId = Number(btn.dataset.pollId);
    const showResults = btn.dataset.showResults === "true";
    const selectedOption = document.querySelector(`input[name="poll-${pollId}"]:checked`);
    const pollResult = document.getElementById(`pollResult-${pollId}`);

    if (!selectedOption) {
      alert("❗ لطفاً یک گزینه را انتخاب کنید");
      return;
    }

    const oid = Number(selectedOption.value);
    if (!oid) {
      alert("❗ شناسه گزینه معتبر نیست");
      return;
    }

    console.log("📤 Sending vote", { pollId, optionId: oid });
    pollResult.innerHTML = `<p>⏳ در حال ثبت رأی...</p>`;

    try {
      const body = JSON.stringify({ pollId, optionId: oid });
      const res = await fetch(`${BASE_URL}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });

      if (res.ok) {
        if (showResults) {
          // پاک کردن سوال و گزینه‌ها
          const pollOptions = document.getElementById(`pollOptions-${pollId}`);
          if (pollOptions) pollOptions.remove();

          const pollTitle = btn.closest(".poll-block").querySelector("h3");
          if (pollTitle) pollTitle.remove();

          btn.remove(); // حذف دکمه رأی دادن

          // لود نتایج در همون بلاک
          await loadResults(pollId, "✅ رأی شما ثبت شد.");
        } else {
          pollResult.innerHTML = `<p>✅ رأی شما ثبت شد. نتایج بعداً منتشر می‌شود.</p>`;
        }
      } else {
        pollResult.innerHTML = `⚠️ ${await res.text()}`;
      }
    } catch (err) {
      console.error(err);
      pollResult.innerHTML = "❌ خطا در ثبت رأی";
    }
  }

  // -------- لود نتایج --------
  async function loadResults(pollId, prefixText = "") {
    const pollResult = document.getElementById(`pollResult-${pollId}`);
    pollResult.innerHTML = `<p>⏳ در حال بارگذاری نتایج...</p>`;

    try {
      const res = await fetch(`${BASE_URL}/${pollId}/results`);
      if (!res.ok) throw new Error(`خطا در دریافت نتایج: ${res.status}`);

      const results = await res.json();
      console.log(`📊 Results for poll ${pollId}:`, results);

      let html = prefixText ? `<p>${prefixText}</p>` : "";
      html += "<h4>📊 نتایج فعلی:</h4>";

      if (!Array.isArray(results) || results.length === 0) {
        html += "<p>هیچ رأیی ثبت نشده است.</p>";
      } else {
        html += results
          .map((r) => {
            const txt = r.optionText ?? r.OptionText;
            const pct = r.percentage ?? r.Percentage ?? 0;
            const cnt = r.voteCount ?? r.VoteCount ?? 0;
            return `
            <div class="result-row">
              <span>${txt}</span>
              <div class="progress-bar">
                <div class="progress-fill" style="width:${pct}%"></div>
                <span class="percent-label">${pct}% (${cnt} رأی)</span>
              </div>
            </div>
          `;
          })
          .join("");
      }

      pollResult.innerHTML = html;
    } catch (err) {
      console.error(err);
      pollResult.innerHTML = "❌ خطا در لود نتایج";
    }
  }

  // 📥 اجرای اولیه
  loadPolls();
});
