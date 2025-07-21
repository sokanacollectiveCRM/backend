'use strict';
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
Object.defineProperty(exports, '__esModule', { value: true });
const express_1 = __importDefault(require('express'));
const index_1 = require('../index');
const requestRouter = express_1.default.Router();
// Updated endpoint to handle all 10-step form fields
requestRouter.post('/requestSubmission', (req, res) =>
  index_1.requestFormController.createForm(req, res)
);
exports.default = requestRouter;
