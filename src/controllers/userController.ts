import { Response } from 'express';

import {
  AuthenticationError,
  AuthorizationError,
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../domains/errors';
import { CloudSqlTeamService } from '../services/cloudSqlTeamService';
import { DoulaDocumentCompletenessService } from '../services/doulaDocumentCompletenessService';
import { AuthRequest, UpdateRequest } from '../types';
import { UserUseCase } from '../usecase/userUseCase';
import {
  buildHourSummary,
  parseHourFilter,
  parseHourType,
} from '../utils/hourTypes';

export class UserController {
  private userUseCase: UserUseCase;
  private cloudSqlTeamService: CloudSqlTeamService;
  private documentCompletenessService: DoulaDocumentCompletenessService | null;

  constructor(
    userUseCase: UserUseCase,
    documentCompletenessService?: DoulaDocumentCompletenessService | null
  ) {
    this.userUseCase = userUseCase;
    this.cloudSqlTeamService = new CloudSqlTeamService();
    this.documentCompletenessService = documentCompletenessService ?? null;
  }

  async getUserById(req: AuthRequest, res: Response): Promise<void> {
    try {
      const targetUserId = req.params.id;

      // Staff profiles are in Cloud SQL; Supabase public.users is gone.
      const member =
        await this.cloudSqlTeamService.getTeamMemberById(targetUserId);
      if (member) {
        res.status(200).json({
          ...member,
          phone: member.phone_number,
          fullName: member.fullName,
        });
        return;
      }

      const user = await this.userUseCase.getUserById(targetUserId);
      res.status(200).json(user.toJSON());
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async getAllUsers(req: AuthRequest, res: Response): Promise<void> {
    try {
      const users = await this.cloudSqlTeamService.listTeamMembers();
      res.status(200).json(users);
    } catch (error) {
      this.handleError(error, res);
    }
  }
  async getAllTeamMembers(req: AuthRequest, res: Response): Promise<void> {
    try {
      const users = await this.cloudSqlTeamService.listTeamMembers();
      res.status(200).json(users);
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async getAllDoulas(req: AuthRequest, res: Response): Promise<void> {
    try {
      const doulas = await this.cloudSqlTeamService.listDoulas();
      res.json({
        success: true,
        doulas: doulas.map((d) => ({
          id: d.id,
          firstname: d.firstname,
          lastname: d.lastname,
          email: d.email,
          profile_picture: d.profile_picture ?? null,
          bio: d.bio ?? null,
          phone_number: d.phone_number,
          scheduling_url: d.scheduling_url ?? null,
        })),
      });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async deleteMember(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.params.id;
      const removed = await this.cloudSqlTeamService.deleteTeamMember(userId);
      if (!removed) {
        res
          .status(404)
          .json({ success: false, error: 'Team member not found' });
        return;
      }
      res.status(200).json({
        success: true,
        message: 'Team member has been deleted successfully',
      });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async addMember(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userName = req.params.firstname;
      const userEmail = req.params.email;
      const userRole = req.params.role;
      const userBio = req.params.bio;
      const user = await this.userUseCase.addMember(
        userName,
        userEmail,
        userRole,
        userBio
      );
      res.status(200).json(user.toJSON());
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async getHours(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id, role } = req.user;
      const hourTypeFilter = parseHourFilter(req.query.type);
      if (req.query.type && !hourTypeFilter) {
        res.status(400).json({
          error:
            'Invalid hour type filter. Must be prenatal, postpartum, or unknown',
        });
        return;
      }

      if (role === 'admin') {
        const allHoursData = await this.userUseCase.getAllHours();
        const hours = hourTypeFilter
          ? allHoursData.filter(
              (entry: any) => (entry.type ?? 'unknown') === hourTypeFilter
            )
          : allHoursData;
        res.status(200).json({
          success: true,
          hours,
          summary: buildHourSummary(hours),
        });
      } else {
        const specificHoursData = await this.userUseCase.getHoursById(id);
        const hours = hourTypeFilter
          ? specificHoursData.filter(
              (entry: any) => (entry.type ?? 'unknown') === hourTypeFilter
            )
          : specificHoursData;
        res.status(200).json({
          success: true,
          hours,
          summary: buildHourSummary(hours),
        });
      }
    } catch (error) {
      console.log("Error when retrieving user's work data");
      this.handleError(error, res);
    }
  }

  async addNewHours(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { doula_id, client_id, start_time, end_time, note, type } =
        req.body;

      const normalizedType = parseHourType(type);
      if (!normalizedType) {
        res.status(400).json({
          error: 'type is required and must be either prenatal or postpartum',
        });
        return;
      }

      if (!doula_id || !client_id || !start_time || !end_time) {
        console.log(`${doula_id}, ${client_id}, ${start_time}, ${end_time}`);
        throw new Error(
          `Error: missing doula_id, client_id, start_time, or end_time`
        );
      }

      const newWorkEntry = await this.userUseCase.addNewHours(
        doula_id,
        client_id,
        new Date(start_time),
        new Date(end_time),
        note,
        normalizedType
      );
      res.status(200).json(newWorkEntry);
    } catch (error) {
      console.log('Error trying to add new work entry');
      this.handleError(error, res);
    }
  }

  async updateHour(req: AuthRequest, res: Response): Promise<void> {
    try {
      const hourId = req.params.hourId;
      const { role, id: userId } = req.user ?? {};
      const normalizedType = parseHourType(req.body?.type);

      if (!hourId) {
        res.status(400).json({ error: 'Missing hourId' });
        return;
      }

      if (!normalizedType) {
        res.status(400).json({
          error: 'type is required and must be either prenatal or postpartum',
        });
        return;
      }

      if (role !== 'admin' && role !== 'doula') {
        res.status(403).json({ error: 'Unauthorized' });
        return;
      }

      const updatedHour = await this.userUseCase.updateHourType(
        hourId,
        normalizedType,
        role === 'doula' ? userId : undefined
      );

      res.status(200).json({
        success: true,
        workEntry: updatedHour,
      });
    } catch (error) {
      console.log('Error trying to update work entry');
      this.handleError(error, res);
    }
  }

  async updateUser(req: UpdateRequest, res: Response): Promise<void> {
    try {
      const user = req.user;
      const updateData = { ...(req.body || {}) } as Record<string, unknown>;
      const profilePicture = req.file;

      // upload profile picture to supabase storage so we can grab it later
      if (profilePicture) {
        const imageUrl = await this.userUseCase.uploadProfilePicture(
          user,
          profilePicture
        );
        updateData.profile_picture = imageUrl;
      }

      const role = String(user.role || '').toLowerCase();

      // Staff profiles live in Cloud SQL (admins/doulas). Supabase public.users is gone.
      if (role === 'admin' || role === 'doula') {
        const updated = await this.cloudSqlTeamService.updateTeamMember(
          user.id,
          {
            firstname:
              typeof updateData.firstname === 'string'
                ? updateData.firstname
                : undefined,
            lastname:
              typeof updateData.lastname === 'string'
                ? updateData.lastname
                : undefined,
            email:
              typeof updateData.email === 'string'
                ? updateData.email
                : undefined,
            phone_number:
              typeof updateData.phone_number === 'string'
                ? updateData.phone_number
                : typeof updateData.phone === 'string'
                  ? updateData.phone
                  : undefined,
            address:
              typeof updateData.address === 'string'
                ? updateData.address
                : undefined,
            city:
              typeof updateData.city === 'string' ? updateData.city : undefined,
            state:
              typeof updateData.state === 'string'
                ? updateData.state
                : undefined,
            country:
              typeof updateData.country === 'string'
                ? updateData.country
                : undefined,
            zip_code:
              updateData.zip_code === null ||
              typeof updateData.zip_code === 'string' ||
              typeof updateData.zip_code === 'number'
                ? (updateData.zip_code as string | null)
                : undefined,
            bio:
              typeof updateData.bio === 'string' ? updateData.bio : undefined,
            gender:
              typeof updateData.gender === 'string'
                ? updateData.gender
                : undefined,
            pronouns:
              typeof updateData.pronouns === 'string'
                ? updateData.pronouns
                : undefined,
            race_ethnicity: Array.isArray(updateData.race_ethnicity)
              ? (updateData.race_ethnicity as string[])
              : undefined,
            languages_other_than_english: Array.isArray(
              updateData.languages_other_than_english
            )
              ? (updateData.languages_other_than_english as string[])
              : undefined,
            race_ethnicity_other:
              typeof updateData.race_ethnicity_other === 'string'
                ? updateData.race_ethnicity_other
                : undefined,
            other_demographic_details:
              typeof updateData.other_demographic_details === 'string'
                ? updateData.other_demographic_details
                : undefined,
            scheduling_url:
              typeof updateData.scheduling_url === 'string'
                ? updateData.scheduling_url
                : undefined,
            profile_picture:
              typeof updateData.profile_picture === 'string' &&
              updateData.profile_picture.trim().length > 0
                ? updateData.profile_picture.trim()
                : undefined,
          }
        );

        if (!updated) {
          res
            .status(404)
            .json({ error: 'Profile not found in Cloud SQL team tables' });
          return;
        }

        res.status(200).json({
          ...updated,
          phone: updated.phone_number,
          role: updated.role,
        });
        return;
      }

      // Client self-update no longer uses Supabase public.users (table removed).
      res.status(400).json({
        error:
          'This account type cannot be updated via /users/update. Use the client portal profile endpoints or team admin tools.',
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to update user';
      res.status(400).json({ error: message });
    }
  }

  async addTeamMember(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { firstname, lastname, email, role, phone_number } = req.body;

      if (!firstname || !lastname || !email || !role) {
        res.status(400).json({ error: 'Missing required fields' });
        return;
      }

      const normalizedRole = String(role).toLowerCase();
      if (normalizedRole !== 'doula' && normalizedRole !== 'admin') {
        res
          .status(400)
          .json({ error: 'Role must be either "admin" or "doula"' });
        return;
      }

      const newMember = await this.cloudSqlTeamService.addTeamMember({
        firstname: String(firstname).trim(),
        lastname: String(lastname).trim(),
        email: String(email).trim(),
        role: normalizedRole as 'admin' | 'doula',
        phone_number: typeof phone_number === 'string' ? phone_number : null,
      });
      res.status(201).json(newMember);
    } catch (error) {
      const message = (error as Error)?.message || 'Failed to add team member';
      const lower = message.toLowerCase();
      if (
        lower.includes('already') ||
        lower.includes('exists') ||
        lower.includes('duplicate')
      ) {
        res.status(409).json({ error: message });
        return;
      }
      res.status(500).json({ error: message });
    }
  }

  async updateTeamMember(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.params.id;
      const updateData = req.body;

      // When setting account_status to 'approved' for a doula, enforce document completeness
      const newStatus = updateData.account_status?.trim?.();
      if (newStatus === 'approved' && this.documentCompletenessService) {
        const member = await this.cloudSqlTeamService.getTeamMemberById(userId);
        if (member && member.role === 'doula') {
          const completeness =
            await this.documentCompletenessService.getCompleteness(userId);
          if (!completeness.canBeActive) {
            const missing = completeness.missingTypes.join(', ');
            const notApproved = completeness.items
              .filter((i) => i.status !== 'approved')
              .map((i) => i.documentType)
              .join(', ');
            const msg = notApproved
              ? `Cannot activate doula: required documents not all approved. Pending: ${notApproved}`
              : `Cannot activate doula: missing required documents. Missing: ${missing}`;
            res.status(400).json({ error: msg });
            return;
          }
        }
      }

      const updatedMember = await this.cloudSqlTeamService.updateTeamMember(
        userId,
        updateData
      );
      if (!updatedMember) {
        res.status(404).json({ error: 'Team member not found' });
        return;
      }
      res.status(200).json(updatedMember);
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
