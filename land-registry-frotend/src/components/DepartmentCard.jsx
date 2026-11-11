import { useCallback } from 'react';
import { DEPARTMENT_ICONS } from './departmentConfig.js';

export default function DepartmentCard({ department, onSelect }) {
  const Icon = DEPARTMENT_ICONS[department.key];

  const handleClick = useCallback(() => {
    if (onSelect) onSelect(department.key);
  }, [onSelect, department.key]);

  return (
    <div
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && handleClick()}
      style={{
        background: 'rgba(15, 23, 42, 0.85)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(56, 189, 248, 0.3)',
        borderRadius: '16px',
        padding: '1.75rem',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        textAlign: 'left',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      }}
    >
      <div
        style={{
          width: '44px',
          height: '44px',
          background: 'rgba(56, 189, 248, 0.15)',
          borderRadius: '10px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Icon size={22} color="#38bdf8" />
      </div>
      <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#fff', fontWeight: 600, letterSpacing: '0.2px' }}>
        {department.title}
      </h3>
      <p style={{ margin: 0, fontSize: '0.9rem', color: '#94a3b8', lineHeight: '1.5' }}>
        {department.description}
      </p>
    </div>
  );
}
