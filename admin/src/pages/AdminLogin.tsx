import { Navigate, useNavigate } from 'react-router-dom';
import { SiweMessage } from 'siwe';
import { useConnect, useConnection, useConnectors, useSignMessage } from 'wagmi';
import { useState } from 'react';
import { api, jsonBody } from '../lib/api';
import { useAuth } from '../components/AuthProvider';

export function AdminLogin(){
  const auth=useAuth(); const navigate=useNavigate(); const connection=useConnection(); const connectors=useConnectors(); const connect=useConnect(); const sign=useSignMessage();
  const [error,setError]=useState(''); const [busy,setBusy]=useState(false);
  if(auth.authenticated) return <Navigate to="/admin/dashboard" replace/>;
  const login=async()=>{
    setBusy(true);setError('');
    try{
      let address=connection.address; let chainId=connection.chainId;
      if(!address){
        const connector=connectors[0]; if(!connector) throw new Error('No Ethereum wallet connector is available in this browser.');
        const result=await connect.mutateAsync({connector}); address=result.accounts[0]; chainId=result.chainId;
      }
      if(!address) throw new Error('Wallet did not provide an address.');
      const {nonce}=await api<{nonce:string}>('/auth/nonce');
      const message=new SiweMessage({domain:window.location.host,address,statement:'Sign in to the private InHaus Project Manager.',uri:window.location.origin,version:'1',chainId:chainId||1,nonce,issuedAt:new Date().toISOString()}).prepareMessage();
      const signature=await sign.mutateAsync({message});
      const result=await api<any>('/auth/verify',{method:'POST',body:jsonBody({message,signature})});
      if(!result.authenticated) throw new Error('Authentication failed.');
      await auth.refresh(); navigate('/admin/dashboard',{replace:true});
    }catch(e:any){setError(e?.message||'Sign-in failed.');}finally{setBusy(false);}
  };
  return <div className="login-page"><div className="login-glow"/><div className="login-card"><div className="brand-mark large">IH</div><div className="login-wordmark">InHaus</div><button className="siwe-button" disabled={busy||auth.loading} onClick={login}>{busy?'Signing in…':'Sign in with Ethereum'}</button>{error&&<div className="login-error">{error}</div>}</div></div>;
}
