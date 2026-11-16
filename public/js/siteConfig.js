/**
 * Site Configuration & Branding — Epstein Foundation
 */

export const siteConfig = {
  projectTitle: "Epstein Foundation",
  tagline: "For Children.",
  heroBadge: "Direct Community Support",

  bannerImage: "assets/banner.jpg",
  bannerAltText: "Epstein Foundation — For Children.",

  announcement: {
    enabled: false,
    text: "100% of verified contributions go directly toward child education, daily nutrition, and essential care."
  },

  storyTitle: "Every Child Deserves a Fair Start.",
  storySubtitle: "Direct, transparent community support—with zero middlemen.",
  storyParagraphs: [
    "Every child deserves safe care, daily nourishment, and the opportunity to learn and grow with dignity.",
    "We built a simple, direct way to support children without bureaucratic delays or platform fees. Every verified contribution goes straight toward essential programs in education, nutrition, and care.",
    "Whether you choose to remain an anonymous supporter or display your name on our live Supporter Leaderboard, thank you for standing with us."
  ],

  impactPillars: [
    {
      icon: "📚",
      title: "Education & Learning",
      description: "Books, learning materials, and foundational schooling support so children can build a brighter future."
    },
    {
      icon: "🍎",
      title: "Daily Nutrition",
      description: "Consistent, wholesome meals and clean water so no child has to learn or grow on an empty stomach."
    },
    {
      icon: "🩺",
      title: "Health & Safe Care",
      description: "Essential healthcare, hygiene supplies, and protective community support for vulnerable children."
    }
  ],

  campaignGoal: {
    enabled: false,
    title: "Current Community Milestone",
    currentDisplay: "Growing Daily",
    percentage: 65
  },

  supportedNetworks: {
    btc: {
      name: "Bitcoin",
      symbol: "BTC",
      badge: "Mainnet · BIP-21",
      networkNotice: "Send only native Bitcoin (BTC) to this address. On-chain confirmations typically take 10–30 minutes."
    },
    bsc: {
      name: "BNB Smart Chain",
      symbol: "BNB / BEP-20",
      badge: "BNB Chain · Chain ID 56",
      networkNotice: "Send native BNB or BEP-20 tokens on BNB Smart Chain (Chain ID: 56). Fast ~3-second confirmations."
    }
  },

  leaderboard: {
    title: "Verified Supporter Leaderboard",
    subtitle: "Real-time, cryptographically verified contributions.",
    emptyStateMessage: "No contributions recorded yet. Be the first supporter to verify!",
    pageSize: 25
  },

  verificationForm: {
    title: "Verify Your Contribution",
    subtitle: "Submit your transaction hash to verify on-chain and appear on the live leaderboard.",
    anonymousToggleLabel: "Stay Anonymous on Public Leaderboard",
    anonymousDefaultText: "Anonymous Supporter"
  },

  volunteerForm: {
    title: "Join as a Volunteer or Share Feedback",
    subtitle: "Want to help on the ground, contribute skills, or send a note to the team? Reach out directly below."
  },

  social: {
    instagram: "https://www.instagram.com/epsteinfoundationforchildren",
    x: "https://x.com/epsteinfnd"
  },

  footerNotice: "Epstein Foundation — For Children. Direct community support with real-time on-chain verification.",
  copyright: "© 2026 Epstein Foundation. For Children.",
  disclaimer: "Cryptocurrency transactions are final and immutable. Please verify the receiving address and network before sending."
};

export default siteConfig;
