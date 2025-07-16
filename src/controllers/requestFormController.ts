import { Request, Response } from "express";
import { NodemailerService } from '../services/emailService';
import { RequestFormService } from "../services/RequestFormService";
import { AuthRequest, RequestFormData, RequestStatus } from "../types";

const notificationEmail = 'info@sokanacollective.com';
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
                message: "Request form submitted successfully",
                data: result
            });
        } catch (error) {
            console.error("Error creating request:", error);
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
                message: "User requests retrieved successfully",
                data: requests
            });
        } catch (error) {
            console.error("Error getting user requests:", error);
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
                message: "Request retrieved successfully",
                data: request
            });
        } catch (error) {
            console.error("Error getting request by ID:", error);
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
                message: "All requests retrieved successfully",
                data: requests
            });
        } catch (error) {
            console.error("Error getting all requests:", error);
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
                message: "Request retrieved successfully",
                data: request
            });
        } catch (error) {
            console.error("Error getting request by ID (admin):", error);
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
                    validStatuses: validStatuses
                });
                return;
            }

            const updatedRequest = await this.service.updateRequestStatus(id, status);
            res.status(200).json({
                message: "Request status updated successfully",
                data: updatedRequest
            });
        } catch (error) {
            console.error("Error updating request status:", error);
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
            const savedForm = await this.service.newForm(formData);

            // Send notification email
            try {
                const subject = 'New Lead Submitted via Request Form';
                const text = `A new lead has been submitted.\n\nName: ${savedForm.firstname} ${savedForm.lastname}\nEmail: ${savedForm.email}\nPhone: ${savedForm.phone_number}\nService Needed: ${savedForm.service_needed}\nCity/State: ${savedForm.city}, ${savedForm.state}\n\nLog into Sokana Collective for details.`;
                const html = `
                  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #4CAF50;">New Lead Submitted</h2>
                    <table style="width: 100%; border-collapse: collapse;">
                      <tr><td style="font-weight: bold; padding: 8px;">Name:</td><td style="padding: 8px;">${savedForm.firstname} ${savedForm.lastname}</td></tr>
                      <tr><td style="font-weight: bold; padding: 8px;">Email:</td><td style="padding: 8px;">${savedForm.email}</td></tr>
                      <tr><td style="font-weight: bold; padding: 8px;">Phone:</td><td style="padding: 8px;">${savedForm.phone_number}</td></tr>
                      <tr><td style="font-weight: bold; padding: 8px;">Service Needed:</td><td style="padding: 8px;">${savedForm.service_needed}</td></tr>
                      <tr><td style="font-weight: bold; padding: 8px;">City/State:</td><td style="padding: 8px;">${savedForm.city}, ${savedForm.state}</td></tr>
                    </table>
                    <p style="margin-top: 24px;">Log into <b>Sokana Collective</b> for details.</p>
                  </div>
                `;
                await emailService.sendEmail(notificationEmail, subject, text, html);
            } catch (emailError) {
                console.error('Failed to send notification email:', emailError);
                // Do not block form submission if email fails
            }

            res.status(200).json({ message: "Form data received, onto processing" });
        } catch (error) {
            console.error("Error processing form data:", error);
            res.status(400).json({ error: error.message });
        }
    }
}