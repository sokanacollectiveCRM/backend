import { Request, Response } from "express";
import { RequestApprovalService } from "../services/RequestApprovalService";
import { RequestFormRepository } from "../repositories/RequestFormRepository";

export class RequestApprovalController {
  private service: RequestApprovalService;
  private repository: RequestFormRepository;

  constructor() {
    this.service = new RequestApprovalService();
    this.repository = new RequestFormRepository();
  }

  async approveRequest(req: Request, res: Response) {
    try {
      const { requestId } = req.params;
      const signupBaseUrl = process.env.FRONTEND_URL + '/signup';
      
      await this.service.approveRequest(parseInt(requestId, 10), signupBaseUrl);
      
      res.status(200).json({ 
        success: true, 
        message: "Request approved and email sent" 
      });
    } catch (error) {
      console.error("Error approving request:", error);
      res.status(500).json({ error: error.message });
    }
  }

  async getPendingRequests(req: Request, res: Response) {
    try {
      const requests = await this.repository.getAllPendingRequests();
      res.status(200).json(requests);
    } catch (error) {
      console.error("Error fetching pending requests:", error);
      res.status(500).json({ error: error.message });
    }
  }
}