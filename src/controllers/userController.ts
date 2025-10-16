import { Response } from 'express';
import { AuthenticationError, AuthorizationError, ConflictError, NotFoundError, ValidationError } from '../domains/errors';
import { AuthRequest, UpdateRequest } from '../types';
import { UserUseCase } from "../usecase/userUseCase";


export class UserController {
  private userUseCase: UserUseCase;

  constructor(userUseCase: UserUseCase) {
    this.userUseCase = userUseCase;
  }

  async getUserById(req: AuthRequest, res: Response): Promise<void> {
    try {
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
  async getAllTeamMembers(req: AuthRequest, res: Response): Promise<void> {
    try {
      const users = await this.userUseCase.getAllTeamMembers();
      res.status(200).json(users.map(user => user.toJSON()));
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async getAllDoulas(req: AuthRequest, res: Response): Promise<void> {
    try {
      const doulas = await this.userUseCase.getDoulasList();
      res.json({
        success: true,
        doulas: doulas.map(d => ({
          id: d.id,
          firstname: d.firstname,
          lastname: d.lastname,
          email: d.email,
          profile_picture: d.profile_picture,
          bio: d.bio,
          phone_number: d.phone_number
        }))
      });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async deleteMember(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.params.id;
      await this.userUseCase.deleteMember(userId);
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async addMember(req: AuthRequest, res: Response): Promise<void>{
    try{
      const userName = req.params.firstname
      const userEmail = req.params.email
      const userRole = req.params.role
      const userBio = req.params.bio
      const user = await this.userUseCase.addMember(userName, userEmail, userRole, userBio)
      res.status(200).json(user.toJSON())
    } catch (error) {
      this.handleError(error, res)
    }
  }

  async getHours(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id, role } = req.user;
      if(role === "admin") {
        const allHoursData = await this.userUseCase.getAllHours();
        res.status(200).json(allHoursData);
      } else {
        const specificHoursData = await this.userUseCase.getHoursById(id);
        res.status(200).json(specificHoursData);
      }
    } catch (error) {
      console.log("Error when retrieving user's work data");
      this.handleError(error, res);
    }
  }

  async addNewHours(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { doula_id, client_id, start_time, end_time, note } = req.body;

      if(!doula_id || !client_id || !start_time|| !end_time) {
        console.log(`${doula_id}, ${client_id}, ${start_time}, ${end_time}`);
        throw new Error(`Error: missing doula_id, client_id, start_time, or end_time`);
      }

      const newWorkEntry = await this.userUseCase.addNewHours(doula_id, client_id, new Date(start_time), new Date(end_time), note);
      res.status(200).json(newWorkEntry);
    } catch (error) {
      console.log("Error trying to add new work entry");
      this.handleError(error, res);
    }
  }

  async updateUser(req: UpdateRequest, res: Response): Promise<void> {
    try {
      const user = req.user
      const updateData = req.body;
      const profilePicture = req.file;

      // upload profile picture to supabase storage so we can grab it later
      if (profilePicture) {
        const imageUrl = await this.userUseCase.uploadProfilePicture(user, profilePicture);
        updateData.profile_picture = imageUrl;
      }

      // Here we will handle which fields to update
      const updatedUser = await this.userUseCase.updateUser(user, updateData);

      res.status(200).json(updatedUser.toJSON());
    } catch(error) {
      res.status(400).json({ error: error.message});
    }
  }

  async addTeamMember(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { firstname, lastname, email, role } = req.body;

      if (!firstname || !lastname || !email || !role) {
        res.status(400).json({ error: 'Missing required fields' });
        return;
      }

      const newMember = await this.userUseCase.addMember(firstname, lastname, email, role);
      res.status(201).json(newMember);
    } catch (error) {
      console.error('Error adding team member:', error);
      res.status(500).json({ error: error.message });
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
