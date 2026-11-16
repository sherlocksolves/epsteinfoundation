/**
 * Epstein Foundation — For Children.
 * Frontend Controller (Live CMS Overrides + On-Chain Verification + Leaderboard + Volunteer Form)
 */
import { siteConfig } from "./siteConfig.js";
import { supabase, functionUrl, SUPABASE_PUBLISHABLE_KEY } from "./supabase-init.js";

let activeNetwork = "btc";
let serverConfig = {
  btc: {
    address: "bc1qtgyrpyrmaf2vampf7ngt4xj4l3rh5kf7yy6qd8",
    qrUri: "bitcoin:bc1qtgyrpyrmaf2vampf7ngt4xj4l3rh5kf7yy6qd8",
    network: "mainnet"
  },
  bsc: {
    address: "0xE826cb2130425B31F89512F944B2784F2d97d732",
    qrUri: "ethereum:0xE826cb2130425B31F89512F944B2784F2d97d732@56",
    chainId: 56
  }
};
let leaderboardChannel;

document.addEventListener("DOMContentLoaded", async () => {
  renderBranding(siteConfig);
  setupEventListeners();
  await loadServerConfig();
  renderCryptoCard();
  await loadLeaderboard();
  setupLeaderboardListener();
});

function setText(id, val) {
  const el = document.getElementById(id);
  if (el && val !== undefined && val !== null) el.textContent = val;
}

/**
 * Render static defaults or live Admin CMS overrides onto the homepage
 */
function renderBranding(cfg) {
  document.title = `${cfg.projectTitle} — ${cfg.tagline}`;

  setText("nav-title", cfg.projectTitle);
  setText("nav-tagline", cfg.tagline);
  setText("hero-badge", cfg.heroBadge);
  setText("hero-title", cfg.projectTitle);
  setText("hero-tagline", cfg.tagline);

  // Announcement bar
  const annBar = document.getElementById("announcement-bar");
  if (annBar) {
    if (cfg.announcement?.enabled && cfg.announcement?.text) {
      setText("announcement-text", cfg.announcement.text);
      annBar.style.display = "block";
    } else {
      annBar.style.display = "none";
    }
  }

  // Banner image
  const banner = document.getElementById("hero-banner-img");
  if (banner && cfg.bannerImage) {
    banner.src = cfg.bannerImage;
    banner.alt = cfg.bannerAltText || "Epstein Foundation — For Children.";
  }

  // Social links
  if (cfg.social?.instagram) {
    const insta = document.getElementById("social-insta-link");
    if (insta) insta.href = cfg.social.instagram;
  }
  if (cfg.social?.x) {
    const xLink = document.getElementById("social-x-link");
    if (xLink) xLink.href = cfg.social.x;
  }

  // Impact Pillars
  const impactGrid = document.getElementById("impact-grid");
  if (impactGrid && Array.isArray(cfg.impactPillars) && cfg.impactPillars.length) {
    impactGrid.replaceChildren(
      ...cfg.impactPillars.map((p) => {
        const card = document.createElement("div");
        card.className = "impact-card";
        const icon = document.createElement("div");
        icon.className = "impact-icon";
        icon.textContent = p.icon || "✨";
        const title = document.createElement("h3");
        title.className = "impact-title";
        title.textContent = p.title || "";
        const desc = document.createElement("p");
        desc.className = "impact-desc";
        desc.textContent = p.description || "";
        card.append(icon, title, desc);
        return card;
      })
    );
  }

  // Story Section
  setText("story-title", cfg.storyTitle);
  setText("story-subtitle", cfg.storySubtitle);
  const body = document.getElementById("story-body");
  if (body && Array.isArray(cfg.storyParagraphs)) {
    body.replaceChildren(
      ...cfg.storyParagraphs.filter(Boolean).map((t) => {
        const p = document.createElement("p");
        p.textContent = t;
        return p;
      })
    );
  }

  // Campaign Goal
  const goal = document.getElementById("goal-container");
  if (cfg.campaignGoal?.enabled) {
    if (goal) goal.style.display = "block";
    setText("goal-title", cfg.campaignGoal.title);
    setText("goal-current", cfg.campaignGoal.currentDisplay);
    const fill = document.getElementById("goal-progress-fill");
    if (fill) fill.style.width = `${Math.min(100, Math.max(0, Number(cfg.campaignGoal.percentage) || 0))}%`;
  } else if (goal) {
    goal.style.display = "none";
  }

  // Verification & Leaderboard & Footer
  setText("form-section-title", cfg.verificationForm?.title);
  setText("form-section-subtitle", cfg.verificationForm?.subtitle);
  setText("anon-toggle-label", cfg.verificationForm?.anonymousToggleLabel);
  setText("leaderboard-title", cfg.leaderboard?.title);
  setText("leaderboard-subtitle", cfg.leaderboard?.subtitle);
  setText("volunteer-title", cfg.volunteerForm?.title);
  setText("volunteer-subtitle", cfg.volunteerForm?.subtitle);
  setText("footer-notice", cfg.footerNotice);
  setText("footer-copyright", cfg.copyright);
  setText("footer-disclaimer", cfg.disclaimer);
}

