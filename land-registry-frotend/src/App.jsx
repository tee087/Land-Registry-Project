import { useState, useEffect, useCallback } from 'react';
import { ShieldCheck, Search, CheckCircle, AlertOctagon, FileText, ShieldAlert, MapPin, Layers, Compass, Lock, Unlock, KeyRound, FileCheck, ArrowRight, Shield, LogOut, UserCircle, Bell, Link2, Home, Landmark, MapPinned, Info, WalletCards, LayoutDashboard, FileSearch } from 'lucide-react';
import { useAuth } from './context/useAuth.js';
import { api } from './api/client.js';
import AuthModal from './components/AuthModal.jsx';
import Dashboard from './components/dashboard/Dashboard.jsx';
import NotificationsPanel from './components/NotificationsPanel.jsx';
import Footer from './components/Footer.jsx';
import DepartmentServices from './components/DepartmentServices.jsx';
import ServiceDetail from './components/ServiceDetail.jsx';
import { Notice } from './components/ui.jsx';
import AccountModeApprovalPage from './components/AccountModeApprovalPage.jsx';

function accountModeLabel(user) {
  if (user?.role !== 'landowner') {
    return ({ registrar: 'Registry reviewer', administrator: 'Administrator', investigator: 'Investigator', auditor: 'Auditor' }[user?.role] || 'Registry staff');
  }
  return ({ buyer: 'Buyer', seller: 'Seller', buyer_seller: 'Buyer + seller' }[user?.accountType] || 'Property account');
}

