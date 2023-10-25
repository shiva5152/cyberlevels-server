import express from 'express';
import { isAuthenticatedCandidate } from '../../middleware/auth';
import { getAllEmployer, signupEmployer, loginEmployer, getCurrEmployer } from '../../controller/userController/employer';

const employerRouter = express.Router();


employerRouter.post('/auth/signup', signupEmployer)
employerRouter.post('/auth/login', loginEmployer)
employerRouter.get('/auth/:id', getCurrEmployer)
employerRouter.get("/getAllEmployers", isAuthenticatedCandidate, getAllEmployer)

export default employerRouter;