/**
 * Load server wallet addresses AND live Admin CMS homepage overrides
 */
async function loadServerConfig() {
  try {
    const r = await fetch(functionUrl("get-public-config"), {
      headers: { apikey: SUPABASE_PUBLISHABLE_KEY }
    });
    const j = await r.json();
    if (r.ok && j.success && j.data) {
      if (j.data.btc) serverConfig.btc = j.data.btc;
      if (j.data.bsc) serverConfig.bsc = j.data.bsc;

      // Apply live CMS overrides saved from Admin Panel (/abcdauth)
      if (j.data.cms && typeof j.data.cms === "object") {
        const cms = j.data.cms;
        const merged = {
          ...siteConfig,
          projectTitle: cms.projectTitle || siteConfig.projectTitle,
          tagline: cms.tagline || siteConfig.tagline,
          heroBadge: cms.heroBadge || siteConfig.heroBadge,
          bannerImage: cms.bannerImage || siteConfig.bannerImage,
          storyTitle: cms.storyTitle || siteConfig.storyTitle,
          storySubtitle: cms.storySubtitle || siteConfig.storySubtitle,
          storyParagraphs: Array.isArray(cms.storyParagraphs) && cms.storyParagraphs.length
            ? cms.storyParagraphs
            : siteConfig.storyParagraphs,
          impactPillars: Array.isArray(cms.impactPillars) && cms.impactPillars.length
            ? cms.impactPillars
            : siteConfig.impactPillars,
          announcement: cms.announcement || siteConfig.announcement,
          campaignGoal: cms.campaignGoal || siteConfig.campaignGoal,
          social: cms.social || siteConfig.social,
          footerNotice: cms.footerNotice || siteConfig.footerNotice,
          copyright: cms.copyright || siteConfig.copyright
        };
        renderBranding(merged);
      }
    }
  } catch (e) {
    console.warn("Using default configuration fallback", e);
  }
}

function renderCryptoCard() {
  const isBtc = activeNetwork === "btc";
  const c = isBtc ? serverConfig.btc : serverConfig.bsc;
  const n = isBtc ? siteConfig.supportedNetworks.btc : siteConfig.supportedNetworks.bsc;

  setText("card-network-badge", n.badge);
  const badge = document.getElementById("card-network-badge");
  if (badge) badge.className = `net-pill ${isBtc ? "pill-btc" : "pill-bsc"}`;

  setText("card-address-text", c.address);
  setText("card-network-notice", n.networkNotice);

  const slot = document.getElementById("card-qr-slot");
  if (slot) {
    slot.innerHTML = window.QRGenerator?.createQrSvg
      ? window.QRGenerator.createQrSvg(c.qrUri || c.address, 204)
      : `<p class="mono">${escapeHtml(c.address)}</p>`;
  }

  document.getElementById("tab-btc")?.classList.toggle("active", isBtc);
  document.getElementById("tab-bsc")?.classList.toggle("active", !isBtc);

  const select = document.getElementById("verify-network-select");
  if (select) {
    select.value = isBtc ? "btc" : "bsc";
    updateVerificationInputPlaceholder();
  }
}

