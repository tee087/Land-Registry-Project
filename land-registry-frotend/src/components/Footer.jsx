import { useCallback } from 'react';
import { SOCIAL_LINKS, USEFUL_LINKS } from './footerConfig.js';

const FOOTER_BG = '#80501F';
const FOOTER_BOTTOM_BG = '#5E3C16';
const TEXT_COLOR = '#FFFFFF';
const MUTED_COLOR = '#E8DCC8';

// Inline SVG icons for platforms not available in lucide-react
const SvgIcons = {
  x: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M18.9 1.2h3.7l-8.1 9.3L24 22.8h-7.4l-5.8-7.6-6.6 7.6H.5l8.7-10L.2 1.2h7.6l5.2 6.9zm-1.3 19.5h2.1L6.7 3.2H4.4z" fill="currentColor" />
    </svg>
  ),
  youtube: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M20.443 2.457c-1.086-.36-2.252-.547-3.46-.547-10.165 0-18.435 8.27-18.435 18.435 0 1.537.194 3.045.547 4.514A18.4 18.4 0 0 1 2.457 19.97c-.359 1.087-.547 2.252-.547 3.46 0 1.21.193 2.375.547 3.46.354 1.086.922 2.129 1.598 3.011C4.85 26.523 6.015 27 7.227 27c1.212 0 2.376-.193 3.459-.547 1.467-.491 2.844-1.194 4.106-2.023A18.4 18.4 0 0 0 17.543 24c1.208 0 2.373-.193 3.46-.547 1.087-.36 2.252-.547 3.46-.547 1.087 0 2.252.187 3.46.547 1.086-.359 2.25-.547 3.46-.547 1.087 0 2.252.187 3.46.547 1.086-.359 2.25-.547 3.46-.547 1.087 0 2.252.187 3.46.547 1.086-.359 2.25-.547 3.46-.547 1.087 0 2.252.187 3.46.547 1.087-.36 2.252-.547 3.46-.547 1.208 0 2.372-.193 3.459-.547 1.087-.36 2.25-.547 3.46-.547h.001c1.087-.36 2.252-.547 3.46-.547 1.086-.36 2.25-.547 3.459-.547 1.087-.36 2.252-.547 3.46-.547 1.087-.36 2.252-.547 3.46-.547 1.087-.36 2.25-.547 3.459-.547 1.086-.36 2.25-.547 3.46-.547V4.345c0-1.087-.187-2.252-.547-3.46-.36-1.087-.547-2.252-.547-3.46 0-1.086-.187-2.251-.547-3.459-.36-1.086-.547-2.25-.547-3.46z" fill="currentColor" />
      <path d="M11.475 15.051V8.949l5.222 3.051z" fill="currentColor" />
      <rect x="1" y="4" width="22" height="16" rx="5" fill="currentColor" />
      <path d="M10 8v8l7-4-7-4Z" fill="white" />
    </svg>
  ),
  facebook: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M13.5 21v-8h2.7l.4-3h-3.1V8.1c0-.9.3-1.5 1.6-1.5h1.7V3.9c-.3 0-1.3-.1-2.5-.1-2.5 0-4.2 1.5-4.2 4.3V10H7.3v3h2.8v8h3.4Z" fill="currentColor" />
    </svg>
  ),
  tiktok: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12.5 2h3.1c.2 2.2 1.4 3.5 3.4 3.7v3.2c-1.2 0-2.4-.4-3.4-1.1v6.7a6 6 0 1 1-6-6h.8v3.3a2.7 2.7 0 1 0 2.1 2.7V2Z" fill="currentColor" />
    </svg>
  ),
};

