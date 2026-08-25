import * as crypto from 'crypto';
import { Response } from 'express';

import { logger } from '../common/utils/logger';
import {
  ASSIGNMENT_SERVICE_CATALOG,
  normalizeAssignmentServices,
} from '../constants/assignmentServices';
import { ClientRepository } from '../repositories/interface/clientRepository';
import { UserRepository } from '../repositories/interface/userRepository';
import { SupabaseAssignmentRepository } from '../repositories/supabaseAssignmentRepository';
import {
  CloudSqlDoulaAssignmentService,
  normalizeDoulaAssignmentRole,
} from '../services/cloudSqlDoulaAssignmentService';
import { CloudSqlTeamService } from '../services/cloudSqlTeamService';
import { AuthRequest } from '../types';
import { ACCOUNT_STATUS, CLIENT_STATUS, ROLE } from '../types';
import { EmailController } from './emailController';

export class AdminController {
  private emailController: EmailController;
  private userRepository: UserRepository;
  private clientRepository: ClientRepository;
  private assignmentRepository: SupabaseAssignmentRepository;
  private cloudSqlAssignmentService: CloudSqlDoulaAssignmentService;
  private cloudSqlTeamService = new CloudSqlTeamService();

  constructor(
    userRepository: UserRepository,
    clientRepository: ClientRepository,
    assignmentRepository: SupabaseAssignmentRepository
  ) {
    this.emailController = new EmailController();
    this.userRepository = userRepository;
    this.clientRepository = clientRepository;
    this.assignmentRepository = assignmentRepository;
    this.cloudSqlAssignmentService = new CloudSqlDoulaAssignmentService();
  }

