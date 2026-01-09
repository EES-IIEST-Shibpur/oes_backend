import express from 'express';
import { createExam, deleteExam, getExamById, getExams, getLiveExams, getUpcomingExams, publishExam, updateDraftExamDetails, updateQuestionsToExam } from './exam.controller.js';
import { requireAuth, requireEmailVerified } from '../../middlewares/auth.middleware.js';
import requireRole from '../../middlewares/role.middleware.js';

const router = express.Router();

router.use(requireAuth);
router.use(requireEmailVerified);

router.get('/upcoming', getUpcomingExams);
router.get('/live', getLiveExams);

router.use(requireRole("ADMIN"));

router.post('/create', createExam);
router.get('/all', getExams);
router.post('/:examId/questions', updateQuestionsToExam);
router.get('/:examId', getExamById);
router.put('/:examId/', updateDraftExamDetails);
router.post('/:examId/publish', publishExam);
router.delete('/:examId', deleteExam);

export default router;