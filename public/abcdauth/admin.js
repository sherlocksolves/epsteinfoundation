import { supabase, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "../js/supabase-init.js";
import { siteConfig } from "../js/siteConfig.js";

const endpoint = `${SUPABASE_URL}/functions/v1/admin-api`;
let token = sessionStorage.getItem("ds_admin_token") || "";
let username = sessionStorage.getItem("ds_admin_user") || "";

async function api(action, { method = "GET", body } = {}) {
  const r = await fetch(`${endpoint}?action=${encodeURIComponent(action)}`, {
    method,
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { "Content-Type": "application/json" } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  const j = await r.json();
  if (!r.ok || !j.success) throw new Error(j.error || `Request failed (${r.status})`);
  return j;
}

const $ = (id) => document.getElementById(id);

function showAdminBanner(text, type = "error", autoDismissMs = 6000) {
  const container = $("admin-banner-container");
  if (!container) return;
  const banner = document.createElement("div");
  banner.className = `admin-banner ${type}`;
  const span = document.createElement("span");
  span.textContent = text;
  const close = document.createElement("button");
  close.className = "admin-banner-close";
  close.setAttribute("aria-label", "Dismiss notification");
  close.innerHTML = "&times;";
  close.onclick = () => banner.remove();
  banner.append(span, close);
  container.prepend(banner);
  if (autoDismissMs > 0) {
    setTimeout(() => {
      if (banner.parentElement) banner.remove();
    }, autoDismissMs);
  }
}

const msg = (id, s, cls = "muted") => {
  const el = $(id);
  if (el) {
    el.textContent = s;
    el.className = cls;
  }
  if (cls === "error") {
    showAdminBanner(s, "error");
  }
};

async function withButtonLoading(btn, asyncFn) {
  if (!btn) return asyncFn();
  const originalHtml = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner"></span> Working...`;
  try {
    return await asyncFn();
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalHtml;
  }
}

// Setup Password Visibility Toggles
document.querySelectorAll(".pwd-toggle").forEach((btn) => {
  btn.addEventListener("click", () => {
    const targetId = btn.dataset.target;
    const input = $(targetId);
    if (input) {
      const isPassword = input.type === "password";
      input.type = isPassword ? "text" : "password";
      btn.textContent = isPassword ? "🙈" : "👁️";
    }
  });
});

// Setup Volunteer Detail Modal
function showMsgModal(title, message) {
  const modal = $("msg-modal");
  if (!modal) return;
  $("msg-modal-title").textContent = title;
  $("msg-modal-body").textContent = message;
  modal.classList.remove("hidden");
}

$("msg-modal-close")?.addEventListener("click", () => {
  $("msg-modal")?.classList.add("hidden");
});

$("msg-modal")?.addEventListener("click", (e) => {
  if (e.target === $("msg-modal")) $("msg-modal")?.classList.add("hidden");
});

// Setup Tab Navigation
document.querySelectorAll(".admin-tab").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".admin-tab").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach((p) => p.classList.add("hidden"));
    btn.classList.add("active");
    const target = $(btn.dataset.tab);
    if (target) target.classList.remove("hidden");
  });
});

function showDashboard() {
  $("login-card").classList.add("hidden");
  $("dashboard").classList.remove("hidden");
  $("logout").classList.remove("hidden");
  $("refresh-btn").classList.remove("hidden");
  load();
}

function showLogin() {
  $("login-card").classList.remove("hidden");
  $("dashboard").classList.add("hidden");
  $("logout").classList.add("hidden");
  $("refresh-btn").classList.add("hidden");
}

