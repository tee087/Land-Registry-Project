import React, { useState } from 'react';
import { ShieldAlert, Lock, Unlock } from 'lucide-react';

export default function ForensicDashboard() {
  const [properties, setProperties] = useState([
    { id: 'MOMBASA/BLOCK12/8', riskScore: 'HIGH (88%)', reason: 'Multiple ownership transfers within 24hrs', frozen: true, lastAudit: '2026-10-28' },
    { id: 'KIAMBU/RUIRU/502', riskScore: 'MEDIUM (42%)', reason: 'Survey boundary overlap with public road reserve', frozen: false, lastAudit: '2026-10-25' },
    { id: 'NAIROBI/BLOCK103/45', riskScore: 'LOW (0%)', reason: 'Clean historical chain of custody', frozen: false, lastAudit: '2026-10-20' }
  ]);

  const toggleFreeze = (id) => {
    setProperties(properties.map(p => {
      if (p.id === id) {
        return { ...p, frozen: !p.frozen };
      }
      return p;
    }));
  };

  return (
    <div style={{ maxWidth: '1100px', margin: '2rem auto', padding: '0 1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ color: '#f8fafc', margin: 0 }}>Forensic Title Investigation Engine</h2>
          <p style={{ color: '#94a3b8', margin: '4px 0 0 0' }}>Automated anomaly detection, double-allocation flags, and emergency land freezing.</p>
        </div>
        <div style={{ background: '#7f1d1d', color: '#fca5a5', padding: '8px 16px', borderRadius: '8px', border: '1px solid #ef4444', fontWeight: 'bold', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ShieldAlert size={18} /> Registrar Access Mode
        </div>
      </div>

      <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', color: '#fff' }}>
          <thead>
            <tr style={{ background: '#0f172a', borderBottom: '1px solid #334155', color: '#94a3b8', fontSize: '0.85rem' }}>
              <th style={{ padding: '14px 16px' }}>PARCEL ID</th>
              <th style={{ padding: '14px 16px' }}>RISK SCORE</th>
              <th style={{ padding: '14px 16px' }}>ANOMALY / REASON DETECTED</th>
              <th style={{ padding: '14px 16px' }}>LAST AUDIT</th>
              <th style={{ padding: '14px 16px' }}>STATUS</th>
              <th style={{ padding: '14px 16px', textAlign: 'right' }}>ACTION</th>
            </tr>
          </thead>
          <tbody>
            {properties.map((item, idx) => (
              <tr key={idx} style={{ borderBottom: '1px solid #334155', fontSize: '0.9rem' }}>
                <td style={{ padding: '14px 16px', fontWeight: 'bold', color: '#38bdf8' }}>{item.id}</td>
                <td style={{ padding: '14px 16px' }}>
                  <span style={{ 
                    padding: '4px 10px', 
                    borderRadius: '12px', 
                    fontSize: '0.75rem', 
                    fontWeight: 'bold',
                    background: item.riskScore.includes('HIGH') ? '#7f1d1d' : item.riskScore.includes('MEDIUM') ? '#713f12' : '#064e3b',
                    color: item.riskScore.includes('HIGH') ? '#fca5a5' : item.riskScore.includes('MEDIUM') ? '#fde047' : '#6ee7b7'
                  }}>
                    {item.riskScore}
                  </span>
                </td>
                <td style={{ padding: '14px 16px', color: '#cbd5e1' }}>{item.reason}</td>
                <td style={{ padding: '14px 16px', color: '#94a3b8', fontSize: '0.85rem' }}>{item.lastAudit}</td>
                <td style={{ padding: '14px 16px' }}>
                  {item.frozen ? (
                    <span style={{ color: '#ef4444', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Lock size={14} /> FROZEN
                    </span>
                  ) : (
                    <span style={{ color: '#22c55e', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Unlock size={14} /> ACTIVE
                    </span>
                  )}
                </td>
                <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                  <button 
                    onClick={() => toggleFreeze(item.id)}
                    style={{ 
                      background: item.frozen ? '#22c55e' : '#ef4444', 
                      color: '#fff', 
                      border: 'none', 
                      padding: '6px 14px', 
                      borderRadius: '6px', 
                      cursor: 'pointer', 
                      fontWeight: 'bold',
                      fontSize: '0.8rem'
                    }}
                  >
                    {item.frozen ? 'Unfreeze Title' : 'Freeze Property'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}