export default function Footer({ onNavigate }) {
  const handleLink = useCallback((tab) => {
    if (onNavigate) onNavigate(tab);
  }, [onNavigate]);

  return (
    <>
      {/* Main footer */}
      <footer
        style={{
          background: FOOTER_BG,
          color: TEXT_COLOR,
          fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif',
          padding: '48px 24px 32px 24px',
        }}
      >
        <div
          className="lrc-footer-grid"
          style={{
            maxWidth: '1200px',
            margin: '0 auto',
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '40px',
            alignItems: 'start',
          }}
        >
          {/* Section 1 – Contacts */}
          <div>
            <h2
              style={{
                margin: '0 0 24px 0',
                fontSize: '1.25rem',
                fontWeight: 600,
                color: TEXT_COLOR,
                letterSpacing: '0.2px',
              }}
            >
              Contacts
            </h2>

            <div style={{ marginBottom: '20px' }}>
              <p
                style={{
                  margin: '0 0 6px 0',
                  fontSize: '0.9rem',
                  color: MUTED_COLOR,
                  fontWeight: 600,
                }}
              >
                Working Days/Hours
              </p>
              <p style={{ margin: 0, fontSize: '0.9rem', color: TEXT_COLOR }}>
                Mon - Fri / 8:00 AM - 5:00 PM
              </p>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <p
                style={{
                  margin: '0 0 6px 0',
                  fontSize: '0.9rem',
                  color: MUTED_COLOR,
                  fontWeight: 600,
                }}
              >
                Address
              </p>
              <p style={{ margin: 0, fontSize: '0.9rem', color: TEXT_COLOR }}>
                LandRegistryChain project support
              </p>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <p
                style={{
                  margin: '0 0 6px 0',
                  fontSize: '0.9rem',
                  color: MUTED_COLOR,
                  fontWeight: 600,
                }}
              >
                Email
              </p>
              <a href="mailto:watchoverlandregistry@yahoo.com" style={{ fontSize: '0.9rem', color: TEXT_COLOR }}>watchoverlandregistry@yahoo.com</a>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <p
                style={{
                  margin: '0 0 8px 0',
                  fontSize: '0.9rem',
                  color: MUTED_COLOR,
                  fontWeight: 600,
                }}
              >
                Media contact:
              </p>
              <a href="tel:+254705322372" style={{ fontSize: '0.9rem', color: TEXT_COLOR }}>+254 705 322 372</a>
            </div>

          </div>

          {/* Section 2 – Quick Links */}
          <div>
            <h2
              style={{
                margin: '0 0 20px 0',
                fontSize: '1.25rem',
                fontWeight: 600,
                color: TEXT_COLOR,
                letterSpacing: '0.2px',
              }}
            >
              Quick Links
            </h2>

            <nav
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
              }}
            >
              {[
                { label: 'About Us', tab: 'about' },
                { label: 'Services', tab: 'services' },
                { label: 'FAQs', tab: 'services' },
                { label: 'Terms & Conditions', tab: 'about' },
              ].map((link) => (
                <button
                  key={link.tab}
                  type="button"
                  onClick={() => handleLink(link.tab)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: TEXT_COLOR,
                    cursor: 'pointer',
                    fontSize: '0.95rem',
                    fontWeight: 500,
                    textAlign: 'left',
                    padding: 0,
                    textDecoration: 'none',
                    transition: 'color 0.2s ease',
                  }}
                >
                  {link.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Section 3 – Useful Links */}
          <div>
            <h2
              style={{
                margin: '0 0 20px 0',
                fontSize: '1.25rem',
                fontWeight: 600,
                color: TEXT_COLOR,
                letterSpacing: '0.2px',
              }}
            >
              Useful Links
            </h2>

            <nav
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
              }}
            >
              {USEFUL_LINKS.map((link) => (
                <a
                  key={link.label}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Visit ${link.label}`}
                  style={{
                    color: TEXT_COLOR,
                    textDecoration: 'none',
                    fontSize: '0.95rem',
                    fontWeight: 500,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    transition: 'color 0.2s ease',
                  }}
                >
                  <span style={{ flexShrink: 1 }}>{link.label}</span>
                </a>
              ))}
            </nav>
          </div>

          {/* Section 4 – Our Social Links */}
          <div>
            <h2
              style={{
                margin: '0 0 20px 0',
                fontSize: '1.25rem',
                fontWeight: 600,
                color: TEXT_COLOR,
                letterSpacing: '0.2px',
              }}
            >
              Our Social Links
            </h2>

            <nav
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
              }}
            >
              {SOCIAL_LINKS.map((social) => {
                const Icon = SvgIcons[social.id];
                return (
                  <a
                    key={social.id}
                    href={social.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={social.ariaLabel}
                    style={{
                      color: TEXT_COLOR,
                      textDecoration: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      transition: 'opacity 0.2s ease',
                    }}
                  >
                    <div
                      style={{
                        width: '32px',
                        height: '32px',
                        background: social.logoBg,
                        borderRadius: '6px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        boxShadow:
                          social.logoBg === '#FFFFFF'
                            ? '0 1px 3px rgba(0,0,0,0.25)'
                            : '0 1px 3px rgba(0,0,0,0.45)',
                      }}
                    >
                      <Icon />
                    </div>
                    <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>
                      {social.label}
                    </span>
                  </a>
                );
              })}
            </nav>
          </div>
        </div>
      </footer>

      {/* Copyright bar */}
      <div
        style={{
          background: FOOTER_BOTTOM_BG,
          color: TEXT_COLOR,
          fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif',
          padding: '16px 24px',
          textAlign: 'center',
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: '0.85rem',
            fontWeight: 400,
            color: TEXT_COLOR,
            letterSpacing: '0.2px',
          }}
        >
          © 2026 LandRegistryChain. All rights reserved.
        </p>
      </div>
    </>
  );
}
