import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "../js/supabase-init.js";
import { siteConfig } from "../js/siteConfig.js";

const endpoint = `${SUPABASE_URL}/functions/v1/admin-api`;
const adminAuth = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "pkce" }
});
const ADMIN_EMAIL = "viratanand1221@gmail.com";
let token = "";

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
const msg = (id, s, cls = "muted") => {
  const el = $(id);
  if (el) {
    el.textContent = s;
    el.className = cls;
  }
};

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

$("google-sign-in").addEventListener("click", async () => {
  msg("login-msg", "Redirecting to Google…");
  const { error } = await adminAuth.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${window.location.origin}/abcdauth/` }
  });
  if (error) msg("login-msg", error.message, "error");
});

$("logout").onclick = async () => {
  await adminAuth.auth.signOut();
  token = "";
  showLogin();
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
      try {
        await api("edit-supporter", {
          method: "POST",
          body: { id: r.id, displayName: nameInput.value.trim(), amountDisplay: amtInput.value.trim() }
        });
        saveBtn.textContent = "✓ Saved";
        setTimeout(() => (saveBtn.textContent = "Save Edit"), 1500);
      } catch (e) {
        msg("global-msg", e.message, "error");
      }
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
        try {
          await api("moderate-entry", { method: "POST", body: { id: r.id, mode } });
          load();
        } catch (e) {
          msg("global-msg", e.message, "error");
        }
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
    cell(tr, p.message || r.note || "—");

    const actionTd = document.createElement("td");
    const delBtn = document.createElement("button");
    delBtn.className = "admin-btn danger";
    delBtn.textContent = "Remove";
    delBtn.onclick = async () => {
      if (!confirm("Remove this submission from the inbox?")) return;
      try {
        await api("manage-volunteer", { method: "POST", body: { id: r.id, mode: "delete" } });
        load();
      } catch (e) {
        msg("global-msg", e.message, "error");
      }
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
    load();
  } catch (err) {
    msg("sup-msg", err.message, "error");
  }
});

// Save Homepage CMS Submit
$("cms-form").addEventListener("submit", async (e) => {
  e.preventDefault();
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
  } catch (err) {
    msg("cms-msg", err.message, "error");
  }
});

// Update Receiving Addresses
$("settings-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    await api("update-settings", {
      method: "POST",
      body: {
        btc_address: $("btc-address").value.trim(),
        bsc_address: $("bsc-address").value.trim()
      }
    });
    msg("settings-msg", "✓ Receiving addresses updated.", "success");
  } catch (err) {
    msg("settings-msg", err.message, "error");
  }
});

async function applySession(session) {
  const email = session?.user?.email?.toLowerCase();
  if (!session || email !== ADMIN_EMAIL) {
    token = "";
    showLogin();
    if (session) {
      msg("login-msg", "This Google account is not authorized for the admin console.", "error");
      await adminAuth.auth.signOut();
    }
    return;
  }
  token = session.access_token;
  if (document.getElementById("dashboard").classList.contains("hidden")) showDashboard();
}

adminAuth.auth.onAuthStateChange((_event, session) => {
  if (!session) {
    token = "";
    showLogin();
    return;
  }

  if (session.user?.email?.toLowerCase() !== ADMIN_EMAIL) {
    token = "";
    showLogin();
    msg("login-msg", "This Google account is not authorized for the admin console.", "error");
    // Run after the auth callback returns to avoid holding Supabase's auth lock.
    queueMicrotask(() => adminAuth.auth.signOut());
    return;
  }

  token = session.access_token;
  if (document.getElementById("dashboard").classList.contains("hidden")) showDashboard();
});

const { data: { session } } = await adminAuth.auth.getSession();
await applySession(session);
