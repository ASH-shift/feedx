import { Router, Request, Response } from 'express';
import { userClient } from '../grpc/clients';
import * as grpc from '@grpc/grpc-js';

const router = Router();

// POST /auth/register
router.post('/register', async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      res.status(400).json({
        success: false,
        error: 'username, email, and password are required',
      });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({
        success: false,
        error: 'password must be at least 6 characters long',
      });
      return;
    }

    const response = await userClient.register({ username, email, password }) as any;

    res.status(201).json({
      success: true,
      data: {
        id: response.id,
        username: response.username,
        email: response.email,
        token: response.token,
        created_at: response.created_at,
      },
    });
  } catch (error: any) {
    const grpcError = error as grpc.ServiceError;
    if (grpcError.code === grpc.status.ALREADY_EXISTS) {
      res.status(409).json({ success: false, error: grpcError.details || 'User already exists' });
    } else if (grpcError.code === grpc.status.INVALID_ARGUMENT) {
      res.status(400).json({ success: false, error: grpcError.details || 'Invalid input' });
    } else {
      console.error('[API Gateway] /auth/register error:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
});

// POST /auth/login
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({
        success: false,
        error: 'email and password are required',
      });
      return;
    }

    const response = await userClient.login({ email, password }) as any;

    res.status(200).json({
      success: true,
      data: {
        id: response.id,
        username: response.username,
        email: response.email,
        token: response.token,
      },
    });
  } catch (error: any) {
    const grpcError = error as grpc.ServiceError;
    if (grpcError.code === grpc.status.NOT_FOUND || grpcError.code === grpc.status.UNAUTHENTICATED) {
      res.status(401).json({ success: false, error: 'Invalid email or password' });
    } else if (grpcError.code === grpc.status.INVALID_ARGUMENT) {
      res.status(400).json({ success: false, error: grpcError.details || 'Invalid input' });
    } else {
      console.error('[API Gateway] /auth/login error:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
});

export default router;
