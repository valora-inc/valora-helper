import { ContractKitProvider } from '@celo-tools/use-contractkit';
import React from 'react';
import ReactDOM from 'react-dom';
import App from './App';
import '@celo-tools/use-contractkit/lib/styles.css'; 
import './index.css';

ReactDOM.render(
  <React.StrictMode>
    <ContractKitProvider
      dapp={{
          name: "Valora helper",
          description: "This app can help you recover funds stuck in the MTW",
          url: "https://example.com",
          icon: "https://valoraapp.com/favicon.ico"
        }}
    >
      <App />
    </ContractKitProvider>
  </React.StrictMode>,
  document.getElementById('root')
);
