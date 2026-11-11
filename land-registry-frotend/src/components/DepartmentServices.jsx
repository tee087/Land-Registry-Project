import { useCallback } from 'react';
import { ArrowRight, FileText } from 'lucide-react';
import {
  DEPARTMENT_SERVICE_LISTS,
  DEPARTMENT_INFO,
  SERVICE_ICONS,
  IMPLEMENTED_SERVICES,
} from './departmentConfig.js';

export default function DepartmentServices({ departmentKey, onServiceSelect, onBack }) {
  const services = DEPARTMENT_SERVICE_LISTS[departmentKey] || [];

  const info = DEPARTMENT_INFO[departmentKey];

  const handleBack = useCallback(() => {
    if (onBack) onBack();
  }, [onBack]);

  const handleServiceClick = useCallback((serviceName) => {
    if (onServiceSelect) onServiceSelect(serviceName);
  }, [onServiceSelect]);

  return (
    <div style={{ maxWidth: '1100px', margin: '2.5rem auto', padding: '0 1rem' }}>
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
              marginBottom: '1rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <ArrowRight size={16} /> Back to departments
          </button>
          <h1 style={{ color: '#fff', fontSize: '2.4rem', fontWeight: '800', margin: '0 0 0.5rem 0', textShadow: '0 2px 10px rgba(0,0,0,0.8)' }}>
            {info?.title}
          </h1>
          <p style={{ color: '#e2e8f0', fontSize: '1.05rem', margin: 0, textShadow: '0 1px 6px rgba(0,0,0,0.8)' }}>
            {info?.description}
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
        {services.length === 0 ? (
          <div style={{ gridColumn: '1 / -1', background: 'rgba(15, 23, 42, 0.85)', border: '1px solid rgba(56, 189, 248, 0.3)', borderRadius: '16px', padding: '2rem', textAlign: 'center' }}>
            <p style={{ color: '#94a3b8', fontSize: '1rem', margin: 0 }}>
              No specific services are listed for this department yet. Please check back soon.
            </p>
          </div>
        ) : (
          services.map((service) => {
            const isImplemented = IMPLEMENTED_SERVICES.has(service);
            const Icon = SERVICE_ICONS[service] || FileText;
            return (
              <div
                key={service}
                onClick={() => handleServiceClick(service)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && handleServiceClick(service)}
                style={{
                  background: 'rgba(15, 23, 42, 0.85)',
                  backdropFilter: 'blur(16px)',
                  border: '1px solid rgba(56, 189, 248, 0.3)',
                  borderRadius: '12px',
                  padding: '1.25rem',
                  cursor: isImplemented ? 'pointer' : 'default',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  boxShadow: isImplemented ? '0 8px 32px rgba(0,0,0,0.4)' : 'none',
                  opacity: isImplemented ? 1 : 0.6,
                }}
              >
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    background: isImplemented ? 'rgba(56, 189, 248, 0.15)' : 'rgba(148, 163, 184, 0.15)',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Icon size={20} color={isImplemented ? '#38bdf8' : '#94a3b8'} />
                </div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#fff', fontWeight: 600 }}>
                  {service}
                </h3>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8', lineHeight: '1.4' }}>
                  {isImplemented ? 'Available — click to apply' : 'Coming soon — not yet implemented'}
                </p>
                {!isImplemented && (
                  <span style={{ fontSize: '0.75rem', color: '#fbbf24', fontWeight: 600, marginTop: '4px' }}>
                    Status: Not yet available
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
