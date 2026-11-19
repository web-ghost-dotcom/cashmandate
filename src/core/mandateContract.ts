import { Contract, type NetworkProvider } from 'cashscript';
import cashMandateArtifact from '../../artifacts/CashMandate.artifact';
import { computeApprovedRecipientsHash, validateMandateTerms, type MandateTerms } from './terms';

export type MandateContract = Contract<typeof cashMandateArtifact>;

export function instantiateMandateContract(
  terms: MandateTerms,
  provider: NetworkProvider,
): MandateContract {
  validateMandateTerms(terms);
  return new Contract(
    cashMandateArtifact,
    [
      terms.ownerPublicKeyHash,
      terms.agentPublicKey,
      computeApprovedRecipientsHash(terms.approvedRecipients),
      terms.perSpendLimitSatoshis,
      BigInt(terms.minimumBlocksBetweenSpends),
    ],
    { provider },
  );
}
