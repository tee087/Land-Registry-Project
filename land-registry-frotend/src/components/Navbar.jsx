import React from 'react';
import { ShieldCheck, Wallet } from 'lucide-react';

export default function Navbar({ activeTab, setActiveTab, account, connectWallet }) {
  return (
    <nav style={{ background: '#0f172a', color: '#fff', padding: '1rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1e293b' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <ShieldCheck color="#38bdf8" size={32} />
        <div>
          <h1 style={{ fontSize: '1.25rem', margin: 0, fontWeight: 'bold' }}>LandRegistryChain</h1>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Secure Blockchain Title Management (Anti-Ardhisasa)</span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '15px', background: '#1e293b', padding: '6px 12px', borderRadius: '8px' }}>
        <button 
          onClick={() => setActiveTab('search')} 
          style={{ background: activeTab === 'search' ? '#38bdf8' : 'transparent', color: activeTab === 'search' ? '#0f172a' : '#cbd5e1', border: 'none', padding: '8px 14px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
          🔍 Title Search
        </button>
        <button 
          onClick={() => setActiveTab('gis')} 
          style={{ background: activeTab === 'gis' ? '#38bdf8' : 'transparent', color: activeTab === 'gis' ? '#0f172a' : '#cbd5e1', border: 'none', padding: '8px 14px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
          🗺️ GIS Map
        </button>
        <button 
          onClick={() => setActiveTab('forensic')} 
          style={{ background: activeTab === 'forensic' ? '#38bdf8' : 'transparent', color: activeTab === 'forensic' ? '#0f172a' : '#cbd5e1', border: 'none', padding: '8px 14px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
          ⚖️ Forensic Audits
        </button>
      </div>

      <div>
        <button 
          onClick={connectWallet}
          style={{ background: account ? '#22c55e' : '#3b82f6', color: '#fff', border: 'none', padding: '10px 18px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Wallet size={18} />
          {account ? `${account.substring(0, 6)}...${account.substring(38)}` : 'Connect Wallet'}
        </button>
      </div>
    </nav>
  );
}