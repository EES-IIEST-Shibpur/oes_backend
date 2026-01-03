import express from 'express';
import apiRoutes from './routes/index.js';
import sequelize from './config/db.js';
import './modules/association/index.js';
import "./cron/autoSubmitExamAttempts.cron.js";
import { verifyEmailTransporter } from './services/email.service.js';

const app = express();

app.use(express.json());
sequelize.sync();
verifyEmailTransporter();

app.use('/api', apiRoutes);

export default app;