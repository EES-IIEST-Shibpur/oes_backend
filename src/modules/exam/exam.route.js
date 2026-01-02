import express from 'express';
import { addQuestionToExam, createExam, deleteExam, getExamById, publishExam } from './exam.controller';
import { requireAuth, requireEmailVerified } from '../../middlewares/auth.middleware';
import requireRole from '../../middlewares/role.middleware';

const router = express.Router();

router.use(requireAuth);
router.use(requireEmailVerified);
router.use(requireRole("ADMIN"));

router.post('/create', createExam);
router.post('/add-question/:examId', addQuestionToExam);
router.get('/:examId', getExamById);
router.get('/publish/:examId', publishExam);
router.delete('/:examId', deleteExam);

export default router;