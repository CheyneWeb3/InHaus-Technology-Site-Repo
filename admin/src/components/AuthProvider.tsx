import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api, setCsrfToken } from '../lib/api';

type Admin = { id:string; wallet_address?:string; walletAddress?:string; display_name?:string|null; displayName?:string|null; role:string };
type AuthState = { loading:boolean; authenticated:boolean; admin:Admin|null; refresh:()=>Promise<void>; logout:()=>Promise<void> };
const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }:{children:React.ReactNode}) {
  const [loading,setLoading]=useState(true); const [admin,setAdmin]=useState<Admin|null>(null);
  const refresh=async()=>{ setLoading(true); try { const data=await api<any>('/auth/session'); if(data.authenticated){setCsrfToken(data.csrfToken);setAdmin(data.admin);} else {setCsrfToken('');setAdmin(null);} } catch {setCsrfToken('');setAdmin(null);} finally {setLoading(false);} };
  const logout=async()=>{ await api('/auth/logout',{method:'POST',body:'{}'}).catch(()=>{}); setCsrfToken(''); setAdmin(null); };
  useEffect(()=>{void refresh();},[]);
  const value=useMemo(()=>({loading,authenticated:Boolean(admin),admin,refresh,logout}),[loading,admin]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth(){const v=useContext(AuthContext);if(!v)throw new Error('AuthProvider missing');return v;}
