export class User {
  constructor(
    public user_id: string,
    public role: string,
  ) {}

  getRole(): string {
    return this.role;
  }
}