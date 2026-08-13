import { createConfig, http } from 'wagmi';
import { mainnet, sepolia } from 'wagmi/chains';
import { injected, walletConnect } from 'wagmi/connectors';

const connectors: any[] = [injected()];
const walletConnectProjectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID;
if (walletConnectProjectId) connectors.push(walletConnect({ projectId: walletConnectProjectId, showQrModal: true }));

export const wagmiConfig = createConfig({
  chains: [mainnet, sepolia],
  connectors,
  transports: { [mainnet.id]: http(), [sepolia.id]: http() }
});
