import { useCallback } from 'react';
import { ArrowRight, FileText } from 'lucide-react';
import {
  SERVICE_ICONS,
  SERVICE_DESCRIPTIONS,
  SERVICE_REQUIREMENTS,
  SERVICE_PROCESS,
  IMPLEMENTED_SERVICES,
} from './departmentConfig.js';

export default function ServiceDetail({ serviceName, departmentKey, onBack }) {
  const Icon = SERVICE_ICONS[serviceName] || FileText;
  const isImplemented = IMPLEMENTED_SERVICES.has(serviceName);
  const description = SERVICE_DESCRIPTIONS[serviceName] || 'No description available.';
  const requirements = SERVICE_REQUIREMENTS[serviceName] || [];
  const process = SERVICE_PROCESS[serviceName] || [];

  const handleBack = useCallback(() => {
    if (onBack) onBack();
  }, [onBack]);

  return (
    <div style={{ maxWidth: '900px', margin: '2.5rem auto', padding: '0 1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <button
            onClick={handleBack}
            style={{
              background: 'transparent',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              color: '#38bdf8',
              padding: '8px 16px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '0.9rem',
              fontWeight: 500,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <ArrowRight size={16} /> Back to services
          </button>
          <h1 style={{ color: '#fff', fontSize: '2.2rem', fontWeight: '800', margin: '0.5rem 0 0.5rem 0', textShadow: '0 2px 10px rgba(0,0,0,0.8)' }}>
            {serviceName}
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1rem' }}>
            <div
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                background: isImplemented ? '#22c55e' : '#fbbf24',
                boxShadow: isImplemented ? '0 0 10px rgba(34, 197, 94, 0.6)' : '0 0 10px rgba(251, 191, 36, 0.6)',
              }}
            />
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: isImplemented ? '#4ade80' : '#fbbf24' }}>
              {isImplemented ? 'Available' : 'Coming Soon'}
            </span>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '2rem' }}>
        <div>
          <div style={{ background: 'rgba(15, 23, 42, 0.85)', border: '1px solid rgba(56, 189, 248, 0.3)', borderRadius: '16px', padding: '1.5rem', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1rem' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  background: 'rgba(56, 189, 248, 0.15)',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Icon size={20} color="#38bdf8" />
              </div>
              <div>
                <h2 style={{ margin: 0, color: '#fff', fontSize: '1.25rem', fontWeight: 600 }}>{serviceName}</h2>
                <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.85rem' }}>Land Service · {departmentKey.charAt(0).toUpperCase() + departmentKey.slice(1)} Department</p>
              </div>
            </div>
            <p style={{ color: '#e2e8f0', fontSize: '1rem', lineHeight: '1.7', margin: 0 }}>
              {description}
            </p>
          </div>

          {requirements.length > 0 && (
            <div style={{ background: 'rgba(15, 23, 42, 0.85)', border: '1px solid rgba(56, 189, 248, 0.3)', borderRadius: '16px', padding: '1.5rem', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: '0 0 1rem 0', color: '#38bdf8', fontSize: '1.15rem', fontWeight: 600 }}>Requirements</h3>
              <ul style={{ margin: 0, paddingLeft: '1.2rem', color: '#cbd5e1', fontSize: '0.95rem', lineHeight: '1.8' }}>
                {requirements.map((req, i) => (
                  <li key={i} style={{ marginBottom: '0.5rem' }}>{req}</li>
                ))}
              </ul>
            </div>
          )}

          {process.length > 0 && (
            <div style={{ background: 'rgba(15, 23, 42, 0.85)', border: '1px solid rgba(56, 189, 248, 0.3)', borderRadius: '16px', padding: '1.5rem' }}>
              <h3 style={{ margin: '0 0 1rem 0', color: '#38bdf8', fontSize: '1.15rem', fontWeight: 600 }}>Application Process</h3>
              <ol style={{ margin: 0, paddingLeft: '1.2rem', color: '#cbd5e1', fontSize: '0.95rem', lineHeight: '1.8' }}>
                {process.map((step, i) => (
                  <li key={i} style={{ marginBottom: '0.75rem' }}>{step}</li>
                ))}
              </ol>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div
            style={{
              background: 'rgba(15, 23, 42, 0.85)',
              border: isImplemented ? '1px solid rgba(56, 189, 248, 0.5)' : '1px dashed rgba(148, 163, 184, 0.2)',
              borderRadius: '12px',
              padding: '1.5rem',
              textAlign: 'center',
            }}
          >
            {isImplemented ? (
              <>
                <h3 style={{ margin: '0 0 1rem 0', color: '#fff', fontSize: '1.1rem', fontWeight: 600 }}>Apply Now</h3>
                <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '1rem', lineHeight: '1.5' }}>
                  Click below to start your application. You will need to sign in to submit.
                </p>
                <button
                  style={{
                    background: '#38bdf8',
                    color: '#0f172a',
                    border: 'none',
                    padding: '12px 24px',
                    borderRadius: '8px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    width: '100%',
                    fontSize: '0.95rem',
                  }}
                >
                  Start Application
                </button>
                <p style={{ marginTop: '1rem', color: '#94a3b8', fontSize: '0.8rem' }}>
                  Requires sign-in. Public browsing is available without authentication.
                </p>
              </>
            ) : (
              <>
                <h3 style={{ margin: '0 0 1rem 0', color: '#fbbf24', fontSize: '1.1rem', fontWeight: 600 }}>Not Yet Available</h3>
                <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: 0, lineHeight: '1.5' }}>
                  This service is planned but not yet implemented. Please check back later.
                </p>
              </>
            )}
          </div>

          {isImplemented && (
            <div style={{ background: 'rgba(2, 6, 23, 0.7)', border: '1px solid rgba(56, 189, 248, 0.2)', borderRadius: '12px', padding: '1.5rem', marginTop: '0.5rem' }}>
              <h3 style={{ margin: '0 0 1rem 0', color: '#38bdf8', fontSize: '1rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Blockchain Secured</h3>
              <p style={{ color: '#cbd5e1', fontSize: '0.8rem', lineHeight: '1.6', margin: 0 }}>
                Approved applications are anchored to an Ethereum-compatible smart contract for tamper-evident verification.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