  /**
   * Invite a doula to join the platform
   * POST /api/admin/doulas/invite
   */
  async inviteDoula(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { email, firstname, lastname } = req.body;

      if (!email || !firstname || !lastname) {
        res.status(400).json({
          success: false,
          error: 'email, firstname, and lastname are required',
        });
        return;
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        res.status(400).json({
          success: false,
          error: 'Invalid email format',
        });
        return;
      }

      const normalizedEmail = String(email).trim().toLowerCase();
      const team = await this.cloudSqlTeamService.listTeamMembers();
      const existing = team.find(
        (m) => m.email.toLowerCase() === normalizedEmail
      );

      if (existing && existing.role !== 'doula') {
        res.status(400).json({
          success: false,
          error: 'A non-doula team member with this email already exists',
        });
        return;
      }

      if (!existing) {
        try {
          await this.cloudSqlTeamService.addTeamMember({
            firstname: String(firstname).trim(),
            lastname: String(lastname).trim(),
            email: normalizedEmail,
            role: 'doula',
          });
        } catch (error: any) {
          const message = error?.message || 'Failed to create doula';
          const lower = message.toLowerCase();
          if (
            !(
              lower.includes('already') ||
              lower.includes('exists') ||
              lower.includes('duplicate')
            )
          ) {
            res.status(500).json({
              success: false,
              error: message,
            });
            return;
          }
        }
      }

      // Generate invite token (optional, for tracking)
      const inviteToken = crypto.randomBytes(32).toString('hex');

      // Send invitation email
      await this.emailController.sendDoulaInvite(
        email,
        firstname,
        lastname,
        inviteToken
      );

      res.status(200).json({
        success: true,
        message: `Invitation email sent to ${email}`,
      });
    } catch (error: any) {
      console.error('inviteDoula error:', error);
      res.status(500).json({
        success: false,
        error: error?.message || 'Failed to invite doula',
      });
    }
  }

  /**
   * Match a doula with a client (only clients in 'matching' phase)
   * POST /api/admin/assignments/match
   */
  async matchDoulaWithClient(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { clientId, doulaId, notes, role, services } = req.body;

      // Validate required fields
      if (!clientId || !doulaId) {
        res.status(400).json({
          success: false,
          error: 'Missing required fields: clientId and doulaId are required',
        });
        return;
      }

      const normalizedRole =
        role === undefined ? undefined : normalizeDoulaAssignmentRole(role);
      if (role !== undefined && !normalizedRole) {
        res.status(400).json({
          success: false,
          error: "Invalid role. Allowed values are 'primary' or 'backup'",
        });
        return;
      }

      const normalizedServices = normalizeAssignmentServices(services);
      if (!normalizedServices) {
        res.status(400).json({
          success: false,
          error: `services is required and must include one or more values from: ${ASSIGNMENT_SERVICE_CATALOG.join(', ')}`,
        });
        return;
      }

      // Verify client exists and get their status
      const client = await this.clientRepository.findById(clientId);
      if (!client) {
        res.status(404).json({
          success: false,
          error: 'Client not found',
        });
        return;
      }

      // Verify client is in 'matching' phase
      if (client.status !== CLIENT_STATUS.MATCHING) {
        res.status(400).json({
          success: false,
          error: `Client is not in matching phase. Current status: ${client.status}. Only clients with status 'matching' can be assigned to doulas.`,
        });
        return;
      }

      // Verify doula exists in Cloud SQL doulas table
      const doula = await this.cloudSqlAssignmentService.getDoulaById(doulaId);
      if (!doula) {
        res.status(404).json({
          success: false,
          error: 'Doula not found',
        });
        return;
      }

      // Check if assignment already exists
      const alreadyAssigned =
        await this.cloudSqlAssignmentService.assignmentExists(
          clientId,
          doulaId
        );

      if (alreadyAssigned) {
        res.status(400).json({
          success: false,
          error: 'This doula is already assigned to this client',
        });
        return;
      }

      // Create the assignment in Cloud SQL
      const adminId = req.user?.id;
      const assignment = await this.cloudSqlAssignmentService.assignDoula(
        clientId,
        doulaId,
        adminId,
        typeof notes === 'string' ? notes : undefined,
        normalizedRole,
        normalizedServices
      );

      // Send email notifications to doula and client
      try {
        // Helper function to get full name from user, checking multiple name fields
        const getUserFullName = (user: any): string => {
          if (user.fullName) return user.fullName;
          if (user.full_name) return user.full_name;
          // Try firstname/lastname first
          const name1 = `${user.firstname || ''} ${user.lastname || ''}`.trim();
          if (name1) return name1;

          // Try first_name/last_name as fallback
          const name2 =
            `${user.first_name || ''} ${user.last_name || ''}`.trim();
          if (name2) return name2;

          // Try preferred_name if available
          if (user.preferred_name) return user.preferred_name;

          // Last resort: return email or generic
          return user.email || 'Client';
        };

        const doulaName = getUserFullName(doula);
        const clientName = getUserFullName(client.user);

        // HIPAA-05: doula assignment mail = client_number + CRM link only (no PHI body)
        await this.emailController.sendDoulaMatchNotification(
          doula.email || '',
          {
            clientNumber: client.clientNumber,
            clientId,
          }
        );

        // Send email to client
        await this.emailController.sendClientMatchNotification(
          client.user.email,
          clientName,
          doulaName,
          doula.email || ''
        );

        logger.info(
          {
            service: 'admin',
            operation: 'match_notification_sent',
            clientId,
            doulaId,
          },
          'Sent match notification emails'
        );
      } catch (emailError) {
        logger.error(
          {
            service: 'admin',
            operation: 'match_notification_send_failed',
            clientId,
            doulaId,
            err: emailError instanceof Error ? emailError.message : 'unknown',
          },
          'Failed to send match notification emails'
        );
        // Don't fail the request if email fails
      }

      console.log(
        `✅ Admin ${adminId} matched doula ${doulaId} with client ${clientId}`
      );

      res.status(201).json({
        success: true,
        message: 'Doula successfully matched with client',
        data: {
          assignment: {
            id: assignment.id,
            clientId: assignment.clientId,
            doulaId: assignment.doulaId,
            services: assignment.services,
            assignedAt: assignment.assignedAt,
            assignedBy: assignment.assignedBy,
            notes: notes || assignment.notes,
            role: assignment.role,
            status: assignment.status,
          },
          client: {
            id: client.id,
            name: `${client.user.firstname} ${client.user.lastname}`,
            status: client.status,
          },
          doula: {
            id: doula.id,
            name: doula.fullName,
            email: doula.email,
          },
        },
      });
    } catch (error: any) {
      console.error('Error matching doula with client:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to match doula with client',
      });
    }
  }

  /**
   * Get all clients in matching phase
   * GET /api/admin/clients/matching
   */
  async getMatchingClients(req: AuthRequest, res: Response): Promise<void> {
    try {
      const clients = await this.clientRepository.findClientsByStatus(
        CLIENT_STATUS.MATCHING
      );

      res.status(200).json({
        success: true,
        count: clients.length,
        data: clients.map((client) => ({
          id: client.id,
          firstname: client.user.firstname || '',
          lastname: client.user.lastname || '',
          email: client.user.email || '',
          phone: client.phoneNumber || client.user.phone_number || '',
          dueDate: client.due_date
            ? client.due_date instanceof Date
              ? client.due_date.toISOString().split('T')[0]
              : client.due_date
            : '',
          status: client.status,
          address: client.user.address || '',
          city: client.user.city || '',
          state: client.user.state || '',
          zipCode: client.user.zip_code || '',
          healthHistory: client.health_history || '',
          allergies: client.allergies || '',
          hospital: client.hospital || '',
          serviceNeeded: client.serviceNeeded || '',
          // Additional useful fields
          phoneNumber: client.phoneNumber || client.user.phone_number || '',
          pronouns: client.pronouns || client.user.pronouns || '',
          annualIncome: client.annual_income || '',
          serviceSpecifics: client.service_specifics || '',
          childrenExpected: client.childrenExpected || '',
          // Include full user object for detailed views
          user: client.user,
        })),
      });
    } catch (error: any) {
      console.error('Error fetching matching clients:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch matching clients',
      });
    }
  }

  private handleError(error: any, res: Response): void {
    console.error('AdminController error:', error);
    const status = error.status || 500;
    const message = error.message || 'Internal server error';
    res.status(status).json({ error: message });
  }
}
