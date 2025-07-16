import express from 'express';
import routes from './routes';

const app = express();

app.use(express.json());
// Serve static files from the public directory
app.use('/public', express.static('public'));
app.use('/api', routes);

export default app;
