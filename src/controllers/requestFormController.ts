import { Request, Response } from 'express';

import { logger } from '../common/utils/logger';
import {
  PUBLIC_INTAKE_SUCCESS_MESSAGE,
  buildAuthenticatedCrmClientUrl,
  buildIntakeStaffNotificationEmail,
  buildIntakeSubmitterConfirmationEmail,
} from '../features/intake';
import {
  evaluateIntakeSubmissionGuards,
  finalizeIntakeIdempotency,
  sendIntakeRateLimited,
  sendIntakeSoftDedupe,
} from '../features/intake/infrastructure/intakeAbuseProtection';
import { RequestFormService } from '../services/RequestFormService';
import { NodemailerService } from '../services/emailService';
import { AuthRequest, RequestFormData, RequestStatus } from '../types';

const notificationEmail = 'hello@sokanacollective.com';
const emailService = new NodemailerService();

export class RequestFormController {
  private service: RequestFormService;

  constructor(requestFormService: RequestFormService) {
    this.service = requestFormService;
  }

  async createRequest(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.body) {
        res.status(400).json({ error: 'No body found in request' });
        return;
      }

      if (!req.user?.id) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const formData: RequestFormData = req.body;
      const result = await this.service.createRequest(formData);

      res.status(201).json({
        message: 'Request form submitted successfully',
        data: result,
      });
    } catch (error) {
      console.error('Error creating request:', error);
      res.status(400).json({ error: error.message });
    }
  }

  async getUserRequests(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user?.id) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const requests = await this.service.getUserRequests(req.user.id);
      res.status(200).json({
        message: 'User requests retrieved successfully',
        data: requests,
      });
    } catch (error) {
      console.error('Error getting user requests:', error);
      res.status(500).json({ error: error.message });
    }
  }

  async getRequestById(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user?.id) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const { id } = req.params;
      if (!id) {
        res.status(400).json({ error: 'Request ID is required' });
        return;
      }

      const request = await this.service.getRequestById(id, req.user.id);
      if (!request) {
        res.status(404).json({ error: 'Request not found' });
        return;
      }

      res.status(200).json({
        message: 'Request retrieved successfully',
        data: request,
      });
    } catch (error) {
      console.error('Error getting request by ID:', error);
      res.status(500).json({ error: error.message });
    }
  }

  async getAllRequests(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user?.id) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      // Check if user is admin
      if (req.user.role !== 'admin') {
        res.status(403).json({ error: 'Admin access required' });
        return;
      }

      const requests = await this.service.getAllRequests();
      res.status(200).json({
        message: 'All requests retrieved successfully',
        data: requests,
      });
    } catch (error) {
      console.error('Error getting all requests:', error);
      res.status(500).json({ error: error.message });
    }
  }

  async getRequestByIdAdmin(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user?.id) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      // Check if user is admin
      if (req.user.role !== 'admin') {
        res.status(403).json({ error: 'Admin access required' });
        return;
      }

      const { id } = req.params;
      if (!id) {
        res.status(400).json({ error: 'Request ID is required' });
        return;
      }

      const request = await this.service.getRequestByIdAdmin(id);
      if (!request) {
        res.status(404).json({ error: 'Request not found' });
        return;
      }

      res.status(200).json({
        message: 'Request retrieved successfully',
        data: request,
      });
    } catch (error) {
      console.error('Error getting request by ID (admin):', error);
      res.status(500).json({ error: error.message });
    }
  }

  async updateRequestStatus(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user?.id) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      // Check if user is admin
      if (req.user.role !== 'admin') {
        res.status(403).json({ error: 'Admin access required' });
        return;
      }

      const { id } = req.params;
      const { status } = req.body;

      if (!id) {
        res.status(400).json({ error: 'Request ID is required' });
        return;
      }

      if (!status) {
        res.status(400).json({ error: 'Status is required' });
        return;
      }

      const validStatuses = Object.values(RequestStatus);
      if (!validStatuses.includes(status)) {
        res.status(400).json({
          error: 'Invalid status value',
          validStatuses: validStatuses,
        });
        return;
      }

      const updatedRequest = await this.service.updateRequestStatus(id, status);
      res.status(200).json({
        message: 'Request status updated successfully',
        data: updatedRequest,
      });
    } catch (error) {
      console.error('Error updating request status:', error);
      res.status(500).json({ error: error.message });
    }
  }

  // Updated method to handle all 10-step form fields
  async createForm(req: Request, res: Response): Promise<void> {
    try {
      if (!req.body) {
        res.status(400).json({ error: 'No body found in request' });
        return;
      }
      const formData = req.body;

      const guard = await evaluateIntakeSubmissionGuards(req, formData);
      if (guard.action === 'rate_limited') {
        sendIntakeRateLimited(res, guard.retryAfterSec);
        return;
      }
      if (guard.action === 'replay') {
        res.status(guard.status).json(guard.body);
        return;
      }
      if (guard.action === 'soft_dedupe') {
        sendIntakeSoftDedupe(res);
        return;
      }

      const savedForm = await this.service.newForm(formData);
      logger.info(
        { service: 'intake', operation: 'lead_saved' },
        'Public intake lead persisted'
      );
      // HIPAA-13F / INV-01: staff mail = client_number + CRM link only (no PHI body)
      const profileLink = buildAuthenticatedCrmClientUrl(
        process.env.FRONTEND_URL,
        savedForm.id
      );

      try {
        const staffMail = buildIntakeStaffNotificationEmail({
          clientNumber: savedForm.client_number,
          crmProfileUrl: profileLink,
        });
        await emailService.sendEmail(
          notificationEmail,
          staffMail.subject,
          staffMail.text,
          staffMail.html
        );
      } catch (emailError) {
        logger.warn(
          {
            service: 'intake',
            operation: 'staff_notification_email',
            errorCode:
              emailError instanceof Error ? emailError.name : 'EMAIL_FAILURE',
          },
          'Failed to send intake staff notification email'
        );
        // Do not block form submission if email fails
      }

      try {
        const confirmation = buildIntakeSubmitterConfirmationEmail();
        await emailService.sendEmail(
          savedForm.email,
          confirmation.subject,
          confirmation.text,
          confirmation.html
        );
      } catch {
        logger.warn(
          {
            service: 'intake',
            operation: 'submitter_confirmation_email',
            errorCode: 'EMAIL_FAILURE',
          },
          'Failed to send intake submitter confirmation email'
        );
        // Do not block form submission if confirmation email fails
      }

      res.status(200).json({ message: PUBLIC_INTAKE_SUCCESS_MESSAGE });
      await finalizeIntakeIdempotency(req, formData, 200, {
        message: PUBLIC_INTAKE_SUCCESS_MESSAGE,
      });
    } catch (error) {
      console.error('Error processing form data:', error);
      res.status(400).json({ error: error.message });
    }
  }
}
