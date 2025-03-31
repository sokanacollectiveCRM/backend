enum Role {
  ADMIN = "admin",
  DOULA = "doula",
  CLIENT = "client"
};

enum 

export class User {
  id: string;
  username: string;
  email: string;
  firstname: string;
  lastname: string;
  createdAt: Date;
  updatedAt: Date;
  role: string;
  address: string;
  city: string;
  state: string;
  coutnry: string;
  zip_code: number;
  profile_picture: Buffer;
  account_status: string;


  constructor(data: {
    id?: string;
    username: string;
    email: string;
    firstname?: string;
    lastname?: string;
    createdAt?: Date;
    updatedAt?: Date;
    role?: string;
  }) {
    this.id = data.id || crypto.randomUUID();
    this.username = data.username;
    this.email = data.email;
    this.firstname = data.firstname || '';
    this.lastname = data.lastname || '';
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
    this.role = data.role || 'client';
  }

  getFullName(): string {
    return `${this.firstname} ${this.lastname}`.trim();
  }

  toJSON(): object {
    return {
      id: this.id,
      username: this.username,
      email: this.email,
      firstname: this.firstname,
      lastname: this.lastname,
      fullName: this.getFullName(),
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      role: this.role
    };
  }
}