import { CeloTxObject, ContractSendMethod } from '@celo/connect'
import { ContractKit } from '@celo/contractkit'
import {
  AccountAuthRequest, AccountAuthResponseSuccess, DappKitRequestMeta,
  DappKitRequestTypes,
  DappKitResponseStatus, parseDappkitResponseDeeplink, serializeDappKitRequestDeeplink,
  SignTxRequest, SignTxResponseSuccess, TxToSignParam
} from '@celo/utils'
import { getContractKit } from './contractkit'

async function openURL(url: string) {
  window.location.href = url
}

function requestAccountAddress(meta: DappKitRequestMeta) {
  openURL(serializeDappKitRequestDeeplink(AccountAuthRequest(meta)))
}

async function waitDecorator(
  requestId: string,
  url: string,
  checkCallback: (requestId: string, dappKitResponse: any) => boolean,
  timeout: number = 60000
): Promise<any> {
  const dappKitResponse = parseDappkitResponseDeeplink(url)
  if (checkCallback(requestId, dappKitResponse)) {
    return dappKitResponse
  }
  throw new Error('Unable to parse Valora response')
}

function checkAccountAuth(requestId: string, dappKitResponse: any): boolean {
  return (
    requestId === dappKitResponse.requestId &&
    dappKitResponse.type === DappKitRequestTypes.ACCOUNT_ADDRESS &&
    dappKitResponse.status === DappKitResponseStatus.SUCCESS
  )
}

function checkSignedTxs(requestId: string, dappKitResponse: any): boolean {
  return (
    requestId === dappKitResponse.requestId &&
    dappKitResponse.type === DappKitRequestTypes.SIGN_TX &&
    dappKitResponse.status === DappKitResponseStatus.SUCCESS
  )
}

async function waitForAccountAuth(requestId: string, url: string): Promise<AccountAuthResponseSuccess> {
  return waitDecorator(requestId, url, checkAccountAuth)
}

async function waitForSignedTxs(requestId: string, url: string): Promise<SignTxResponseSuccess> {
  return waitDecorator(requestId, url, checkSignedTxs)
}

interface TxParams {
  tx: CeloTxObject<any>
  from: string
  to?: string
  estimatedGas?: number
  value?: string
}

async function requestTxSig(
  kit: ContractKit,
  txParams: TxParams[],
  meta: DappKitRequestMeta
) {
  // TODO: For multi-tx payloads, we for now just assume the same from address for all txs. We should apply a better heuristic
  const baseNonce = await kit.connection.nonce(txParams[0].from)
  const txs: TxToSignParam[] = await Promise.all(
    txParams.map(async (txParam, index) => {
      const feeCurrencyContractAddress = '0x765DE816845861e75A25fCA122bb6898B8B1282a'
      const value = txParam.value === undefined ? '0' : txParam.value

      const estimatedTxParams = {
        feeCurrency: feeCurrencyContractAddress,
        from: txParam.from,
        value,
      } as any
      const estimatedGas =
        txParam.estimatedGas === undefined
          ? await txParam.tx.estimateGas(estimatedTxParams)
          : txParam.estimatedGas

      return {
        txData: txParam.tx.encodeABI(),
        estimatedGas,
        nonce: baseNonce + index,
        feeCurrencyAddress: feeCurrencyContractAddress,
        value,
        ...txParam,
      }
    })
  )
  const request = SignTxRequest(txs, meta)

  openURL(serializeDappKitRequestDeeplink(request))
}

async function waitForValoraResponse() {
  const localStorageKey = 'valoraRedirect'
  while (true) {
    const value = localStorage.getItem(localStorageKey)
    if (value) {
      localStorage.removeItem(localStorageKey)
      console.log('From storage', value)
      return value
    }
    await new Promise(resolve => setTimeout(resolve, 100))
  }
}

const dappName = 'Valora Helper'
const callback = window.location.hostname === 'localhost' ? 'http://localhost:3000' : 'https://valora-helper.web.app'

export async function connectToValora() {
  const requestId = 'login'

  requestAccountAddress({
    requestId,
    dappName,
    callback,
  });

  const url = await waitForValoraResponse()
  const dappkitResponse = await waitForAccountAuth(requestId, url);
  
  const kit = await getContractKit()
  kit.defaultAccount = dappkitResponse.address

  return dappkitResponse.address
}

export async function makeTx(address: string, txToSend: CeloTxObject<any>, toAddress: string) {
  const requestId = 'sign_tx';

  const kit = await getContractKit()

  requestTxSig(
    kit,
    [
      {
        tx: txToSend,
        from: address,
        to: toAddress
      }
    ],
    { requestId, dappName, callback }
  );

  const url = await waitForValoraResponse()
  const dappkitResponse = await waitForSignedTxs(requestId, url);
  const rawTx = dappkitResponse.rawTxs[0];

  const tx = await kit.connection.sendSignedTransaction(rawTx);
  const receipt = await tx.waitReceipt();
  return receipt
}
