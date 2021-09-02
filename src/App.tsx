import { useContractKit } from '@celo-tools/use-contractkit';
import { toTransactionObject } from '@celo/connect';
import { ContractKit, StableToken } from '@celo/contractkit';
import { toRawTransaction } from '@celo/contractkit/lib/wrappers/MetaTransactionWallet';
import axios from 'axios';
import React, { useState } from 'react';
import './App.css';

async function fetchWalletAddressForAccount(kit: ContractKit, address: string) {
  const accounts = await kit.contracts.getAccounts();
  const walletAddress = await accounts.getWalletAddress(address);
  return walletAddress ?? address
}

async function rescueFundsFromMTW(
  kit: ContractKit,
  address: string
): Promise<{ txHashes: string[], error?: string}> {
  const txHashes: string[] = []
  try {
    const walletAddress = await fetchWalletAddressForAccount(kit, address)
    const response = await axios.get(`https://us-central1-celo-mobile-mainnet.cloudfunctions.net/fetchAccountsForWalletAddress?walletAddress=${walletAddress.toLowerCase()}`)
    const accountAddresses = response.data.filter((accountAddress: string) => accountAddress.toLowerCase() !== address);
    for (const metaTxWalletAddress of accountAddresses) {
      try {
        const batch: any[] = []
        const cUSD = await kit.contracts.getStableToken(StableToken.cUSD)
        const cUSDBalance = await cUSD.balanceOf(metaTxWalletAddress)
        batch.push(toRawTransaction(cUSD.transfer(walletAddress, cUSDBalance.toFixed()).txo))
  
        const cEUR = await kit.contracts.getStableToken(StableToken.cEUR)
        const cEURBalance = await cEUR.balanceOf(metaTxWalletAddress)
        batch.push(toRawTransaction(cEUR.transfer(walletAddress, cEURBalance.toFixed()).txo))
  
        const celo = await kit.contracts.getGoldToken()
        const celoBalance = await celo.balanceOf(metaTxWalletAddress)
        batch.push(toRawTransaction(celo.transfer(walletAddress, celoBalance.toFixed()).txo))
  
        const wallet = await kit.contracts.getMetaTransactionWallet(metaTxWalletAddress)
  
        const tx = toTransactionObject(
          kit.connection,
          wallet.executeTransactions(batch).txo
        )
        const receipt = await tx.sendAndWaitForReceipt({ from: walletAddress })
        txHashes.push(receipt.transactionHash)
      } catch (err) {
        console.error(err)
      }
    }
    return { 
      txHashes,
      error: txHashes.length ? undefined : "Couldn't find any valid Meta Transaction Wallet for your address"
    }
  } catch (error) {
    return {
      txHashes,
      error: `Unexpected error: ${error}`
    }
  }
}

function App() {
  const { connect, performActions, address } = useContractKit();
  const [txHashes, setTxHashes] = useState<string[]>([])
  const [error, setError] = useState<string | undefined>()

  async function onClickRecover() {
    await performActions(async (kit) => {
      const { txHashes, error } = await rescueFundsFromMTW(kit, address!)
      setTxHashes(txHashes)
      setError(error)
    });
  }

  return (
    <div className="App">
      {address ? (
        <>
          <div onClick={onClickRecover} className="button">Recover funds from MTW</div>
          {txHashes.map((txHash: string) => 
            <a href={`https://explorer.celo.org/tx/${txHash}`} target="_blank" rel="noreferrer">
              TX Hash: {txHash}
            </a>
          )}
          {error && <div>Error: {error}</div>}
        </>
      ) : (
        <div onClick={connect} className="button">Connect to your wallet</div>
      )}
    </div>
  );
}

export default App;
