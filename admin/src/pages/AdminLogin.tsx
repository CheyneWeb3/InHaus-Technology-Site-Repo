import { Navigate, useNavigate } from 'react-router-dom';
import { getAddress } from 'viem';
import { useConnect, useConnection, useConnectors, useSignMessage } from 'wagmi';
import { useState } from 'react';
import { api, jsonBody } from '../lib/api';
import { useAuth } from '../components/AuthProvider';

function buildSiweMessage(args: {
  domain: string;
  address: string;
  uri: string;
  chainId: number;
  nonce: string;
  issuedAt: string;
}) {
  return [
    `${args.domain} wants you to sign in with your Ethereum account:`,
    args.address,
    '',
    'Sign in to the private InHaus Project Manager.',
    '',
    `URI: ${args.uri}`,
    'Version: 1',
    `Chain ID: ${args.chainId}`,
    `Nonce: ${args.nonce}`,
    `Issued At: ${args.issuedAt}`
  ].join('\n');
}

export function AdminLogin() {
  const auth = useAuth();
  const navigate = useNavigate();
  const connection = useConnection();
  const connectors = useConnectors();
  const connect = useConnect();
  const sign = useSignMessage();

  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (auth.authenticated) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  const login = async () => {
    setBusy(true);
    setError('');

    try {
      let address = connection.address;
      let chainId = connection.chainId;

      if (!address) {
        const connector = connectors[0];

        if (!connector) {
          throw new Error(
            'No Ethereum wallet was detected. Install or enable an EVM wallet and reload this page.'
          );
        }

        const result = await connect.mutateAsync({ connector });
        address = result.accounts[0];
        chainId = result.chainId;
      }

      if (!address) {
        throw new Error('Wallet connected but did not provide an Ethereum address.');
      }

      const checksumAddress = getAddress(address);
      const { nonce } = await api<{ nonce: string }>('/auth/nonce');

      if (!/^[A-Za-z0-9]{8,}$/.test(nonce)) {
        throw new Error('The authentication server returned an invalid SIWE nonce.');
      }

      const message = buildSiweMessage({
        domain: window.location.host,
        address: checksumAddress,
        uri: window.location.origin,
        chainId: Number(chainId || 1),
        nonce,
        issuedAt: new Date().toISOString()
      });

      const signature = await sign.mutateAsync({
        message,
        account: checksumAddress
      });

      const result = await api<{ authenticated: boolean }>('/auth/verify', {
        method: 'POST',
        body: jsonBody({ message, signature })
      });

      if (!result.authenticated) {
        throw new Error('Authentication failed.');
      }

      await auth.refresh();
      navigate('/admin/dashboard', { replace: true });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Sign-in failed.';

      if (/user rejected|user denied|rejected the request/i.test(message)) {
        setError('Wallet signature request was cancelled.');
      } else {
        setError(message);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-glow" aria-hidden="true" />

      <div className="login-card">
        <a className="login-public-brand" href="/" aria-label="InHaus Technology home">
          <img className="login-public-mark" src="/assets/inhaus-mark.svg" alt="" aria-hidden="true" />
          <span className="login-public-name">InHaus Technology</span>
        </a>

        <div className="login-rule" />

        <div className="login-heading">
          <span className="login-eyebrow">PRIVATE CONTROL PLANE</span>
          <h1>Project Manager</h1>
          <p>
            Authorized wallet access to InHaus projects, infrastructure,
            publishing and engineering knowledge.
          </p>
        </div>

        <button
          className="siwe-button"
          disabled={busy || auth.loading}
          onClick={login}
        >
          {busy ? 'Waiting for wallet…' : 'Sign in with Ethereum'}
        </button>

        <div className="login-security-note">
          <span className="login-security-dot" />
          Server-verified SIWE · allowlisted wallets only
        </div>

        {error && <div className="login-error">{error}</div>}
      </div>
    </div>
  );
}
