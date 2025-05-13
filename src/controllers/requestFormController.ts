import { Request, Response } from "express";
import { RequestFormService } from "../services/RequestFormService";


export class RequestFormController{
    private service: RequestFormService;


    constructor(requestFormService: RequestFormService){
        this.service = requestFormService;
    }

    async createForm(req: Request, res: Response): Promise<void>{
        try {
            if (!req.body) {
              res.status(400).json({ error: 'No body found in request' });
              return;
            }
            const formData = req.body;
            await this.service.newForm(formData);
            res.status(200).json({ message: "Form data received, onto processing" });
          } catch (error) {
            console.error("Error processing form data:", error);
            res.status(400).json({ error: error.message });
          }
    }
}