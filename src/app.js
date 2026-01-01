import express from 'express';
import apiRoutes from './routes/index.js';
import sequelize from './config/db.js';
import './modules/association/index.js';

const app = express();

app.use(express.json());
sequelize.sync();

app.use('/api', apiRoutes);

export default app;