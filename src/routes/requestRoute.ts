import express, { Router } from 'express';
import { requestFormController } from 'index';

const requestRouter: Router =  express.Router();

requestRouter.post('/requestSubmission', async (req, res) => {
	try {
		const result = await requestFormController.createForm(req, res);
		res.status(200).send(result);
	} catch (error) {
		res.status(500).send({ error: 'An error occurred while processing the request.' });
	}
});

export default requestRouter;