export default function App() {
  const [requestedTab, setRequestedTab] = useState('home');
  const [selectedServiceCat, setSelectedServiceCat] = useState('registration');
  const [account, setAccount] = useState(null);
  const [authLinkNotice, setAuthLinkNotice] = useState('');

  const { user, loading, logout, refreshUser, sessionExpired } = useAuth();
  const [showAuth, setShowAuth] = useState(['/reset-password', '/register', '/login', '/verify-email'].includes(window.location.pathname));
  const [authMode, setAuthMode] = useState(window.location.pathname === '/register' ? 'register' : window.location.pathname === '/verify-email' ? 'verify' : 'login');
  const [searching, setSearching] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Department / service navigation state
  const [selectedDepartment, setSelectedDepartment] = useState(null);
  const [selectedService, setSelectedService] = useState(null);

  const activeTab = user && ['home', 'services', 'about'].includes(requestedTab) ? 'dashboard' : requestedTab;

  // Property Search State
  const [parcelId, setParcelId] = useState('');
  const [searchResult, setSearchResult] = useState(null);
  const [chainVerification, setChainVerification] = useState(null);
  const [chainVerifying, setChainVerifying] = useState(false);
  const [chainError, setChainError] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    const token = params.get('token');
    if (window.location.pathname === '/reset-password') window.history.replaceState({}, '', window.location.pathname);
    if (window.location.pathname === '/verify-email' && token) {
      api.verifyEmail(token).then(() => setAuthLinkNotice('Email verified. You can sign in now.')).catch((error) => setAuthLinkNotice(error.message));
      window.history.replaceState({}, '', '/');
    }
  }, []);

  // GIS / forensic data loaded from the registry API
  const [gisParcels, setGisParcels] = useState([]);
  const [selectedGISId, setSelectedGISId] = useState(null);
  const [registryLoading, setRegistryLoading] = useState(false);
  const [registryError, setRegistryError] = useState(null);
  const [evidenceList, setEvidenceList] = useState([]);

  const navigateAuth = (mode) => {
    window.history.pushState({}, '', mode === 'register' ? '/register' : '/login');
    setAuthMode(mode);
    setShowAuth(true);
  };

  useEffect(() => {
    const onPopState = () => {
      const path = window.location.pathname;
      setAuthMode(path === '/register' ? 'register' : path === '/verify-email' ? 'verify' : 'login');
      setShowAuth(['/register', '/login', '/reset-password', '/verify-email'].includes(path));
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // Informational service categories; this application is not connected to Ardhisasa.
  const ardhisasaServiceCategories = {
    registration: {
      title: 'LAND REGISTRATION',
      description: 'Cryptographic deed registration, caveat management, and title issuance.',
      services: ['Caution / Caveats', 'Charge & Discharge', 'Lease Processing', 'Registration of Certificates of Title', 'Replacement of Title', 'Restriction Placement', 'Title Search (On-Chain)', 'Stamp Duty Assessment', 'Land Transfer']
    },
    administration: {
      title: 'LAND ADMINISTRATION',
      description: 'Management of public/private land leases and statutory user approvals.',
      services: ['Sub-division & Amalgamation Schemes', 'Change / Extension of Land User', 'Lease Extensions', 'Determination of Ground Rent', 'Land Control Board Consent']
    },
    planning: {
      title: 'PHYSICAL PLANNING',
      description: 'Spatial allocation, master plan approvals, and environmental compliance.',
      services: ['Approval of Development Plans', 'Issuance of Compliance Certificates', 'Part Development Plans (PDP) Processing', 'Environmental Impact Assessments (EIA)']
    },
    survey: {
      title: 'SURVEY & MAPPING',
      description: 'GIS beacon verification, cadastral plan processing, and RIM amendments.',
      services: ['Geo-referencing & Sectional Surveys', 'Boundary Dispute Resolution', 'Cadastral Plan Preparation (RIM)', 'Mutation Form Approvals']
    },
    valuation: {
      title: 'VALUATION',
      description: 'Property valuation for taxation, arbitration, and government acquisitions.',
      services: ['Valuation for Stamp Duty', 'Asset & Probate Valuation', 'Government Purchase & Leasing', 'Preparation of Valuation Rolls']
    },
    adjudication: {
      title: 'ADJUDICATION & SETTLEMENT',
      description: 'Community land rights recognition and settlement scheme processing.',
      services: ['Recognition of Community Land Rights', 'Customary Rights Registration', 'Settlement Scheme Offer Letters']
    },
    nlc: {
      title: 'PUBLIC LAND & COMMISSION SERVICES',
      description: 'Public land administration and compulsory land acquisition management.',
      services: ['Public Land Allocation', 'Compulsory Acquisition Claims', 'Historical Land Injustices Investigation']
    }
  };

  const gisOptions = gisParcels.filter((parcel) => parcel.latitude != null && parcel.longitude != null);
  const currentGISParcel = gisOptions.find((parcel) => parcel.id === selectedGISId) || gisOptions[0] || null;
  const currentGIS = currentGISParcel
    ? {
        id: currentGISParcel.id,
        coordinates: `${currentGISParcel.latitude}, ${currentGISParcel.longitude}`,
        registryStatus: ['frozen', 'disputed', 'archived'].includes(currentGISParcel.status)
          ? String(currentGISParcel.status).toUpperCase()
          : 'ACTIVE',
        area: currentGISParcel.areaHectares ? `${currentGISParcel.areaHectares} Ha` : 'N/A',
        county: currentGISParcel.county || '—',
        block: currentGISParcel.block || '—',
        isClean: !['frozen', 'disputed', 'archived'].includes(currentGISParcel.status),
      }
    : { id: null, coordinates: '—', registryStatus: 'NO GEOREFERENCED PARCELS', area: '—', county: '—', block: '—', isClean: true };

  const canFreeze = ['registrar', 'administrator'].includes(user?.role);
  const canViewInvestigations = user?.role === 'administrator';
  const canVerifyChain = ['registrar', 'administrator', 'auditor'].includes(user?.role);
  const forensicProperties = gisParcels.map((parcel) => ({
    id: parcel.parcelNumber,
    parcelId: parcel.id,
    indicator:
      parcel.status === 'frozen'
        ? 'Frozen title'
        : parcel.status === 'disputed'
          ? 'Disputed status'
          : parcel.status === 'archived'
            ? 'Archived title'
            : 'No adverse status recorded',
    tone: ['frozen', 'disputed', 'archived'].includes(parcel.status) ? 'danger' : 'success',
    reason:
      parcel.status === 'frozen'
        ? 'The registrar has set this parcel to frozen in the registry database.'
        : parcel.status === 'disputed'
          ? 'The parcel is marked disputed in the registry database.'
          : parcel.status === 'archived'
            ? 'The parcel is archived and not open for normal registration or transfer.'
            : 'The registry status is active. This is not a forensic clearance.',
    frozen: ['frozen', 'disputed', 'archived'].includes(parcel.status),
    lastAudit: String(parcel.updatedAt || parcel.createdAt || '').slice(0, 10),
  }));

  const tabBackgrounds = {
    home: 'https://images.unsplash.com/photo-1547471080-7cc2caa01a7e?q=80&w=1920&auto=format&fit=crop',
    services: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=1920&auto=format&fit=crop',
    search: 'https://images.unsplash.com/photo-1547471080-7cc2caa01a7e?q=80&w=1920&auto=format&fit=crop',
    gis: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?q=80&w=1920&auto=format&fit=crop',
    forensic: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=1920&auto=format&fit=crop',
    dashboard: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=1920&auto=format&fit=crop',
    notifications: 'https://images.unsplash.com/photo-1547471080-7cc2caa01a7e?q=80&w=1920&auto=format&fit=crop',
    about: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?q=80&w=1920&auto=format&fit=crop'
  };

  const connectWallet = async () => {
    if (window.ethereum) {
      try {
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        setAccount(accounts[0]);
        if (user) {
          await api.updateProfile({ walletAddress: accounts[0] });
          await refreshUser();
        }
      } catch (err) {
        console.error("Wallet connection rejected", err);
      }
    } else {
      alert("MetaMask wallet extension not detected in browser!");
    }
  };

  const handleNavClick = (tab) => {
    if (tab === 'forensic' && !canViewInvestigations) {
      return;
    }
    setRequestedTab(tab);
  };

  const handleLogout = async () => {
    await logout();
    setRequestedTab('home');
  };

  useEffect(() => {
    if (!window.ethereum) return undefined;
    let active = true;
    const handleAccountsChanged = (accounts) => setAccount(accounts[0] || null);
    window.ethereum.request({ method: 'eth_accounts' })
      .then((accounts) => { if (active) handleAccountsChanged(accounts); })
      .catch(() => {});
    window.ethereum.on('accountsChanged', handleAccountsChanged);
    return () => {
      active = false;
      window.ethereum.removeListener?.('accountsChanged', handleAccountsChanged);
    };
  }, []);

  useEffect(() => {
    if (!user) {
      return undefined;
    }
    let active = true;
    api.notifications({ unread: 'true' })
      .then(({ data }) => {
        if (active) setUnreadCount((data || []).length);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [user]);

  const loadParcels = useCallback(async () => {
    if (!user) return;
    setRegistryLoading(true);
    setRegistryError(null);
    try {
      const { data } = await api.listParcels('?limit=100');
      const rows = data || [];
      setGisParcels(rows);
      setSelectedGISId((previous) =>
        rows.some((row) => row.id === previous) ? previous : rows.find((row) => row.latitude != null)?.id ?? rows[0]?.id ?? null
      );
      if (['investigator', 'administrator'].includes(user.role)) {
        const evidence = await api.listEvidence().catch(() => ({ data: [] }));
        setEvidenceList(evidence.data || []);
      }
    } catch (err) {
      setRegistryError(err.message || 'Unable to load registry parcels.');
    } finally {
      setRegistryLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user || (activeTab !== 'gis' && activeTab !== 'forensic')) return undefined;
    const pending = Promise.resolve().then(loadParcels);
    return () => {
      pending.catch(() => {});
    };
  }, [activeTab, user, loadParcels]);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f172a', color: '#94a3b8', fontFamily: 'system-ui, sans-serif' }}>
        Restoring session…
      </div>
    );
  }

  const handleSearch = async (e) => {
    e.preventDefault();
    const query = parcelId.trim().toUpperCase();
    if (!query) return;
    if (!user) {
      setSearchResult({ error: 'Please sign in to search land registry records.' });
      return;
    }
    setSearching(true);
    setChainVerification(null);
    setChainError(null);
    try {
      const { data: parcel } = await api.searchParcel(query);
      if (!parcel) {
        setSearchResult({ error: 'Property record not found in the registry database.' });
        return;
      }
      const buyerSummary = Boolean(parcel.limitedBuyerView);
      const currentOwner = (parcel.ownerships || [])[0]?.owner;
      const currentDocument = (parcel.documents || []).find((doc) => doc.isCurrent) || (parcel.documents || [])[0];
      setSearchResult({
        id: parcel.id,
        parcelId: parcel.parcelNumber,
        location: [parcel.location, parcel.county].filter(Boolean).join(', ') || parcel.county,
        buyerSummary,
        ownerName: buyerSummary ? 'Not shown in buyer summary' : currentOwner?.fullName || 'Unregistered',
        owner: buyerSummary ? 'Obtain an official land search' : currentOwner?.email || '—',
        size: parcel.areaHectares ? `${parcel.areaHectares} Ha` : 'N/A',
        status: String(parcel.status).toUpperCase(),
        isDisputed: ['frozen', 'disputed', 'archived'].includes(parcel.status),
        documentHash: buyerSummary ? null : currentDocument?.sha256 || null,
        documents: buyerSummary ? [] : parcel.documents || [],
        history: buyerSummary ? null : (parcel.documents || []).map((doc) => ({
          date: String(doc.createdAt || '').slice(0, 10),
          event: `Document v${doc.version} — ${doc.originalName}${doc.isCurrent ? ' (current)' : ''}`,
          digest: doc.sha256 ? `${doc.sha256.slice(0, 20)}…` : '—',
        })),
      });
    } catch (err) {
      setSearchResult({ error: err.message || 'Unable to query the land registry.' });
    } finally {
      setSearching(false);
    }
  };

  const verifySearchOnChain = async () => {
    if (!searchResult?.parcelId) return;
    setChainVerifying(true);
    setChainError(null);
    setChainVerification(null);
    try {
      const { data } = await api.verifyParcelOnChain(searchResult.parcelId);
      setChainVerification(data);
    } catch (err) {
      setChainError(err.message || 'Unable to read the parcel from chain.');
    } finally {
      setChainVerifying(false);
    }
  };

  const toggleFreeze = async (parcelId, frozen) => {
    try {
      await api.freezeParcel(parcelId, !frozen);
      await loadParcels();
    } catch (err) {
      setRegistryError(err.message || 'Unable to update parcel status.');
    }
  };

  if (window.location.pathname === '/approve-account-mode') return <AccountModeApprovalPage />;

  return (
    <div className={`lrc-app-shell${user ? ' is-authenticated' : ''}`} style={{
      minHeight: '100vh', 
      fontFamily: 'system-ui, sans-serif', 
      color: '#f8fafc',
      backgroundColor: user ? '#07111f' : '#0f172a',
      backgroundImage: user ? 'none' : activeTab === 'home'
        ? `linear-gradient(to bottom, rgba(15, 23, 42, 0.34), rgba(2, 6, 23, 0.63)), url('${tabBackgrounds.home}')`
        : `linear-gradient(to bottom, rgba(15, 23, 42, 0.70), rgba(2, 6, 23, 0.85)), url('${tabBackgrounds[activeTab] || tabBackgrounds.home}')`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundAttachment: 'fixed',
      transition: 'background-image 0.6s ease-in-out'
    }}>
      {/* Top Navbar matching Ardhisasa Structure */}
      <nav className={`lrc-topbar${user ? ' lrc-topbar-authenticated' : ''}`} style={{ background: user ? 'rgba(7, 17, 31, 0.96)' : 'rgba(15, 23, 42, 0.9)', backdropFilter: 'blur(16px)', color: '#fff', padding: user ? '0.62rem 1.5rem' : '0.8rem 2rem', borderBottom: '1px solid rgba(56, 189, 248, 0.2)', position: 'sticky', top: 0, zIndex: 100 }}>
        <div className="lrc-topbar-inner" style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          
          {/* Logo Brand */}
          <button className="lrc-brand" type="button" aria-label={user ? 'Open your workspace' : 'Open the public home page'} style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', background: 'transparent', color: 'inherit', border: 0, padding: 0, textAlign: 'left' }} onClick={() => setRequestedTab(user ? 'dashboard' : 'home')}>
            <img src="/land-registrychain-logo.png" alt="LandRegistryChain" style={{ width: 52, height: 52, objectFit: 'contain', borderRadius: '8px' }} />
            <div>
              <h1 style={{ fontSize: '1.3rem', margin: 0, fontWeight: 'bold', letterSpacing: '0.5px' }}>LandRegistryChain</h1>
              <span style={{ fontSize: '0.75rem', color: '#38bdf8', fontWeight: '600' }}>Secure land records and verification</span>
            </div>
          </button>

          {/* Role-based navigation links */}
          <nav className={`lrc-primary-nav${user ? ' is-authenticated' : ''}`} aria-label="Primary">
            {!user ? (
              <>
                {[
                  { tab: 'home', label: 'Home', icon: Home },
                  { tab: 'services', label: 'Services', icon: Landmark },
                  { tab: 'search', label: 'Search Land', icon: Search },
                  { tab: 'gis', label: 'GIS Map', icon: MapPinned },
                  { tab: 'about', label: 'About Us', icon: Info },
                ].map(({ tab, label, icon: Icon }) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setRequestedTab(tab)}
                    aria-current={activeTab === tab ? 'page' : undefined}
                    className="lrc-nav-link"
                  >
                    <Icon size={14} strokeWidth={1.8} aria-hidden="true" />
                    <span>{label}</span>
                  </button>
                ))}
              </>
            ) : (
              <>
                {[
                  { tab: 'dashboard', label: 'Workspace', icon: LayoutDashboard },
                  { tab: 'search', label: user.role === 'landowner' && user.accountType === 'buyer' ? 'Land search' : 'Registry search', icon: Search },
                  { tab: 'gis', label: 'GIS map', icon: MapPinned },
                  ...(canViewInvestigations ? [{ tab: 'forensic', label: 'Forensics', icon: FileSearch }] : []),
                ].map(({ tab, label, icon: Icon }) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => handleNavClick(tab)}
                    aria-current={activeTab === tab ? 'page' : undefined}
                    className="lrc-nav-link"
                  >
                    <Icon size={14} strokeWidth={1.8} aria-hidden="true" />
                    <span>{label}</span>
                  </button>
                ))}
              </>
            )}
          </nav>

          {/* Account actions */}
          <div className="lrc-account-actions" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="lrc-wallet-wrap">
              <button
                type="button"
                className={`lrc-wallet-action${account ? ' is-connected' : ''}`}
                onClick={connectWallet}
                aria-label={account ? `Connected wallet ${account}` : 'Connect an active wallet'}
                title={account ? `Connected: ${account}` : 'Click to open active wallet'}
              >
                <WalletCards size={20} strokeWidth={1.8} aria-hidden="true" />
              </button>
              <small className="lrc-wallet-hint">{account ? `${account.slice(0, 6)}…${account.slice(-4)}` : 'Click to open active wallet'}</small>
            </div>
            {!user ? (
              <>
                <button
                  key="nav-register"
                  type="button"
                  onClick={() => navigateAuth('register')}
                  style={{ background: 'transparent', color: '#38bdf8', border: '1px solid #38bdf8', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' }}
                >
                  Register
                </button>
                <button
                  key="nav-signin"
                  type="button"
                  onClick={() => navigateAuth('login')}
                  style={{ background: 'rgba(56, 189, 248, 0.15)', border: '1px solid #38bdf8', color: '#fff', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' }}
                >
                  Sign In
                </button>
              </>
            ) : (
              <>
                <div className="lrc-account-summary" style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(2, 6, 23, 0.6)', border: '1px solid rgba(56, 189, 248, 0.3)', padding: '6px 10px', borderRadius: '8px' }}>
                  <UserCircle size={18} color="#38bdf8" />
                  <span style={{ fontSize: '0.8rem', color: '#e2e8f0', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={user.email}>
                    {user.email}
                  </span>
                  <span style={{ fontSize: '0.65rem', color: '#38bdf8', textTransform: 'uppercase', fontWeight: 'bold' }}>{accountModeLabel(user)}</span>
                  <button
                    key="nav-logout"
                    onClick={handleLogout}
                    title="Sign out"
                    style={{ background: 'transparent', border: 'none', color: '#f87171', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                  >
                    <LogOut size={16} />
                  </button>
                </div>
                {user && (
                  <button
                    key="nav-notifications"
                    onClick={() => setRequestedTab('notifications')}
                    title="Notifications"
                    style={{ position: 'relative', background: 'rgba(2, 6, 23, 0.6)', border: '1px solid rgba(56, 189, 248, 0.3)', color: '#38bdf8', padding: '8px 10px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                  >
                    <Bell size={18} />
                    {unreadCount > 0 && (
                      <span style={{ position: 'absolute', top: '-6px', right: '-6px', background: '#ef4444', color: '#fff', borderRadius: '999px', fontSize: '0.65rem', fontWeight: 800, minWidth: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>
                        {unreadCount}
                      </span>
                    )}
                  </button>
                )}
              </>
            )}
          </div>

        </div>
      </nav>

      {/* Main Page Render */}
      <main style={{ paddingBottom: '3rem' }}>
        {authLinkNotice && <div role="status" style={{ maxWidth: 900, margin: '1rem auto', padding: '0.9rem 1rem', color: '#e2e8f0', background: 'rgba(15,23,42,.95)', border: '1px solid rgba(56,189,248,.4)', borderRadius: 10 }}>{authLinkNotice}</div>}

        {sessionExpired && (
          <div style={{ maxWidth: '1100px', margin: '1rem auto 0 auto', padding: '0 1rem' }}>
            <Notice tone="warning">Your session has expired. Sign in again to continue where you left off.</Notice>
          </div>
        )}
        
        {/* PAGE 1: HOME PAGE — Department-based layout */}
        {activeTab === 'home' && !selectedDepartment && !selectedService && (
          <div className="lrc-home-content" style={{ maxWidth: '1100px', margin: '3rem auto', padding: '0 1rem', textAlign: 'center' }}>
            <img src="/land-registrychain-logo.png" alt="LandRegistryChain — Secure land, trusted ownership, transparent Kenya" style={{ display: 'block', width: 'min(100%, 340px)', maxHeight: '380px', objectFit: 'contain', margin: '0 auto 1.5rem', borderRadius: '14px', boxShadow: '0 18px 60px rgba(0,0,0,.45)' }} />
            <h1 style={{ fontSize: '3rem', fontWeight: '800', color: '#fff', marginBottom: '1.5rem', textShadow: '0 2px 10px rgba(0,0,0,0.8)' }}>
              LandRegistryChain – Secure Land Registry System
            </h1>
            <p style={{ fontSize: '1.15rem', color: '#e2e8f0', maxWidth: '800px', margin: '0 auto 3rem auto', lineHeight: '1.7', textShadow: '0 1px 6px rgba(0,0,0,0.8)' }}>
              LandRegistryChain is a digital land management platform designed to help people manage land records, verify ownership, process land transactions and protect property information through secure digital records and blockchain technology.
            </p>

            <p style={{ fontSize: '0.95rem', color: '#94a3b8', marginBottom: '2.5rem', textShadow: '0 1px 6px rgba(0,0,0,0.8)' }}>
              Choose a service to get started.
            </p>

            {/* Service cards grid */}
            <div className="lrc-service-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginBottom: '3rem' }}>
              {[
                {
                  icon: Search,
                  label: 'Search Land',
                  description: 'Find land records and ownership details.',
                  tab: 'search',
                },
                {
                  icon: FileText,
                  label: 'Land Registration',
                  description: 'Register land and submit applications.',
                  tab: 'services',
                },
                {
                  icon: ArrowRight,
                  label: 'Land Transfer',
                  description: 'Apply to transfer land ownership.',
                  tab: 'services',
                },
                {
                  icon: ShieldCheck,
                  label: 'Title Verification',
                  description: 'Check land title information and documents.',
                  tab: 'search',
                },
                {
                  icon: MapPin,
                  label: 'Land Mapping',
                  description: 'View saved parcel coordinate points. These are not surveyed boundaries.',
                  tab: 'gis',
                },
                {
                  icon: Shield,
                  label: 'Security & Records',
                  description: 'Protect land records and track changes.',
                  tab: 'dashboard',
                },
              ].map((card) => {
                const Icon = card.icon;
                return (
                  <div
                    key={card.label}
                    onClick={() => setRequestedTab(card.tab)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && setRequestedTab(card.tab)}
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
                    <h3 style={{ margin: '0 0 8px 0', fontSize: '1.15rem', color: '#fff', fontWeight: 600, letterSpacing: '0.2px' }}>
                      {card.label}
                    </h3>
                    <p style={{ margin: 0, fontSize: '0.9rem', color: '#94a3b8', lineHeight: '1.5' }}>
                      {card.description}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Info block about LandRegistryChain's unique capabilities */}
            <div className="lrc-about-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
              <div style={{ background: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(16px)', border: '1px solid rgba(56, 189, 248, 0.3)', borderRadius: '16px', padding: '1.5rem', textAlign: 'left' }}>
                <ShieldCheck size={24} color="#38bdf8" style={{ marginBottom: '10px' }} />
                <h3 style={{ margin: '0 0 8px 0', color: '#fff', fontSize: '1.1rem', fontWeight: 600 }}>Optional Blockchain Anchoring</h3>
                <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.88rem', lineHeight: '1.5' }}>
                  Approved changes can be anchored when a blockchain network and worker are configured. The database remains the registry record.
                </p>
              </div>
              <div style={{ background: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(16px)', border: '1px solid rgba(56, 189, 248, 0.3)', borderRadius: '16px', padding: '1.5rem', textAlign: 'left' }}>
                <FileText size={24} color="#22c55e" style={{ marginBottom: '10px' }} />
                <h3 style={{ margin: '0 0 8px 0', color: '#fff', fontSize: '1.1rem', fontWeight: 600 }}>Document Integrity</h3>
                <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.88rem', lineHeight: '1.5' }}>
                  All documents are verified using SHA-256 cryptographic digests.
                </p>
              </div>
              <div style={{ background: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(16px)', border: '1px solid rgba(56, 189, 248, 0.3)', borderRadius: '16px', padding: '1.5rem', textAlign: 'left' }}>
                <ShieldAlert size={24} color="#ef4444" style={{ marginBottom: '10px' }} />
                <h3 style={{ margin: '0 0 8px 0', color: '#fff', fontSize: '1.1rem', fontWeight: 600 }}>Digital Forensics</h3>
                <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.88rem', lineHeight: '1.5' }}>
                  Investigate suspicious titles with evidence custody and audit trails.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* PAGE 1B: DEPARTMENT SERVICES PAGE */}
        {activeTab === 'home' && selectedDepartment && !selectedService && (
          <DepartmentServices
            departmentKey={selectedDepartment}
            onServiceSelect={setSelectedService}
            onBack={() => setSelectedDepartment(null)}
          />
        )}

        {/* PAGE 1C: SERVICE DETAIL PAGE */}
        {activeTab === 'home' && selectedDepartment && selectedService && (
          <ServiceDetail
            serviceName={selectedService}
            departmentKey={selectedDepartment}
            onBack={() => setSelectedService(null)}
          />
        )}

        {/* PAGE 2: Informational land services directory */}
        {activeTab === 'services' && (
          <div style={{ maxWidth: '1100px', margin: '2.5rem auto', padding: '0 1rem' }}>
            <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
              <h2 style={{ color: '#ffffff', fontSize: '2.4rem', fontWeight: '800', textShadow: '0 2px 10px rgba(0,0,0,0.8)' }}>Land Services Information</h2>
              <p style={{ color: '#e2e8f0', fontSize: '1.05rem', textShadow: '0 1px 6px rgba(0,0,0,0.8)' }}>Independent project; not affiliated with or connected to Ardhisasa, the Ministry of Lands, or the National Land Commission. Only actions shown in the dashboard are implemented here.</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1.5rem' }}>
              
              {/* Left Sidebar - Service Categories */}
              <div style={{ background: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(20px)', border: '1px solid rgba(56, 189, 248, 0.3)', borderRadius: '16px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {Object.keys(ardhisasaServiceCategories).map((catKey) => {
                  const cat = ardhisasaServiceCategories[catKey];
                  const isSelected = selectedServiceCat === catKey;
                  return (
                    <button
                      key={catKey}
                      onClick={() => setSelectedServiceCat(catKey)}
                      style={{
                        textAlign: 'left',
                        padding: '12px 16px',
                        borderRadius: '10px',
                        border: isSelected ? '1px solid #38bdf8' : '1px solid transparent',
                        background: isSelected ? 'rgba(56, 189, 248, 0.2)' : 'transparent',
                        color: isSelected ? '#38bdf8' : '#cbd5e1',
                        fontWeight: 'bold',
                        fontSize: '0.85rem',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <span>{cat.title}</span>
                      <ArrowRight size={14} opacity={isSelected ? 1 : 0.4} />
                    </button>
                  );
                })}
              </div>

              {/* Right Side - Active Category Services List */}
              <div style={{ background: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(20px)', border: '1px solid rgba(56, 189, 248, 0.3)', borderRadius: '16px', padding: '2rem' }}>
                <h3 style={{ color: '#38bdf8', marginTop: 0, fontSize: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '12px' }}>
                  {ardhisasaServiceCategories[selectedServiceCat].title}
                </h3>
                <p style={{ color: '#cbd5e1', fontSize: '0.95rem', marginBottom: '1.5rem' }}>
                  {ardhisasaServiceCategories[selectedServiceCat].description}
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '10px' }}>
                  {ardhisasaServiceCategories[selectedServiceCat].services.map((service, idx) => (
                    <div key={idx} style={{ background: 'rgba(2, 6, 23, 0.7)', padding: '14px 18px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: '600', color: '#f8fafc' }}>{service}</span>
                      <button onClick={() => setRequestedTab('search')} style={{ background: 'rgba(56, 189, 248, 0.15)', border: '1px solid #38bdf8', color: '#38bdf8', padding: '6px 12px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 'bold', cursor: 'pointer' }}>
                        Search registry
                      </button>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>
        )}

        {/* PAGE 3: TITLE SEARCH */}
        {activeTab === 'search' && (
          <div style={{ maxWidth: '900px', margin: '2.5rem auto', padding: '0 1rem' }}>
            <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
              <h2 style={{ color: '#ffffff', fontSize: '2.4rem', fontWeight: '800', textShadow: '0 2px 10px rgba(0,0,0,0.8)' }}>Registry Title Search</h2>
              <p style={{ color: '#e2e8f0', fontSize: '1.1rem', textShadow: '0 1px 6px rgba(0,0,0,0.8)' }}>Search a parcel number in the registry database. Authorized roles can also compare the record with the on-chain anchor.</p>
            </div>

            <form className="lrc-search-form" onSubmit={handleSearch} style={{ display: 'flex', gap: '12px', marginBottom: '2rem' }}>
              <input 
                type="text" 
                aria-label="Parcel number to search"
                aria-required="true"
                required
                placeholder="Try: NAIROBI/BLOCK103/45 or MOMBASA/BLOCK12/8" 
                value={parcelId} 
                onChange={(e) => setParcelId(e.target.value)}
                style={{ flex: 1, padding: '16px 20px', borderRadius: '12px', border: '1px solid rgba(56, 189, 248, 0.4)', background: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(12px)', color: '#fff', fontSize: '1.05rem', boxShadow: '0 4px 20px rgba(0,0,0,0.4)' }}
              />
              <button type="submit" disabled={searching} aria-busy={searching} style={{ background: searching ? '#0e7490' : '#38bdf8', color: '#0f172a', border: 'none', padding: '0 30px', borderRadius: '12px', fontWeight: 'bold', fontSize: '1.05rem', cursor: searching ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 0 20px rgba(56, 189, 248, 0.5)' }}>
                <Search size={20} /> {searching ? 'Searching registry…' : 'Search registry'}
              </button>
            </form>

            {searchResult && (
              searchResult.error ? (
                <div style={{ background: 'rgba(69, 10, 10, 0.95)', border: '1px solid #ef4444', color: '#fca5a5', padding: '1.25rem', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '10px', boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}>
                  <AlertOctagon size={24} />
                  <span style={{ fontWeight: '600' }}>{searchResult.error}</span>
                </div>
              ) : (
                <div className="lrc-search-result" style={{ background: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(20px)', border: '1px solid rgba(56, 189, 248, 0.3)', borderRadius: '16px', padding: '2rem', color: '#fff', boxShadow: '0 0 35px rgba(56, 189, 248, 0.2)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', paddingBottom: '1rem', marginBottom: '1.25rem' }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.6rem', color: '#38bdf8', fontWeight: 'bold' }}>{searchResult.parcelId}</h3>
                      <span style={{ color: '#cbd5e1', fontSize: '1rem' }}>{searchResult.location}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: searchResult.isDisputed ? 'rgba(239, 68, 68, 0.25)' : 'rgba(34, 197, 94, 0.25)', border: searchResult.isDisputed ? '1px solid #ef4444' : '1px solid #22c55e', color: searchResult.isDisputed ? '#fca5a5' : '#4ade80', padding: '8px 16px', borderRadius: '20px', fontWeight: 'bold' }}>
                      {searchResult.isDisputed ? <ShieldAlert size={18} /> : <CheckCircle size={18} />}
                      {searchResult.status}
                    </div>
                  </div>

                  <div className="lrc-search-details-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
                    <div>
                      <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: '0 0 4px 0' }}>Registered Owner</p>
                      <p style={{ margin: 0, fontWeight: 'bold', fontSize: '1.1rem', color: '#f8fafc' }}>{searchResult.ownerName} ({searchResult.owner})</p>
                    </div>
                    <div>
                      <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: '0 0 4px 0' }}>Parcel Size</p>
                      <p style={{ margin: 0, fontWeight: 'bold', fontSize: '1.1rem', color: '#f8fafc' }}>{searchResult.size}</p>
                    </div>
                    <div style={{ gridColumn: 'span 2' }}>
                      <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: '0 0 4px 0' }}>SHA-256 Document Digest (registry database)</p>
                      <p style={{ margin: 0, fontSize: '0.95rem', color: '#38bdf8', fontFamily: 'monospace', background: 'rgba(2, 6, 23, 0.6)', padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(56, 189, 248, 0.2)', wordBreak: 'break-all' }}>
                        <FileText size={14} style={{ display: 'inline', marginRight: '6px' }} />
                        {searchResult.documentHash || 'No document digest on file'}
                      </p>
                    </div>
                  </div>

                  {canVerifyChain && (
                    <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.1)', paddingTop: '1rem', marginTop: '0.5rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        <div>
                          <h4 style={{ margin: 0, color: '#e2e8f0', fontSize: '1.05rem' }}>On-chain verification</h4>
                          <p style={{ margin: '3px 0 0 0', color: '#94a3b8', fontSize: '0.82rem' }}>Reads the parcel directly from the configured LandRegistry contract. This is separate from the database record above.</p>
                        </div>
                        <button onClick={verifySearchOnChain} disabled={chainVerifying} style={{ background: 'rgba(56, 189, 248, 0.15)', border: '1px solid #38bdf8', color: '#38bdf8', padding: '8px 14px', borderRadius: '8px', fontWeight: 'bold', cursor: chainVerifying ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Link2 size={15} /> {chainVerifying ? 'Reading chain…' : 'Verify on chain'}
                        </button>
                      </div>
                      {chainError && (
                        <div style={{ marginTop: '0.75rem', background: 'rgba(127, 29, 29, 0.5)', border: '1px solid #ef4444', color: '#fca5a5', padding: '10px 12px', borderRadius: '9px', fontSize: '0.85rem' }}>
                          {chainError}
                        </div>
                      )}
                      {chainVerification && (
                        <div style={{ marginTop: '0.75rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.6rem', fontSize: '0.85rem' }}>
                          {Object.entries(chainVerification.verification).map(([key, value]) => (
                            <div key={key} style={{ background: 'rgba(2,6,23,0.65)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '8px 10px' }}>
                              <div style={{ color: '#94a3b8', fontSize: '0.72rem', textTransform: 'uppercase' }}>{key}</div>
                              <div style={{ color: value === 'MATCH' ? '#4ade80' : value === 'MISMATCH' ? '#f87171' : '#fbbf24', fontWeight: 700 }}>{value}</div>
                            </div>
                          ))}
                          <div style={{ gridColumn: 'span 2', color: '#94a3b8', fontSize: '0.78rem' }}>
                            On-chain record (evidence only, not legal title):
                            <span style={{ fontFamily: 'monospace', color: '#38bdf8' }}>{chainVerification.onChain.transactionReference}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {searchResult.buyerSummary && <Notice tone="info" style={{ marginTop: '0.8rem' }}>Buyer preview only: ownership identity and private document details are withheld. Obtain an official search and verify the seller’s authority before paying or signing.</Notice>}

                  <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.1)', paddingTop: '1.25rem', marginTop: '1rem' }}>
                    <h4 style={{ margin: '0 0 12px 0', color: '#e2e8f0', fontSize: '1.05rem' }}>Document version history</h4>
                    {searchResult.buyerSummary ? (
                      <p style={{ color: '#94a3b8', margin: 0 }}>Document details are not shown in a buyer preview. Request an official search through the relevant land registry.</p>
                    ) : searchResult.history.length === 0 ? (
                      <p style={{ color: '#94a3b8', margin: 0 }}>No documents have been uploaded for this parcel.</p>
                    ) : searchResult.history.map((item, index) => (
                      <div key={index} style={{ background: 'rgba(2, 6, 23, 0.7)', padding: '14px 18px', borderRadius: '10px', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', gap: '10px', fontSize: '0.9rem', border: '1px solid rgba(255,255,255,0.08)', flexWrap: 'wrap' }}>
                        <span style={{ color: '#f1f5f9' }}>{item.date} — <strong>{item.event}</strong></span>
                        <span style={{ color: '#38bdf8', fontFamily: 'monospace' }}>SHA-256: {item.digest}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            )}
          </div>
        )}

        {/* PAGE 4: GIS MAP */}
        {activeTab === 'gis' && (
          <div style={{ maxWidth: '1100px', margin: '2.5rem auto', padding: '0 1rem' }}>
            <div style={{ marginBottom: '1.5rem' }}>
              <h2 style={{ color: '#ffffff', margin: 0, fontSize: '2.2rem', textShadow: '0 2px 10px rgba(0,0,0,0.8)' }}>Parcel Coordinates</h2>
              <p style={{ color: '#e2e8f0', margin: '4px 0 0 0', textShadow: '0 1px 6px rgba(0,0,0,0.8)' }}>Registry latitude and longitude for parcels where coordinates were recorded. This is not a surveyed boundary map.</p>
            </div>

            {!user && (
              <div style={{ background: 'rgba(15, 23, 42, 0.85)', border: '1px solid rgba(56, 189, 248, 0.3)', borderRadius: '12px', padding: '1rem 1.25rem', marginBottom: '1rem', color: '#cbd5e1' }}>
                Sign in to load live cadastral parcels from the registry.
              </div>
            )}
            {user && registryLoading && (
              <div style={{ color: '#cbd5e1', marginBottom: '1rem' }}>Loading registry parcels…</div>
            )}
            {user && registryError && (
              <div style={{ background: 'rgba(127, 29, 29, 0.6)', border: '1px solid #ef4444', borderRadius: '12px', padding: '1rem 1.25rem', marginBottom: '1rem', color: '#fca5a5' }}>
                {registryError}
              </div>
            )}
            {user && !registryLoading && !registryError && gisParcels.length === 0 && (
              <div style={{ background: 'rgba(15, 23, 42, 0.85)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '1rem 1.25rem', marginBottom: '1rem', color: '#cbd5e1' }}>
                No parcels have been registered yet.
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: '1.5rem' }}>
              <div style={{ background: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(20px)', border: '1px solid rgba(56, 189, 248, 0.3)', borderRadius: '16px', height: '450px', position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', boxShadow: '0 0 30px rgba(0,0,0,0.6)' }}>
                <div style={{ position: 'absolute', top: '15px', left: '15px', background: 'rgba(15, 23, 42, 0.9)', padding: '8px 14px', borderRadius: '8px', fontSize: '0.85rem', color: '#cbd5e1', border: '1px solid rgba(255, 255, 255, 0.1)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Layers size={16} color="#38bdf8" /> OpenStreetMap · Registry point
                </div>

                <div style={{ position: 'absolute', top: '15px', right: '15px', background: 'rgba(15, 23, 42, 0.9)', padding: '8px 14px', borderRadius: '8px', fontSize: '0.85rem', color: '#cbd5e1', border: '1px solid rgba(255, 255, 255, 0.1)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Compass size={16} color="#38bdf8" /> Lat/Lng: {currentGIS.coordinates}
                </div>

                {currentGISParcel ? (
                  <iframe title={`Map location for ${currentGISParcel.parcelNumber}`} aria-label={`OpenStreetMap location for parcel ${currentGISParcel.parcelNumber}`} referrerPolicy="no-referrer" width="100%" height="100%" style={{ border: 0 }} loading="lazy" src={`https://www.openstreetmap.org/export/embed.html?bbox=${Number(currentGISParcel.longitude) - 0.015}%2C${Number(currentGISParcel.latitude) - 0.015}%2C${Number(currentGISParcel.longitude) + 0.015}%2C${Number(currentGISParcel.latitude) + 0.015}&layer=mapnik&marker=${currentGISParcel.latitude}%2C${currentGISParcel.longitude}`} />
                ) : (
                  <div style={{ display: 'grid', placeItems: 'center', height: '100%', color: '#cbd5e1', textAlign: 'center', padding: '2rem' }}><MapPin size={36} /><p>No parcel has stored latitude and longitude coordinates yet.</p></div>
                )}

                <div style={{ position: 'absolute', bottom: '15px', color: '#94a3b8', fontSize: '0.85rem', textAlign: 'center', padding: '0 1rem' }}>
                  The marker uses the saved registry coordinate. It is not a surveyed or legally verified parcel boundary.
                </div>
              </div>

              <div style={{ background: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(20px)', border: '1px solid rgba(56, 189, 248, 0.3)', borderRadius: '16px', padding: '1.75rem', boxShadow: '0 0 30px rgba(0,0,0,0.6)' }}>
                <h3 style={{ margin: '0 0 1.25rem 0', fontSize: '1.25rem', color: '#38bdf8' }}>Parcel coordinates and status</h3>

                <div style={{ marginBottom: '1.25rem' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '6px' }}>Select Parcel</label>
                  <select 
                    value={currentGISParcel?.id ?? ''} 
                    onChange={(e) => setSelectedGISId(Number(e.target.value))}
                    style={{ width: '100%', padding: '12px', borderRadius: '10px', background: 'rgba(2, 6, 23, 0.9)', border: '1px solid rgba(56, 189, 248, 0.3)', color: '#fff', fontWeight: 'bold', fontSize: '0.95rem' }}
                  >
                    {gisOptions.length === 0 && <option value="">No georeferenced parcels available</option>}
                    {gisOptions.map((parcel) => (
                      <option key={parcel.id} value={parcel.id}>
                        {parcel.parcelNumber} ({parcel.status})
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.95rem' }}>
                  <div>
                    <span style={{ color: '#94a3b8', display: 'block', fontSize: '0.8rem' }}>County & Block</span>
                    <strong style={{ fontSize: '1.05rem', color: '#fff' }}>{currentGIS.county} — {currentGIS.block}</strong>
                  </div>

                  <div>
                    <span style={{ color: '#94a3b8', display: 'block', fontSize: '0.8rem' }}>Acreage Area</span>
                    <strong style={{ fontSize: '1.05rem', color: '#fff' }}>{currentGIS.area}</strong>
                  </div>

                  <div>
                    <span style={{ color: '#94a3b8', display: 'block', fontSize: '0.8rem' }}>Block / survey reference</span>
                    <strong style={{ fontSize: '1.05rem', color: '#fff' }}>{currentGIS.block}</strong>
                  </div>

                  <div style={{ background: 'rgba(2, 6, 23, 0.7)', padding: '14px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <span style={{ color: '#94a3b8', display: 'block', fontSize: '0.8rem' }}>Registry status indicator</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px', color: currentGIS.isClean ? '#4ade80' : '#f87171', fontWeight: 'bold' }}>
                      {currentGIS.isClean ? <CheckCircle size={18} /> : <ShieldAlert size={18} />}
                      {currentGIS.registryStatus}
                    </div>
                    <p style={{ margin: '6px 0 0 0', color: '#94a3b8', fontSize: '0.75rem' }}>Derived from the parcel status stored in the registry database.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* PAGE 5: FORENSIC AUDITS */}
        {activeTab === 'forensic' && (
          <div style={{ maxWidth: '1100px', margin: '2.5rem auto', padding: '0 1rem' }}>
            {!user || !canViewInvestigations ? (
              <div style={{ 
                background: 'rgba(15, 23, 42, 0.9)', 
                backdropFilter: 'blur(24px)', 
                border: '1px solid rgba(239, 68, 68, 0.4)', 
                borderRadius: '20px', 
                padding: '4rem 2rem', 
                textAlign: 'center', 
                boxShadow: '0 0 40px rgba(239, 68, 68, 0.25)' 
              }}>
                <div style={{ background: 'rgba(239, 68, 68, 0.15)', width: '80px', height: '80px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem auto', border: '1px solid rgba(239, 68, 68, 0.4)' }}>
                  <KeyRound size={40} color="#fca5a5" />
                </div>
                <h2 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#fff', margin: '0 0 10px 0' }}>{user ? 'Role access required' : 'Sign in required'}</h2>
                <p style={{ color: '#cbd5e1', maxWidth: '550px', margin: '0 auto 2rem auto', fontSize: '1.05rem', lineHeight: '1.6' }}>
                  {user
                    ? 'The investigation workspace is available to administrators only. Your current role does not include these permissions.'
                    : 'Sign in to access the investigation workspace. Access is restricted to administrators; public registration creates a landowner account only.'}
                </p>
                {!user && (
                  <button 
                    onClick={() => setShowAuth(true)}
                    style={{ background: '#0284c7', color: '#fff', border: 'none', padding: '14px 32px', borderRadius: '12px', fontSize: '1.05rem', fontWeight: 'bold', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '10px', boxShadow: '0 0 25px rgba(2, 132, 199, 0.5)' }}>
                    <KeyRound size={20} /> Sign in
                  </button>
                )}
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                  <div>
                    <h2 style={{ color: '#ffffff', margin: 0, fontSize: '2.2rem', textShadow: '0 2px 10px rgba(0,0,0,0.8)' }}>Investigation workspace</h2>
                    <p style={{ color: '#e2e8f0', margin: '4px 0 0 0', textShadow: '0 1px 6px rgba(0,0,0,0.8)' }}>Review registry status indicators and evidence custody. Indicators are informational and are not automated risk scores.</p>
                  </div>
                  <div style={{ background: 'rgba(14, 116, 144, 0.85)', color: '#bae6fd', padding: '10px 18px', borderRadius: '10px', border: '1px solid #38bdf8', fontWeight: 'bold', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 0 15px rgba(56, 189, 248, 0.35)' }}>
                    <ShieldAlert size={18} /> Signed in as {accountModeLabel(user)}
                  </div>
                </div>

                <div style={{ marginBottom: '0.9rem' }}>
                  <Notice tone="info">
                    These indicators are derived only from the parcel status stored in the registry database. They are not automated forensic risk scores and do not establish fraud. Use the evidence register and audit trail for investigation records.
                  </Notice>
                </div>
                <div style={{ background: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(20px)', border: '1px solid rgba(56, 189, 248, 0.3)', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 0 35px rgba(0,0,0,0.6)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', color: '#fff' }}>
                    <thead>
                      <tr style={{ background: 'rgba(2, 6, 23, 0.9)', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', color: '#38bdf8', fontSize: '0.85rem', letterSpacing: '0.5px' }}>
                        <th style={{ padding: '18px 20px' }}>PARCEL ID</th>
                        <th style={{ padding: '18px 20px' }}>REGISTRY INDICATOR</th>
                        <th style={{ padding: '18px 20px' }}>OBSERVATION</th>
                        <th style={{ padding: '18px 20px' }}>LAST AUDIT</th>
                        <th style={{ padding: '18px 20px' }}>STATUS</th>
                        <th style={{ padding: '18px 20px', textAlign: 'right' }}>ACTION</th>
                      </tr>
                    </thead>
                    <tbody>
                      {forensicProperties.length === 0 && (
                        <tr>
                          <td colSpan={6} style={{ padding: '22px 20px', color: '#94a3b8', textAlign: 'center' }}>
                            {registryLoading ? 'Loading registry parcels…' : registryError || 'No parcels available for review.'}
                          </td>
                        </tr>
                      )}
                      {forensicProperties.map((item) => (
                        <tr key={item.parcelId} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)', fontSize: '0.95rem' }}>
                          <td style={{ padding: '18px 20px', fontWeight: 'bold', color: '#38bdf8' }}>{item.id}</td>
                          <td style={{ padding: '18px 20px' }}>
                            <span style={{ 
                              padding: '6px 14px', 
                              borderRadius: '12px', 
                              fontSize: '0.75rem', 
                              fontWeight: 'bold',
                              whiteSpace: 'nowrap',
                              display: 'inline-block',
                              background: item.tone === 'danger' ? '#7f1d1d' : '#064e3b',
                              color: item.tone === 'danger' ? '#fca5a5' : '#6ee7b7',
                              border: item.tone === 'danger' ? '1px solid #ef4444' : '1px solid #22c55e'
                            }}>
                              {item.indicator}
                            </span>
                          </td>
                          <td style={{ padding: '18px 20px', color: '#e2e8f0' }}>{item.reason}</td>
                          <td style={{ padding: '18px 20px', color: '#94a3b8', fontSize: '0.85rem' }}>{item.lastAudit}</td>
                          <td style={{ padding: '18px 20px' }}>
                            {item.frozen ? (
                              <span style={{ color: '#fca5a5', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Lock size={16} color="#ef4444" /> FROZEN
                              </span>
                            ) : (
                              <span style={{ color: '#4ade80', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Unlock size={16} color="#22c55e" /> ACTIVE
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '18px 20px', textAlign: 'right' }}>
                            <button 
                              onClick={() => toggleFreeze(item.parcelId, item.frozen)}
                              disabled={!canFreeze}
                              title={canFreeze ? undefined : 'Only registrars and administrators can freeze titles'}
                              style={{ 
                                background: item.frozen ? '#22c55e' : '#ef4444', 
                                color: '#fff', 
                                border: 'none', 
                                padding: '8px 18px', 
                                borderRadius: '8px', 
                                cursor: canFreeze ? 'pointer' : 'not-allowed', 
                                opacity: canFreeze ? 1 : 0.45,
                                fontWeight: 'bold',
                                fontSize: '0.85rem',
                                boxShadow: item.frozen ? '0 0 12px rgba(34, 197, 94, 0.4)' : '0 0 12px rgba(239, 68, 68, 0.4)'
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

                {['investigator', 'administrator'].includes(user?.role) && (
                  <div style={{ marginTop: '1.5rem', background: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(20px)', border: '1px solid rgba(56, 189, 248, 0.3)', borderRadius: '16px', padding: '1.75rem', boxShadow: '0 0 35px rgba(0,0,0,0.6)' }}>
                    <h3 style={{ margin: '0 0 1rem 0', color: '#38bdf8' }}>Evidence Custody Register</h3>
                    {evidenceList.length === 0 ? (
                      <p style={{ color: '#94a3b8', margin: 0 }}>No evidence has been recorded through the custody workflow yet.</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {evidenceList.map((item) => (
                          <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', background: 'rgba(2, 6, 23, 0.7)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '10px', padding: '12px 14px' }}>
                            <div>
                              <strong style={{ color: '#38bdf8' }}>{item.custodyRef}</strong>
                              <p style={{ margin: '4px 0 0 0', color: '#cbd5e1', fontSize: '0.9rem' }}>{item.description}</p>
                            </div>
                            <div style={{ textAlign: 'right', fontSize: '0.85rem', color: '#94a3b8' }}>
                              <div>{String(item.status).toUpperCase()}</div>
                              <div>{String(item.createdAt || '').slice(0, 10)}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* PAGE 6: DASHBOARD */}
        {activeTab === 'dashboard' && (
          user ? (
              <Dashboard
              user={user}
              refreshUser={refreshUser}
              walletAccount={account}
              onConnectWallet={connectWallet}
              onUnreadChange={setUnreadCount}
              onFindLand={() => setRequestedTab('search')}
              onLogout={logout}
            />
          ) : (
            <div style={{ maxWidth: '720px', margin: '3rem auto', padding: '0 1rem' }}>
              <div style={{ background: 'rgba(15, 23, 42, 0.9)', backdropFilter: 'blur(24px)', border: '1px solid rgba(56, 189, 248, 0.35)', borderRadius: '20px', padding: '3rem 2rem', textAlign: 'center', boxShadow: '0 0 40px rgba(56, 189, 248, 0.2)' }}>
                <KeyRound size={44} color="#38bdf8" style={{ marginBottom: '1rem' }} />
                <h2 style={{ fontSize: '1.9rem', fontWeight: 'bold', color: '#fff', margin: '0 0 10px 0' }}>Sign in to open your dashboard</h2>
                <p style={{ color: '#cbd5e1', maxWidth: '520px', margin: '0 auto 1.75rem auto', lineHeight: '1.6' }}>
                  The dashboard shows the parcels, registrations, transfers, documents, and notifications available to your role.
                </p>
              <button
                  onClick={() => setShowAuth(true)}
                  style={{ background: '#0284c7', color: '#fff', border: 'none', padding: '13px 28px', borderRadius: '12px', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '10px', boxShadow: '0 0 25px rgba(2, 132, 199, 0.5)' }}
                >
                  <KeyRound size={18} /> Sign in
                </button>
              </div>
            </div>
          )
        )}

        {/* PAGE 7: NOTIFICATIONS */}
        {activeTab === 'notifications' && (
          <div style={{ maxWidth: '860px', margin: '2.5rem auto', padding: '0 1rem' }}>
            {user ? (
              <NotificationsPanel onUnreadChange={setUnreadCount} />
            ) : (
              <div style={{ background: 'rgba(15, 23, 42, 0.9)', backdropFilter: 'blur(24px)', border: '1px solid rgba(56, 189, 248, 0.35)', borderRadius: '20px', padding: '3rem 2rem', textAlign: 'center', boxShadow: '0 0 40px rgba(56, 189, 248, 0.2)' }}>
                <Bell size={44} color="#38bdf8" style={{ marginBottom: '1rem' }} />
                <h2 style={{ fontSize: '1.9rem', fontWeight: 'bold', color: '#fff', margin: '0 0 10px 0' }}>Sign in to view notifications</h2>
                <p style={{ color: '#cbd5e1', maxWidth: '520px', margin: '0 auto 1.75rem auto', lineHeight: '1.6' }}>
                  Registration and transfer decisions, freeze actions, and account updates are delivered to your account.
                </p>
                <button
                  onClick={() => setShowAuth(true)}
                  style={{ background: '#0284c7', color: '#fff', border: 'none', padding: '13px 28px', borderRadius: '12px', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '10px', boxShadow: '0 0 25px rgba(2, 132, 199, 0.5)' }}
                >
                  <KeyRound size={18} /> Sign in
                </button>
              </div>
            )}
          </div>
        )}

        {/* PAGE 8: ABOUT US */}
        {activeTab === 'about' && (
          <div style={{ maxWidth: '900px', margin: '2.5rem auto', padding: '0 1rem' }}>
            <div style={{ background: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(20px)', border: '1px solid rgba(56, 189, 248, 0.3)', borderRadius: '20px', padding: '2.5rem', color: '#fff' }}>
              <h2 style={{ fontSize: '2.2rem', color: '#38bdf8', marginTop: 0, borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem' }}>
                About LandRegistryChain
              </h2>
              <p style={{ fontSize: '1.05rem', lineHeight: '1.7', color: '#e2e8f0' }}>
                <strong>LandRegistryChain</strong> is a land registry and audit workspace. Parcels, ownership, documents, reviews, and evidence are recorded in a relational database, while approved changes can be anchored to an Ethereum-compatible smart contract when blockchain integration is configured.
              </p>

              <h3 style={{ color: '#38bdf8', marginTop: '2rem' }}>How records and anchoring work</h3>
              <p style={{ lineHeight: '1.7', color: '#cbd5e1' }}>
                Registry decisions are made in the application and stored in the database. When a blockchain event is approved, it is queued in an outbox and submitted to the configured contract by a background worker. Database approval and on-chain confirmation are tracked separately, so an approved database change is not presented as a blockchain confirmation until the transaction is mined and reconciled.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginTop: '2rem' }}>
                <div style={{ background: 'rgba(2, 6, 23, 0.7)', padding: '1.25rem', borderRadius: '12px', border: '1px solid rgba(56, 189, 248, 0.2)' }}>
                  <Shield size={28} color="#38bdf8" style={{ marginBottom: '8px' }} />
                  <h4 style={{ margin: '0 0 6px 0', color: '#fff' }}>Tamper-evident anchoring</h4>
                  <p style={{ margin: 0, fontSize: '0.88rem', color: '#94a3b8' }}>Approved registration and transfer events are queued for the configured smart contract, with transaction status and block confirmation recorded separately.</p>
                </div>

                <div style={{ background: 'rgba(2, 6, 23, 0.7)', padding: '1.25rem', borderRadius: '12px', border: '1px solid rgba(56, 189, 248, 0.2)' }}>
                  <FileCheck size={28} color="#22c55e" style={{ marginBottom: '8px' }} />
                  <h4 style={{ margin: '0 0 6px 0', color: '#fff' }}>Auditability</h4>
                  <p style={{ margin: 0, fontSize: '0.88rem', color: '#94a3b8' }}>Administrative actions, review decisions, document digests, and evidence custody are recorded in the application audit trail and evidence register.</p>
                </div>
              </div>

              <p style={{ marginTop: '1.75rem', color: '#94a3b8', fontSize: '0.88rem', lineHeight: '1.6' }}>
                Document files are stored by the application file service and identified by SHA-256 digests. Wallet linking records a public address on the account; it is separate from role-based authentication.
              </p>
            </div>
          </div>
        )}

      </main>

      <Footer onNavigate={setRequestedTab} />

      <AuthModal key={authMode} open={showAuth} initialMode={authMode} onClose={() => { setShowAuth(false); if (['/login', '/register', '/verify-email'].includes(window.location.pathname)) window.history.pushState({}, '', '/'); }} />
    </div>
  );
}
