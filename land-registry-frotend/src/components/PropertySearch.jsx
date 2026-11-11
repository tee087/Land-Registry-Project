import React, { useState } from 'react';
import { Search, CheckCircle, AlertOctagon, FileText, Lock, ShieldAlert } from 'lucide-react';

export default function PropertySearch() {
  const [parcelId, setParcelId] = useState('');
  const [searchResult, setSearchResult] = useState(null);

  // Mock data representing a verified Kenyan title registered on the blockchain
  const mockProperties = {
    'NAIROBI/BLOCK103/45': {
      parcelId: 'NAIROBI/BLOCK103/45',
      owner: '0x71C...39A2',
      ownerName: 'Wanjiku Mukami',
      location: 'Westlands, Nairobi',
      size: '0.045 Ha',
      status: 'VERIFIED',
      isDisputed: false,
      ipfsHash: 'QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco',
      registrationDate: '2024-03-15',
      history: [
        { date: '2024-03-15', event: 'Title Converted & Registered on Chain', txHash: '0xabc...123' },
        { date: '2021-08-10', event: 'Transfer from Juma Omondi', txHash: '0xdef...456' }
      ]
    },
    'MOMBASA/BLOCK12/8': {
      parcelId: 'MOMBASA/BLOCK12/8',
      owner: '0x89A...11F4',
      ownerName: 'Hassan Ali',
      location: 'Nyali, Mombasa',
      size: '0.12 Ha',
      status: 'FROZEN / DISPUTED',
      isDisputed: true,
      ipfsHash: 'QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG',
      registrationDate: '2022-01-20',
      history: [
        { date: '2025-06-11', event: 'Forensic Caution Placed by Registrar', txHash: '0x999...111' },
        { date: '2022-01-20', event: 'Title Registered', txHash: '0x777...888' }
      ]
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    const query = parcelId.trim().toUpperCase();
    if (mockProperties[query]) {
      setSearchResult(mockProperties[query]);
    } else {
      setSearchResult({ error: 'Property record not found on ledger.' });
    }
  };

  return (
    <div style={{ maxWidth: '900px', margin: '2rem auto', padding: '0 1rem' }}>
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <h2 style={{ color: '#f8fafc', fontSize: '1.8rem' }}>Cryptographic Title Verification</h2>
        <p style={{ color: '#94a3b8' }}>Search any Kenyan Parcel ID to verify ownership authenticity on the blockchain ledger.</p>
      </div>

      <form onSubmit={handleSearch} style={{ display: 'flex', gap: '10px', marginBottom: '2rem' }}>
        <input 
          type="text" 
          placeholder="e.g. NAIROBI/BLOCK103/45 or MOMBASA/BLOCK12/8" 
          value={parcelId} 
          onChange={(e) => setParcelId(e.target.value)}
          style={{ flex: 1, padding: '14px', borderRadius: '8px', border: '1px solid #334155', background: '#0f172a', color: '#fff', fontSize: '1rem' }}
        />
        <button type="submit" style={{ background: '#38bdf8', color: '#0f172a', border: 'none', padding: '0 24px', borderRadius: '8px', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Search size={20} /> Verify
        </button>
      </form>

      {searchResult && (
        searchResult.error ? (
          <div style={{ background: '#450a0a', border: '1px solid #ef4444', color: '#fca5a5', padding: '1rem', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertOctagon size={24} />
            <span>{searchResult.error}</span>
          </div>
        ) : (
          <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '1.5rem', color: '#fff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #334155', pb: '1rem', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.4rem', color: '#38bdf8' }}>{searchResult.parcelId}</h3>
                <span style={{ color: '#94a3b8', fontSize: '0.9rem' }}>{searchResult.location}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: searchResult.isDisputed ? '#7f1d1d' : '#064e3b', color: searchResult.isDisputed ? '#fca5a5' : '#6ee7b7', padding: '6px 12px', borderRadius: '20px', fontWeight: 'bold' }}>
                {searchResult.isDisputed ? <ShieldAlert size={18} /> : <CheckCircle size={18} />}
                {searchResult.status}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
              <div>
                <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: '0 0 4px 0' }}>Registered Owner</p>
                <p style={{ margin: 0, fontWeight: 'bold' }}>{searchResult.ownerName} ({searchResult.owner})</p>
              </div>
              <div>
                <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: '0 0 4px 0' }}>Parcel Size</p>
                <p style={{ margin: 0, fontWeight: 'bold' }}>{searchResult.size}</p>
              </div>
              <div>
                <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: '0 0 4px 0' }}>IPFS Title Document Hash</p>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#38bdf8', fontFamily: 'monospace' }}>
                  <FileText size={14} style={{ display: 'inline', marginRight: '4px' }} />
                  {searchResult.ipfsHash}
                </p>
              </div>
              <div>
                <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: '0 0 4px 0' }}>Registration Date</p>
                <p style={{ margin: 0, fontWeight: 'bold' }}>{searchResult.registrationDate}</p>
              </div>
            </div>

            <div style={{ borderTop: '1px solid #334155', pt: '1rem', marginTop: '1rem' }}>
              <h4 style={{ margin: '0 0 10px 0', color: '#cbd5e1' }}>Blockchain Chain of Ownership</h4>
              {searchResult.history.map((item, index) => (
                <div key={index} style={{ background: '#0f172a', padding: '10px 14px', borderRadius: '6px', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                  <span>{item.date} — {item.event}</span>
                  <span style={{ color: '#64748b', fontFamily: 'monospace' }}>Tx: {item.txHash}</span>
                </div>
              ))}
            </div>
          </div>
        )
      )}
    </div>
  );
}