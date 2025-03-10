import { User } from 'entities/User';
import { UserRepository } from 'repositories/interface/userRepository';
import {
  AuthorizationError
} from '../domainErrors';

export class clientUseCase {
  private userRepository;

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
  ): Promise<User[]> {

    if (role !== "admin" || role !== "doula") {
      throw new AuthorizationError("forbidden");
    }

    let users;
    try {
      if (role === "admin") {
        // return all the users of the client role
        users = await this.userRepository.findByRole("client");
      }
      else if (role === "doula") {
        // return the clients assigned to the doula
        users = await this.userRepository.findClientsByDoula(id);
      }
    }
    catch (error) {
      throw new Error(`Could not return clients: ${error.message}`);
    }

  }
}