import { Navigate,Route,Routes } from 'react-router-dom';
import { useAuth } from './components/AuthProvider';
import { Shell } from './components/Shell';
import { AdminLogin } from './pages/AdminLogin';
import { Dashboard } from './pages/Dashboard';
import { Projects } from './pages/Projects';
import { ProjectDetail } from './pages/ProjectDetail';
import { Search } from './pages/Search';
import { Components } from './pages/Components';
import { ComponentDetail } from './pages/ComponentDetail';
import { GitHubDiscovery } from './pages/GitHubDiscovery';
import { Knowledge } from './pages/Knowledge';
import { Audit } from './pages/Audit';
import { Games } from './pages/Games';
import { Publishing } from './pages/Publishing';
import { Backups } from './pages/Backups';
import { Settings } from './pages/Settings';

function Guard(){const auth=useAuth();if(auth.loading)return <div className="loading-screen">Loading…</div>;if(!auth.authenticated)return <Navigate to="/admin" replace/>;return <Shell/>}
export function App(){return <Routes><Route path="/admin" element={<AdminLogin/>}/><Route element={<Guard/>}><Route path="/admin/dashboard" element={<Dashboard/>}/><Route path="/admin/projects" element={<Projects/>}/><Route path="/admin/games" element={<Games/>}/><Route path="/admin/projects/:id" element={<ProjectDetail/>}/><Route path="/admin/search" element={<Search/>}/><Route path="/admin/components" element={<Components/>}/><Route path="/admin/components/:id" element={<ComponentDetail/>}/><Route path="/admin/github" element={<GitHubDiscovery/>}/><Route path="/admin/knowledge" element={<Knowledge/>}/><Route path="/admin/publishing" element={<Publishing/>}/><Route path="/admin/backups" element={<Backups/>}/><Route path="/admin/settings" element={<Settings/>}/><Route path="/admin/audit" element={<Audit/>}/></Route><Route path="*" element={<Navigate to="/admin" replace/>}/></Routes>}
