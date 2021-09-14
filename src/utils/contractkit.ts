import { ContractKit, newKit } from '@celo/contractkit'

let contractKit: ContractKit
export async function getContractKit(): Promise<ContractKit> {
  if (contractKit && (await contractKit.connection.isListening())) {
    return contractKit
  } else {
    contractKit = newKit('https://forno.celo.org');
    return contractKit
  }
}
