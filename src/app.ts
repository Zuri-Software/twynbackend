import express from 'express';
import cors from 'cors';
import routes from './routes';

const app = express();

// Enable CORS for iOS app
app.use(cors({
  origin: '*', // Allow all origins for testing (restrict this later for production)
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
// Serve static files from the public directory
app.use('/public', express.static('public'));
app.use('/api', routes);

export default app;