function setupEventListeners() {
  document.getElementById("tab-btc")?.addEventListener("click", () => {
    activeNetwork = "btc";
    renderCryptoCard();
  });
  document.getElementById("tab-bsc")?.addEventListener("click", () => {
    activeNetwork = "bsc";
    renderCryptoCard();
  });

  document.getElementById("btn-copy-address")?.addEventListener("click", () =>
    copyToClipboard(document.getElementById("card-address-text").textContent, "Wallet address copied!")
  );
  document.getElementById("btn-copy-uri")?.addEventListener("click", () => {
    const c = activeNetwork === "btc" ? serverConfig.btc : serverConfig.bsc;
    copyToClipboard(c.qrUri || c.address, "Payment URI copied!");
  });

  document.getElementById("verify-network-select")?.addEventListener("change", (e) => {
    activeNetwork = e.target.value;
    renderCryptoCard();
  });

  const anon = document.getElementById("anon-toggle");
  const group = document.getElementById("display-name-group");
  const nameInput = document.getElementById("display-name-input");
  anon?.addEventListener("change", () => {
    if (anon.checked) {
      group.style.display = "none";
      nameInput.value = "";
    } else {
      group.style.display = "flex";
      nameInput.focus();
    }
  });

  document.getElementById("verify-tx-form")?.addEventListener("submit", handleVerificationSubmit);
  document.getElementById("volunteer-form")?.addEventListener("submit", handleVolunteerSubmit);
}

function updateVerificationInputPlaceholder() {
  const btc = activeNetwork === "btc";
  const input = document.getElementById("tx-hash-input");
  const help = document.getElementById("tx-hash-help");
  if (input) input.placeholder = btc ? "Enter 64-char Bitcoin TXID" : "Enter 0x-prefixed 66-char BSC Transaction Hash";
  if (help) help.textContent = btc
    ? "Transaction ID found in your Bitcoin wallet or block explorer."
    : "Transaction hash found in BscScan or your Web3 wallet.";
}

async function handleVerificationSubmit(e) {
  e.preventDefault();
  const network = document.getElementById("verify-network-select").value;
  const txHash = document.getElementById("tx-hash-input").value.trim();
  const isAnonymous = document.getElementById("anon-toggle").checked;
  const displayName = isAnonymous
    ? siteConfig.verificationForm.anonymousDefaultText
    : (document.getElementById("display-name-input").value.trim() || siteConfig.verificationForm.anonymousDefaultText);
  const note = document.getElementById("note-input").value.trim();

  if (network === "btc" && !/^[a-fA-F0-9]{64}$/.test(txHash)) {
    showToast("Bitcoin TXID must be exactly 64 hexadecimal characters.", "error");
    return;
  }
  if (network === "bsc" && !/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
    showToast("BSC transaction hash must start with 0x and contain 64 hex characters.", "error");
    return;
  }

  const btn = document.getElementById("btn-verify-submit");
  const original = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Verifying On-Chain...';

  try {
    const fn = network === "btc" ? "verify-btc" : "verify-bsc";
    const payload = network === "btc"
      ? { txid: txHash, displayName, isAnonymous, note }
      : { txHash, displayName, isAnonymous, note };

    const r = await fetch(functionUrl(fn), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_PUBLISHABLE_KEY
      },
      body: JSON.stringify(payload)
    });
    const result = await r.json();
    if (!r.ok || !result.success) throw new Error(result.error || `Verification failed (${r.status})`);

    showToast(`Thank you! ${result.message || "Contribution verified!"}`, "success");
    document.getElementById("tx-hash-input").value = "";
    document.getElementById("note-input").value = "";
    await loadLeaderboard();
  } catch (err) {
    showToast(err.message, "error");
  } finally {
    btn.disabled = false;
    btn.innerHTML = original;
  }
}

/**
 * Submit Volunteer Application / Community Feedback to Admin Panel
 */
