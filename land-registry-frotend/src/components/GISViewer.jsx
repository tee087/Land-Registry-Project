import React, { useState } from 'react';
import { MapPin, Layers, CheckCircle, ShieldAlert, Compass } from 'lucide-react';

export default function GISViewer() {
  const [selectedParcel, setSelectedParcel] = useState('NAIROBI/BLOCK103/45');

  const parcels = {
    'NAIROBI/BLOCK103/45': {
      coordinates: '-1.2683, 36.8111',
      surveyor: 'Licensed Surveyor Reg #402',
      beaconStatus: 'INTACT & VERIFIED',
      area: '0.045 Ha',
      county: 'Nairobi City County',
      block: 'Block 103 (Westlands)',
      isClean: true
    },
    'MOMBASA/BLOCK12/8': {
      coordinates: '-4.0435, 39.6682',
      surveyor: 'Pending Boundary Audit',
      beaconStatus: 'OVERLAPPING BOUNDARY DETECTED',
      area: '0.12 Ha',
      county: 'Mombasa County',
      block: 'Block 12 (Nyali)',
      isClean: false
    }
  };

  const current = parcels[selectedParcel];

  return (
    <div style={{ maxWidth: '1100px', margin: '2rem auto', padding: '0 1rem' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ color: '#f8fafc', margin: 0 }}>GIS Spatial Parcel Map</h2>
        <p style={{ color: '#94a3b8', margin: '4px 0 0 0' }}>Interactive boundary verification mapped to Registry Index Maps (RIM) and blockchain state.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
        <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '12px', height: '420px', position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ position: 'absolute', top: '15px', left: '15px', background: '#1e293b', padding: '6px 12px', borderRadius: '6px', fontSize: '0.85rem', color: '#cbd5e1', border: '1px solid #334155', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Layers size={16} color="#38bdf8" /> Satellite Layer Active
          </div>

          <div style={{ position: 'absolute', top: '15px', right: '15px', background: '#1e293b', padding: '6px 12px', borderRadius: '6px', fontSize: '0.85rem', color: '#cbd5e1', border: '1px solid #334155', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Compass size={16} color="#38bdf8" /> Lat/Lng: {current.coordinates}
          </div>

          <div 
            onClick={() => setSelectedParcel(selectedParcel === 'NAIROBI/BLOCK103/45' ? 'MOMBASA/BLOCK12/8' : 'NAIROBI/BLOCK103/45')}
            style={{ 
              width: '260px', 
              height: '180px', 
              border: current.isClean ? '3px dashed #22c55e' : '3px dashed #ef4444', 
              background: current.isClean ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)', 
              borderRadius: '8px', 
              display: 'flex', 
              flexDirection: 'column', 
              justifyContent: 'center', 
              alignItems: 'center', 
              cursor: 'pointer',
              transition: 'all 0.3s ease'
            }}
          >
            <MapPin size={36} color={current.isClean ? '#22c55e' : '#ef4444'} />
            <span style={{ fontWeight: 'bold', color: '#fff', marginTop: '8px' }}>{selectedParcel}</span>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Click to toggle parcel view</span>
          </div>

          <div style={{ position: 'absolute', bottom: '15px', color: '#64748b', fontSize: '0.8rem' }}>
            Geospatial beacons linked to Smart Contract Hash #0x7a...8b9
          </div>
        </div>

        <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '1.25rem' }}>
          <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', color: '#38bdf8' }}>Parcel Spatial Data</h3>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '4px' }}>Select Parcel</label>
            <select 
              value={selectedParcel} 
              onChange={(e) => setSelectedParcel(e.target.value)}
              style={{ width: '100%', padding: '10px', borderRadius: '6px', background: '#0f172a', border: '1px solid #334155', color: '#fff', fontWeight: 'bold' }}
            >
              <option value="NAIROBI/BLOCK103/45">NAIROBI/BLOCK103/45 (Clean)</option>
              <option value="MOMBASA/BLOCK12/8">MOMBASA/BLOCK12/8 (Boundary Dispute)</option>
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', fontSize: '0.9rem' }}>
            <div>
              <span style={{ color: '#94a3b8', display: 'block', fontSize: '0.75rem' }}>County & Block</span>
              <strong>{current.county} — {current.block}</strong>
            </div>

            <div>
              <span style={{ color: '#94a3b8', display: 'block', fontSize: '0.75rem' }}>Acreage Area</span>
              <strong>{current.area}</strong>
            </div>

            <div>
              <span style={{ color: '#94a3b8', display: 'block', fontSize: '0.75rem' }}>Licensed Surveyor</span>
              <strong>{current.surveyor}</strong>
            </div>

            <div style={{ background: '#0f172a', padding: '10px', borderRadius: '6px', border: '1px solid #334155' }}>
              <span style={{ color: '#94a3b8', display: 'block', fontSize: '0.75rem' }}>GPS Beacon Verification</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px', color: current.isClean ? '#4ade80' : '#f87171', fontWeight: 'bold' }}>
                {current.isClean ? <CheckCircle size={16} /> : <ShieldAlert size={16} />}
                {current.beaconStatus}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}