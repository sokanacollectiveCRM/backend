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

    // if (role !== "admin" && role !== "doula") {
    //   throw new AuthorizationError("forbidden");
    // }
    try {
    let users = await this.userRepository.findClientsAll();
    // let users;
    // try {
    //   if (role === "admin") {
    //     // return all the users of the client role
        
    //   }
    //   else if (role === "doula") {
    //     // return the clients assigned to the doula
    //     users = await this.userRepository.findClientsByDoula(id);
    //   }

      return users;
    }
    catch (error) {
      throw new Error(`Could not return clients: ${error.message}`);
    }
  }
}