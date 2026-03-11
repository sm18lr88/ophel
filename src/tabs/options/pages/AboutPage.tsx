/**
 * About page.
 * Displays extension information, version details, and links.
 */
import React from "react"

import {
  AboutIcon,
  BrainIcon,
  ChromeIcon,
  FirefoxIcon,
  GithubIcon,
  GlobeIcon,
  GreasyForkIcon,
  HeartIcon,
  ShieldCheckIcon,
  StarIcon,
} from "~components/icons"
import { APP_DISPLAY_NAME, APP_ICON_URL, APP_VERSION } from "~utils/config"
import { t } from "~utils/i18n"

import { PageTitle } from "../components"

const AboutPage: React.FC = () => {
  return (
    <div>
      <PageTitle title={t("navAbout") || "About"} Icon={AboutIcon} />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          marginBottom: 24,
        }}>
        <BrainIcon size={18} />
        <div className="about-slogan">
          {t("aboutPageDesc") || "Make AI workflows easier to use"}
        </div>
        <BrainIcon size={18} />
      </div>

      {/* Hero Card */}
      <div className="about-hero-card">
        <img
          src={APP_ICON_URL}
          alt={APP_DISPLAY_NAME}
          className="about-hero-logo"
          onError={(e) => {
            ;(e.target as HTMLImageElement).style.display = "none"
          }}
        />
        <div className="about-hero-content">
          <div className="about-hero-title">
            {APP_DISPLAY_NAME}
            <span className="about-hero-version">v{APP_VERSION}</span>
          </div>
          <div className="about-hero-desc">
            {t("aboutDescription", { appName: APP_DISPLAY_NAME }) ||
              `${APP_DISPLAY_NAME} is a browser enhancement for Gemini, ChatGPT, Claude, AI Studio, Grok, and other AI platforms. It adds structured navigation, organization tools, automation features, and import/export utilities.`}
          </div>
        </div>
      </div>

      <div className="about-section-title">{t("rateAndReview") || "Rate and Review"}</div>
      <div
        className="about-links-grid"
        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
        {/* Chrome Store */}
        <a
          href="https://chromewebstore.google.com/detail/ophel-ai-chat-enhancer/lpcohdfbomkgepfladogodgeoppclakd"
          target="_blank"
          rel="noopener noreferrer"
          className="about-link-card">
          <div className="about-link-header">
            <ChromeIcon size={24} color="#4285F4" />
            {t("chromeStore") || "Chrome Web Store"}
          </div>
          <button className="about-link-btn" style={{ marginTop: "auto" }}>
            Review
          </button>
        </a>

        {/* Firefox Add-on */}
        <a
          href="https://addons.mozilla.org/firefox/addon/ophel-ai-chat-enhancer/"
          target="_blank"
          rel="noopener noreferrer"
          className="about-link-card">
          <div className="about-link-header">
            <FirefoxIcon size={24} color="#FF7139" />
            {t("firefoxAddons") || "Firefox Add-ons"}
          </div>
          <button className="about-link-btn" style={{ marginTop: "auto", background: "#FF7139" }}>
            Review
          </button>
        </a>

        {/* GreasyFork */}
        <a
          href="https://greasyfork.org/scripts/563646-ophel-ai-chat-page-enhancer"
          target="_blank"
          rel="noopener noreferrer"
          className="about-link-card">
          <div className="about-link-header">
            <GreasyForkIcon size={24} color="#000000" />
            {t("greasyFork") || "Greasy Fork"}
          </div>
          <button className="about-link-btn" style={{ marginTop: "auto", background: "#333" }}>
            Review
          </button>
        </a>
      </div>

      <div className="about-section-title">
        {t("communityAndSupport") || "Community and Support"}
      </div>
      <div
        style={{
          fontSize: "13px",
          color: "var(--gh-text-secondary)",
          marginBottom: 16,
          fontStyle: "italic",
        }}>
        "{t("communityMotto")}"
      </div>

      <div className="about-links-grid">
        {/* GitHub Link */}
        <a
          href="https://github.com/sm18lr88/ophel"
          target="_blank"
          rel="noopener noreferrer"
          className="about-link-card">
          <div className="about-link-header">
            <GithubIcon size={20} />
            GitHub Repository
          </div>
          <div className="about-link-desc">
            {t("githubDesc") || "Browse the source, report issues, or contribute to development"}
          </div>
          <button className="about-link-btn about-star-btn">
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <StarIcon size={14} />
              {t("giveStar") || "Leave a Star"}
            </span>
          </button>
        </a>

        <a
          href="https://github.com/sm18lr88/ophel"
          target="_blank"
          rel="noopener noreferrer"
          className="about-link-card">
          <div className="about-link-header">
            <GlobeIcon size={20} />
            {t("projectWebsite") || "Project Website"}
          </div>
          <div className="about-link-desc">
            {t("websiteDesc") || "Read the docs, setup guides, and project details"}
          </div>
          <button className="about-link-btn">{t("visitWebsite") || "Visit Website"}</button>
        </a>
      </div>

      <div className="about-section-title">{t("techStack") || "Tech Stack"}</div>

      <div className="about-tech-grid">
        <TechCard
          name="Plasmo"
          version="v0.89.0"
          desc={t("tsPlasmoDesc") || "Browser Extension Framework"}
        />
        <TechCard
          name="React"
          version="v18.2.0"
          desc={t("tsReactDesc") || "User Interface Library"}
        />
        <TechCard
          name="TypeScript"
          version="v5.3.3"
          desc={t("tsTypescriptDesc") || "Typed JavaScript"}
        />
        <TechCard name="Zustand" version="v5.0.3" desc={t("tsZustandDesc") || "State Management"} />
        <TechCard name="Vite" version="v5.0.0" desc={t("tsViteDesc") || "Frontend Tooling"} />
      </div>

      <div className="about-section-title">{t("credits") || "Credits"}</div>

      <div className="about-simple-card">
        <div className="about-simple-header">
          <HeartIcon size={18} style={{ color: "#ef4444" }} />
          {t("devAndMaintain") || "Development and Maintenance"}
        </div>
        <p
          style={{
            fontSize: "13px",
            color: "var(--gh-text-secondary)",
            lineHeight: 1.6,
            marginBottom: 16,
          }}>
          {t("creditsDesc") ||
            "Thanks to the open source projects and contributors that made this extension possible."}
        </p>
        <div style={{ display: "flex", gap: 8 }}>
          <Badge text={`Made with ❤️`} />
          <Badge text="Open Source" />
          <Badge text="Privacy First" />
        </div>
        <div style={{ marginTop: 16, fontSize: "12px", color: "var(--gh-text-secondary)" }}>
          GNU GPLv3 © {new Date().getFullYear()} {APP_DISPLAY_NAME}
        </div>
      </div>

      {/* Privacy Banner */}
      <div className="about-privacy-banner">
        <ShieldCheckIcon size={24} className="about-privacy-icon" />
        <div>
          <div className="about-privacy-title">{t("privacyTitle") || "Privacy"}</div>
          <div className="about-privacy-desc">
            {t("privacyText") ||
              "All extension data is stored locally in your browser unless you explicitly configure your own sync target."}
          </div>
        </div>
      </div>
    </div>
  )
}

const TechCard = ({ name, version, desc }: { name: string; version: string; desc: string }) => (
  <div className="about-tech-card">
    <div className="about-tech-header">
      <div className="about-tech-name">{name}</div>
      <div className="about-tech-version">{version}</div>
    </div>
    <div className="about-tech-desc">{desc}</div>
  </div>
)

const Badge = ({ text }: { text: string }) => (
  <span
    style={{
      display: "inline-flex",
      alignItems: "center",
      padding: "2px 8px",
      background: "var(--gh-bg-secondary)",
      border: "1px solid var(--gh-border)",
      borderRadius: "12px",
      fontSize: "12px",
      color: "var(--gh-text-secondary)",
    }}>
    {text}
  </span>
)

export default AboutPage
