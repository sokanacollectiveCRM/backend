export class Template {
  constructor(
    public id: string,
    public name: string,
    public depositFee: number,
    public serviceFee: number,
    public storagePath: string,
  ) {}

  toJson() {
    return {
      id: this.id,
      name: this.name,
      depositFee: this.depositFee,
      serviceFee: this.serviceFee,
      storagePath: this.storagePath,
    }
  }
}