async function handleVolunteerSubmit(e) {
  e.preventDefault();
  const type = document.getElementById("vol-type").value;
  const fullName = document.getElementById("vol-name").value.trim();
  const contact = document.getElementById("vol-contact").value.trim();
  const location = document.getElementById("vol-location").value.trim();
  const role = document.getElementById("vol-role").value;
  const message = document.getElementById("vol-message").value.trim();

  if (!fullName || !contact || !message) {
    showToast("Please fill in your name, contact details, and message.", "error");
    return;
  }

  const btn = document.getElementById("btn-volunteer-submit");
  const original = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Sending...';

  try {
    const r = await fetch(`${functionUrl("admin-api")}?action=submit-community`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_PUBLISHABLE_KEY
      },
      body: JSON.stringify({ type, fullName, contact, location, role, message })
    });
    const j = await r.json();
    if (!r.ok || !j.success) throw new Error(j.error || "Submission failed. Please try again.");

    showToast("Thank you! Your submission has been received by the Epstein Foundation team.", "success");
    e.target.reset();
  } catch (err) {
    showToast(err.message, "error");
  } finally {
    btn.disabled = false;
    btn.innerHTML = original;
  }
}

async function loadLeaderboard() {
  const tbody = document.getElementById("leaderboard-body");
  const empty = document.getElementById("leaderboard-empty");
  const count = document.getElementById("stats-total-count");
  try {
    const { data, error } = await supabase
      .from("public_leaderboard")
      .select("id,display_name,network,amount_display,status,verified_at")
      .eq("status", "verified")
      .order("verified_at", { ascending: false })
      .limit(siteConfig.leaderboard.pageSize || 25);
    if (error) throw error;
    renderLeaderboard(data || [], tbody, empty, count);
  } catch (e) {
    console.warn("Leaderboard load failed", e);
    empty.style.display = "block";
    empty.textContent = "Leaderboard is refreshing. Please check back in a moment.";
  }
}

function setupLeaderboardListener() {
  leaderboardChannel = supabase
    .channel("public-leaderboard-live")
    .on("postgres_changes", { event: "*", schema: "public", table: "public_leaderboard" }, loadLeaderboard)
    .subscribe();
  window.addEventListener("beforeunload", () => {
    if (leaderboardChannel) supabase.removeChannel(leaderboardChannel);
  });
}

function renderLeaderboard(items, tbody, empty, count) {
  tbody.replaceChildren();
  count.textContent = String(items.length);
  empty.style.display = items.length ? "none" : "block";
  if (!items.length) {
    empty.textContent = siteConfig.leaderboard.emptyStateMessage;
    return;
  }
  items.forEach((item, i) => {
    const tr = document.createElement("tr");
    const td = (v, cls = "") => {
      const el = document.createElement("td");
      if (cls) el.className = cls;
      el.textContent = v;
      return el;
    };
    const rank = document.createElement("span");
    rank.className = `rank-badge ${i === 0 ? "rank-gold" : i === 1 ? "rank-silver" : i === 2 ? "rank-bronze" : "rank-norm"}`;
    rank.textContent = `#${i + 1}`;
    const rtd = document.createElement("td");
    rtd.append(rank);

    const supporter = td(item.display_name || "Anonymous Supporter", "font-medium");
    const amount = td(item.amount_display || "Verified", "font-bold text-accent mono");
    const net = document.createElement("td");
    const tag = document.createElement("span");
    tag.className = `net-tag ${item.network === "BTC" ? "badge-btc" : "badge-bsc"}`;
    tag.textContent = item.network || "BTC";
    net.append(tag);

    const status = td("✓ Verified", "status-verified");
    const date = td(
      new Date(item.verified_at).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      "text-muted text-sm"
    );
    tr.append(rtd, supporter, amount, net, status, date);
    tbody.append(tr);
  });
}

async function copyToClipboard(text, msg) {
  try {
    if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
    else {
      const t = document.createElement("textarea");
      t.value = text;
      document.body.append(t);
      t.select();
      document.execCommand("copy");
      t.remove();
    }
    showToast(msg, "success");
  } catch {
    showToast("Failed to copy automatically. Please copy manually.", "error");
  }
}

function showToast(message, type = "info") {
  const c = document.getElementById("toast-container");
  if (!c) return;
  const t = document.createElement("div");
  t.className = `toast-item toast-${type}`;
  const span = document.createElement("span");
  span.className = "toast-msg";
  span.textContent = message;
  const close = document.createElement("button");
  close.className = "toast-close";
  close.setAttribute("aria-label", "Close");
  close.textContent = "×";
  close.onclick = () => t.remove();
  t.append(span, close);
  c.append(t);
  setTimeout(() => {
    t.classList.add("toast-fadeout");
    setTimeout(() => t.remove(), 400);
  }, 4500);
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c]));
}
