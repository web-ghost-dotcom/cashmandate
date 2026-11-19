export class MandateError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'MandateError';
  }
}

export class InvalidMandateTermsError extends MandateError {
  public constructor(message: string) {
    super(`Invalid mandate terms: ${message}`);
    this.name = 'InvalidMandateTermsError';
  }
}

export class VaultNotFundedError extends MandateError {
  public constructor(contractAddress: string) {
    super(`No vault output found at ${contractAddress}`);
    this.name = 'VaultNotFundedError';
  }
}

export class InsufficientFundsError extends MandateError {
  public constructor(address: string, requiredSatoshis: bigint, availableSatoshis: bigint) {
    super(`Address ${address} holds ${availableSatoshis} satoshis but ${requiredSatoshis} are required`);
    this.name = 'InsufficientFundsError';
  }
}

export class UnknownRecipientError extends MandateError {
  public constructor(recipientIndex: number, approvedCount: number) {
    super(`Recipient index ${recipientIndex} is outside the ${approvedCount} approved recipients`);
    this.name = 'UnknownRecipientError';
  }
}
