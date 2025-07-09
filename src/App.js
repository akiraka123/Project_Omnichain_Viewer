import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import NFTViewer from './components/NFTViewer';
import './App.css';

function App() {
  const [account, setAccount] = useState('');
  const [provider, setProvider] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [currentNetwork, setCurrentNetwork] = useState('bsc-testnet');

  // Network Configurations
  const NETWORKS = {
    'bsc-testnet': {
      chainId: '0x61', // 97 in hex
      chainName: 'BSC Testnet',
      rpcUrls: ['https://data-seed-prebsc-1-s1.binance.org:8545/'],
      nativeCurrency: {
        name: 'BNB',
        symbol: 'BNB',
        decimals: 18
      },
      blockExplorerUrls: ['https://testnet.bscscan.com/'],
      contracts: ['0x367Dea712BAD2D63090DA17AB2257363A39D00Ad']
    },
    'eth-sepolia': {
      chainId: '0xaa36a7', // 11155111 in hex
      chainName: 'Ethereum Sepolia',
      rpcUrls: ['https://rpc.sepolia.org'],
      nativeCurrency: {
        name: 'ETH',
        symbol: 'ETH',
        decimals: 18
      },
      blockExplorerUrls: ['https://sepolia.etherscan.io/'],
      contracts: ['0xE7728F3183966430f62D8d6e1Ed29CD5B9469cb6']
    },
    'arbitrum-sepolia': {
      chainId: '0x66eee', // 421614 in hex
      chainName: 'Arbitrum Sepolia',
      rpcUrls: ['https://sepolia-rollup.arbitrum.io/rpc'],
      nativeCurrency: {
        name: 'ETH',
        symbol: 'ETH',
        decimals: 18
      },
      blockExplorerUrls: ['https://sepolia.arbiscan.io/'],
      contracts: ['0x666A106AA3b50b31E048d261C3431904Dd03bC9E']
    }
  };

  const switchNetwork = async (networkKey) => {
    try {
      const networkConfig = NETWORKS[networkKey];
      
      // Switch to the network
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: networkConfig.chainId }]
        });
      } catch (switchError) {
        // Network not added, add it
        if (switchError.code === 4902) {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [networkConfig]
          });
        }
      }
      
      setCurrentNetwork(networkKey);
      
      // Update provider
      if (window.ethereum) {
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        setProvider(provider);
      }
    } catch (error) {
      console.error('Error switching network:', error);
    }
  };

  const connectWallet = async () => {
    try {
      if (window.ethereum) {
        // Request account access
        const accounts = await window.ethereum.request({
          method: 'eth_requestAccounts'
        });

        // Switch to selected network
        await switchNetwork(currentNetwork);

        const provider = new ethers.providers.Web3Provider(window.ethereum);
        setProvider(provider);
        setAccount(accounts[0]);
        setIsConnected(true);
      } else {
        alert('MetaMask tidak terdeteksi. Silakan install MetaMask.');
      }
    } catch (error) {
      console.error('Error connecting wallet:', error);
    }
  };

  const disconnectWallet = () => {
    setAccount('');
    setProvider(null);
    setIsConnected(false);
  };

  // Listen for network changes
  useEffect(() => {
    if (window.ethereum) {
      window.ethereum.on('chainChanged', (chainId) => {
        // Find network by chainId
        const networkKey = Object.keys(NETWORKS).find(key => 
          NETWORKS[key].chainId === chainId
        );
        if (networkKey) {
          setCurrentNetwork(networkKey);
        }
      });
    }
  }, []);

  return (
    <div className="App">
      <header className="App-header">
        <h1>Omnichain NFT Viewer</h1>
        
        <div className="header-controls">
          {/* Network Selector */}
          <div className="network-selector">
            <label>Select Network:</label>
            <select 
              value={currentNetwork} 
              onChange={(e) => setCurrentNetwork(e.target.value)}
              disabled={isConnected}
            >
              <option value="bsc-testnet">BSC Testnet</option>
              <option value="eth-sepolia">Ethereum Sepolia</option>
              <option value="arbitrum-sepolia">Arbitrum Sepolia</option>
            </select>
          </div>
          
          {!isConnected ? (
            <div className="wallet-connection">
              <button onClick={connectWallet} className="connect-btn">
                Connect MetaMask
              </button>
              <p>Connect to view NFTs</p>
            </div>
          ) : (
            <div className="wallet-info">
              <p>Connected: {account.slice(0, 6)}...{account.slice(-4)}</p>
              <p>Network: {NETWORKS[currentNetwork].chainName}</p>
              <div className="wallet-actions">
                <button onClick={disconnectWallet} className="disconnect-btn">
                  Disconnect
                </button>
                <button 
                  onClick={() => switchNetwork(currentNetwork)} 
                  className="switch-network-btn"
                >
                  Switch Network
                </button>
              </div>
            </div>
          )}
        </div>
      </header>

      <main>
        {isConnected && provider && (
          <NFTViewer 
            account={account} 
            provider={provider} 
            networkConfig={NETWORKS[currentNetwork]}
            currentNetwork={currentNetwork}
          />
        )}
      </main>
    </div>
  );
}

export default App;
