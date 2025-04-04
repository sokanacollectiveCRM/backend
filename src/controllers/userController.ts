import { Response } from 'express';
import { AuthenticationError, AuthorizationError, ConflictError, NotFoundError, ValidationError } from 'domains/errors';
import { UserUseCase } from "usecase/UserUseCase";
import { AuthRequest } from "types";

export class UserController {
  private userUseCase: UserUseCase;

  constructor(userUseCase: UserUseCase) {
    this.userUseCase = userUseCase;
  }

  async getUserById(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id, role } = req.user;
      const targetUserId = req.params.id;

      const user = await this.userUseCase.getUserById(targetUserId);
      res.status(200).json(user.toJSON());
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async getAllUsers(req: AuthRequest, res: Response): Promise<void> {
    try {
      const users = await this.userUseCase.getAllUsers();
      res.status(200).json(users.map(user => user.toJSON()));
    } catch (error) {
      this.handleError(error, res);
    }
  }

  private handleError(error: Error, res: Response): void {
    console.error('Error:', error.message);
    
    if (error instanceof ValidationError) {
      res.status(400).json({ error: error.message });
    } else if (error instanceof ConflictError) {
      res.status(409).json({ error: error.message });
    } else if (error instanceof AuthenticationError) {
      res.status(401).json({ error: error.message });
    } else if (error instanceof NotFoundError) {
      res.status(404).json({ error: error.message });
    } else if (error instanceof AuthorizationError) {
      res.status(403).json({ error: error.message });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
}