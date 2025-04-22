import { UserRepository } from 'repositories/interface/userRepository';

export class ClientUseCase {
  private userRepository: UserRepository;

  constructor (userRepository: UserRepository) {
    this.userRepository = userRepository;
  }

  //
  // forward to repository to grab clients based on role
  //
  // returns:
  //    users
  //
  async getClients(
    id: string,
    role: string
  ): Promise<any> {

    try {
      if (role === "admin") {
        let users = await this.userRepository.findClientsAll();
        return users;
      }
    }
    catch (error) {
      throw new Error(`Could not return clients: ${error.message}`);
    }
  }
}