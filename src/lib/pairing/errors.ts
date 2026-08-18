export class PairingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PairingError";
  }
}
