import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './AuthProvider';
import { useState } from 'react';

const nav=[['Dashboard','/admin/dashboard'],['Projects','/admin/projects'],['Games','/admin/games'],['Components','/admin/components'],['Search','/admin/search'],['Publishing','/admin/publishing'],['GitHub Discovery','/admin/github'],['Knowledge Sync','/admin/knowledge'],['Backups','/admin/backups'],['Audit','/admin/audit'],['Settings','/admin/settings']];
export function Shell(){
  const {admin,logout}=useAuth(); const navigate=useNavigate(); const location=useLocation(); const [q,setQ]=useState('');
  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand admin-brand"><a href="/" className="admin-brand-link" aria-label="InHaus Technology home"><img className="admin-brand-mark" src="/assets/inhaus-mark.svg" alt="" aria-hidden="true" /><span className="admin-brand-name">InHaus Technology</span></a><span className="admin-brand-subtitle">Project Manager</span></div>
      <nav>{nav.map(([label,to])=><NavLink key={to} to={to} className={({isActive})=>isActive?'nav-item active':'nav-item'}>{label}</NavLink>)}</nav>
      <div className="sidebar-footer"><span className="wallet-label">{(admin?.wallet_address||admin?.walletAddress||'').slice(0,8)}…</span><button className="button ghost" onClick={async()=>{await logout();navigate('/admin');}}>Sign out</button></div>
    </aside>
    <main className="main">
      <header className="topbar"><form className="global-search" onSubmit={e=>{e.preventDefault();if(q.trim())navigate(`/admin/search?q=${encodeURIComponent(q.trim())}`)}}><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search projects, contracts, URLs, repos, servers, components…" /><button>Search</button></form><span className="route-chip">{location.pathname.replace('/admin/','')||'admin'}</span></header>
      <div className="content"><Outlet/></div>
    </main>
  </div>
}