// Google Sign-In OAuth Handler
const googleBtn = $("google-login-btn");
if (googleBtn) {
  googleBtn.addEventListener("click", async () => {
    try {
      googleBtn.disabled = true;
      msg("login-msg", "Redirecting to Google Sign-In...", "muted");
      showAdminBanner("Connecting to Google authentication...", "info", 4000);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/abcdauth`
        }
      });
      if (error) throw error;
    } catch (err) {
      googleBtn.disabled = false;
      msg("login-msg", `Google Sign-In failed: ${err.message}`, "error");
    }
  });
}

// Standard Username / Password Login
$("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const submitBtn = $("login-submit-btn") || e.currentTarget.querySelector("button[type=submit]");
  await withButtonLoading(submitBtn, async () => {
    const f = new FormData(e.currentTarget);
    try {
      const j = await api("login", {
        method: "POST",
        body: { username: f.get("username"), password: f.get("password") }
      });
      token = j.token;
      username = j.username;
      sessionStorage.setItem("ds_admin_token", token);
      sessionStorage.setItem("ds_admin_user", username);
      showDashboard();
    } catch (err) {
      msg("login-msg", err.message, "error");
    }
  });
});

$("logout").onclick = async () => {
  token = "";
  username = "";
  sessionStorage.removeItem("ds_admin_token");
  sessionStorage.removeItem("ds_admin_user");
  try {
    await supabase.auth.signOut();
  } catch (e) {
    console.warn("Sign-out error:", e);
  }
  showLogin();
  showAdminBanner("Signed out successfully.", "info", 3000);
};

$("refresh-btn").onclick = () => load();

async function load() {
  try {
    const j = await api("contributions");
    const priv = j.private_contributions || [];
    const pub = j.public_leaderboard || [];
    const vols = j.volunteers || [];

    $("private-count").textContent = priv.length;
    $("public-count").textContent = pub.length;
    $("volunteer-count").textContent = vols.length;

    renderPrivate(priv);
    renderPublic(pub);
    renderVolunteers(vols);
    populateCmsForm(j.cms || siteConfig);

    if (j.settings) {
      $("btc-address").value = j.settings.btc_address || "";
      $("bsc-address").value = j.settings.bsc_address || "";
    }
  } catch (e) {
    if (/session|expired/i.test(e.message)) {
      $("logout").click();
    } else {
      msg("global-msg", e.message, "error");
    }
  }
}

function cell(tr, value, cls = "") {
  const td = document.createElement("td");
  td.textContent = value ?? "—";
  if (cls) td.className = cls;
  tr.append(td);
  return td;
}

function renderPublic(rows) {
  const root = $("public-rows");
  root.replaceChildren();
  if (!rows.length) {
    const tr = document.createElement("tr");
    const td = cell(tr, "No supporters on the leaderboard yet. Use the form above to add one or verify a transaction.", "muted");
    td.colSpan = 6;
    root.append(tr);
    return;
  }

  for (const r of rows) {
    const tr = document.createElement("tr");
    cell(tr, new Date(r.verified_at).toLocaleString(), "small");

    // Editable Name Input
    const nameTd = document.createElement("td");
    const nameInput = document.createElement("input");
    nameInput.className = "inline-edit-input";
    nameInput.value = r.display_name || "Anonymous Supporter";
    nameTd.append(nameInput);
    tr.append(nameTd);

    // Editable Amount Input
    const amtTd = document.createElement("td");
    const amtInput = document.createElement("input");
    amtInput.className = "inline-edit-input mono";
    amtInput.value = r.amount_display || "";
    amtTd.append(amtInput);
    tr.append(amtTd);

    cell(tr, r.network);
    cell(tr, r.status);

    const td = document.createElement("td");
    const actions = document.createElement("div");
    actions.className = "admin-actions";

    // Save Inline Edit Button
    const saveBtn = document.createElement("button");
    saveBtn.className = "admin-btn";
    saveBtn.textContent = "Save Edit";
    saveBtn.onclick = async () => {
      await withButtonLoading(saveBtn, async () => {
        try {
          await api("edit-supporter", {
            method: "POST",
            body: { id: r.id, displayName: nameInput.value.trim(), amountDisplay: amtInput.value.trim() }
          });
          showAdminBanner("✓ Supporter updated successfully.", "success", 3000);
        } catch (e) {
          msg("global-msg", e.message, "error");
        }
      });
    };
    actions.append(saveBtn);

    // Hide/Restore & Delete Buttons
    for (const [mode, label, cls] of [
      [r.status === "hidden" ? "restore" : "hide", r.status === "hidden" ? "Restore" : "Hide", "admin-btn secondary"],
      ["delete", "Delete", "admin-btn danger"]
    ]) {
      const b = document.createElement("button");
      b.className = cls;
      b.textContent = label;
      b.onclick = async () => {
        if (mode === "delete" && !confirm("Permanently delete this supporter from the leaderboard?")) return;
        await withButtonLoading(b, async () => {
          try {
            await api("moderate-entry", { method: "POST", body: { id: r.id, mode } });
            load();
            showAdminBanner(`✓ Supporter ${mode === "delete" ? "deleted" : "updated"}.`, "success", 3000);
          } catch (e) {
            msg("global-msg", e.message, "error");
          }
        });
      };
      actions.append(b);
    }

    td.append(actions);
    tr.append(td);
    root.append(tr);
  }
}

function renderPrivate(rows) {
  const root = $("private-rows");
  root.replaceChildren();
  if (!rows.length) {
    const tr = document.createElement("tr");
    const td = cell(tr, "No on-chain verification records yet.", "muted");
    td.colSpan = 6;
    root.append(tr);
    return;
  }
  for (const r of rows) {
    const tr = document.createElement("tr");
    cell(tr, new Date(r.verified_at).toLocaleString(), "small");
    cell(tr, `${(r.network || "").toUpperCase()} · ${r.amount_display}`);
    cell(tr, r.sender || "—");
    cell(tr, r.recipient || "—", "small mono");
    cell(tr, r.tx_hash, "small mono");
    cell(tr, r.note || "—");
    root.append(tr);
  }
}

function renderVolunteers(rows) {
  const root = $("volunteer-rows");
  root.replaceChildren();
  if (!rows.length) {
    const tr = document.createElement("tr");
    const td = cell(tr, "No volunteer applications or feedback submissions yet.", "muted");
    td.colSpan = 8;
    root.append(tr);
    return;
  }

  for (const r of rows) {
    const p = r.raw_payload || {};
    const tr = document.createElement("tr");
    cell(tr, new Date(r.verified_at).toLocaleString(), "small");

    const typeTd = document.createElement("td");
    const pill = document.createElement("span");
    pill.className = "pill-type";
    pill.textContent = p.submission_type || r.amount_display || "Volunteer";
    typeTd.append(pill);
    tr.append(typeTd);

    cell(tr, p.fullName || r.sender || "—");
    cell(tr, p.contact || "—", "mono small");
    cell(tr, p.location || "—");
    cell(tr, p.role || "—");

    // Message Cell with Truncation & Modal expander
    const msgTd = document.createElement("td");
    const fullMessage = p.message || r.note || "—";
    if (fullMessage.length > 70) {
      msgTd.textContent = `${fullMessage.slice(0, 68)}... `;
      const expandBtn = document.createElement("button");
      expandBtn.type = "button";
      expandBtn.className = "admin-btn secondary";
      expandBtn.style.padding = "0.2rem 0.45rem";
      expandBtn.style.fontSize = "0.74rem";
      expandBtn.textContent = "View";
      expandBtn.onclick = () => showMsgModal(`${p.fullName || "Volunteer"} (${p.submission_type || "Submission"})`, fullMessage);
      msgTd.append(expandBtn);
    } else {
      msgTd.textContent = fullMessage;
    }
    tr.append(msgTd);

    const actionTd = document.createElement("td");
    const delBtn = document.createElement("button");
    delBtn.className = "admin-btn danger";
    delBtn.textContent = "Remove";
    delBtn.onclick = async () => {
      if (!confirm("Remove this submission from the inbox?")) return;
      await withButtonLoading(delBtn, async () => {
        try {
          await api("manage-volunteer", { method: "POST", body: { id: r.id, mode: "delete" } });
          load();
          showAdminBanner("✓ Submission removed from inbox.", "success", 3000);
        } catch (e) {
          msg("global-msg", e.message, "error");
        }
      });
    };
    actionTd.append(delBtn);
    tr.append(actionTd);
    root.append(tr);
  }
}

function populateCmsForm(cms) {
  $("cms-ann-enabled").checked = Boolean(cms.announcement?.enabled);
  $("cms-ann-text").value = cms.announcement?.text || siteConfig.announcement.text;
  $("cms-title").value = cms.projectTitle || siteConfig.projectTitle;
  $("cms-tagline").value = cms.tagline || siteConfig.tagline;
  $("cms-badge").value = cms.heroBadge || siteConfig.heroBadge;
  $("cms-banner").value = cms.bannerImage || siteConfig.bannerImage;
  $("cms-story-title").value = cms.storyTitle || siteConfig.storyTitle;
  $("cms-story-subtitle").value = cms.storySubtitle || siteConfig.storySubtitle;
  const paragraphs = Array.isArray(cms.storyParagraphs) && cms.storyParagraphs.length
    ? cms.storyParagraphs
    : siteConfig.storyParagraphs;
  $("cms-story-body").value = paragraphs.join("\n");

  $("cms-goal-enabled").checked = Boolean(cms.campaignGoal?.enabled);
  $("cms-goal-title").value = cms.campaignGoal?.title || siteConfig.campaignGoal.title;
  $("cms-goal-display").value = cms.campaignGoal?.currentDisplay || siteConfig.campaignGoal.currentDisplay;
  $("cms-goal-pct").value = cms.campaignGoal?.percentage ?? siteConfig.campaignGoal.percentage;

  $("cms-insta").value = cms.social?.instagram || siteConfig.social.instagram;
  $("cms-x").value = cms.social?.x || siteConfig.social.x;
  $("cms-footer-notice").value = cms.footerNotice || siteConfig.footerNotice;
  $("cms-copyright").value = cms.copyright || siteConfig.copyright;
}

// Add Manual Supporter Submit
$("add-supporter-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const submitBtn = e.currentTarget.querySelector("button[type=submit]");
  await withButtonLoading(submitBtn, async () => {
    try {
      await api("add-supporter", {
        method: "POST",
        body: {
          displayName: $("sup-name").value.trim(),
          amountDisplay: $("sup-amount").value.trim(),
          network: $("sup-network").value,
          note: $("sup-note").value.trim()
        }
      });
      $("sup-name").value = "";
      $("sup-amount").value = "";
      $("sup-note").value = "";
      msg("sup-msg", "✓ Supporter added to live leaderboard!", "success");
      showAdminBanner("✓ Supporter added to live leaderboard!", "success", 4000);
      load();
    } catch (err) {
      msg("sup-msg", err.message, "error");
    }
  });
});

// Save Homepage CMS Submit
$("cms-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const submitBtn = e.currentTarget.querySelector("button[type=submit]");
  await withButtonLoading(submitBtn, async () => {
    try {
      const paragraphs = $("cms-story-body")
        .value.split("\n")
        .map((s) => s.trim())
        .filter(Boolean);

      await api("save-cms", {
        method: "POST",
        body: {
          projectTitle: $("cms-title").value.trim(),
          tagline: $("cms-tagline").value.trim(),
          heroBadge: $("cms-badge").value.trim(),
          bannerImage: $("cms-banner").value.trim(),
          storyTitle: $("cms-story-title").value.trim(),
          storySubtitle: $("cms-story-subtitle").value.trim(),
          storyParagraphs: paragraphs,
          announcement: {
            enabled: $("cms-ann-enabled").checked,
            text: $("cms-ann-text").value.trim()
          },
          campaignGoal: {
            enabled: $("cms-goal-enabled").checked,
            title: $("cms-goal-title").value.trim(),
            currentDisplay: $("cms-goal-display").value.trim(),
            percentage: Number($("cms-goal-pct").value) || 0
          },
          social: {
            instagram: $("cms-insta").value.trim(),
            x: $("cms-x").value.trim()
          },
          footerNotice: $("cms-footer-notice").value.trim(),
          copyright: $("cms-copyright").value.trim()
        }
      });
      msg("cms-msg", "✓ Homepage changes published live!", "success");
      showAdminBanner("✓ Homepage changes published live!", "success", 4000);
    } catch (err) {
      msg("cms-msg", err.message, "error");
    }
  });
});

// Update Receiving Addresses
$("settings-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const submitBtn = e.currentTarget.querySelector("button[type=submit]");
  await withButtonLoading(submitBtn, async () => {
    try {
      await api("update-settings", {
        method: "POST",
        body: {
          btc_address: $("btc-address").value.trim(),
          bsc_address: $("bsc-address").value.trim()
        }
      });
      msg("settings-msg", "✓ Receiving addresses updated.", "success");
      showAdminBanner("✓ Receiving addresses updated.", "success", 4000);
    } catch (err) {
      msg("settings-msg", err.message, "error");
    }
  });
});

// Update Admin Credentials
$("credentials-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const newPass = $("new-password").value;
  const confirmPass = $("confirm-password") ? $("confirm-password").value : newPass;
  if (newPass && newPass !== confirmPass) {
    msg("credentials-msg", "New password and confirm password do not match.", "error");
    return;
  }

  const submitBtn = $("credentials-submit-btn") || e.currentTarget.querySelector("button[type=submit]");
  await withButtonLoading(submitBtn, async () => {
    try {
      const j = await api("change-credentials", {
        method: "POST",
        body: {
          username: $("new-username").value.trim() || username,
          currentPassword: $("current-password").value,
          password: newPass
        }
      });
      token = j.token;
      username = j.username;
      sessionStorage.setItem("ds_admin_token", token);
      sessionStorage.setItem("ds_admin_user", username);
      $("current-password").value = "";
      $("new-password").value = "";
      if ($("confirm-password")) $("confirm-password").value = "";
      $("new-username").value = "";
      msg("credentials-msg", "✓ Admin credentials updated.", "success");
      showAdminBanner("✓ Admin credentials updated successfully.", "success", 4000);
    } catch (err) {
      msg("credentials-msg", err.message, "error");
    }
  });
});

// Initialize Authentication on Page Load
async function initAuth() {
  // 1. Check for OAuth errors in query string (?error=...&error_description=...)
  const params = new URLSearchParams(window.location.search);
  if (params.get("error")) {
    const errDesc = params.get("error_description") || params.get("error");
    msg("login-msg", `Google Authentication Error: ${errDesc}`, "error");
    window.history.replaceState({}, document.title, window.location.pathname);
    showLogin();
    return;
  }

  // 2. Check for active Supabase Auth session (from PKCE exchange or redirect)
  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) {
      msg("login-msg", `OAuth Session Error: ${sessionError.message}`, "error");
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (session?.access_token) {
      // Exchange Google OAuth access token with admin-api for authorized admin token
      try {
        msg("login-msg", "Verifying administrator permissions...", "muted");
        showAdminBanner("Verifying administrator authorization...", "info", 3000);
        const j = await api("google-login", {
          method: "POST",
          body: { accessToken: session.access_token }
        });
        token = j.token;
        username = j.username;
        sessionStorage.setItem("ds_admin_token", token);
        sessionStorage.setItem("ds_admin_user", username);
        window.history.replaceState({}, document.title, window.location.pathname);
        showAdminBanner(`Signed in as authorized admin (${username})`, "success", 4000);
        showDashboard();
        return;
      } catch (err) {
        await supabase.auth.signOut();
        window.history.replaceState({}, document.title, window.location.pathname);
        msg("login-msg", `Access denied: ${err.message}`, "error");
        showLogin();
        return;
      }
    }
  } catch (err) {
    console.warn("Session check error:", err);
  }

  // 3. Fallback to existing session storage token
  if (token) {
    showDashboard();
  } else {
    showLogin();
  }
}

initAuth();
