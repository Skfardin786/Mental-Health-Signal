(() => {
  "use strict";

  const API_BASE = "https://mansik-santulan-score.onrender.com";
  const $ = (id) => document.getElementById(id);

  const form = $("predict-form");
  const submitBtn = $("submit-btn");
  const states = { idle: $("state-idle"), loading: $("state-loading"), result: $("state-result"), error: $("state-error") };
  const gaugeFill = $("gauge-fill");
  const needle = $("gauge-needle");
  const GAUGE_ARC_LENGTH = 314;

  const FIELDS = [
    "age", "gender", "country", "academic_level", "most_used_platform", "purpose_of_use",
    "avg_daily_usage_hours", "daily_unlocks", "study_hours", "physical_activity_hours",
    "sleep_hours_per_night", "stress_level",
  ];
  const NUMERIC = {
    age: [10, 100], avg_daily_usage_hours: [0, 24], daily_unlocks: [0, Infinity],
    study_hours: [0, 24], physical_activity_hours: [0, 24], sleep_hours_per_night: [0, 24],
  };

  // ---------- interactive background ----------
  const root = document.documentElement;
  const STRESS_HUE = { Low: 150, Medium: 45, High: 20, "Very High": 350 };
  function setBgHue(h) {
    root.style.setProperty("--h1", h);
    root.style.setProperty("--h2", (h + 50) % 360);
  }
  window.addEventListener("pointermove", (e) => {
    root.style.setProperty("--mx", e.clientX + "px");
    root.style.setProperty("--my", e.clientY + "px");
    root.style.setProperty("--px", (e.clientX / window.innerWidth - 0.5).toFixed(3));
    root.style.setProperty("--py", (e.clientY / window.innerHeight - 0.5).toFixed(3));
  });

  // ---------- gauge ticks ----------
  document.querySelectorAll(".gauge-ticks").forEach((g) => {
    for (let i = 0; i <= 10; i += 2) {
      const a = Math.PI - (i / 10) * Math.PI;
      const l = document.createElementNS("http://www.w3.org/2000/svg", "line");
      l.setAttribute("x1", (120 + 100 * Math.cos(a)).toFixed(1));
      l.setAttribute("y1", (140 - 100 * Math.sin(a)).toFixed(1));
      l.setAttribute("x2", (120 + 90 * Math.cos(a)).toFixed(1));
      l.setAttribute("y2", (140 - 90 * Math.sin(a)).toFixed(1));
      g.appendChild(l);
    }
  });

  // ---------- field errors ----------
  const wrapOf = (el) => el.closest(".field");
  function setFieldError(el, msg) {
    const w = wrapOf(el); if (!w) return;
    w.classList.add("field-error");
    const m = w.querySelector(".error-msg"); if (m) m.textContent = msg;
  }
  function clearFieldError(el) {
    const w = wrapOf(el); if (!w) return;
    w.classList.remove("field-error");
    const m = w.querySelector(".error-msg"); if (m) m.textContent = "";
  }
  function clearAllErrors() {
    form.querySelectorAll(".field").forEach((f) => f.classList.remove("field-error"));
    form.querySelectorAll(".error-msg").forEach((m) => (m.textContent = ""));
  }

  // ---------- generic setter (inputs + button groups) ----------
  function setValue(id, val) {
    const el = $(id);
    el.value = val;
    const group = form.querySelector(`.choice[data-name="${id}"]`);
    if (group) {
      group.querySelectorAll(".seg-btn").forEach((b) => b.classList.toggle("active", b.dataset.value === String(val)));
    }
    if (el.dataset.slider !== undefined) syncSlider(el);
    if (id === "stress_level") setBgHue(STRESS_HUE[val] ?? 160);
    clearFieldError(el);
    refresh();
  }

  // ---------- button groups (gender, level, platform, purpose, stress) ----------
  form.querySelectorAll(".choice").forEach((group) => {
    group.querySelectorAll(".seg-btn").forEach((btn) => {
      btn.addEventListener("click", () => setValue(group.dataset.name, btn.dataset.value));
    });
  });

  // ---------- sliders paired with number inputs ----------
  function syncSlider(input) {
    const r = input._range; if (!r) return;
    const v = parseFloat(input.value);
    r.value = Number.isNaN(v) ? r.min : v;
    const pct = ((r.value - r.min) / (r.max - r.min)) * 100;
    r.style.setProperty("--fill", pct + "%");
  }
  document.querySelectorAll("input[data-slider]").forEach((input) => {
    const r = document.createElement("input");
    r.type = "range";
    r.className = "slider";
    r.min = input.min; r.max = input.max; r.step = input.step || "1";
    r.setAttribute("aria-label", (document.querySelector(`label[for="${input.id}"]`) || {}).textContent || input.id);
    r.tabIndex = -1;
    input._range = r;
    (input.closest(".unit-input") || input).after(r);
    r.addEventListener("input", () => {
      input.value = r.value;
      clearFieldError(input);
      syncSlider(input);
      refresh();
    });
    input.addEventListener("input", () => syncSlider(input));
    syncSlider(input);
  });

  // ---------- live progress + "your 24 hours" bar ----------
  const num = (id) => { const v = parseFloat($(id).value); return Number.isNaN(v) ? 0 : v; };

  function refresh() {
    const done = FIELDS.filter((id) => String($(id).value).trim() !== "").length;
    const pct = Math.round((done / FIELDS.length) * 100);
    $("progress-text").textContent = `${done} of ${FIELDS.length} answered`;
    $("progress-pct").textContent = pct + "%";
    $("progress-bar").style.width = pct + "%";
    $("progress-bar").classList.toggle("full", pct === 100);

    const sleep = num("sleep_hours_per_night"), study = num("study_hours");
    const active = num("physical_activity_hours"), screen = num("avg_daily_usage_hours");
    const total = sleep + study + active + screen;
    const scale = Math.max(24, total);
    [["d-sleep", sleep], ["d-study", study], ["d-active", active], ["d-screen", screen]].forEach(([id, h]) => {
      $(id).style.width = (h / scale) * 100 + "%";
    });
    const note = $("daybar-note");
    if (total === 0) note.textContent = "Fill in your hours to see your day.";
    else if (total > 24) note.textContent = `${total.toFixed(1)} h logged — screen time often overlaps with study.`;
    else note.textContent = `${(24 - total).toFixed(1)} h left for everything else.`;
  }

  form.querySelectorAll("input, select").forEach((el) => {
    el.addEventListener("input", () => { clearFieldError(el); refresh(); });
  });

  // ---------- sample / clear ----------
  const SAMPLE = {
    age: 21, gender: "Female", country: "India", academic_level: "Undergraduate",
    most_used_platform: "Instagram", purpose_of_use: "Entertainment",
    avg_daily_usage_hours: 5.5, daily_unlocks: 85, study_hours: 4,
    physical_activity_hours: 1, sleep_hours_per_night: 6.5, stress_level: "Medium",
  };
  $("sample-btn").addEventListener("click", () => {
    Object.entries(SAMPLE).forEach(([k, v]) => setValue(k, v));
    clearAllErrors();
  });
  function clearForm() {
    FIELDS.forEach((id) => setValue(id, ""));
    clearAllErrors();
    showState("idle");
  }
  $("clear-btn").addEventListener("click", clearForm);

  // ---------- validation ----------
  function collectPayload() {
    const fd = new FormData(form);
    const n = (k, int) => (fd.get(k) === "" || fd.get(k) === null ? NaN : int ? parseInt(fd.get(k), 10) : parseFloat(fd.get(k)));
    return {
      age: n("age", true),
      gender: fd.get("gender") || "",
      country: (fd.get("country") || "").trim(),
      academic_level: fd.get("academic_level") || "",
      most_used_platform: fd.get("most_used_platform") || "",
      purpose_of_use: fd.get("purpose_of_use") || "",
      avg_daily_usage_hours: n("avg_daily_usage_hours"),
      daily_unlocks: n("daily_unlocks", true),
      study_hours: n("study_hours"),
      physical_activity_hours: n("physical_activity_hours"),
      sleep_hours_per_night: n("sleep_hours_per_night"),
      stress_level: fd.get("stress_level") || "",
    };
  }

  function validate(p) {
    const errors = [];
    Object.entries(NUMERIC).forEach(([key, [min, max]]) => {
      const v = p[key];
      if (Number.isNaN(v)) errors.push([$(key), "This field is required."]);
      else if (v < min || v > max) errors.push([$(key), `Must be between ${min} and ${max === Infinity ? "0+" : max}.`]);
    });
    ["gender", "country", "academic_level", "most_used_platform", "purpose_of_use", "stress_level"].forEach((k) => {
      if (!p[k]) errors.push([$(k), k === "stress_level" ? "Pick a stress level." : "This field is required."]);
    });
    return errors;
  }

  // ---------- UI states ----------
  function showState(name) {
    Object.values(states).forEach((el) => (el.hidden = true));
    states[name].hidden = false;
  }
  function setSubmitting(on) {
    submitBtn.disabled = on;
    submitBtn.classList.toggle("loading", on);
  }

  function bandFor(s) {
    if (s < 4) return { label: "Signal: strained", context: "Your responses suggest elevated strain right now. Small shifts in sleep or screen time can go a long way." };
    if (s < 7) return { label: "Signal: balanced", context: "Your rhythm looks fairly steady, with some room to recover and reset." };
    return { label: "Signal: strong", context: "Your habits point to a well-supported, resilient baseline. Keep it up." };
  }

  // tips come from the user's own inputs (not from the model)
  function tipsFor(p) {
    const t = [];
    if (p.sleep_hours_per_night < 7) t.push(`Sleep is ${p.sleep_hours_per_night} h — aiming for 7–9 h is the easiest lever.`);
    if (p.avg_daily_usage_hours > 6) t.push(`${p.avg_daily_usage_hours} h of screen time is high. Try one phone-free hour before bed.`);
    if (p.daily_unlocks > 100) t.push(`${p.daily_unlocks} unlocks a day — notification batching can cut this.`);
    if (p.physical_activity_hours < 0.5) t.push("A 20–30 minute walk most days helps mood and sleep.");
    if (p.stress_level === "High" || p.stress_level === "Very High") t.push("High stress is worth sharing with someone you trust.");
    if (p.study_hours > 9) t.push("Long study days need real breaks — try 50 min on, 10 off.");
    if (!t.length) t.push("Your inputs look healthy. Keep your sleep and movement steady.");
    return t.slice(0, 3);
  }

  // ---------- history (last 5 reads) ----------
  let history = [];
  try { history = JSON.parse(localStorage.getItem("mhs_history") || "[]"); } catch (_) {}
  function renderHistory() {
    const box = $("history"), list = $("history-list");
    box.hidden = history.length < 2;
    list.innerHTML = "";
    history.forEach((s) => {
      const chip = document.createElement("span");
      chip.className = "history-chip";
      chip.textContent = s.toFixed(1);
      list.appendChild(chip);
    });
  }

  let countRaf = 0;
  function renderResult(score, payload) {
    const clamped = Math.max(0, Math.min(10, score));
    const { label, context } = bandFor(clamped);
    $("score-band").textContent = label;
    $("score-context").textContent = context;
    $("tips").innerHTML = tipsFor(payload).map((x) => `<li></li>`).join("");
    $("tips").querySelectorAll("li").forEach((li, i) => (li.textContent = tipsFor(payload)[i]));

    history = [...history, score].slice(-5);
    try { localStorage.setItem("mhs_history", JSON.stringify(history)); } catch (_) {}
    renderHistory();

    setBgHue(Math.round(clamped * 14)); // red (0) -> green (10)
    showState("result");

    gaugeFill.style.transition = "none";
    needle.style.transition = "none";
    gaugeFill.style.strokeDashoffset = String(GAUGE_ARC_LENGTH);
    needle.style.transform = "rotate(-90deg)";
    requestAnimationFrame(() => requestAnimationFrame(() => {
      gaugeFill.style.transition = "";
      needle.style.transition = "";
      gaugeFill.style.strokeDashoffset = String(GAUGE_ARC_LENGTH * (1 - clamped / 10));
      needle.style.transform = `rotate(${(clamped / 10) * 180 - 90}deg)`;
    }));

    // count-up
    cancelAnimationFrame(countRaf);
    const start = performance.now(), dur = 1100;
    const tick = (now) => {
      const k = Math.min(1, (now - start) / dur);
      $("score-number").textContent = (score * (1 - Math.pow(1 - k, 3))).toFixed(2);
      if (k < 1) countRaf = requestAnimationFrame(tick);
    };
    countRaf = requestAnimationFrame(tick);
  }

  function renderError(label, copy) {
    $("error-label").textContent = label;
    $("error-copy").textContent = copy;
    showState("error");
  }

  function applyServerValidationErrors(detail) {
    if (!Array.isArray(detail)) return false;
    let matched = false;
    detail.forEach((err) => {
      const field = Array.isArray(err.loc) ? err.loc[err.loc.length - 1] : null;
      const el = field ? $(field) : null;
      if (el) { setFieldError(el, err.msg || "Invalid value."); matched = true; }
    });
    return matched;
  }

  // ---------- submit ----------
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearAllErrors();

    const payload = collectPayload();
    const errs = validate(payload);
    if (errs.length) {
      errs.forEach(([el, msg]) => setFieldError(el, msg));
      const first = wrapOf(errs[0][0]);
      first.scrollIntoView({ behavior: "smooth", block: "center" });
      first.classList.remove("shake"); void first.offsetWidth; first.classList.add("shake");
      return;
    }

    setSubmitting(true);
    showState("loading");
    $("loading-copy").textContent = "Running your habits through the model.";

    // free Render servers sleep; tell the user why it may take a while
    const slowTimer = setTimeout(() => {
      $("loading-copy").textContent = "Waking up the server — the first read can take up to a minute.";
    }, 5000);
    const ctrl = new AbortController();
    const abortTimer = setTimeout(() => ctrl.abort(), 70000);

    try {
      const res = await fetch(`${API_BASE}/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: ctrl.signal,
      });

      if (res.status === 422) {
        const body = await res.json().catch(() => null);
        const matched = body && applyServerValidationErrors(body.detail);
        renderError("Check your inputs", matched
          ? "The API rejected a few fields — details are marked on the form."
          : "The API rejected this submission. Please review your inputs and try again.");
        return;
      }
      if (!res.ok) {
        let msg = `The API responded with status ${res.status}.`;
        const body = await res.json().catch(() => null);
        if (body && typeof body.detail === "string") msg = body.detail;
        renderError("Prediction failed", msg);
        return;
      }
      const data = await res.json();
      if (typeof data.predicted_mental_health_score !== "number") {
        renderError("Unexpected response", "The API responded, but the score was missing or malformed.");
        return;
      }
      renderResult(data.predicted_mental_health_score, payload);
    } catch (err) {
      renderError(
        err.name === "AbortError" ? "Server took too long" : "Can't reach the server",
        err.name === "AbortError"
          ? "The server didn't answer in time. Try again in a moment."
          : `Couldn't connect to ${API_BASE}. Check your internet connection and that the backend is running.`
      );
    } finally {
      clearTimeout(slowTimer);
      clearTimeout(abortTimer);
      setSubmitting(false);
    }
  });

  // ---------- result / error buttons ----------
  $("reset-btn").addEventListener("click", clearForm);
  $("edit-btn").addEventListener("click", () => {
    showState("idle");
    form.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  $("error-retry-btn").addEventListener("click", () => showState("idle"));

  refresh();
})();