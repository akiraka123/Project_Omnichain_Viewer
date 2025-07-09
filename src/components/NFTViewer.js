import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import axios from 'axios';
import './NFTViewer.css';

// ERC-721 ABI yang lebih lengkap
const ERC721_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)",
  "function tokenURI(uint256 tokenId) view returns (string)",
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function totalSupply() view returns (uint256)",
  "function tokenByIndex(uint256 index) view returns (uint256)",
  "function supportsInterface(bytes4 interfaceId) view returns (bool)"
];

const NFTViewer = ({ account, provider, networkConfig, currentNetwork }) => {
  const [nfts, setNfts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [contractAddress, setContractAddress] = useState('');
  const [debugInfo, setDebugInfo] = useState('');
  const [showDebug, setShowDebug] = useState(false);

  const addDebugInfo = (info) => {
    console.log(info);
    setDebugInfo(prev => prev + '\n' + info);
  };

  const fetchNFTsFromContract = async (contractAddr) => {
    try {
      if (!contractAddr || contractAddr.length !== 42) {
        addDebugInfo('Invalid contract address');
        return [];
      }
      
      addDebugInfo(`\n=== Checking contract: ${contractAddr} ===`);
      const contract = new ethers.Contract(contractAddr, ERC721_ABI, provider);
      
      // Get collection info
      let name = 'Unknown Collection';
      let symbol = 'UNKNOWN';
      
      try {
        name = await contract.name();
        symbol = await contract.symbol();
        addDebugInfo(`Collection: ${name} (${symbol})`);
      } catch (error) {
        addDebugInfo(`Could not get collection name/symbol: ${error.message}`);
      }
      
      const userNFTs = [];
      
      // Method 1: Try tokenOfOwnerByIndex (ERC721Enumerable) - FASTEST
      try {
        addDebugInfo('Trying tokenOfOwnerByIndex method...');
        const balance = await contract.balanceOf(account);
        const balanceNum = balance.toNumber();
        addDebugInfo(`User balance: ${balanceNum}`);
        
        if (balanceNum === 0) {
          addDebugInfo('User has no NFTs in this contract');
          return [];
        }
        
        for (let i = 0; i < balanceNum; i++) {
          try {
            const tokenId = await contract.tokenOfOwnerByIndex(account, i);
            addDebugInfo(`Found token ID: ${tokenId.toString()}`);
            
            const tokenURI = await contract.tokenURI(tokenId);
            addDebugInfo(`Token URI: ${tokenURI}`);
            
            const metadata = await fetchNFTMetadata(tokenURI);
            
            userNFTs.push({
              contractAddress: contractAddr,
              tokenId: tokenId.toString(),
              tokenURI,
              metadata,
              collectionName: name,
              collectionSymbol: symbol
            });
          } catch (tokenError) {
            addDebugInfo(`Error with token ${i}: ${tokenError.message}`);
          }
        }
        
        if (userNFTs.length > 0) {
          addDebugInfo(`Successfully found ${userNFTs.length} NFTs using tokenOfOwnerByIndex`);
          return userNFTs;
        }
      } catch (error) {
        addDebugInfo(`tokenOfOwnerByIndex not supported: ${error.message}`);
      }
      
      // Method 2: Check specific token IDs (optimized range)
      addDebugInfo('Trying specific token IDs based on network...');
      
      // Check ID 1-30 for all networks (per 10 range but checking all 30)
      let possibleTokenIds = [];
      if (currentNetwork === 'eth-sepolia') {
        // Ethereum Sepolia: Check ID 1-30
        possibleTokenIds = Array.from({length: 30}, (_, i) => i + 1);
        addDebugInfo('Checking Ethereum Sepolia token IDs: 1-30');
      } else if (currentNetwork === 'arbitrum-sepolia') {
        // Arbitrum Sepolia: Check ID 1-30
        possibleTokenIds = Array.from({length: 30}, (_, i) => i + 1);
        addDebugInfo('Checking Arbitrum Sepolia token IDs: 1-30');
      } else if (currentNetwork === 'bsc-testnet') {
        // BSC Testnet: Check ID 1-30
        possibleTokenIds = Array.from({length: 30}, (_, i) => i + 1);
        addDebugInfo('Checking BSC Testnet token IDs: 1-30');
      }
      
      for (const tokenId of possibleTokenIds) {
        try {
          const owner = await contract.ownerOf(tokenId);
          if (owner.toLowerCase() === account.toLowerCase()) {
            addDebugInfo(`Found owned token from specific check: ${tokenId}`);
            
            const tokenURI = await contract.tokenURI(tokenId);
            const metadata = await fetchNFTMetadata(tokenURI);
            
            userNFTs.push({
              contractAddress: contractAddr,
              tokenId: tokenId.toString(),
              tokenURI,
              metadata,
              collectionName: name,
              collectionSymbol: symbol
            });
          }
        } catch (err) {
          // Token might not exist or not owned
          continue;
        }
      }
      
      addDebugInfo(`Final result: ${userNFTs.length} NFTs found`);
      return userNFTs;
    } catch (error) {
      addDebugInfo(`Error fetching NFTs from contract: ${error.message}`);
      return [];
    }
  };

  const fetchNFTMetadata = async (uri) => {
    try {
      if (!uri) return null;
      
      addDebugInfo(`Fetching metadata from: ${uri}`);
      
      // Handle IPFS URLs
      if (uri.startsWith('ipfs://')) {
        uri = uri.replace('ipfs://', 'https://ipfs.io/ipfs/');
      }
      
      // Handle HTTP URLs with reduced timeout
      if (uri.startsWith('http')) {
        const response = await axios.get(uri, { timeout: 5000 });
        addDebugInfo(`Metadata fetched successfully`);
        return response.data;
      }
      
      return null;
    } catch (error) {
      addDebugInfo(`Error fetching metadata: ${error.message}`);
      return null;
    }
  };

  const fetchAllNFTs = async () => {
    setLoading(true);
    setNfts([]);
    setDebugInfo(`Starting NFT fetch on ${networkConfig.chainName}...`);
    
    try {
      let allNFTs = [];
      
      // Check custom contract if provided
      if (contractAddress && contractAddress.length === 42) {
        addDebugInfo(`Checking custom contract: ${contractAddress}`);
        const contractNFTs = await fetchNFTsFromContract(contractAddress);
        allNFTs = [...allNFTs, ...contractNFTs];
      }
      
      // Use contracts from network config
      const knownContracts = networkConfig.contracts || [];
      
      for (const contract of knownContracts) {
        addDebugInfo(`\nChecking ${networkConfig.chainName} contract: ${contract}`);
        const contractNFTs = await fetchNFTsFromContract(contract);
        allNFTs = [...allNFTs, ...contractNFTs];
      }
      
      addDebugInfo(`\nFINAL RESULT: ${allNFTs.length} total NFTs found on ${networkConfig.chainName}`);
      setNfts(allNFTs);
    } catch (error) {
      addDebugInfo(`Error in fetchAllNFTs: ${error.message}`);
      console.error('Error fetching NFTs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (account && provider) {
      fetchAllNFTs();
    }
  }, [account, provider]);

  return (
    <div className="nft-viewer">
      <div className="controls">
        <h2>NFT Koleksi - {networkConfig.chainName}</h2>
        
        <div className="contract-input">
          <input
            type="text"
            placeholder={`Masukkan alamat contract NFT (${networkConfig.contracts[0]})`}
            value={contractAddress}
            onChange={(e) => setContractAddress(e.target.value)}
          />
          <button onClick={fetchAllNFTs} disabled={loading}>
            {loading ? 'Loading...' : 'Refresh NFTs'}
          </button>
          <button 
            onClick={() => setShowDebug(!showDebug)}
            className="debug-toggle"
          >
            {showDebug ? 'Hide Debug' : 'Show Debug'}
          </button>
        </div>
        
        <div className="account-info">
          <small>Alamat wallet: {account}</small>
          <small>Network: {networkConfig.chainName}</small>
        </div>
      </div>

      {loading && (
        <div className="loading">
          <p>Memuat NFT Anda...</p>
          <div className="spinner"></div>
        </div>
      )}

      {/* Debug Info - Hidden by default */}
      {debugInfo && showDebug && (
        <div className="debug-info">
          <h3>Debug Information:</h3>
          <pre>{debugInfo}</pre>
        </div>
      )}

      {nfts.length === 0 && !loading && (
        <div className="no-nfts">
          <p>Tidak ada NFT ditemukan di alamat ini pada {networkConfig.chainName}.</p>
          <p>Coba masukkan alamat contract: <code>{networkConfig.contracts[0]}</code></p>
          <p>Pastikan Anda terhubung ke {networkConfig.chainName} dan memiliki NFT.</p>
          {!showDebug && <p><button onClick={() => setShowDebug(true)} className="debug-btn">Show Debug Info</button></p>}
        </div>
      )}

      <div className="nft-grid">
        {nfts.map((nft, index) => (
          <div key={index} className="nft-card">
            <div className="nft-image">
              {nft.metadata?.image ? (
                <img
                  src={nft.metadata.image.startsWith('ipfs://') 
                    ? nft.metadata.image.replace('ipfs://', 'https://ipfs.io/ipfs/')
                    : nft.metadata.image
                  }
                  alt={nft.metadata.name || 'NFT'}
                  onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.nextSibling.style.display = 'flex';
                  }}
                />
              ) : (
                <div className="no-image">
                  <span>No Image</span>
                </div>
              )}
              <div className="no-image" style={{ display: 'none' }}>
                <span>No Image</span>
              </div>
            </div>
            
            <div className="nft-info">
              <h3>{nft.metadata?.name || `Token #${nft.tokenId}`}</h3>
              <p className="collection">{nft.collectionName} ({nft.collectionSymbol})</p>
              <p className="token-id">Token ID: {nft.tokenId}</p>
              <p className="network-badge">{networkConfig.chainName}</p>
              
              {nft.metadata?.description && (
                <p className="description">{nft.metadata.description}</p>
              )}
              
              <div className="contract-info">
                <small>Contract: {nft.contractAddress}</small>
              </div>
              
              <div className="bscscan-link">
                <a 
                  href={`${networkConfig.blockExplorerUrls[0]}token/${nft.contractAddress}?a=${nft.tokenId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  View on Explorer
                </a>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {/* Credit Section */}
      <div className="credit-section">
        <p className="credit-text">
          Developed by <span className="developer-name">Mochamad Akiraka Harifanda</span>
        </p>
      </div>
    </div>
  );
};

export default NFTViewer;
