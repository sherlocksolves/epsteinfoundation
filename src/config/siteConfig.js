/**
 * Site Configuration & Branding — Epstein Foundation
 */

export const siteConfig = {
  projectTitle: "Epstein Foundation",
  tagline: "For Children.",
  heroBadge: "Direct Community Support",

  bannerImage: "assets/banner.jpg",
  bannerAltText: "Epstein Foundation — For Children.",

  storyTitle: "For Children.",
  storySubtitle: "Direct, transparent support—with zero middlemen.",
  storyParagraphs: [
    "Every child deserves a fair start—safe care, daily nutrition, and the chance to learn.",
    "We built a simple, direct way to support children without unnecessary barriers or platform fees. Every verified contribution goes directly toward supporting child education, nutrition, and essential care.",
    "Whether you choose to stay anonymous or display your name on our live Supporter Leaderboard, thank you for standing with us."
  ],

  campaignGoal: {
    enabled: false,
    title: "Community Milestone",
    currentDisplay: "",
    percentage: 0
  },

  supportedNetworks: {
    btc: {
      name: "Bitcoin",
      symbol: "BTC",
      badge: "Mainnet / BIP-21",
      networkNotice: "Send only native BTC to this address. Confirmations may take 10–30 minutes."
    },
    bsc: {
      name: "BNB Smart Chain",
      symbol: "BNB / BEP-20",
      badge: "BNB Chain (EIP-681 @56)",
      networkNotice: "Send only on BNB Smart Chain (BEP-20 · Chain ID: 56). Fast ~3s confirmations."
    }
  },

  leaderboard: {
    title: "Verified Supporter Leaderboard",
    subtitle: "Real-time verified contributions.",
    emptyStateMessage: "No contributions recorded yet. Be the first supporter to verify!",
    pageSize: 20
  },

  verificationForm: {
    title: "Verify Your Contribution",
    subtitle: "Submit your transaction hash to verify on-chain and appear on the live leaderboard.",
    anonymousToggleLabel: "Stay Anonymous on Public Leaderboard",
    anonymousDefaultText: "Anonymous Supporter"
  },

  social: {
    instagram: "https://www.instagram.com/epsteinfoundationforchildren",
    x: "https://x.com/epsteinfnd"
  },

  footerNotice: "Epstein Foundation — For Children. Direct community support with on-chain verification.",
  copyright: "© 2026 Epstein Foundation. For Children.",
  disclaimer: "Cryptocurrency transactions are final and immutable. Please verify the receiving address and network before sending."
};

export default siteConfig;
