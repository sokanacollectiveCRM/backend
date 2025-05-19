import { User } from 'entities/User';
import type { File as MulterFile } from 'multer';

/**
 * UserRepository defines the interface for user data operations
 */
export interface UserRepository {
  /**
   * Find a user by their email
   */
  findByEmail(email: string): Promise<User | null>;

  /**
   * Get all users by role
   */
  findByRole(role: string): Promise<User[]>;

  /**
   * Get all clients by Doula
   */
  findClientsByDoula(doulaId: string): Promise<User[]>;

  /**
   * FOR SHOWCASE ONLY
   */
  findClientsAll(): Promise<any>;
  
  /**
   * Save a user to the repository
   */
  save(user: User): Promise<User>;

  /**
   * Update a user to the repository
   */
  update(userId: string, fieldsToUpdate: Partial<User>): Promise<User>;
  
  /**
   * Get all users
   */
  findAll(): Promise<User[]>;
  
  /**
   * Find a user by ID
   */
  findById(id: string): Promise<User | null>;
  
  /**
   * Delete a user
   */
  delete(id: string): Promise<void>;

  /**
   * Upload a user profile picture
   */
  uploadProfilePicture(user: User, profilePicture: MulterFile): Promise<string>;

    /**
   * Update the status for a client in client_info
   */
    updateClientStatusToCustomer(userId: string): Promise<void>;

}